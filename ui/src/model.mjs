import ob from 'urbit-ob';
export function shipNumber(value) { return ob.patp2dec(value); }
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
// A desk is done once it runs (Kiln installed it, heard back from its
// source and merged what it brought) or failed. Catching up comes between.
export function deskTally(desks = []) {
  const running = desks.filter(d => d.stage === 'running').length;
  const failed = desks.filter(d => d.stage === 'failed');
  const catching = desks.filter(d => d.stage === 'catching-up').length;
  const installing = desks.filter(d => d.stage === 'seeded' || d.stage === 'installing').length;
  return {total: desks.length, running, failed, catching, installing, done: running + failed.length === desks.length};
}
// Still catching up with a desk's source: running, but busy on the host.
export const catchingUp = moon => (moon?.desks || []).some(d => d.stage === 'catching-up');
// The desks a moon already has, for the add-desks dialog. A desk can be
// held when it updates from the host's desk of the same name: holding
// stops Kiln's updates, so only an update from the dialog changes it.
export function installedDesks(moon, host) {
  return (moon?.desks || []).filter(row => row.desk !== 'base').map(row => ({
    desk: row.desk, stage: row.stage, source: row.source || null,
    held: !!row.held, behind: !!row.behind, count: 1, heldCount: row.held ? 1 : 0,
    holdable: !!row.held || (row.source?.ship === host && row.source?.desk === row.desk),
  }));
}
// The same for a fleet: its recipe's desks, held when every booted member
// holds them.
export function fleetInstalledDesks(group, moons) {
  const {members} = fleetState(group, moons);
  return group.desks.filter(row => row.desk !== 'base').map(row => {
    const rows = members.map(moon => moon.desks.find(d => d.desk === row.desk)).filter(Boolean);
    const heldCount = rows.filter(d => d.held).length;
    return {desk: row.desk, stage: null, source: null, count: rows.length, heldCount,
      held: rows.length > 0 && heldCount === rows.length, behind: rows.some(d => d.held && d.behind), holdable: row.from === 'host'};
  });
}
export function installedLabel(row) {
  if (row.stage === null) {
    const held = row.heldCount ? `held on ${row.heldCount} of ${row.count}${row.behind ? ', behind the host' : ''}` : 'updates from the host';
    return `${row.count} ${row.count === 1 ? 'moon' : 'moons'} · ${held}`;
  }
  if (row.held) return row.behind ? 'held · the host has a newer version' : 'held · same as the host';
  const stage = row.stage === 'catching-up' ? 'catching up' : row.stage;
  return `${stage}${row.source ? ` · ${row.source.ship}/%${row.source.desk}` : ''}`;
}
// What the installed-desk choices ask for, in the order to send it: holds
// first, so Kiln can't merge an older update over the new one, and
// releases last, so Kiln resumes from what the update left.
export function deskChanges(rows, update = [], hold = {}) {
  return {
    hold: rows.filter(row => row.holdable && hold[row.desk] === true && !row.held).map(row => row.desk),
    update: rows.filter(row => update.includes(row.desk)).map(row => row.desk),
    release: rows.filter(row => hold[row.desk] === false && row.heldCount > 0).map(row => row.desk),
  };
}
export const anyDeskChange = c => c.hold.length + c.update.length + c.release.length > 0;
export function validateFleet(data) {
  if (data?.version !== 3 || !Array.isArray(data.moons) || !Array.isArray(data.fleets) || !Array.isArray(data.snapshots) || !Array.isArray(data.caches) || !ob.isValidPatp(data.host)) throw new Error('Theseus management API is unavailable or incompatible.');
  if (data.moons.some(m => !Array.isArray(m.desks) || (m.recovery != null && (!['registering', 'restarting', 'failed'].includes(m.recovery.stage) || typeof m.recovery.attempts !== 'number')))) throw new Error('Theseus returned an invalid moon record.');
  const members = new Set();
  for (const group of data.fleets) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(group?.name) || !Array.isArray(group.ships) || !Array.isArray(group.desks) || typeof group.created !== 'number') throw new Error('Theseus returned an invalid fleet record.');
    if (group.boot != null && (!Array.isArray(group.boot.pending) || !Array.isArray(group.boot.failed) || typeof group.boot.started !== 'number' || typeof group.boot.updated !== 'number' || group.boot.pending.some(ship => !group.ships.includes(ship)) || group.boot.failed.some(row => !group.ships.includes(row?.ship) || typeof row.reason !== 'string'))) throw new Error('Theseus returned an invalid fleet boot job.');
    for (const ship of group.ships) {
      if (validateMoon(ship, data.host) || members.has(ship)) throw new Error('Theseus returned overlapping fleet membership.');
      members.add(ship);
    }
  }
  return data;
}

export function fleetState(group, moons) {
  const byShip = new Map(moons.map(moon => [moon.ship, moon]));
  const members = group.ships.map(ship => byShip.get(ship)).filter(Boolean);
  const missing = group.ships.filter(ship => !byShip.has(ship));
  const running = members.filter(moon => moon.status === 'healthy' && !moon.paused && !moon.recovery).length;
  const paused = members.filter(moon => moon.paused && !moon.recovery).length;
  const attention = members.length - running - paused + missing.length;
  const catching = members.filter(moon => moon.status === 'healthy' && !moon.paused && !moon.recovery && catchingUp(moon)).length;
  return {members, missing, running, paused, attention, catching};
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
// Snapshots hold one ship each. Those taken together (a fleet's) share a set,
// /<set>/<~ship>, and restore or delete together through the set's path. A
// snapshot from before sets is a set of its own.
export function snapshotSets(snapshots = []) {
  const sets = new Map();
  for (const s of snapshots) {
    const key = s.set || s.path;
    const set = sets.get(key) || {path: key, created: s.created, compatible: true, ships: [], entries: []};
    if ((daMs(s.created) || 0) > (daMs(set.created) || 0)) set.created = s.created;
    set.compatible = set.compatible && s.compatible;
    set.ships.push(...s.ships);
    set.entries.push(s);
    sets.set(key, set);
  }
  return [...sets.values()].map(set => ({...set, ships: [...new Set(set.ships)].sort()}))
    .sort((a, b) => (daMs(b.created) || 0) - (daMs(a.created) || 0));
}
// A snapshot's or set's name for people: its path without the leading slash.
export const snapshotLabel = path => String(path || '').replace(/^\//, '');
// The visible text of one Dill blit, without styles.
function blitText(blit) {
  if (blit.put) return blit.put.map(safe).join('');
  if (blit.klr) return blit.klr.map(run => (run.text || []).map(safe).join('')).join('');
  return '';
}
// The fleet terminal's merged log: turn a moon's blits into the lines it
// finished printing. Dill redraws the line in progress with %put/%klr and ends
// it with %nel; only ended lines are shown. The Dojo prompt line, which each
// moon echoes for every command, is left out.
export function blitLines(cur = '', blits = []) {
  const lines = [];
  const walk = list => {
    for (const blit of list) {
      if (blit.mor) walk(blit.mor);
      else if (blit.put || blit.klr) cur = blitText(blit);
      else if ('nel' in blit) {
        if (cur.trim() && !/^~[a-z-]+:dojo> /.test(cur)) lines.push(cur);
        cur = '';
      } else if ('clr' in blit) cur = '';
    }
  };
  walk(Array.isArray(blits) ? blits : []);
  return {cur, lines};
}
// Fleet terminal commands that change or wipe something in every moon, so the
// console asks before running them across a fleet.
export function riskyCommand(text) {
  return /^\s*\|\s*(nuke|uninstall|suspend|ota|rein|breach|rm|mv|cp|commit|merge|cork|exit|knob|rekey|moon-breach|code|bump|pass|unsync|cancel|rebuild)\b/.test(text)
    || /^\s*:\S+\s*\|/.test(text);
}
// A moon's name without its host's part: ~fopsep-litruc-siglup-narwet ->
// ~fopsep-litruc. Moons share their host's name, so the rest is noise.
export function shortMoon(ship, host) {
  const tail = String(host || '').replace(/^~/, '');
  return tail && ship.endsWith(`-${tail}`) ? ship.slice(0, -tail.length - 1) : ship;
}
// Where to load a profile picture from: an absolute URL as it is, a path on
// the ship (an avatar uploaded in Noltbook) at the ship's own origin, if any.
export function avatarSrc(avatar, origin, ship) {
  const url = typeof avatar?.url === 'string' ? avatar.url.trim() : '';
  if (/^https?:\/\//i.test(url)) return url;
  if (origin === undefined) return '';
  if (url.startsWith('/')) return `${origin}${url}`;
  // A picture uploaded to Noltbook: its url is a version, which goes in the
  // address so a new upload isn't hidden behind the old one in a cache.
  if (avatar?.type === 'urbit') return ship ? `${origin}/apps/noltbook/user-avatar/${ship}${url ? `?v=${encodeURIComponent(url)}` : ''}` : `${origin}/apps/noltbook/avatar`;
  return '';
}
export function validateProfiles(data) {
  const ok = p => p && typeof p.ship === 'string' && typeof p.noltbook === 'boolean' && (p.name === null || typeof p.name === 'string') && (p.avatar === null || typeof p.avatar === 'object');
  if (!ok(data?.host) || !Array.isArray(data.moons) || !data.moons.every(ok)) throw new Error('Theseus returned invalid profiles.');
  return data;
}
