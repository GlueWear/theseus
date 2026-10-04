import ob from 'urbit-ob';
export function validateMoon(value, host) {
  if (!ob.isValidPatp(value)) return 'Enter a valid moon name.';
  const moon = BigInt(ob.patp2dec(value));
  if (moon < 2n ** 32n || moon >= 2n ** 64n) return 'This name is not a moon.';
  if ((moon & 0xffffffffn) !== BigInt(ob.patp2dec(host))) return `The moon must belong to ${host}.`;
  return '';
}
export function newMoon(host, existing, random = crypto.getRandomValues(new Uint32Array(1))[0]) {
  const parent = BigInt(ob.patp2dec(host));
  for (let i = 0; i < 100; i++) {
    const index = BigInt((random + i) >>> 0 || 1);
    const name = ob.patp(((index << 32n) + parent).toString());
    if (!existing.includes(name)) return name;
  }
  throw new Error('Could not allocate a new moon name.');
}
export function snapshotName(date = new Date()) { return `snapshot-${date.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`; }
// An Urbit date (~2026.10.2..12.00.00..) as Unix ms, or NaN.
export function daMs(value) {
  const match = /^~(\d+)\.(\d+)\.(\d+)\.\.(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? Date.UTC(+match[1], +match[2]-1, +match[3], +match[4], +match[5], +match[6]) : NaN;
}
export function dateLabel(value) {
  const ms = daMs(value);
  return Number.isNaN(ms) ? value : new Date(ms).toLocaleString();
}
// Dill content is untrusted. Strip control characters before writing to xterm;
// only this renderer emits terminal control sequences, never guest text.
const safe = value => String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
// Dill styles (%klr) as SGR codes: bold and underline, named or RGB colours.
// Only numbers reach the escape sequence.
const tints = {k: 0, r: 1, g: 2, y: 3, b: 4, m: 5, c: 6, w: 7};
function sgr(stye) {
  const codes = [];
  for (const deco of stye?.deco || []) {if (deco === 'br') codes.push(1); if (deco === 'un') codes.push(4);}
  const tint = (value, base) => {
    if (typeof value === 'string' && value in tints) codes.push(base + tints[value]);
    else if (value && [value.r, value.g, value.b].every(n => Number.isInteger(n) && n >= 0 && n < 256)) codes.push(base + 8, 2, value.r, value.g, value.b);
  };
  tint(stye?.fore, 30); tint(stye?.back, 40);
  return codes.length ? `\x1b[${codes.join(';')}m` : '';
}
export function blitsToAnsi(blits) {
  if (!Array.isArray(blits)) return '';
  return blits.map(blit => {
    if (blit.put) return blit.put.map(safe).join('');
    if (blit.klr) return blit.klr.map(run => {const text = (run.text || []).map(safe).join(''), open = sgr(run.stye); return open && text ? `${open}${text}\x1b[0m` : text;}).join('');
    if (blit.mor) return blitsToAnsi(blit.mor);
    if (blit.nel) return '\r\n';
    if (blit.clr) return '\x1b[2J\x1b[H';
    if (blit.wyp) return '\x1b[K';
    if (blit.hop !== undefined) {
      const x = typeof blit.hop === 'number' ? blit.hop : blit.hop.x;
      const n = Math.max(0, Math.min(4096, Number(x) || 0)) + 1;
      return `\x1b[${n}G`;
    }
    return '';
  }).join('');
}
// What xterm.js reports for a keypress or paste, as Dill belts. Printable runs
// become one %txt; Enter, Backspace, Delete, arrows and Ctrl-letters become
// their own belts; Tab is Ctrl-I and Option-letter is Meta, as Dill expects.
// Other control characters and escape sequences are dropped.
export function keysToBelts(data) {
  const belts = [];
  let text = '';
  const flush = () => {if (text) {belts.push({txt: text}); text = '';}};
  for (let i = 0; i < data.length; i++) {
    const c = data[i], code = c.charCodeAt(0);
    if (c === '\x1b') {
      const seq = /^\x1b(\[[0-9;]*[A-Za-z~]|O[A-Za-z]|[\s\S])?/.exec(data.slice(i))[0];
      i += seq.length - 1; flush();
      const arrow = {'[A': 'u', '[B': 'd', '[C': 'r', '[D': 'l', 'OA': 'u', 'OB': 'd', 'OC': 'r', 'OD': 'l'}[seq.slice(1)];
      if (arrow) belts.push({aro: arrow});
      else if (seq === '\x1b[3~') belts.push({del: null});
      else if (/^\x1b[a-z]$/.test(seq)) belts.push({met: seq[1]});
      continue;
    }
    if (c === '\r' || c === '\n') {flush(); if (!(c === '\n' && data[i - 1] === '\r')) belts.push({ret: null}); continue;}
    if (code === 0x7f || code === 0x08) {flush(); belts.push({bac: null}); continue;}
    if (c === '\t') {flush(); belts.push({ctl: 'i'}); continue;}
    if (code >= 1 && code <= 26) {flush(); belts.push({ctl: String.fromCharCode(code + 96)}); continue;}
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    text += c;
  }
  flush();
  return belts;
}
// Oldest boot first; moons with no recorded boot time last, by name.
export function byBoot(moons) {
  return [...moons].sort((a, b) => (a.booted ?? Infinity) - (b.booted ?? Infinity) || a.ship.localeCompare(b.ship));
}
// A booting moon's desks: how many run, and why any failed.
export function deskTally(desks = []) {
  const running = desks.filter(d => d.stage === 'running').length;
  const failed = desks.filter(d => d.stage === 'failed');
  return {total: desks.length, running, failed, done: running + failed.length === desks.length};
}
export function validateFleet(data) {
  if (data?.version !== 2 || !Array.isArray(data.moons) || !Array.isArray(data.snapshots) || !Array.isArray(data.caches) || !ob.isValidPatp(data.host)) throw new Error('Theseus management API is unavailable or incompatible.');
  if (data.moons.some(m => !Array.isArray(m.desks) || (m.recovery != null && (!['registering', 'restarting', 'failed'].includes(m.recovery.stage) || typeof m.recovery.attempts !== 'number')))) throw new Error('Theseus returned an invalid moon record.');
  return data;
}
export function validateHostDesks(data) {
  if (data?.version !== 1 || !Array.isArray(data.desks)) throw new Error('Theseus host desk inventory is unavailable or incompatible.');
  for (const row of data.desks) {
    if (!/^[a-z][a-z0-9-]*$/.test(row?.desk) || !Array.isArray(row.dependencies) || typeof row.running !== 'boolean') throw new Error('Theseus returned an invalid host desk record.');
  }
  return {...data, desks: [...data.desks].sort((a, b) => a.desk === 'base' ? -1 : b.desk === 'base' ? 1 : a.desk.localeCompare(b.desk))};
}
export function resolveDeskSelection(catalog, explicit = []) {
  const byName = new Map(catalog.map(row => [row.desk, row]));
  const selected = new Set(['base', ...explicit.filter(name => byName.has(name))]);
  const reasons = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of [...selected]) for (const dependency of byName.get(name)?.dependencies || []) {
      if (!byName.has(dependency) || selected.has(dependency)) continue;
      selected.add(dependency); reasons.set(dependency, name); changed = true;
    }
  }
  const desks = [...selected].sort((a, b) => a === 'base' ? -1 : b === 'base' ? 1 : a.localeCompare(b));
  return {desks, reasons};
}
// Where a chosen desk takes its updates from: the host, or the ship the host's
// own copy syncs from (its publisher). %base always tracks the host, and a desk
// the host syncs from no one can only come from the host.
export function deskPublisher(row, host) {
  return row && row.desk !== 'base' && row.source && row.source.ship !== host ? row.source : null;
}
export function bootDesks(catalog, desks, from = {}, host) {
  const byName = new Map(catalog.map(row => [row.desk, row]));
  return desks.map(desk => ({desk, from: from[desk] === 'publisher' && deskPublisher(byName.get(desk), host) ? 'publisher' : 'host'}));
}
// Web gateway: moon origins come from the gateway's address template,
// e.g. 'http://{moon}.localhost:8084' or 'https://{moon}.example.com'.
export function moonOrigin(template, ship) {
  return template.replace('{moon}', ship.replace(/^~/, '')).replace(/\/$/, '');
}
export function validPort(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n > 0 && n < 65536;
}
// Mirrors %theseus-ui: an origin with {moon} in the hostname, nothing after
// it but an optional '/'. Moon apps use absolute paths, so it cannot be a path.
export function validTemplate(value) {
  const t = String(value || '');
  const m = /^https?:\/\/([^/\s]+)\/?$/.exec(t);
  return Boolean(m) && t.length <= 255 && (t.match(/\{moon\}/g) || []).length === 1 && m[1].includes('{moon}');
}
// Why moon apps cannot open right now, or '' if they can.
export function gatewayProblem(gw) {
  if (!gw) return 'Gateway settings are unavailable. Update the theseus desk on the host.';
  if ((gw.status === 'ok' || gw.status === 'external') && gw.url) return '';
  return {
    down: 'No web gateway is running for this host, so moon apps cannot open in their own tab.',
    stale: 'The web gateway is still forwarding to an old Eyre port.',
    mismatch: 'The web gateway is still switching to the declared port.',
  }[gw.status] || 'The web gateway is not ready.';
}
