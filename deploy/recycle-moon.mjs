#!/usr/bin/env node
// Restore one virtual moon to a sealed clean snapshot, then return it to the
// broker pool.  The moon stays claimed while restore is in flight; failures
// leave it quarantined instead of assigning a partially recycled moon.

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const moon = normalizeShip(required('moon'));
const snapshot = normalizeSnapshot(required('snapshot'));
const execute = args.execute === 'true';
const force = args.force === 'true';
const hostUrl = trimSlash(args['host-url'] || process.env.URBIT_URL || 'http://localhost:8082');
const hostShip = stripSig(args['host-ship'] || process.env.URBIT_SHIP || 'mignes-magtel');
const hostPier = args['host-pier'] || process.env.URBIT_PIER ||
  '/Users/chris/Enviorment/urbit-dev/ships/mignes-magtel';
const assignmentsFile = path.resolve(args['assignments-file'] ||
  new URL('./broker-assignments.json', import.meta.url).pathname);
const moonsFile = path.resolve(args['moons-file'] ||
  new URL('./broker-moons.json', import.meta.url).pathname);
const timeoutMs = Number(args.timeout || 30_000);

const configured = readJson(moonsFile);
if (!Object.hasOwn(configured, moon)) fail(`${moon} is not present in ${moonsFile}`);
const initialAssignments = readJson(assignmentsFile);
if (!initialAssignments[moon] && !force) {
  fail(`${moon} is not currently assigned; pass --force to recycle a free moon`);
}

console.log(`[recycle] moon=${moon}`);
console.log(`[recycle] snapshot=${snapshot}`);
console.log(`[recycle] assignments=${assignmentsFile}`);
console.log('[recycle] Ames keys and broker login code will NOT be rotated.');
if (!execute) {
  console.log('[recycle] dry run only; add --execute to restore and release this moon.');
  process.exit(0);
}

// Any value in the assignment map is unavailable to /assign. Mark the moon as
// recycling before touching Theseus so a concurrent visitor cannot claim it.
mutateAssignments((state) => {
  state[moon] = {
    ...(state[moon] || {}),
    status: 'recycling',
    recycleStartedAt: new Date().toISOString(),
    snapshot,
  };
});

let cookie = '';
let uid = '';
try {
  const code = args.code || process.env.URBIT_CODE || readCode(hostPier);
  if (!code) throw new Error(`no host code found under ${hostPier}/.urb/code`);
  cookie = await login(hostUrl, code);
  uid = `theseus-recycle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const pokeId = 1;

  await channelPut(hostUrl, uid, cookie, [{
    id: pokeId,
    action: 'poke',
    ship: hostShip,
    app: 'theseus',
    mark: 'theseus-recycle',
    json: { who: moon, path: snapshot },
  }]);

  const ack = await waitForPoke(hostUrl, uid, cookie, pokeId, timeoutMs);
  if (ack.err) throw new Error(`restore poke rejected: ${formatError(ack.err)}`);

  // Re-read before deleting so assignments made for other moons while this
  // restore ran are preserved.
  mutateAssignments((state) => { delete state[moon]; });
  console.log(`[recycle] restored ${snapshot}`);
  console.log(`[recycle] released ${moon} back to the pool`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  mutateAssignments((state) => {
    state[moon] = {
      ...(state[moon] || {}),
      status: 'recycle-error',
      recycleFailedAt: new Date().toISOString(),
      error: message.slice(0, 500),
      snapshot,
    };
  });
  console.error(`[recycle] FAILED; ${moon} remains quarantined: ${message}`);
  process.exitCode = 1;
} finally {
  if (uid && cookie) await channelDelete(hostUrl, uid, cookie).catch(() => {});
}

function mutateAssignments(change) {
  const state = readJson(assignmentsFile);
  change(state);
  atomicWriteJson(assignmentsFile, state);
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function readJson(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('expected object');
    return value;
  } catch (error) {
    throw new Error(`cannot read ${file}: ${error.message}`);
  }
}

function readCode(pier) {
  try { return fs.readFileSync(path.join(pier, '.urb', 'code'), 'utf8').trim(); }
  catch { return ''; }
}

async function login(baseUrl, password) {
  const response = await fetch(`${baseUrl}/~/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }),
    redirect: 'manual',
  });
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error(`host login returned HTTP ${response.status} without a cookie`);
  return setCookie.split(';')[0];
}

async function channelPut(baseUrl, channel, auth, commands) {
  const response = await fetch(`${baseUrl}/~/channel/${channel}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: auth },
    body: JSON.stringify(commands),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`channel PUT returned HTTP ${response.status}: ${body}`);
  }
}

async function channelDelete(baseUrl, channel, auth) {
  await fetch(`${baseUrl}/~/channel/${channel}`, { method: 'DELETE', headers: { cookie: auth } });
}

async function waitForPoke(baseUrl, channel, auth, wantedId, waitMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('poke acknowledgement timed out')), waitMs);
  try {
    const response = await fetch(`${baseUrl}/~/channel/${channel}`, {
      headers: { accept: 'text/event-stream', cookie: auth },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`channel SSE returned HTTP ${response.status}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let split;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const data = raw.split('\n').filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const decoded = JSON.parse(data);
        for (const message of Array.isArray(decoded) ? decoded : [decoded]) {
          if (message?.response === 'poke' && Number(message.id) === wantedId) return message;
        }
      }
    }
    throw new Error('channel closed before poke acknowledgement');
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result[key] = 'true';
    else { result[key] = next; i += 1; }
  }
  return result;
}

function required(name) {
  const value = args[name];
  if (!value || value === 'true') fail(`missing --${name}`);
  return value;
}
function normalizeShip(value) { return value.startsWith('~') ? value : `~${value}`; }
function normalizeSnapshot(value) { return value.startsWith('/') ? value : `/${value}`; }
function stripSig(value) { return String(value).replace(/^~/, ''); }
function trimSlash(value) { return String(value).replace(/\/+$/, ''); }
function formatError(value) {
  try { return typeof value === 'string' ? value : JSON.stringify(value); }
  catch { return String(value); }
}
function fail(message) { console.error(`[recycle] ${message}`); process.exit(1); }
