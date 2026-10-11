import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMoon, validateMoon, blitsToAnsi, validateFleet, validateHostDesks, resolveDeskSelection, bootDesks, deskPublisher, keysToBelts, byBoot, deskTally, catchingUp, snapshotName, shipNumber, fleetState, snapshotSets, snapshotLabel, blitLines, riskyCommand, shortMoon, avatarSrc, validateProfiles} from '../src/model.mjs';
test('generated moon belongs to host and avoids existing identities', () => {
  const a = newMoon('~siglup-narwet', [], 123);
  assert.equal(validateMoon(a, '~siglup-narwet'), '');
  assert.notEqual(newMoon('~siglup-narwet', [a], 123), a);
  assert.ok(validateMoon(a, '~baltel-bidlys'));
  assert.ok(validateMoon('~siglup-narwet', '~siglup-narwet'));
  assert.ok(validateMoon('invalid', '~siglup-narwet'));
});
test('sidecar configuration uses decimal ship identities', () => {
  const host = BigInt(shipNumber('~siglup-narwet'));
  const moon = BigInt(shipNumber('~sampel-siglup-narwet'));
  assert.equal(moon & 0xffffffffn, host);
});
test('Dill output preserves Unicode and generated controls, strips guest escapes', () => {
  assert.equal(blitsToAnsi([{put:['h','i']},{nel:true},{hop:3},{klr:[{text:['4']}]}]), 'hi\r\n\x1b[4G4');
  assert.equal(blitsToAnsi([{put:['\x1b]52;c;secret\x07']}]), ']52;c;secret');
  assert.equal(blitsToAnsi([{mor:[{put:['\u00e9']}]}]), '\u00e9');
});
test('API contract refuses unknown or missing data', () => {
  assert.throws(() => validateFleet({}));
  assert.throws(() => validateFleet({version: 2, host:'~zod', moons:[], fleets:[], snapshots:[], caches:[]}));
  assert.equal(validateFleet({version:3, host:'~zod', moons:[], fleets:[], snapshots:[], caches:[]}).host, '~zod');
  const recovering = {ship:'~sampel-zod',desks:[],recovery:{stage:'registering',attempts:1,reason:null}};
  assert.equal(validateFleet({version:3, host:'~zod', moons:[recovering], fleets:[], snapshots:[], caches:[]}).moons[0].recovery.stage, 'registering');
  assert.throws(() => validateFleet({version:3, host:'~zod', moons:[{...recovering,recovery:{stage:'ready',attempts:0}}], fleets:[], snapshots:[], caches:[]}));
  assert.match(snapshotName(), /^[a-z][a-z0-9-]+$/);
});
test('fleet records are exclusive and report missing members', () => {
  const host = '~siglup-narwet';
  const a = newMoon(host, [], 10), b = newMoon(host, [a], 11);
  const group = {name:'workers', ships:[a,b], desks:[{desk:'base',from:'host'}], created:1};
  const moon = {ship:a,status:'healthy',paused:false,recovery:null};
  const data = validateFleet({version:3,host,moons:[{...moon,desks:[]}],fleets:[group],snapshots:[],caches:[]});
  assert.equal(data.fleets[0].name, 'workers');
  assert.deepEqual(fleetState(group,[moon]), {members:[moon],missing:[b],running:1,paused:0,attention:1,catching:0});
  assert.throws(() => validateFleet({...data,fleets:[group,{...group,name:'other'}]}), /overlapping/);
});
test('desk selection locks base and resolves docket dependencies', () => {
  const catalog = validateHostDesks({version:1,desks:[
    {desk:'plain',title:null,running:false,source:null,hash:'0v2',dependencies:[]},
    {desk:'landscape',title:'Landscape',running:true,source:null,hash:'0v1',dependencies:[]},
    {desk:'base',title:null,running:true,source:{ship:'~zod',desk:'kids'},hash:'0v0',dependencies:[]},
    {desk:'glurff',title:'Glurff',running:true,source:{ship:'~nolset',desk:'glurff'},hash:'0v3',dependencies:['landscape']},
  ]});
  assert.deepEqual(catalog.desks.map(d => d.desk), ['base','glurff','landscape','plain']);
  const chosen = resolveDeskSelection(catalog.desks, ['glurff']);
  assert.deepEqual(chosen.desks, ['base','glurff','landscape']);
  assert.equal(chosen.reasons.get('landscape'), 'glurff');
  assert.deepEqual(resolveDeskSelection(catalog.desks, []).desks, ['base']);
});
test('desks update from the host unless a publisher is chosen and exists', () => {
  const host = '~siglup-narwet';
  const rows = [
    {desk:'base',source:{ship:host,desk:'kids'}},
    {desk:'glurff',source:{ship:'~nolset',desk:'glurff'}},
    {desk:'landscape',source:{ship:host,desk:'landscape'}},
    {desk:'local',source:null},
  ];
  assert.equal(deskPublisher(rows[1], host).ship, '~nolset');
  assert.equal(deskPublisher(rows[0], host), null);
  assert.equal(deskPublisher(rows[2], host), null);
  assert.equal(deskPublisher(rows[3], host), null);
  assert.deepEqual(
    bootDesks(rows, ['base','glurff','landscape','local'], {base:'publisher', glurff:'publisher', landscape:'publisher', local:'publisher'}, host),
    [{desk:'base',from:'host'},{desk:'glurff',from:'publisher'},{desk:'landscape',from:'host'},{desk:'local',from:'host'}]);
  assert.deepEqual(bootDesks(rows, ['base','glurff'], {}, host), [{desk:'base',from:'host'},{desk:'glurff',from:'host'}]);
});
test('keystrokes become Dill belts', () => {
  assert.deepEqual(keysToBelts('(add 2 2)\r'), [{txt:'(add 2 2)'},{ret:null}]);
  assert.deepEqual(keysToBelts('\x1b[A\x1b[D\x7f\x03\t\x1b[3~\x1bb'), [{aro:'u'},{aro:'l'},{bac:null},{ctl:'c'},{ctl:'i'},{del:null},{met:'b'}]);
  assert.deepEqual(keysToBelts('a\r\nb'), [{txt:'a'},{ret:null},{txt:'b'}]);
  assert.deepEqual(keysToBelts('\x1b[15~\x00'), []);
});
test('moons sort oldest boot first, unknown boots last', () => {
  assert.deepEqual(byBoot([{ship:'~b',booted:5},{ship:'~a'},{ship:'~c',booted:1}]).map(m => m.ship), ['~c','~b','~a']);
});
test('a boot is done when every desk runs or failed', () => {
  assert.equal(deskTally([{stage:'running'},{stage:'installing'}]).done, false);
  const done = deskTally([{stage:'running'},{stage:'failed',desk:'x'}]);
  assert.equal(done.done, true); assert.equal(done.failed.length, 1);
  assert.equal(deskTally([]).done, true);
  // catching up comes after installing and before running: not done yet
  const catching = deskTally([{stage:'running'},{stage:'catching-up'},{stage:'installing'}]);
  assert.deepEqual([catching.catching, catching.installing, catching.done], [1, 1, false]);
  assert.equal(catchingUp({desks:[{stage:'running'},{stage:'catching-up'}]}), true);
  assert.equal(catchingUp({desks:[{stage:'running'}]}), false);
  assert.equal(catchingUp({}), false);
});
test('styled Dill text keeps bold, underline and colours', () => {
  const ansi = blitsToAnsi([{klr:[{text:['h','i'],stye:{deco:['br'],fore:'r',back:null}},{text:['x'],stye:{deco:['un'],fore:{r:1,g:2,b:3},back:'b'}},{text:['p'],stye:{deco:[null],fore:null,back:null}}]}]);
  assert.equal(ansi, '\x1b[1;31mhi\x1b[0m\x1b[4;38;2;1;2;3;44mx\x1b[0mp');
});

test('snapshots group into sets: a fleet snapshot is one per moon, restored together', () => {
  const sets = snapshotSets([
    {path: '/clean/~a-host', set: '/clean', ships: ['~a-host'], compatible: true, created: '~2026.10.8..10.00.00'},
    {path: '/clean/~b-host', set: '/clean', ships: ['~b-host'], compatible: false, created: '~2026.10.8..10.00.00'},
    {path: '/old', ships: ['~a-host'], compatible: true, created: '~2026.10.1..10.00.00'},
  ]);
  assert.deepEqual(sets.map(s => [s.path, s.ships, s.compatible, s.entries.length]), [['/clean', ['~a-host', '~b-host'], false, 2], ['/old', ['~a-host'], true, 1]]);
  assert.equal(snapshotLabel('/clean'), 'clean');
});
test('the fleet terminal keeps the lines a moon finished printing, not its prompt', () => {
  let r = blitLines('', [{mor: [{hop: 0}, {put: [...'~a-host:dojo> +vats']}]}, {nel: true}, {put: [...'%base']}]);
  assert.deepEqual(r.lines, []);
  assert.equal(r.cur, '%base');
  r = blitLines(r.cur, [{nel: true}, {klr: [{stye: {deco: ['br']}, text: [...'running']}]}, {nel: true}, {put: ['\x1b', 'x']}, {nel: true}]);
  assert.deepEqual(r.lines, ['%base', 'running', 'x']);
  assert.equal(r.cur, '');
});
test('commands that change every moon are caught before a fleet runs them', () => {
  for (const c of ['|nuke %glurff', ' |uninstall %pong', '|ota ~zod %kids', '|commit %base', '|rm /foo', ':hood|code %reset']) assert.ok(riskyCommand(c), c);
  for (const c of ['+vats', '(add 2 2)', '|hi ~zod', '|mount %base']) assert.ok(!riskyCommand(c), c);
});
test('moons are named without their host, and pictures resolve to where they live', () => {
  assert.equal(shortMoon('~fopsep-litruc-siglup-narwet', '~siglup-narwet'), '~fopsep-litruc');
  assert.equal(shortMoon('~sampel-palnet', '~siglup-narwet'), '~sampel-palnet');
  assert.equal(avatarSrc({type: 'external', url: 'https://x.test/a.png'}, undefined), 'https://x.test/a.png');
  assert.equal(avatarSrc({type: 'urbit', url: '/apps/noltbook/avatar'}, 'http://moon.localhost:8086'), 'http://moon.localhost:8086/apps/noltbook/avatar');
  assert.equal(avatarSrc({type: 'urbit', url: '/apps/noltbook/avatar'}, undefined), '', 'no gateway, no picture');
  assert.equal(avatarSrc({type: 'external', url: 'javascript:alert(1)'}, ''), '');
  assert.equal(avatarSrc(null, ''), '');
  // an upload's version goes in the address, so a new one is fetched anew
  assert.equal(avatarSrc({type: 'urbit', url: '0v1a.b2c'}, 'http://moon.localhost:8086', '~sampel-siglup-narwet'), 'http://moon.localhost:8086/apps/noltbook/user-avatar/~sampel-siglup-narwet?v=0v1a.b2c');
  assert.equal(avatarSrc({type: 'urbit', url: ''}, '', '~siglup-narwet'), '/apps/noltbook/user-avatar/~siglup-narwet');
  assert.throws(() => validateProfiles({host: {ship: '~zod'}, moons: []}));
  assert.ok(validateProfiles({host: {ship: '~zod', noltbook: true, name: 'Z', avatar: null}, moons: []}));
});
