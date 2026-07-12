#!/usr/bin/env node
// P1 parity reader (temporary). Connects to theseus-pyre's /ames lick socket,
// deframes + cues each %spit'd outbound packet, and logs [who lane blob].
// Run this ALONGSIDE the live carrier and compare: every outbound packet should
// appear BOTH as a carrier `OUT` line (from the Eyre fact) AND here (from lick),
// with matching who / lane target / blob size. Nothing is sent to UDP from here.
//
// Usage: node deploy/lick-out-reader.mjs [socket-path]
//   default: /Users/chris/disden-talhes/.urb/dev/theseus-pyre/ames
import net from 'node:net';
import { cue_bytes, isAtom, isCell } from '@urbit/nockjs';

const path = process.argv[2] || '/Users/chris/disden-talhes/.urb/dev/theseus-pyre/ames';

// wire frame: [0x00 tag][uint32 LE len][ jam([mark noun]) ]  (proven in P0)
function atomBig(x) {
  for (const k of ['number', 'big', 'n', 'value']) if (typeof x[k] === 'bigint') return x[k];
  if (x.valueOf) { const v = x.valueOf(); if (typeof v === 'bigint') return v; }
  return 0n;
}
const cord = (bn) => { let s = ''; while (bn > 0n) { s += String.fromCharCode(Number(bn & 0xffn)); bn >>= 8n; } return s; };
const blobBytes = (bn) => (bn === 0n ? 0 : Math.ceil(bn.toString(2).length / 8));

function handleFrame(payload) {
  let noun;
  try { noun = cue_bytes(new DataView(payload.buffer, payload.byteOffset, payload.byteLength)); }
  catch (e) { console.log('[lick-out] cue failed:', e.message); return; }
  // noun = [mark who lane blob] == [mark [who [lane blob]]]
  if (!isCell(noun)) { console.log('[lick-out] not a cell'); return; }
  const mark = cord(atomBig(noun.head));
  const r1 = noun.tail;                 // [who [lane blob]]
  const who = atomBig(r1.head);
  const r2 = r1.tail;                   // [lane blob]
  const lane = r2.head;                 // [?(%.y %.n) val]
  const blob = atomBig(r2.tail);
  const laneTag = atomBig(lane.head) === 0n ? '%.y' : '%.n';
  const laneVal = atomBig(lane.tail);
  console.log(`[lick-out] mark=${mark} who=${who} lane=${laneTag}:${laneVal} blob=${blobBytes(blob)}B`);
}

let acc = Buffer.alloc(0);
const sock = net.connect(path, () => console.log(`[lick-out] connected ${path}`));
sock.on('data', (chunk) => {
  acc = Buffer.concat([acc, chunk]);
  while (acc.length >= 5) {
    const len = acc.readUInt32LE(1);           // byte0 = tag, bytes1..4 = LE len
    if (acc.length < 5 + len) break;
    handleFrame(acc.subarray(5, 5 + len));
    acc = acc.subarray(5 + len);
  }
});
sock.on('error', (e) => console.error('[lick-out] socket error:', e.message));
sock.on('close', () => console.log('[lick-out] closed'));
process.on('SIGINT', () => { sock.end(); process.exit(0); });
