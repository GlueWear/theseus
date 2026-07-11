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

// virtual moons we serve (filters internal packets; inbound target)
const moons = new Set(asList(args.moon).map(stripSig));

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

let eventId = 1;
let lastSeenId = 0;   // highest channel event id received
let lastAckedId = 0;  // highest we've acked back to Eyre
let cookie = args.cookie || process.env.URBIT_COOKIE || '';

if (!code && !cookie) fail('No Urbit code or cookie. Pass --code / --cookie.');
if (!cookie) cookie = await login(url, code);

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
async function sendToGalaxy(name, gnum, bytes, from) {
  const host = `${name}.${turf}`;
  const port = czarBase + gnum;
  const addr = await resolveHost(host);
  if (!addr) { console.log(`[transport] DNS fail ${host}, drop`); return; }
  sock.send(bytes, port, addr, (e) => { if (e) console.error('[transport] galaxy send err:', e); });
  console.log(`[transport] OUT ~${from} -> ~${name} galaxy ${host}:${port} (${addr}) ${bytes.length}B`);
}

// --- UDP socket: the moon's transport endpoint ---------------------------
const sock = dgram.createSocket('udp4');
sock.on('message', onUdp);
sock.on('error', (e) => console.error('[transport] udp error:', e));
await new Promise((res) => sock.bind(bindPort, bindAddr, res));
console.log(`[transport] udp bound ${bindAddr}:${bindPort}`);
console.log(`[transport] galaxies via DNS: *.${turf} port ${czarBase}+n${args.fake ? ' (fakenet)' : ''}`);
console.log(`[transport] peers: ${[...peers].map(([w, a]) => `${w}->${a.addr}:${a.port}`).join(', ') || '(none)'}`);
console.log(`[transport] moons: ${[...moons].map((m) => `~${m}`).join(', ') || '(none)'}`);

// --- Eyre channel: watch outbound, poke inbound --------------------------
console.log(`[transport] host=~${ship} url=${url}, watching %theseus-pyre /ames/outbound`);
await channelPut([
  { id: nextId(), action: 'subscribe', ship, app: 'theseus-pyre', path: '/ames/outbound' },
]);
// --- health heartbeat -----------------------------------------------------
// Touch a file whenever we prove we're actually alive AND our Eyre channel
// works. An external watchdog restarts us if this goes stale, catching a
// WEDGE (process alive but channel dead) -- crashes are already caught by the
// supervisor's restart loop.
const heartbeatFile = args.heartbeat || process.env.SIDECAR_HEARTBEAT || '';
function beat() {
  if (!heartbeatFile) return;
  try { fs.writeFileSync(heartbeatFile, String(Date.now())); } catch {}
}
beat();  // startup

const sse = readSse(`${url}/~/channel/${uid}`, cookie, onChannel);

// Ack received events so Eyre releases its buffer (otherwise it clogs under
// bursty inbound, e.g. a Clay OTA). Cheap periodic ack of the high-water id.
const ackTimer = setInterval(() => {
  if (lastSeenId <= lastAckedId) return;
  const id = lastSeenId;
  channelPut([{ id: nextId(), action: 'ack', 'event-id': id }])
    .then(() => { lastAckedId = id; })
    .catch(() => {});
}, 500);

// Keepalive: periodically re-assert the channel (HTTP + cookie) is alive and
// refresh the heartbeat. If this stops succeeding, the heartbeat goes stale
// and the watchdog restarts us. (Idempotent ack; harmless if nothing new.)
const beatTimer = setInterval(() => {
  const p = lastSeenId > 0
    ? channelPut([{ id: nextId(), action: 'ack', 'event-id': lastSeenId }])
    : Promise.resolve();
  p.then(beat).catch((e) => console.error('[transport] heartbeat channel check failed:', e.message));
}, 20_000);

process.on('SIGINT', async () => {
  console.log('\n[transport] closing');
  clearInterval(ackTimer);
  clearInterval(beatTimer);
  sse.abort();
  try { sock.close(); } catch {}
  try { await channelDelete(); } catch {}
  process.exit(0);
});

await sse.done;

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
    const target = out['lane-ship'] ? stripSig(out['lane-ship']) : null;
    if (!target) {
      // direct-address lane [%.n p]: the moon learned a peer's real transport
      // address (from the origin disden stamps on forwarded replies) and wants
      // to send straight there, like a NAT-punched ship. Decode p -> ip:port.
      const la = decodeLane(out['lane-addr']);
      if (la) {
        const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
        sock.send(bytes, la.port, la.addr, (e) => { if (e) console.error('[transport] direct send err:', e); });
        console.log(`[transport] OUT ~${from} -> direct ${la.addr}:${la.port} ${bytes.length}B`);
        continue;
      }
      console.log(`[transport] skip non-ship lane from ${from} (addr=${out['lane-addr'] ?? 'none'})`);
      continue;
    }
    if (moons.has(target)) continue;           // internal virtual<->virtual, theseus routes it
    // galaxy destination: dial <name>.<turf>:(czarBase+num) directly over DNS,
    // like vere. The moon routes strangers via their galaxy (lane [%.y galaxy]);
    // this is the outbound leg the host planet won't relay, so we dial it here.
    const gnum = galaxyNum(target);
    if (gnum >= 0) {
      const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
      sendToGalaxy(target, gnum, bytes, from);
      continue;
    }
    // explicit route, else the gateway uplink (host planet forwards it)
    const peer = peers.get(`~${target}`) || (gatewayShip && peers.get(gatewayShip));
    if (!peer) { console.log(`[transport] no route for ~${target}, drop`); continue; }

    const bytes = atomHexToBufferLE(out.blob, Number(out['blob-len'] ?? 0));
    sock.send(bytes, peer.port, peer.addr, (e) => {
      if (e) console.error('[transport] send err:', e);
    });
    console.log(`[transport] OUT ~${from} -> ~${target} (${peer.addr}:${peer.port}) ${bytes.length}B`);
  }
}

// ---- inbound: UDP packet -> %ames-inbound poke --------------------------
function onUdp(buf, rinfo) {
  const from = peersByAddr.get(`${rinfo.address}:${rinfo.port}`) || firstPeerShip();
  const moon = pickMoon();
  if (!moon) { console.log('[transport] inbound but no moon configured, drop'); return; }
  const hex = bufferLEToAtomHex(buf);
  console.log(`[transport] IN  ${from} -> ~${moon} ${buf.length}B`);
  pokeInbound(moon, stripSig(from), hex).catch((e) => console.error('[transport] inbound poke fail:', e));
}

function pickMoon() {
  // TODO: parse rcvr @p from the Ames packet header for multi-moon.
  if (moons.size === 1) return [...moons][0];
  if (moons.size > 1) console.log('[transport] multiple moons; rcvr-parse not yet implemented, using first');
  return moons.size ? [...moons][0] : null;
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
