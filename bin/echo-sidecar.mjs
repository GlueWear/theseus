#!/usr/bin/env node
/*
 * Theseus Ames echo sidecar proof.
 *
 * This is intentionally not the real UDP bridge.  With `:theseus-pyre|ames-test`
 * it proves only the userspace transport loop; it does not claim the blob is a
 * valid Ames packet:
 *
 *   virtual moon Ames %send
 *   -> %theseus-pyre /ames/outbound fact
 *   -> this script
 *   -> %theseus %ames-test-inbound poke
 *   -> Theseus logs the inbound side of the bridge loop
 *
 * Usage:
 *   node bin/echo-sidecar.mjs
 *   node bin/echo-sidecar.mjs --url http://localhost:8082 --ship zod
 */

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const ship = stripSig(args.ship || process.env.URBIT_SHIP || 'zod');
const url = trimSlash(args.url || process.env.URBIT_URL || 'http://localhost:8082');
const pier = args.pier || process.env.URBIT_PIER || '/Users/chris/Enviorment/urbit-dev/ships/zod';
const code = args.code || process.env.URBIT_CODE || readCode(pier);
const uid = `theseus-echo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let eventId = 1;
let cookie = args.cookie || process.env.URBIT_COOKIE || '';

if (!code && !cookie) {
  fail('No Urbit code or cookie found. Pass --code, --cookie, URBIT_CODE, or URBIT_COOKIE.');
}

if (!cookie) {
  cookie = await login(url, code);
}

console.log(`[theseus-echo] ship=~${ship} url=${url}`);
console.log('[theseus-echo] watching %theseus-pyre /ames/outbound');

// Channel must exist before the SSE GET, or Eyre 404s. PUT the subscribe
// first (this creates the channel), then open the event stream.
await channelPut([
  {
    id: nextId(),
    action: 'subscribe',
    ship,
    app: 'theseus-pyre',
    path: '/ames/outbound',
  },
]);

const sse = readSse(`${url}/~/channel/${uid}`, cookie, handleChannelMessage);

process.on('SIGINT', async () => {
  console.log('\n[theseus-echo] closing');
  sse.abort();
  try {
    await channelDelete();
  } catch {
    // best effort
  }
  process.exit(0);
});

await sse.done;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function trimSlash(s) {
  return String(s).replace(/\/+$/, '');
}

function stripSig(s) {
  return String(s).replace(/^~/, '');
}

function readCode(pierPath) {
  try {
    return fs.readFileSync(path.join(pierPath, '.urb', 'code'), 'utf8').trim();
  } catch {
    return '';
  }
}

async function login(baseUrl, password) {
  const body = new URLSearchParams({ password });
  const res = await fetch(`${baseUrl}/~/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    fail(`Login did not return a cookie. HTTP ${res.status}`);
  }
  return setCookie.split(';')[0];
}

async function channelPut(commands) {
  const res = await fetch(`${url}/~/channel/${uid}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`Channel PUT failed: HTTP ${res.status} ${text}`);
  }
}

async function channelDelete() {
  await fetch(`${url}/~/channel/${uid}`, {
    method: 'DELETE',
    headers: { cookie },
  });
}

function readSse(endpoint, cookieHeader, onMessage) {
  const controller = new AbortController();
  const done = (async () => {
    const res = await fetch(endpoint, {
      headers: {
        accept: 'text/event-stream',
        cookie: cookieHeader,
      },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      fail(`SSE connection failed: HTTP ${res.status}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let split;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const data = raw
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) onMessage(data);
      }
    }
  })().catch((err) => {
    if (err.name !== 'AbortError') throw err;
  });

  return {
    abort: () => controller.abort(),
    done,
  };
}

function handleChannelMessage(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.log('[theseus-echo] non-json channel event:', raw);
    return;
  }

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  for (const msg of messages) {
    if (msg && msg.response === 'poke') {
      if (msg.err) console.error('[theseus-echo] POKE NACK:', msg.err);
      else console.log('[theseus-echo] poke ack ok', msg.id ?? '');
      continue;
    }
    const fact = extractFact(msg);
    if (!fact) continue;

    const outbound = extractOutbound(fact);
    if (!outbound) continue;

    const from = outbound.ship;
    const to = outbound['lane-ship'];
    const blob = outbound.blob;

    if (!from || !to || !blob) {
      console.log('[theseus-echo] outbound missing fields:', outbound);
      continue;
    }

    console.log(`[theseus-echo] ~${stripSig(from)} -> ${to} ${blob.length} chars`);
    pokeInbound(stripSig(to), stripSig(from), blob).catch((err) => {
      console.error('[theseus-echo] inbound poke failed:', err);
    });
  }
}

function extractFact(msg) {
  if (!msg || typeof msg !== 'object') return null;

  if (msg.response === 'diff' || msg.response === 'fact') {
    return msg.json ?? msg.data ?? msg;
  }

  if (msg.json && typeof msg.json === 'object') {
    return msg.json;
  }

  return null;
}

function extractOutbound(fact) {
  if (!fact || typeof fact !== 'object') return null;

  if (fact.ship && fact.blob) return fact;
  if (fact['ames-outbound']) return fact['ames-outbound'];
  if (fact.update?.ship && fact.update?.blob) return fact.update;

  return null;
}

async function pokeInbound(who, from, blob) {
  await channelPut([
    {
      id: nextId(),
      action: 'poke',
      ship,
      app: 'theseus',
      mark: 'theseus-ames-in',
      json: {
        'ames-test-inbound': {
          who: `~${who}`,
          from: `~${from}`,
          blob,
        },
      },
    },
  ]);
}

function nextId() {
  return eventId++;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(`[theseus-echo] ${message}`);
  process.exit(1);
}
