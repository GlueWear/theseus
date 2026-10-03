import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newMoon, validateMoon, blitsToAnsi, validateFleet, snapshotName} from '../src/model.mjs';
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
  assert.throws(() => validateFleet({version: 2, host:'~zod', moons:[], snapshots:[], caches:[]}));
  assert.equal(validateFleet({version:1, host:'~zod', moons:[], snapshots:[], caches:[]}).host, '~zod');
  assert.match(snapshotName(), /^[a-z][a-z0-9-]+$/);
});
