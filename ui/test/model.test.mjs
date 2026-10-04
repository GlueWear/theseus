import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMoon, validateMoon, blitsToAnsi, validateFleet, validateHostDesks, resolveDeskSelection, bootDesks, deskPublisher, keysToBelts, byBoot, deskTally, snapshotName} from '../src/model.mjs';
test('generated moon belongs to host and avoids existing identities', () => {
  const a = newMoon('~siglup-narwet', [], 123);
  assert.equal(validateMoon(a, '~siglup-narwet'), '');
  assert.notEqual(newMoon('~siglup-narwet', [a], 123), a);
  assert.ok(validateMoon(a, '~baltel-bidlys'));
  assert.ok(validateMoon('~siglup-narwet', '~siglup-narwet'));
  assert.ok(validateMoon('invalid', '~siglup-narwet'));
});
test('Dill output preserves Unicode and generated controls, strips guest escapes', () => {
  assert.equal(blitsToAnsi([{put:['h','i']},{nel:true},{hop:3},{klr:[{text:['4']}]}]), 'hi\r\n\x1b[4G4');
  assert.equal(blitsToAnsi([{put:['\x1b]52;c;secret\x07']}]), ']52;c;secret');
  assert.equal(blitsToAnsi([{mor:[{put:['\u00e9']}]}]), '\u00e9');
});
test('API contract refuses unknown or missing data', () => {
  assert.throws(() => validateFleet({}));
  assert.throws(() => validateFleet({version: 1, host:'~zod', moons:[], snapshots:[], caches:[]}));
  assert.equal(validateFleet({version:2, host:'~zod', moons:[], snapshots:[], caches:[]}).host, '~zod');
  const recovering = {ship:'~sampel-zod',desks:[],recovery:{stage:'registering',attempts:1,reason:null}};
  assert.equal(validateFleet({version:2, host:'~zod', moons:[recovering], snapshots:[], caches:[]}).moons[0].recovery.stage, 'registering');
  assert.throws(() => validateFleet({version:2, host:'~zod', moons:[{...recovering,recovery:{stage:'ready',attempts:0}}], snapshots:[], caches:[]}));
  assert.match(snapshotName(), /^[a-z][a-z0-9-]+$/);
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
});
test('styled Dill text keeps bold, underline and colours', () => {
  const ansi = blitsToAnsi([{klr:[{text:['h','i'],stye:{deco:['br'],fore:'r',back:null}},{text:['x'],stye:{deco:['un'],fore:{r:1,g:2,b:3},back:'b'}},{text:['p'],stye:{deco:[null],fore:null,back:null}}]}]);
  assert.equal(ansi, '\x1b[1;31mhi\x1b[0m\x1b[4;38;2;1;2;3;44mx\x1b[0mp');
});
