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
export function dateLabel(value) {
  const match = /^~(\d+)\.(\d+)\.(\d+)\.\.(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) return value;
  return new Date(Date.UTC(+match[1], +match[2]-1, +match[3], +match[4], +match[5], +match[6])).toLocaleString();
}
// Dill content is untrusted. Strip control characters before writing to xterm;
// only this renderer emits terminal control sequences, never guest text.
const safe = value => String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, '');
export function blitsToAnsi(blits) {
  if (!Array.isArray(blits)) return '';
  return blits.map(blit => {
    if (blit.put) return blit.put.map(safe).join('');
    if (blit.klr) return blit.klr.map(run => (run.text || []).map(safe).join('')).join('');
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
export function validateFleet(data) {
  if (data?.version !== 2 || !Array.isArray(data.moons) || !Array.isArray(data.snapshots) || !Array.isArray(data.caches) || !ob.isValidPatp(data.host)) throw new Error('Theseus management API is unavailable or incompatible.');
  if (data.moons.some(m => !Array.isArray(m.desks))) throw new Error('Theseus returned an invalid moon desk plan.');
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
