#!/usr/bin/env node
// Broker login — log a user into their moon using the moon's +code (held
// server-side), then hand the browser ONLY the moon's session cookie, so the
// user lands logged in WITHOUT ever seeing the code.
//
// Runs behind Caddy on each moon's subdomain via a /broker carve-out, so the
// Set-Cookie lands on the correct (subdomain) origin.
//
// Flow:  browser GET <moon>.host/broker
//   -> broker POSTs <host>/theseus/~<moon>/~/login  password=<+code>
//   -> keeps the urbauth-~<moon> cookie from the response
//   -> 303 redirect to the landing page with that cookie set
//
// Usage:
//   node deploy/broker.mjs --moons-file deploy/broker-moons.json
//   broker-moons.json:  { "~dozlet-disden-talhes": "rintus-laclen-dashes-linbes" }
// (later this map comes from the control-plane DB, not a flat file.)
import http from 'node:http';
import fs from 'node:fs';

const args = parseArgs(process.argv.slice(2));
const HOST_URL = trimSlash(args['host-url'] || process.env.URBIT_URL || 'http://localhost:80');
const PORT = Number(args.port || 8091);
const LANDING = args.landing || '/';           // where to drop the user (e.g. /apps/noltbook/)
const codes = loadCodes(args);

const [upstreamHost, upstreamPortStr] = HOST_URL.replace(/^https?:\/\//, '').split(':');
const upstreamPort = Number(upstreamPortStr || 80);

const server = http.createServer((req, res) => {
  const host = String(req.headers.host || '').split(':')[0];
  const u = new URL(req.url, `http://${host || 'localhost'}`);
  // moon from ?moon= or from the subdomain label (dozlet-disden-talhes.host -> dozlet-disden-talhes)
  const moon = stripSig(u.searchParams.get('moon') || host.split('.')[0] || '');
  const code = codes[`~${moon}`] || codes[moon];
  if (!moon || !code) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`broker: no config for moon "${moon}"`);
    return;
  }
  const landing = u.searchParams.get('landing') || LANDING;
  brokerLogin(moon, code)
    .then((cookie) => {
      if (!cookie) { res.writeHead(502); res.end('broker: moon login returned no session cookie'); return; }
      console.log(`[broker] ~${moon} session issued -> ${landing}`);
      res.writeHead(303, { 'set-cookie': cookie, location: landing });
      res.end();
    })
    .catch((e) => { console.error('[broker] error:', e.message); res.writeHead(502); res.end('broker error'); });
});
server.listen(PORT, () =>
  console.log(`[broker] :${PORT} upstream ${HOST_URL} landing ${LANDING} moons: ${Object.keys(codes).join(', ') || '(none)'}`));

// POST the moon's /~/login with its +code; return ONLY the moon's session cookie.
function brokerLogin(moon, code) {
  return new Promise((resolve, reject) => {
    const body = `password=${encodeURIComponent(code)}&redirect=/`;
    const r = http.request({
      host: upstreamHost, port: upstreamPort, method: 'POST',
      path: `/theseus/~${moon}/~/login`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(body),
        host: 'localhost',
      },
    }, (resp) => {
      resp.on('data', () => {});
      resp.on('end', () => {
        const setc = resp.headers['set-cookie'] || [];
        // keep only the moon's cookie -- never leak the host planet's session
        resolve(setc.find((c) => c.startsWith(`urbauth-~${moon}=`)) || null);
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

function loadCodes(a) {
  const out = {};
  if (a['moons-file']) {
    try { Object.assign(out, JSON.parse(fs.readFileSync(a['moons-file'], 'utf8'))); }
    catch (e) { console.error('[broker] cannot read moons-file:', e.message); }
  }
  if (a.moon && a.code) out[a.moon.startsWith('~') ? a.moon : `~${a.moon}`] = a.code;
  return out;
}
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]; if (!x.startsWith('--')) continue;
    const k = x.slice(2), n = argv[i + 1];
    if (!n || n.startsWith('--')) o[k] = 'true'; else { o[k] = n; i++; }
  }
  return o;
}
function trimSlash(s) { return String(s).replace(/\/+$/, ''); }
function stripSig(s) { return String(s).replace(/^~/, ''); }
