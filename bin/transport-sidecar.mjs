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
 * Usage:
 *   node bin/transport-sidecar.mjs \
 *     --code lidlut-tabwed-pillex-ridrup \
 *     --moon ~doznec-dozzod-dozzod \
 *     --peer ~zod=127.0.0.1:31337 \
 *     --bind 127.0.0.1:39999
 *
 * Defaults target the fake-galaxy loopback test (~zod at 127.0.0.1:31337).
 */

import fs from 'node:fs';
import path from 'node:path';
import dgram from 'node:dgram';
import http from 'node:http';

const args = parseArgs(process.argv.slice(2));
const ship = stripSig(args.ship || process.env.URBIT_SHIP || 'zod');
const url = trimSlash(args.url || process.env.URBIT_URL || 'http://localhost:8082');
const pier = args.pier || process.env.URBIT_PIER || '/Users/chris/Enviorment/urbit-dev/ships/zod';
const code = args.code || process.env.URBIT_CODE || readCode(pier);
const uid = `theseus-transport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ship -> {addr, port} routing table (default: fake-galaxy ~zod loopback)
const peers = new Map();
addPeer('~zod', '127.0.0.1:31337');
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

const [bindAddr, bindPortStr] = (args.bind || '127.0.0.1:39999').split(':');
const bindPort = Number(bindPortStr);

let eventId = 1;
let lastSeenId = 0;   // highest channel event id received
let lastAckedId = 0;  // highest we've acked back to Eyre
let cookie = args.cookie || process.env.URBIT_COOKIE || '';

if (!code && !cookie) fail('No Urbit code or cookie. Pass --code / --cookie.');
if (!cookie) cookie = await login(url, code);

// --- UDP socket: the moon's transport endpoint ---------------------------
const sock = dgram.createSocket('udp4');
sock.on('message', onUdp);
sock.on('error', (e) => console.error('[transport] udp error:', e));
await new Promise((res) => sock.bind(bindPort, bindAddr, res));
console.log(`[transport] udp bound ${bindAddr}:${bindPort}`);
console.log(`[transport] peers: ${[...peers].map(([w, a]) => `${w}->${a.addr}:${a.port}`).join(', ')}`);
console.log(`[transport] moons: ${[...moons].map((m) => `~${m}`).join(', ') || '(none)'}`);

// --- Eyre channel: watch outbound, poke inbound --------------------------
console.log(`[transport] host=~${ship} url=${url}, watching %theseus-pyre /ames/outbound`);
await channelPut([
  { id: nextId(), action: 'subscribe', ship, app: 'theseus-pyre', path: '/ames/outbound' },
]);
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

process.on('SIGINT', async () => {
  console.log('\n[transport] closing');
  clearInterval(ackTimer);
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
    if (!target) {                             // non-ship (raw address) lane: skip for now
      console.log('[transport] skip non-ship lane from', from);
      continue;
    }
    if (moons.has(target)) continue;           // internal virtual<->virtual, theseus routes it
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
      json: { 'ames-inbound': { who: `~${who}`, from: `~${from}`, blob: blobHex } },
    },
  ]);
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
// node's fetch/undici chokes on Eyre's chunked SSE ("Invalid character in
// chunk size"); the http module de-chunks transparently and is lenient.
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function httpRequest(method, urlStr, { headers = {}, body = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request(
      { method, hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, headers },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    if (body != null) req.write(body);
    req.end();
  });
}
async function login(baseUrl, password) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await httpRequest('POST', `${baseUrl}/~/login`, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password }).toString(),
      });
      const sc = res.headers['set-cookie'];
      if (sc && sc.length) return String(sc[0]).split(';')[0];
      console.error(`[transport] login ${attempt}: no cookie (HTTP ${res.status}), retry`);
    } catch (e) {
      console.error(`[transport] login ${attempt} failed: ${e.message}, retry`);
    }
    await sleep(2000);
  }
  fail('login failed after 6 attempts');
}
async function channelPut(commands) {
  const res = await httpRequest('PUT', `${url}/~/channel/${uid}`, {
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(commands),
  });
  if (res.status >= 300) console.error(`[transport] channel PUT HTTP ${res.status} ${res.body}`);
}
async function channelDelete() {
  try { await httpRequest('DELETE', `${url}/~/channel/${uid}`, { headers: { cookie } }); } catch {}
}
function readSse(endpoint, cookieHeader, onMessage) {
  const u = new URL(endpoint);
  let aborted = false;
  let curReq = null;
  const done = new Promise((resolve) => {
    const connect = () => {
      if (aborted) { resolve(); return; }
      curReq = http.get(
        { hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search,
          headers: { accept: 'text/event-stream', cookie: cookieHeader } },
        (res) => {
          if (res.statusCode !== 200) {
            console.error(`[transport] SSE HTTP ${res.statusCode}, reconnecting`);
            res.resume(); setTimeout(connect, 1500); return;
          }
          res.setEncoding('utf8');
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk;
            let split;
            while ((split = buffer.indexOf('\n\n')) >= 0) {
              const raw = buffer.slice(0, split);
              buffer = buffer.slice(split + 2);
              const data = raw.split('\n').filter((l) => l.startsWith('data:'))
                .map((l) => l.slice(5).trimStart()).join('\n');
              if (data) onMessage(data);
            }
          });
          res.on('end', () => {
            if (aborted) { resolve(); return; }
            console.error('[transport] SSE ended, reconnecting'); setTimeout(connect, 1500);
          });
          res.on('error', (e) => {
            if (aborted) return;
            console.error(`[transport] SSE error: ${e.message}, reconnecting`); setTimeout(connect, 1500);
          });
        },
      );
      curReq.on('error', (e) => {
        if (aborted) return;
        console.error(`[transport] SSE req error: ${e.message}, reconnecting`); setTimeout(connect, 1500);
      });
    };
    connect();
  });
  return { abort: () => { aborted = true; try { curReq && curReq.destroy(); } catch {} }, done };
}
function extractFact(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.response === 'diff' || msg.response === 'fact') return msg.json ?? msg.data ?? msg;
  if (msg.json && typeof msg.json === 'object') return msg.json;
  return null;
}
function nextId() { return eventId++; }
function fail(m) { console.error(`[transport] ${m}`); process.exit(1); }
