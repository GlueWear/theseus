#!/usr/bin/env node
/*
 * Theseus Ames transport sidecar.
 *
 * The real bridge (echo-sidecar was a userspace stand-in). It carries a
 * virtual moon's raw Ames packets onto/off the real network:
 *
 *   virtual moon %send
 *   -> %theseus-pyre /ames/outbound fact [who lane blob]
 *   -> this sidecar: UDP send the blob to the target ship's Ames port
 *   ...real ship replies to this sidecar's UDP socket...
 *   -> this sidecar: poke %theseus %ames-inbound [moon lane blob]
 *   -> virtual moon %hear
 *
 * The moon only ever uses SHIP lanes ([%.y target]); this sidecar is its
 * transport layer, mapping ship -> ip:port. That mirrors how vere resolves
 * lanes for a real ship.
 *
 * Galaxies (stranger destinations) are dialed directly over DNS like vere:
 * <galaxy>.<turf> on port (czarBase + galaxy-number). No hardcoded galaxy IPs.
 * The host planet only handles the inbound return leg (--gateway).
 *
 * Usage (live mainnet):
 *   node bin/transport-sidecar.mjs \
 *     --url http://localhost:80 --ship disden-talhes \
 *     --moon ~dozlet-disden-talhes \
 *     --gateway disden-talhes=127.0.0.1:57284 \
 *     --bind 0.0.0.0:39999
 *
 * Flags:
 *   --turf <domain>      galaxy DNS suffix (default urbit.org)
 *   --czar-base <port>   galaxy port base (live 13337, fake 31337)
 *   --fake               fakenet: base 31337 + seed ~zod=127.0.0.1:31337
 *   --peer ~s=ip:port    extra static route (non-galaxy)
 */

import fs from 'node:fs';
import path from 'node:path';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Atom, Cell, jam, cue_bytes, isCell } from '@urbit/nockjs';

const args = parseArgs(process.argv.slice(2));
const ship = stripSig(args.ship || process.env.URBIT_SHIP || 'zod');
const url = trimSlash(args.url || process.env.URBIT_URL || 'http://localhost:8082');
const pier = args.pier || process.env.URBIT_PIER || '/Users/chris/Enviorment/urbit-dev/ships/zod';
const code = args.code || process.env.URBIT_CODE || readCode(pier);
const uid = `theseus-transport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ship -> {addr, port} routing table for non-galaxy peers (gateway, moons).
// Galaxies are NOT listed here -- they're resolved live via DNS (sendToGalaxy),
// exactly like vere. No hardcoded galaxy IPs.
const peers = new Map();
// fakenet loopback default only under --fake; live routes galaxies via DNS.
if (args.fake) addPeer('~zod', '127.0.0.1:31337');
for (const p of asList(args.peer)) {
  const [who, hostport] = p.split('=');
  addPeer(who, hostport);
}
// gateway: catch-all uplink for any non-moon destination. On a real host this
// is the host planet's own Ames port; its real Ames forwards the moon's
// packets to the network (galaxy/remote) and forwards replies back.
//   --gateway ~marmun-marmex=127.0.0.1:57173
let gatewayShip = null;
if (args.gateway) {
  const [who, hostport] = String(args.gateway).split('=');
  addPeer(who, hostport);
  gatewayShip = who.startsWith('~') ? who : `~${who}`;
}
// reverse map "addr:port" -> ~ship, for inbound sender identification
const peersByAddr = new Map();
for (const [who, { addr, port }] of peers) peersByAddr.set(`${addr}:${port}`, who);

// virtual moons we serve, with their numeric @p for inbound rcvr-routing.
//   --moons-map <json> : { "~name-a": 123, "~name-b": 456 }   (name -> @ud)
const moonNums = loadMoonsMap(args);                   // { name(no ~): number }
const moons = new Set([...Object.keys(moonNums), ...asList(args.moon).map(stripSig)]);
const moonByNum = new Map();                            // bigint rcvr -> moon name
for (const [name, num] of Object.entries(moonNums)) moonByNum.set(BigInt(num), name);
const RANK_BYTES = [2, 4, 8, 16];                       // @p byte-rank sizes

// galaxy routing config (no hardcoded IPs): a galaxy destination is dialed at
// <galaxy>.<turf> on port (czarBase + galaxy-number).  czarBase is a network
// protocol constant (fake 31337, live 13337); turf is network config (default
// urbit.org).  Both overridable; confirm czarBase against disden's live traffic.
const turf = args.turf || process.env.URBIT_TURF || 'urbit.org';
const czarBase = Number(args['czar-base'] || (args.fake ? 31337 : 13337));

// Bind 0.0.0.0 (all interfaces) not loopback: galaxy replies arrive from the
// real internet, so the socket must be reachable there. NAT/firewall must allow
// the port for the direct-return path; otherwise replies come sponsor-routed.
const [bindAddr, bindPortStr] = (args.bind || '0.0.0.0:39999').split(':');
const bindPort = Number(bindPortStr);

// P2 lick transport: when set to theseus-pyre's /ames socket path, carry packets
// over lick instead of the Eyre channel. Unset -> Eyre (the fallback).
const lickSocket = args['lick-socket'] || '';
// connected lick socket -- declared here (before setupLickTransport runs) to
// avoid a temporal-dead-zone ReferenceError.
let lickConn = null;

let eventId = 1;
let lastSeenId = 0;   // highest channel event id received
let lastAckedId = 0;  // highest we've acked back to Eyre
let cookie = args.cookie || process.env.URBIT_COOKIE || '';

if (!lickSocket) {
  if (!code && !cookie) fail('No Urbit code or cookie. Pass --code / --cookie.');
  if (!cookie) cookie = await login(url, code);
}

// --- galaxy DNS routing (no hardcoded IPs) -------------------------------
// Declared here (before `await sse.done` below) so the const initializers run
// before the SSE callback can fire; otherwise galaxyNum hits GALAXIES in TDZ.
// dex suffix-syllable table from sys/hoon.hoon ++po: index = galaxy number
// (0-255). e.g. GALAXIES[143] === 'rus'  ->  ~rus.
const GALAXIES = (
  'zodnecbudwessevpersutletfulpensytdurwepserwylsun' +
  'rypsyxdyrnuphebpeglupdepdysputlughecryttyvsydnex' +
  'lunmeplutseppesdelsulpedtemledtulmetwenbynhexfeb' +
  'pyldulhetmevruttylwydtepbesdexsefwycburderneppur' +
  'rysrebdennutsubpetrulsynregtydsupsemwynrecmegnet' +
  'secmulnymtevwebsummutnyxrextebfushepbenmuswyxsym' +
  'selrucdecwexsyrwetdylmynmesdetbetbeltuxtugmyrpel' +
  'syptermebsetdutdegtexsurfeltudnuxruxrenwytnubmed' +
  'lytdusnebrumtynseglyxpunresredfunrevrefmectedrus' +
  'bexlebduxrynnumpyxrygryxfeptyrtustyclegnemfermer' +
  'tenlusnussyltecmexpubrymtucfyllepdebbermughuttun' +
  'bylsudpemdevlurdefbusbeprunmelpexdytbyttyplevmyl' +
  'wedducfurfexnulluclennerlexrupnedlecrydlydfenwel' +
  'nydhusrelrudneshesfetdesretdunlernyrsebhulryllud' +
  'remlysfynwerrycsugnysnyllyndyndemluxfedsedbecmun' +
  'lyrtesmudnytbyrsenwegfyrmurtelreptegpecnelnevfes'
).match(/.{3}/g);
// galaxy @p name -> number (0-255), or -1 if the name isn't a galaxy.
function galaxyNum(name) { return GALAXIES.indexOf(stripSig(name)); }

const dnsCache = new Map(); // host -> { addr, exp }
async function resolveHost(host) {
  const now = Date.now();
  const hit = dnsCache.get(host);
  if (hit && hit.exp > now) return hit.addr;
  try {
    const { address } = await dns.lookup(host, { family: 4 });
    dnsCache.set(host, { addr: address, exp: now + 60_000 });
    return address;
  } catch { return null; }
}
async function sendToGalaxy(udp, name, gnum, bytes, from) {
  const host = `${name}.${turf}`;
  const port = czarBase + gnum;
  const addr = await resolveHost(host);
  if (!addr) { console.log(`[transport] DNS fail ${host}, drop`); return; }
  udp.send(bytes, port, addr, (e) => { if (e) console.error('[transport] galaxy send err:', e); });
  console.log(`[transport] OUT ~${from} -> ~${name} galaxy ${host}:${port} (${addr}) ${bytes.length}B`);
}

// --- UDP sockets: one transport endpoint per virtual moon -----------------
// A Mesa %page response does not contain the requesting ship's identity;
// vere knows its recipient from the UDP socket that received it.  Sharing one
// socket between virtual moons therefore cannot be demultiplexed reliably.
// Give each moon its own socket, exactly as separate vere processes would.
// Ports are deterministic for a stable moons map: numeric @p ascending, from
// --bind's base port upward.
const udpRecords = [];
const udpByName = new Map();
const udpByNum = new Map();
const moonNames = [...moons].sort((a, b) => {
  const an = moonNums[a] == null ? null : BigInt(moonNums[a]);
  const bn = moonNums[b] == null ? null : BigInt(moonNums[b]);
  if (an == null && bn == null) return a.localeCompare(b);
  if (an == null) return 1;
  if (bn == null) return -1;
  return an < bn ? -1 : an > bn ? 1 : 0;
});
if (!moonNames.length) fail('No virtual moons configured. Pass --moons-map or --moon.');
for (let i = 0; i < moonNames.length; i += 1) {
  const name = moonNames[i];
  const num = moonNums[name] == null ? null : BigInt(moonNums[name]);
  const port = bindPort + i;
  const udp = dgram.createSocket('udp4');
  const rec = { name, num, port, udp };
  udp.on('message', (buf, rinfo) => onUdpForMoon(rec, buf, rinfo));
  udp.on('error', (e) => console.error(`[transport] udp ~${name} error:`, e));
  await new Promise((res) => udp.bind(port, bindAddr, res));
  udpRecords.push(rec);
  udpByName.set(name, rec);
  if (num != null) udpByNum.set(num, rec);
  console.log(`[transport] udp ~${name} bound ${bindAddr}:${port}`);
}
console.log(`[transport] galaxies via DNS: *.${turf} port ${czarBase}+n${args.fake ? ' (fakenet)' : ''}`);
console.log(`[transport] peers: ${[...peers].map(([w, a]) => `${w}->${a.addr}:${a.port}`).join(', ') || '(none)'}`);
console.log(`[transport] moons: ${[...moons].map((m) => `~${m}`).join(', ') || '(none)'}`);

// --- health heartbeat (both transports) ----------------------------------
// Touch a file when we prove we're alive AND our transport works, so the
// supervisor watchdog can restart us on a WEDGE (not just a crash).
const heartbeatFile = args.heartbeat || process.env.SIDECAR_HEARTBEAT || '';
function beat() { if (!heartbeatFile) return; try { fs.writeFileSync(heartbeatFile, String(Date.now())); } catch {} }
beat();  // startup

if (lickSocket) {
  // --- lick transport (P2): OUT = read %spit, IN = write %soak -----------
  await setupLickTransport(lickSocket);
} else {
  // --- Eyre channel (fallback): watch outbound, poke inbound -------------
  console.log(`[transport] host=~${ship} url=${url}, watching %theseus-pyre /ames/outbound`);
  await channelPut([
    { id: nextId(), action: 'subscribe', ship, app: 'theseus-pyre', path: '/ames/outbound' },
  ]);
  const sse = readSse(`${url}/~/channel/${uid}`, cookie, onChannel);
  // Ack received events so Eyre releases its buffer (else it clogs under burst).
  const ackTimer = setInterval(() => {
    if (lastSeenId <= lastAckedId) return;
    const id = lastSeenId;
    channelPut([{ id: nextId(), action: 'ack', 'event-id': id }])
      .then(() => { lastAckedId = id; }).catch(() => {});
  }, 500);
  // Keepalive: re-assert the channel is alive + refresh the heartbeat.
  const beatTimer = setInterval(() => {
    const p = lastSeenId > 0
      ? channelPut([{ id: nextId(), action: 'ack', 'event-id': lastSeenId }])
      : Promise.resolve();
    p.then(beat).catch((e) => console.error('[transport] heartbeat channel check failed:', e.message));
  }, 20_000);
  process.on('SIGINT', async () => {
    console.log('\n[transport] closing');
    clearInterval(ackTimer); clearInterval(beatTimer); sse.abort();
    for (const rec of udpRecords) { try { rec.udp.close(); } catch {} }
    try { await channelDelete(); } catch {}
    process.exit(0);
  });
  await sse.done;
}

// ---- outbound: /ames/outbound fact -> UDP send --------------------------
function onChannel(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return; }
  beat();  // real SSE data flowing = channel healthy
  for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
    // track channel event ids so we can ack; without acks Eyre clogs
    if (msg && typeof msg.id === 'number' && msg.id > lastSeenId) lastSeenId = msg.id;
    if (msg && msg.response === 'poke') {
      if (msg.err) console.error('[transport] POKE NACK:', msg.err);
      continue;
    }
    const fact = extractFact(msg);
    if (!fact) continue;
    const out = fact.ship && fact.blob ? fact : fact['ames-outbound'];
    if (!out || !out.blob) continue;

    const from = stripSig(out.ship);           // the virtual moon sending
    const rec = udpByName.get(from) || (udpRecords.length === 1 ? udpRecords[0] : null);
    if (!rec) { console.log(`[transport] no UDP endpoint for ~${from}, drop`); continue; }
    const target = out['lane-ship'] ? stripSig(out['lane-ship']) : null;
    if (!target) {
      // direct-address lane [%.n p]: the moon learned a peer's real transport
      // address (from the origin disden stamps on forwarded replies) and wants
      // to send straight there, like a NAT-punched ship. Decode p -> ip:port.
      const la = decodeLane(out['lane-addr']);
      if (la) {
        const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
        rec.udp.send(bytes, la.port, la.addr, (e) => { if (e) console.error('[transport] direct send err:', e); });
        console.log(`[transport] OUT ~${from} -> direct ${la.addr}:${la.port} ${bytes.length}B`);
        continue;
      }
      console.log(`[transport] skip non-ship lane from ${from} (addr=${out['lane-addr'] ?? 'none'})`);
      continue;
    }
    if (moons.has(target)) {
      const dest = udpByName.get(target);
      if (!dest) { console.log(`[transport] no local endpoint for ~${target}, drop`); continue; }
      rec.udp.send(bytes, dest.port, '127.0.0.1', (e) => {
        if (e) console.error('[transport] local moon send err:', e);
      });
      console.log(`[transport] LOCAL ~${from} -> ~${target} ${bytes.length}B`);
      continue;
    }
    // galaxy destination: dial <name>.<turf>:(czarBase+num) directly over DNS,
    // like vere. The moon routes strangers via their galaxy (lane [%.y galaxy]);
    // this is the outbound leg the host planet won't relay, so we dial it here.
    const gnum = galaxyNum(target);
    if (gnum >= 0) {
      const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
      sendToGalaxy(rec.udp, target, gnum, bytes, from);
      continue;
    }
    // explicit route, else the gateway uplink (host planet forwards it)
    const peer = peers.get(`~${target}`) || (gatewayShip && peers.get(gatewayShip));
    if (!peer) { console.log(`[transport] no route for ~${target}, drop`); continue; }

    const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
    rec.udp.send(bytes, peer.port, peer.addr, (e) => {
      if (e) console.error('[transport] send err:', e);
    });
    console.log(`[transport] OUT ~${from} -> ~${target} (${peer.addr}:${peer.port}) ${bytes.length}B`);
  }
}

// ---- inbound: UDP packet -> %ames-inbound poke --------------------------
function onUdpForMoon(rec, buf, rinfo) {
  if (lickSocket) { onUdpLick(rec, buf, rinfo); return; }
  onUdp(rec, buf, rinfo);
}

function onUdp(rec, buf, rinfo) {
  const isMesa = isMesaPact(buf);
  if (isMesa) {
    console.log(`[transport] inbound mesa for ~${rec.name} requires lick mode; drop`);
    return;
  }
  if (!legacyTargets(rec, buf)) return;
  const from = peersByAddr.get(`${rinfo.address}:${rinfo.port}`) || firstPeerShip();
  const hex = bufferLEToAtomHex(buf);
  console.log(`[transport] IN  ${from} -> ~${rec.name} ${buf.length}B udp=:${rec.port}`);
  pokeInbound(rec.name, stripSig(from), hex).catch((e) => console.error('[transport] inbound poke fail:', e));
}

// Legacy Ames shots carry a receiver @p, so retain the parser as a defensive
// cross-check against stale/cross-socket traffic. Mesa pacts are routed by the
// receiving UDP socket because %page responses do not encode their recipient.
function legacyTargets(rec, buf) {
  return legacyMatch(rec, buf) != null;
}

// Pick the same plain/relayed body layout for both receiver validation and
// sender attribution. The old Lick path stamped every legacy packet as coming
// from the host planet, so a real ~ten packet was applied to ~mignes' bone and
// crashed the moon with %dangling-bone.
function legacyMatch(rec, buf) {
  if (rec.num == null) return udpRecords.length === 1 ? { sndr: 0n } : null;
  const s = parseShot(buf);
  if (s && s.rcvr === rec.num) return s;
  return null;
}

function isMesaPact(buf) { return buf.length >= 8 && buf.readUInt32LE(4) === 0x67e00200; }

// --- Ames packet parse (for multi-moon inbound routing) ------------------
// Pull the sender/receiver and header metadata out of a legacy shot, exactly as
// 408 +sift-shot does.  In the serialized little-endian byte stream, a relayed
// shot's six-byte origin precedes the tick/sender/receiver fields.
function leToBig(b) { let n = 0n; for (let i = b.length - 1; i >= 0; i -= 1) n = (n << 8n) | BigInt(b[i]); return n; }
function parseShot(buf) {
  if (!buf || buf.length < 6) return null;
  const header = buf.readUInt32LE(0);
  const sndrSize = RANK_BYTES[((buf[0] >> 7) & 1) | ((buf[1] & 1) << 1)];
  const rcvrSize = RANK_BYTES[(buf[1] >> 1) & 3];
  const relayed = ((header >>> 31) & 1) === 0;
  const rawBody = buf.subarray(4);
  if (relayed && rawBody.length < 7) return null;
  const body = relayed ? rawBody.subarray(6) : rawBody;
  const req = ((header >>> 2) & 1) === 0;
  const sam = ((header >>> 3) & 1) === 0;
  const content = body.subarray(1 + sndrSize + rcvrSize);
  let fineNum = null;
  let finePath = null;
  if (req && !sam && content.length >= 7 && content[0] === 0) {
    const len = content.readUInt16LE(5);
    if (content.length >= 7 + len) {
      fineNum = content.readUInt32LE(1);
      finePath = content.subarray(7, 7 + len).toString('utf8');
    }
  }
  return {
    sndr: leToBig(body.subarray(1, 1 + sndrSize)),
    rcvr: leToBig(body.subarray(1 + sndrSize, 1 + sndrSize + rcvrSize)),
    req,
    sam,
    version: (header >>> 4) & 7,
    relayed,
    sndrTick: body[0] & 0x0f,
    rcvrTick: (body[0] >>> 4) & 0x0f,
    headerHex: buf.subarray(0, 5).toString('hex'),
    fineNum,
    finePath,
  };
}
function loadMoonsMap(a) {
  const out = {};
  if (a['moons-map']) {
    try {
      const raw = JSON.parse(fs.readFileSync(a['moons-map'], 'utf8'));
      for (const [k, v] of Object.entries(raw)) out[stripSig(k)] = v;
    } catch (e) { console.error('[transport] cannot read moons-map:', e.message); }
  }
  return out;
}

async function pokeInbound(who, from, blobHex) {
  await channelPut([
    {
      id: nextId(), action: 'poke', ship, app: 'theseus', mark: 'theseus-ames-in',
      // addr required by the ames-inbound dejs. 0x0 -> moon uses ship-lane
      // [%.y from], correct for sponsor-routed returns (reply via disden).
      // A raw galaxy/peer addr here would teach the moon a bogus direct lane.
      json: { 'ames-inbound': { who: `~${who}`, from: `~${from}`, addr: '0x0', blob: blobHex } },
    },
  ]);
}

// decode a direct-address lane atom p (from `scot %ux`, dot-grouped) into
// ip:port.  ames packs it as ip=low 32 bits (@if, big-endian octets), port=
// bits 32-47 (see ames.hoon: end [0 32] p / cut 0 [32 16] p).  Returns null
// for empty/zero/portless addresses (nothing sendable).
function decodeLane(scotHex) {
  if (!scotHex) return null;
  const clean = String(scotHex).replace(/^0x/i, '').replace(/\./g, '');
  if (!clean) return null;
  const p = BigInt('0x' + clean);
  const ip = Number(p & 0xffffffffn);
  const port = Number((p >> 32n) & 0xffffn);
  const a = (ip >>> 24) & 0xff, b = (ip >>> 16) & 0xff, c = (ip >>> 8) & 0xff, d = ip & 0xff;
  if (!port || (a === 0 && b === 0 && c === 0 && d === 0)) return null;
  return { addr: `${a}.${b}.${c}.${d}`, port };
}

// ---- blob <-> bytes (little-endian atom) --------------------------------
function atomHexToBufferLE(scotHex, len) {
  const clean = String(scotHex).replace(/^0x/i, '').replace(/\./g, '');
  let n = clean === '' ? 0n : BigInt('0x' + clean);
  const size = len > 0 ? len : Math.ceil(clean.length / 2);
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i += 1) { buf[i] = Number(n & 0xffn); n >>= 8n; }
  return buf;
}
function bufferLEToAtomHex(buf) {
  let n = 0n;
  for (let i = buf.length - 1; i >= 0; i -= 1) n = (n << 8n) | BigInt(buf[i]);
  // match `scot %ux`: dot-group hex into 4-digit chunks from the right
  let h = n.toString(16);
  if (h === '0') return '0x0';
  let out = '';
  while (h.length > 4) { out = '.' + h.slice(-4) + out; h = h.slice(0, -4); }
  return '0x' + h + out;
}

// ---- routing helpers ----------------------------------------------------
function addPeer(who, hostport) {
  if (!who || !hostport) return;
  const [addr, port] = hostport.split(':');
  peers.set(who.startsWith('~') ? who : `~${who}`, { addr, port: Number(port) });
}
function firstPeerShip() { const k = peers.keys().next().value; return k || '~zod'; }

// ---- lick transport (P2): native IPC over the /ames unix socket ---------
async function setupLickTransport(sockPath) {
  console.log(`[transport] lick mode -> ${sockPath}`);
  await new Promise((resolve) => {
    const c = net.connect(sockPath, () => { lickConn = c; beat(); console.log(`[transport] lick connected ${sockPath}`); resolve(); });
    let acc = Buffer.alloc(0);
    c.on('data', (chunk) => {
      beat();
      acc = Buffer.concat([acc, chunk]);
      while (acc.length >= 5) {                 // frame = [0x00][u32 LE len][jam]
        const len = acc.readUInt32LE(1);
        if (acc.length < 5 + len) break;
        onLickOut(acc.subarray(5, 5 + len));
        acc = acc.subarray(5 + len);
      }
    });
    c.on('error', (e) => console.error('[transport] lick socket error:', e.message));
    c.on('close', () => { lickConn = null; console.error('[transport] lick socket closed; exiting for supervisor restart'); process.exit(1); });
  });
  setInterval(() => { if (lickConn) beat(); }, 15_000);
  process.on('SIGINT', () => {
    for (const rec of udpRecords) { try { rec.udp.close(); } catch {} }
    try { lickConn && lickConn.end(); } catch {}
    process.exit(0);
  });
  await new Promise(() => {});   // keep the process alive on the socket
}

// outbound: a %spit'd [%ames-out [who lane blob]] (legacy Ames) or
// [%mesa-out [who lanes blob]] (408 Mesa) -> UDP send. Mesa supplies a list
// because Vere is expected to try every currently usable pact lane.
function onLickOut(payload) {
  let noun;
  try { noun = cue_bytes(new DataView(payload.buffer, payload.byteOffset, payload.byteLength)); }
  catch (e) { console.error('[transport] lick cue failed:', e.message); return; }
  if (!isCell(noun)) return;
  const mark = cordOf(atomBig(noun.head));
  if (mark === 'mesa-out') { onLickMesaOut(noun.tail); return; }
  if (mark !== 'ames-out') return;
  const who = atomBig(noun.tail.head);
  const lane = noun.tail.tail.head;
  const bytes = atomToLeBuf(atomBig(noun.tail.tail.tail));
  const from = moonByNum.get(who) || String(who);
  const rec = udpByNum.get(who) || (udpRecords.length === 1 ? udpRecords[0] : null);
  if (!rec) { console.log(`[transport] no UDP endpoint for ~${from}, drop`); return; }
  const tag = atomBig(lane.head);              // 0 = %.y ship, 1 = %.n addr
  const val = atomBig(lane.tail);
  if (tag === 1n) {                            // direct-address lane
    const la = decodeLaneBig(val);
    if (!la) return;
    rec.udp.send(bytes, la.port, la.addr, (e) => { if (e) console.error('[transport] direct send err:', e); });
    console.log(`[transport] OUT ~${from} -> direct ${la.addr}:${la.port} ${bytes.length}B`);
    return;
  }
  if (moonByNum.has(val)) {
    const dest = udpByNum.get(val);
    if (!dest) { console.log(`[transport] no local endpoint for ${val}, drop`); return; }
    rec.udp.send(bytes, dest.port, '127.0.0.1', (e) => {
      if (e) console.error('[transport] local moon send err:', e);
    });
    console.log(`[transport] LOCAL ~${from} -> ~${dest.name} ${bytes.length}B`);
    return;
  }
  const N = Number(val);
  if (N >= 0 && N < 256) { sendToGalaxy(rec.udp, GALAXIES[N], N, bytes, from); return; }
  const p = gatewayShip && peers.get(gatewayShip);   // non-galaxy ship -> gateway
  if (!p) { console.log(`[transport] OUT ~${from} no route (ship ${N}), drop`); return; }
  rec.udp.send(bytes, p.port, p.addr, (e) => { if (e) console.error('[transport] gw send err:', e); });
  console.log(`[transport] OUT ~${from} -> ~${stripSig(gatewayShip)} gateway ${bytes.length}B`);
}

function onLickMesaOut(noun) {
  if (!isCell(noun) || !isCell(noun.tail)) {
    console.log('[transport] malformed mesa-out noun; drop');
    return;
  }
  const who = atomBig(noun.head);
  const lanes = hoonList(noun.tail.head);
  const bytes = atomToLeBuf(atomBig(noun.tail.tail));
  const from = moonByNum.get(who) || String(who);
  const rec = udpByNum.get(who) || (udpRecords.length === 1 ? udpRecords[0] : null);
  if (!rec) { console.log(`[transport] no UDP endpoint for ~${from}, mesa drop`); return; }
  if (!lanes) { console.log(`[transport] malformed mesa lane list from ~${from}; drop`); return; }
  if (lanes.length === 0) { console.log(`[transport] OUT mesa ~${from} has no lanes; drop`); return; }
  for (const lane of lanes) sendMesaLane(rec, from, lane, bytes);
}

function sendMesaLane(rec, from, lane, bytes) {
  // An atom pact lane is a ship route (normally a sponsor or galaxy).
  if (!isCell(lane)) {
    const val = atomBig(lane);
    if (moonByNum.has(val)) {
      const dest = udpByNum.get(val);
      if (!dest) { console.log(`[transport] no local endpoint for mesa lane ${val}; drop`); return; }
      rec.udp.send(bytes, dest.port, '127.0.0.1', (e) => {
        if (e) console.error('[transport] local mesa send err:', e);
      });
      console.log(`[transport] OUT mesa ~${from} -> local ~${dest.name} ${bytes.length}B`);
      return;
    }
    const n = Number(val);
    if (n >= 0 && n < 256) {
      sendToGalaxy(rec.udp, GALAXIES[n], n, bytes, from);
      return;
    }
    const peer = gatewayShip && peers.get(gatewayShip);
    if (!peer) { console.log(`[transport] OUT mesa ~${from} no route for ship ${val}; drop`); return; }
    rec.udp.send(bytes, peer.port, peer.addr, (e) => {
      if (e) console.error('[transport] mesa gateway send err:', e);
    });
    console.log(`[transport] OUT mesa ~${from} -> ~${stripSig(gatewayShip)} gateway ${bytes.length}B`);
    return;
  }

  const tag = cordOf(atomBig(lane.head));
  if (!isCell(lane.tail)) { console.log(`[transport] malformed mesa %${tag} lane; drop`); return; }
  const address = atomBig(lane.tail.head);
  const port = Number(atomBig(lane.tail.tail));
  if (!port) { console.log(`[transport] mesa %${tag} lane has no port; drop`); return; }
  if (tag === 'if') {
    const addr = ipv4Text(address);
    rec.udp.send(bytes, port, addr, (e) => {
      if (e) console.error('[transport] mesa IPv4 send err:', e);
    });
    console.log(`[transport] OUT mesa ~${from} -> ${addr}:${port} ${bytes.length}B`);
    return;
  }
  // Existing Theseus UDP endpoints are IPv4. Preserve and identify an IPv6
  // lane rather than misrouting it; IPv6 sockets can be added independently.
  if (tag === 'is') {
    console.log(`[transport] OUT mesa ~${from} IPv6 lane unsupported; drop lane`);
    return;
  }
  console.log(`[transport] OUT mesa ~${from} unknown lane %${tag}; drop lane`);
}

function hoonList(noun) {
  const out = [];
  let cur = noun;
  while (isCell(cur)) { out.push(cur.head); cur = cur.tail; }
  return atomBig(cur) === 0n ? out : null;
}

function ipv4Text(ip) {
  const n = Number(ip & 0xffffffffn);
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

// inbound: classify the wire protocol, then inject through the matching 408
// Ames unix task.  Legacy shots use %hear with an opaque direct-address lane;
// Mesa pacts use %heer with a structured pact lane.  The pact serializer has a
// stable 32-bit magic at bytes 4..7 (see +head:de:pact in 408 %lull).
function onUdpLick(rec, buf, rinfo) {
  const isMesa = isMesaPact(buf);
  const legacy = isMesa ? null : legacyMatch(rec, buf);
  if (!isMesa && !legacy) return;
  if (rec.num == null) {
    console.log(`[transport] no numeric @p for ~${rec.name}; inbound drop`);
    return;
  }
  const who = rec.num;
  if (!lickConn) return;
  const A = (v) => Atom.fromInt(v);
  const ip = ipv4Big(rinfo.address);
  let noun;
  if (isMesa) {
    const lane = new Cell(Atom.fromCord('if'), new Cell(A(ip), A(BigInt(rinfo.port))));
    noun = new Cell(Atom.fromCord('mesa-in'),
             new Cell(A(who), new Cell(lane, A(leToBig(buf)))));
  } else {
    // Legacy Ames address = IPv4 in low 32 bits, UDP port in bits 32..47.
    const addr = ip | (BigInt(rinfo.port) << 32n);
    noun = new Cell(Atom.fromCord('ames-in'),
             new Cell(A(who), new Cell(A(legacy.sndr), new Cell(A(addr), A(leToBig(buf))))));
  }
  const jb = Buffer.from(jam(noun).bytes());
  const frame = Buffer.alloc(5 + jb.length);   // [0x00][u32 LE len][jam]
  frame.writeUInt32LE(jb.length, 1);
  jb.copy(frame, 5);
  lickConn.write(frame);
  if (isMesa) {
    console.log(`[transport] IN mesa -> ~${rec.name} ${buf.length}B udp=:${rec.port} lane=${rinfo.address}:${rinfo.port}`);
  } else {
    const fine = legacy.finePath == null ? '' : ` fine=${legacy.fineNum}:${legacy.finePath}`;
    console.log(`[transport] IN ames ${legacy.sndr}->${legacy.rcvr} req=${Number(legacy.req)} sam=${Number(legacy.sam)} relayed=${Number(legacy.relayed)} ticks=${legacy.sndrTick}/${legacy.rcvrTick} hdr=${legacy.headerHex}${fine} ${buf.length}B udp=:${rec.port} lane=${rinfo.address}:${rinfo.port}`);
  }
}

function atomBig(x) { for (const k of ['number', 'big', 'n', 'value']) if (typeof x[k] === 'bigint') return x[k]; const v = x.valueOf && x.valueOf(); return typeof v === 'bigint' ? v : 0n; }
function cordOf(bn) { let s = ''; while (bn > 0n) { s += String.fromCharCode(Number(bn & 0xffn)); bn >>= 8n; } return s; }
function atomToLeBuf(bn) { const b = []; while (bn > 0n) { b.push(Number(bn & 0xffn)); bn >>= 8n; } return Buffer.from(b); }
function ipv4Big(addr) { const p = String(addr).split('.').map((x) => Number(x)); return BigInt(((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]); }
function decodeLaneBig(val) {
  const ip = Number(val & 0xffffffffn), port = Number((val >> 32n) & 0xffffn);
  const a = (ip >>> 24) & 0xff, b = (ip >>> 16) & 0xff, c = (ip >>> 8) & 0xff, d = ip & 0xff;
  if (!port || (a === 0 && b === 0 && c === 0 && d === 0)) return null;
  return { addr: `${a}.${b}.${c}.${d}`, port };
}

// ---- Eyre channel plumbing ---------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { out[key] = 'true'; }
    else { out[key] = key in out ? [].concat(out[key], next) : next; i += 1; }
  }
  return out;
}
function asList(v) { return v == null ? [] : [].concat(v); }
function trimSlash(s) { return String(s).replace(/\/+$/, ''); }
function stripSig(s) { return String(s).replace(/^~/, ''); }
function readCode(p) {
  try { return fs.readFileSync(path.join(p, '.urb', 'code'), 'utf8').trim(); } catch { return ''; }
}
async function login(baseUrl, password) {
  const res = await fetch(`${baseUrl}/~/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }), redirect: 'manual',
  });
  const sc = res.headers.get('set-cookie');
  if (!sc) fail(`Login returned no cookie. HTTP ${res.status}`);
  return sc.split(';')[0];
}
async function channelPut(commands) {
  const res = await fetch(`${url}/~/channel/${uid}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(commands),
  });
  if (!res.ok) fail(`Channel PUT failed: HTTP ${res.status} ${await res.text().catch(() => '')}`);
}
async function channelDelete() {
  await fetch(`${url}/~/channel/${uid}`, { method: 'DELETE', headers: { cookie } });
}
function readSse(endpoint, cookieHeader, onMessage) {
  const controller = new AbortController();
  const done = (async () => {
    const res = await fetch(endpoint, {
      headers: { accept: 'text/event-stream', cookie: cookieHeader }, signal: controller.signal,
    });
    if (!res.ok || !res.body) fail(`SSE failed: HTTP ${res.status}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let split;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const data = raw.split('\n').filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart()).join('\n');
        if (data) onMessage(data);
      }
    }
  })().catch((err) => { if (err.name !== 'AbortError') throw err; });
  return { abort: () => controller.abort(), done };
}
function extractFact(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.response === 'diff' || msg.response === 'fact') return msg.json ?? msg.data ?? msg;
  if (msg.json && typeof msg.json === 'object') return msg.json;
  return null;
}
function nextId() { return eventId++; }
function fail(m) { console.error(`[transport] ${m}`); process.exit(1); }
