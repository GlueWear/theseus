#!/usr/bin/env node
// Downloaded from the authenticated Theseus console. Node.js 20+.

// ../bin/transport-sidecar.mjs
import fs from "node:fs";
import path from "node:path";
import dgram from "node:dgram";
import dns from "node:dns/promises";
import net from "node:net";

// ../node_modules/@urbit/nockjs/dist/nockjs.esm.mjs
function bigIntToByteArray(bigInt) {
  const hexString = bigInt.toString(16);
  const paddedHexString = hexString.length % 2 === 0 ? hexString : "0" + hexString;
  const arrayLength = paddedHexString.length / 2;
  const int8Array = new Uint8Array(arrayLength);
  for (let i = 0; i < paddedHexString.length; i += 2) {
    const hexSubstring = paddedHexString.slice(i, i + 2);
    const signedInt = parseInt(hexSubstring, 16) << 24 >> 24;
    int8Array[i / 2] = signedInt;
  }
  return int8Array;
}
var blcCoeff = [];
var blcBigCoeff = [];
var blc = [];
var blcNext = 0;
function bitLength(bigIntValue) {
  if (bigIntValue === 0n) return 0;
  let k = 0;
  while (true) {
    if (blcNext === k) {
      blcCoeff.push(32 << blcNext);
      blcBigCoeff.push(BigInt(blcCoeff[blcNext]));
      blc.push(1n << blcBigCoeff[blcNext]);
      blcNext++;
    }
    if (bigIntValue < blc[k]) break;
    k++;
  }
  if (!k) return 32 - Math.clz32(Number(bigIntValue));
  k--;
  let i = blcCoeff[k];
  let a = bigIntValue >> blcBigCoeff[k];
  while (k--) {
    let b = a >> blcBigCoeff[k];
    if (b) i += blcCoeff[k], a = b;
  }
  return i + 32 - Math.clz32(Number(a));
}
function testBit(bigIntValue, index) {
  return (bigIntValue & BigInt(1) << BigInt(index)) !== BigInt(0);
}
function bigIntFromStringWithRadix(number, radix) {
  if (radix === 16) return BigInt("0x" + (number || "0"));
  if (radix === 10) return BigInt(number || "0");
  let result = BigInt(0);
  const base = BigInt(radix);
  const length = number.length;
  for (let i = 0; i < length; i++) {
    const digit = parseInt(number.charAt(i), radix);
    if (isNaN(digit)) {
      throw new Error(`Invalid character for radix ${radix}: '${number.charAt(i)}'`);
    }
    result = result * base + BigInt(digit);
  }
  return result;
}
function murmurhash3_bi(len, key, seed) {
  let remainder, bytes, h1, h1b, c1, c2, k1, i;
  let yek;
  if (0n === key) {
    yek = new Uint8Array(0);
    len = len || 0;
  } else {
    yek = bigIntToByteArray(key);
    len = len || yek.length;
  }
  if (yek.length < len) {
    const fil = new Uint8Array(len - yek.length);
    const nek = new Uint8Array(yek.length + fil.length);
    nek.set(fil);
    nek.set(yek, fil.length);
    yek = nek;
  } else if (yek.length > len) {
    throw new Error("murmur3 oversized key for length");
  }
  yek.reverse();
  remainder = yek.length & 3;
  bytes = yek.length - remainder;
  h1 = seed;
  c1 = 3432918353;
  c2 = 461845907;
  i = 0;
  while (i < bytes) {
    k1 = yek[i] & 255 | (yek[++i] & 255) << 8 | (yek[++i] & 255) << 16 | (yek[++i] & 255) << 24;
    ++i;
    k1 = (k1 & 65535) * c1 + (((k1 >>> 16) * c1 & 65535) << 16) & 4294967295;
    k1 = k1 << 15 | k1 >>> 17;
    k1 = (k1 & 65535) * c2 + (((k1 >>> 16) * c2 & 65535) << 16) & 4294967295;
    h1 ^= k1;
    h1 = h1 << 13 | h1 >>> 19;
    h1b = (h1 & 65535) * 5 + (((h1 >>> 16) * 5 & 65535) << 16) & 4294967295;
    h1 = (h1b & 65535) + 27492 + (((h1b >>> 16) + 58964 & 65535) << 16);
  }
  k1 = 0;
  switch (remainder) {
    case 3:
      k1 ^= (yek[i + 2] & 255) << 16;
    case 2:
      k1 ^= (yek[i + 1] & 255) << 8;
    case 1:
      k1 ^= yek[i] & 255;
      k1 = (k1 & 65535) * c1 + (((k1 >>> 16) * c1 & 65535) << 16) & 4294967295;
      k1 = k1 << 15 | k1 >>> 17;
      k1 = (k1 & 65535) * c2 + (((k1 >>> 16) * c2 & 65535) << 16) & 4294967295;
      h1 ^= k1;
  }
  h1 ^= yek.length;
  h1 ^= h1 >>> 16;
  h1 = (h1 & 65535) * 2246822507 + (((h1 >>> 16) * 2246822507 & 65535) << 16) & 4294967295;
  h1 ^= h1 >>> 13;
  h1 = (h1 & 65535) * 3266489909 + (((h1 >>> 16) * 3266489909 & 65535) << 16) & 4294967295;
  h1 ^= h1 >>> 16;
  return h1 >>> 0;
}
function dwim$1() {
  for (var _len = arguments.length, args2 = new Array(_len), _key = 0; _key < _len; _key++) {
    args2[_key] = arguments[_key];
  }
  const n = args2.length === 1 ? args2[0] : args2;
  if (isNoun(n)) return n;
  if (typeof n === "number") {
    return Atom.fromInt(n);
  } else if (typeof n === "bigint") {
    return new Atom(n);
  } else if (typeof n === "string") {
    return Atom.fromCord(n);
  } else if (Array.isArray(n)) {
    if (n.length < 2) {
      return dwim$1(n[0]);
    }
    const head = dwim$1(n[n.length - 2]);
    const tail = dwim$1(n[n.length - 1]);
    let cel = new Cell(head, tail);
    for (var j = n.length - 3; j >= 0; --j) {
      cel = new Cell(dwim$1(n[j]), cel);
    }
    return cel;
  } else if (n === null) {
    return Atom.zero;
  }
  console.error("what do you mean??", typeof n, JSON.stringify(n));
  throw new Error("dwim, but meaning unclear");
}
function list$1(args2) {
  if (args2.length === 0) return Atom.zero;
  return dwim$1([...args2, Atom.zero]);
}
function set(args2) {
  if (args2.length === 0) return Atom.zero;
  let set2 = Atom.zero;
  for (let arg of args2) {
    set2 = putIn(set2, dwim$1(arg));
  }
  return set2;
}
function map(args2) {
  if (args2.length === 0) return Atom.zero;
  let map2 = Atom.zero;
  for (let arg of args2) {
    map2 = putBy(map2, dwim$1(arg.key), dwim$1(arg.val));
  }
  return map2;
}
var dejs = {
  nounify: dwim$1,
  dwim: dwim$1,
  list: list$1,
  set,
  map
};
function mum(syd, fal, key) {
  let i = 0;
  while (i < 8) {
    const haz = murmurhash3_bi(null, key, syd);
    const ham = haz >>> 31 ^ haz & 2147483647;
    if (0 !== ham) return ham;
    i++;
    syd++;
  }
  return fal;
}
function dor(a, b) {
  if (a.equals(b)) return true;
  if (a.isCell()) {
    if (b.isAtom()) return false;
    if (a.head.equals(b.head))
      return dor(a.tail, b.tail);
    return dor(a.head, b.head);
  }
  if (b.isCell()) return true;
  return a < b;
}
function gor(a, b) {
  const c = a.mug();
  const d = b.mug();
  if (c === d)
    return dor(a, b);
  return c < d;
}
function mor(a, b) {
  const c = Atom.fromInt(a.mug()).mug();
  const d = Atom.fromInt(b.mug()).mug();
  if (c === d)
    return dor(a, b);
  return c < d;
}
function isSet(a) {
  return a.isCell() && a.tail.isCell();
}
function putIn(a, b) {
  if (a.equals(Atom.zero)) {
    return dwim$1(b, null, null);
  }
  if (!isSet(a)) {
    throw new Error("malformed set");
  }
  if (b.equals(a.head)) {
    return a;
  }
  if (gor(b, a.head)) {
    const c2 = putIn(a.tail.head, b);
    if (!isSet(c2)) {
      throw new Error("implementation error");
    }
    if (mor(a.head, c2.head)) {
      return dwim$1(a.head, c2, a.tail.tail);
    }
    return dwim$1(c2.head, c2.tail.head, [a.head, c2.tail.tail, a.tail.tail]);
  }
  const c = putIn(a.tail.tail, b);
  if (!isSet(c)) {
    throw new Error("implementation error");
  }
  if (mor(a.head, c.head)) {
    return dwim$1(a.head, a.tail.head, c);
  }
  return dwim$1(c.head, [a.head, a.tail.head, c.tail.head], c.tail.tail);
}
function isMap(a) {
  return a.isCell() && a.head.isCell() && a.tail.isCell();
}
function putBy(a, b, c) {
  if (a.equals(Atom.zero)) {
    return dwim$1([b, c], null, null);
  }
  if (!isMap(a)) {
    throw new Error("malformed map");
  }
  if (b.equals(a.head.head)) {
    if (c.equals(a.head.tail)) {
      return a;
    }
    return dwim$1([b, c], a.tail);
  }
  if (gor(b, a.head.head)) {
    const d2 = putBy(a.tail.head, b, c);
    if (!isMap(d2)) {
      throw new Error("implementation error");
    }
    if (mor(a.head.head, d2.head.head)) {
      return dwim$1(a.head, d2, a.tail.tail);
    }
    return dwim$1(d2.head, d2.tail.head, [a.head, d2.tail.tail, a.tail.tail]);
  }
  const d = putBy(a.tail.tail, b, c);
  if (!isMap(d)) {
    throw new Error("implementation error");
  }
  if (mor(a.head.head, d.head.head)) {
    return dwim$1(a.head, a.tail.head, d);
  }
  return dwim$1(d.head, [a.head, a.tail.head, d.tail.head], d.tail.tail);
}
var _Atom;
var fragCache = {
  "0": function(a) {
    throw new Error("Bail");
  },
  "1": function(a) {
    return a;
  }
};
var Atom = class _Atom2 {
  constructor(number) {
    this.number = void 0;
    this._mug = 0;
    this.deep = false;
    this.number = number;
  }
  // common methods with Cell
  isAtom() {
    return true;
  }
  isCell() {
    return false;
  }
  pretty(out, hasTail) {
    if (this.number < 65536n) out.push(this.number.toString(10));
    else {
      let tap = [], isTa = true, isTas = true, bytes = bigIntToByteArray(this.number);
      for (let i = bytes.length - 1; i >= 0; --i) {
        const c = bytes[i];
        if (isTa && (c < 32 || c > 127)) {
          isTa = false;
          isTas = false;
          break;
        } else if (isTas && !(c > 47 && c < 58 || c > 96 && c < 123 || c === 45)) isTas = false;
        tap.push(String.fromCharCode(c));
      }
      if (isTas) {
        out.push("%");
        out.push.apply(out, tap);
      } else if (isTa) {
        out.push("'");
        out.push.apply(out, tap);
        out.push("'");
      } else {
        out.push("0x");
        out.push(this.number.toString(16));
      }
    }
  }
  toString() {
    const parts = [];
    this.pretty(parts, false);
    return parts.join("");
  }
  equals(o) {
    return o instanceof _Atom2 && o.number === this.number;
  }
  loob() {
    if (Number(this.number) === 0) return true;
    if (Number(this.number) === 1) return false;
    else throw new Error("Bail");
  }
  mug() {
    if (this._mug === 0) this._mug = this.calculateMug();
    return this._mug;
  }
  calculateMug() {
    return mum(3405691582, 32767, this.number);
  }
  mugged() {
    return this._mug !== 0;
  }
  at(a) {
    return _Atom2.fragmenter(a)(this);
  }
  // Atom specific methods
  bump() {
    return new _Atom2(this.number + 1n);
  }
  bytes() {
    const bytes = bigIntToByteArray(this.number);
    const r = [];
    for (var i = bytes.length - 1; i >= 0; --i) {
      r.push(bytes[i] & 255);
    }
    return r;
  }
  cap() {
    if (Number(this.number) === 0) throw new Error("Bail");
    if (Number(this.number) === 1) throw new Error("Bail");
    else return testBit(this.number, bitLength(this.number) - 2) ? new _Atom2(3n) : new _Atom2(2n);
  }
  mas() {
    if (Number(this.number) === 0) throw new Error("Bail");
    if (Number(this.number) === 1) throw new Error("Bail");
    if (Number(this.number) === 2) return new _Atom2(1n);
    if (Number(this.number) === 3) return new _Atom2(1n);
    else {
      const n = this.number;
      const l = bitLength(n) - 2;
      const addTop = BigInt(1 << l);
      const mask = BigInt((1 << l) - 1);
      return new _Atom2(n & mask ^ addTop);
    }
  }
  shortCode() {
    return this.number.toString(36);
  }
  // Class Methods
  static cordToString(c) {
    const bytes = c.bytes(), chars = [];
    for (let i = 0; i < bytes.length; ++i) {
      chars.push(String.fromCharCode(bytes[i]));
    }
    return chars.join("");
  }
  // cached tree addressing function constructor
  static fragmenter(a) {
    const s = a.shortCode();
    if (fragCache.hasOwnProperty(s)) {
      return fragCache[s];
    } else {
      for (var parts = ["a"]; !_Atom2.one.equals(a); a = a.mas()) {
        parts.push(_Atom2.two.equals(a.cap()) ? "head" : "tail");
      }
      return fragCache[s] = new Function("a", "return " + parts.join(".") + ";");
    }
  }
  // Atom builders
  static fromString(str, radix) {
    if (radix === void 0) {
      radix = 10;
    }
    const num = bigIntFromStringWithRadix(str, radix);
    return new _Atom2(num);
  }
  static fromInt(n) {
    if (n < 256) return _Atom2.small[n];
    else return new _Atom2(BigInt(n));
  }
  static fromCord(str) {
    if (str.length === 0) return _Atom2.zero;
    let i, j, octs = Array(str.length);
    for (i = 0, j = octs.length - 1; i < octs.length; ++i, --j) {
      const charByte = (str.charCodeAt(i) & 255).toString(16);
      octs[j] = charByte.length === 1 ? "0" + charByte : charByte;
    }
    if (str.length > 4) return _Atom2.fromString(octs.join(""), 16);
    else return new _Atom2(BigInt(parseInt(octs.join(""), 16)));
  }
};
_Atom = Atom;
Atom.small = /* @__PURE__ */ Array.from(Array(256)).map(function(_, i) {
  return new _Atom(BigInt(i));
});
Atom.zero = _Atom.small[0];
Atom.one = _Atom.small[1];
Atom.two = _Atom.small[2];
Atom.three = _Atom.small[3];
var Cell = class _Cell {
  constructor(head, tail, deep) {
    if (deep === void 0) {
      deep = true;
    }
    this.head = void 0;
    this.tail = void 0;
    this.deep = void 0;
    this._mug = 0;
    this.head = head;
    this.tail = tail;
    this.deep = deep;
  }
  // common methods
  isAtom() {
    return false;
  }
  isCell() {
    return true;
  }
  pretty(out, hasTail) {
    if (!hasTail) out.push("[");
    this.head.pretty(out, false);
    out.push(" ");
    this.tail.pretty(out, true);
    if (!hasTail) out.push("]");
  }
  toString() {
    const parts = [];
    this.pretty(parts, false);
    return parts.join("");
  }
  mug() {
    if (this._mug === 0) this._mug = this.calculateMug();
    return this._mug;
  }
  calculateMug() {
    return mum(3735928559, 65534, BigInt(this.tail.mug()) << 32n | BigInt(this.head.mug()));
  }
  mugged() {
    return this._mug !== 0;
  }
  equals(o) {
    if (o instanceof _Cell) return this.unify(o);
    else return false;
  }
  bump() {
    throw new Error("Bail");
  }
  loob() {
    throw new Error("Bail");
  }
  at(a) {
    return Atom.fragmenter(a)(this);
  }
  // Cell specific
  unify(o) {
    if (this === o) return true;
    if (o.mugged()) {
      if (this.mugged()) {
        if (this.mug() != o.mug()) return false;
      } else return o.unify(this);
    }
    if (this.head.equals(o.head)) {
      o.head = this.head;
      if (this.tail.equals(o.tail)) {
        o._mug = this._mug;
        o.tail = this.tail;
        return true;
      }
    }
    return false;
  }
};
function isAtom(a) {
  return a instanceof Atom;
}
function isCell(a) {
  return a instanceof Cell;
}
function isNoun(a) {
  return isAtom(a) || isCell(a);
}
function met(a, b) {
  var bits2 = bitLength(b.number), full = bits2 >>> a, part = full << a !== bits2;
  return part ? full + 1 : full;
}
function gth(a, b) {
  return a.number > b.number;
}
function lth(a, b) {
  return a.number < b.number;
}
function gte(a, b) {
  return a.number >= b.number;
}
function lte(a, b) {
  return a.number <= b.number;
}
function add(a, b) {
  return new Atom(a.number + b.number);
}
function sub(a, b) {
  var r = a.number - b.number;
  if (r < 0) {
    throw new Error("subtract underflow");
  } else {
    return new Atom(r);
  }
}
function dec(a) {
  return sub(a, Atom.one);
}
function bex(a) {
  const b = 1n << a.number;
  return new Atom(b);
}
function lsh(a, b, c) {
  var bits2 = Number(b.number << a.number);
  return new Atom(c.number << BigInt(bits2));
}
function rsh(a, b, c) {
  var bits2 = b.number << a.number;
  return new Atom(c.number >> BigInt(bits2));
}
function bytesToWords(bytes) {
  var len = bytes.length, trim = len % 4;
  let i, b, w;
  if (trim > 0) {
    len += 4 - trim;
    for (i = 0; i < trim; ++i) {
      bytes.push(0);
    }
  }
  const size = len >> 2;
  const words = new Array(size);
  for (i = 0, b = 0; i < size; ++i) {
    w = bytes[b++] << 0 & 255;
    w ^= bytes[b++] << 8 & 65280;
    w ^= bytes[b++] << 16 & 16711680;
    w ^= bytes[b++] << 24 & 4278190080;
    words[i] = w;
  }
  return words;
}
function wordsToBytes(words) {
  const buf = [];
  let w, i, b;
  for (i = 0, b = 0; i < words.length; ++i) {
    w = words[i];
    buf[b++] = 255 & (w & 255);
    buf[b++] = 255 & (w & 65280) >>> 8;
    buf[b++] = 255 & (w & 16711680) >>> 16;
    buf[b++] = 255 & (w & 4278190080) >>> 24;
  }
  while (buf[--b] === 0) {
    buf.pop();
  }
  return buf;
}
function bytesToAtom(bytes) {
  let byt, parts = [];
  for (var i = bytes.length - 1; i >= 0; --i) {
    byt = bytes[i] & 255;
    parts.push(byt < 16 ? "0" + byt.toString(16) : byt.toString(16));
  }
  const num = bigIntFromStringWithRadix(parts.join(""), 16);
  return new Atom(num);
}
function atomToBytes(atom) {
  return atom.bytes();
}
function atomToWords(atom) {
  return bytesToWords(atomToBytes(atom));
}
function wordsToAtom(words) {
  return bytesToAtom(wordsToBytes(words));
}
var malt = wordsToAtom;
function slaq(bloq, len) {
  return new Array((len << bloq) + 31 >>> 5);
}
function chop(met2, fum, wid, tou, dst, src) {
  var buf = atomToWords(src), len = buf.length, i, j, san, mek, baf, bat, hut, san, wuf, wut, waf, raf, wat, rat, hop;
  if (met2 < 5) {
    san = 1 << met2;
    mek = (1 << san) - 1;
    baf = fum << met2;
    bat = tou << met2;
    for (i = 0; i < wid; ++i) {
      waf = baf >>> 5;
      raf = baf & 31;
      wat = bat >>> 5;
      rat = bat & 31;
      hop = waf >= len ? 0 : buf[waf];
      hop = hop >>> raf & mek;
      dst[wat] ^= hop << rat;
      baf += san;
      bat += san;
    }
  } else {
    hut = met2 - 5;
    san = 1 << hut;
    for (i = 0; i < wid; ++i) {
      wuf = fum + i << hut;
      wut = tou + i << hut;
      for (j = 0; j < san; ++j) {
        dst[wut + j] ^= wuf + j >= len ? 0 : buf[wuf + j];
      }
    }
  }
}
function cut(a, b, c, d) {
  if (a.number === 0n) {
    return new Atom(d.number >> b.number & (1n << c.number) - 1n);
  }
  var ai = Number(a.number), bi = Number(b.number), ci = Number(c.number);
  var len = met(ai, d);
  if (Atom.zero.equals(c) || bi >= len) {
    return Atom.zero;
  }
  if (bi + ci > len) {
    ci = len - Number(b.number);
  }
  if (0 === bi && ci === len) {
    return d;
  } else {
    var sal = slaq(ai, ci);
    chop(ai, bi, ci, 0, sal, d);
    return malt(sal);
  }
}
var maxCat = /* @__PURE__ */ Atom.fromInt(4294967295);
var catBits = /* @__PURE__ */ Atom.fromInt(32);
function end(a, b, c) {
  if (gth(a, catBits)) {
    throw new Error("Fail");
  } else if (gth(b, maxCat)) {
    return c;
  } else {
    var ai = Number(a.number), bi = Number(b.number), len = met(ai, c);
    if (0 === bi) {
      return Atom.zero;
    } else if (bi >= len) {
      return c;
    } else {
      var sal = slaq(ai, bi);
      chop(ai, 0, bi, 0, sal, c);
      return malt(sal);
    }
  }
}
function mix(a, b) {
  return new Atom(a.number ^ b.number);
}
function cat(a, b, c) {
  if (gth(a, catBits)) {
    throw new Error("Fail");
  } else {
    var ai = Number(a.number), lew = met(ai, b), ler = met(ai, c), all = lew + ler;
    if (0 === all) {
      return Atom.zero;
    } else {
      const sal = slaq(ai, all);
      chop(ai, 0, lew, 0, sal, b);
      chop(ai, 0, ler, lew, sal, c);
      return malt(sal);
    }
  }
}
function can(a, b) {
  if (gth(a, catBits)) {
    throw new Error("Fail");
  } else {
    let ai = Number(a.number), tot = 0, cab = b, pos, i_cab, pi_cab, qi_cab;
    while (true) {
      if (Atom.zero.equals(cab)) break;
      if (cab instanceof Atom) throw new Error("Fail");
      i_cab = cab.head;
      if (i_cab instanceof Atom) throw new Error("Fail");
      else if (i_cab instanceof Cell) {
        pi_cab = i_cab.head;
        qi_cab = i_cab.tail;
      }
      if (pi_cab instanceof Atom && gth(pi_cab, maxCat)) throw new Error("Fail");
      if (qi_cab instanceof Cell) throw new Error("Fail");
      if (pi_cab instanceof Atom) tot += Number(pi_cab.number);
      if (cab instanceof Cell) cab = cab.tail;
    }
    if (0 === tot) return Atom.zero;
    var sal = slaq(ai, tot);
    cab = b;
    pos = 0;
    while (!Atom.zero.equals(cab)) {
      if (cab instanceof Cell) i_cab = cab.head;
      if (i_cab instanceof Cell) {
        if (i_cab.head instanceof Atom) pi_cab = Number(i_cab.head.number);
        qi_cab = i_cab.tail;
        chop(ai, 0, pi_cab, pos, sal, qi_cab);
        pos += pi_cab;
        if (cab instanceof Cell) cab = cab.tail;
      }
    }
    return malt(sal);
  }
}
var bits = {
  met,
  cut,
  add,
  sub,
  dec,
  gth,
  lth,
  gte,
  lte,
  bex,
  lsh,
  rsh,
  end,
  mix,
  cat,
  can,
  bytesToWords,
  wordsToBytes,
  bytesToAtom,
  atomToBytes,
  atomToWords,
  wordsToAtom
};
var dwim = dejs.dwim;
function flop(a) {
  var b = Atom.zero;
  while (true) {
    if (Atom.zero.equals(a)) {
      return b;
    } else if (a instanceof Atom) {
      throw new Error("Bail");
    } else {
      b = new Cell(a.head, b);
      a = a.tail;
    }
  }
}
function forEach(n, f) {
  while (true) {
    if (Atom.zero.equals(n)) {
      return;
    } else if (n instanceof Atom) {
      throw new Error("Bail");
    } else {
      f(n.head);
      n = n.tail;
    }
  }
}
var list = {
  flop,
  forEach
};
var Slot = class {
};
var Node = class extends Slot {
  constructor() {
    super();
    this.slots = void 0;
    this.slots = Array(32);
  }
  insert(key, val, lef, rem) {
    lef -= 5;
    const inx = rem >>> lef;
    rem &= (1 << lef) - 1;
    this.slots[inx] = void 0 === this.slots[inx] ? new Single(key, val) : this.slots[inx].insert(key, val, lef, rem);
    return this;
  }
  get(key, lef, rem) {
    lef -= 5;
    const inx = rem >>> lef;
    rem &= (1 << lef) - 1;
    const sot = this.slots[inx];
    return void 0 === sot ? void 0 : sot.get(key, lef, rem);
  }
};
var Bucket = class extends Slot {
  constructor() {
    super();
    this.singles = void 0;
    this.singles = [];
  }
  insert(key, val, lef, rem) {
    const a = this.singles;
    for (var i = 0; i < a.length; ++i) {
      const s = a[i];
      if (s.key.equals(key)) {
        s.val = val;
        return this;
      }
    }
    a.push(new Single(key, val));
    return this;
  }
  get(key) {
    const a = this.singles;
    for (var i = 0; i < a.length; ++i) {
      const s = a[i];
      if (s.key.equals(key)) {
        return s.val;
      }
    }
  }
};
var Single = class extends Slot {
  constructor(key, val) {
    super();
    this.key = void 0;
    this.val = void 0;
    this.key = key;
    this.val = val;
  }
  insert(key, val, lef, rem) {
    if (this.key.equals(key)) {
      this.val = val;
      return this;
    } else {
      const rom = this.key.mug() & (1 << lef) - 1;
      const n = lef > 0 ? new Node() : new Bucket();
      n.insert(this.key, this.val, lef, rom);
      n.insert(key, val, lef, rem);
      return n;
    }
  }
  get(key) {
    if (this.key.equals(key)) return this.val;
  }
};
var NounMap = class {
  constructor() {
    this.slots = void 0;
    this.slots = Array(64);
  }
  insert(key, val) {
    const m = key.mug();
    const inx = m >>> 25;
    const sot = this.slots;
    if (sot[inx] === void 0) sot[inx] = new Single(key, val);
    else {
      var rem = m & (1 << 25) - 1;
      sot[inx] = sot[inx].insert(key, val, 25, rem);
    }
  }
  get(key) {
    const m = key.mug();
    const inx = m >>> 25;
    const sot = this.slots[inx];
    if (void 0 === sot) {
      return void 0;
    } else {
      var rem = m & (1 << 25) - 1;
      return sot.get(key, 25, rem);
    }
  }
};
function bytesToBigint(bytes) {
  if (bytes.length === 1) return BigInt(bytes[0]);
  let byt, parts = [];
  for (var i = bytes.length - 1; i >= 0; --i) {
    byt = bytes[i] & 255;
    parts.push(byt.toString(16).padStart(2, "0"));
  }
  const num = bigIntFromStringWithRadix(parts.join(""), 16);
  return num;
}
function dv_bit(b, d) {
  const byte = Math.floor(b / 8);
  return d.getUint8(byte) >> b % 8 & 1;
}
function dv_bitLength(d) {
  const l = d.byteLength - 1;
  if (l > 2 ** 49) throw new Error("bail: oversized byte buffer");
  return l * 8 + d.getUint8(l).toString(2).length;
}
function dv_cut(b, c, d) {
  if (c === 1) return dv_bit(b, d) ? 1n : 0n;
  const offset = b % 8;
  if (offset === 0) return dv_cut_at_bytes(b, c, d);
  const out = [];
  let curByte = Math.floor(b / 8);
  const bitsFromOne = 8 - offset;
  const bitsFromTwo = offset;
  const twoMask = 255 >> 8 - bitsFromTwo;
  while (c >= 8) {
    const one = d.getUint8(curByte);
    const two = d.getUint8(curByte + 1);
    const left = (two & twoMask) << bitsFromOne;
    const right = one >> bitsFromTwo;
    out.push(left | right);
    curByte++;
    c -= 8;
  }
  if (c > 0n) {
    const bitsFromOne2 = Math.min(c, 8 - offset);
    const bitsFromTwo2 = c - bitsFromOne2;
    const oneMask = 255 >> 8 - bitsFromOne2 << offset;
    const twoMask2 = 255 >> 8 - bitsFromTwo2;
    const one = d.getUint8(curByte);
    const two = curByte + 1 >= d.byteLength ? 0 : d.getUint8(curByte + 1);
    const left = bitsFromTwo2 === 0 ? 0 : (two & twoMask2) << bitsFromOne2;
    const right = (one & oneMask) >> offset;
    out.push(left | right);
  }
  return bytesToBigint(out);
}
function dv_cut_at_bytes(b, c, d) {
  if (b % 8 !== 0) throw new Error("non-byte-aligned read " + b);
  let curByte = Math.floor(b / 8);
  const out = [];
  while (c >= 8) {
    out.push(d.getUint8(curByte));
    curByte++;
    c -= 8;
  }
  if (c > 0n) {
    out.push(d.getUint8(curByte) & 255 >> 8 - c);
  }
  return bytesToBigint(out);
}
function rub(a, v, l) {
  var c, d, e, w, x, y, z, p, q, m;
  m = a + l;
  x = a;
  while (0 === dv_bit(x, v)) {
    y = x + 1;
    if (x > m) throw new Error("bail: rubbing past end");
    x = y;
  }
  if (a === x) return {
    head: 1,
    tail: Atom.zero
  };
  c = x - a;
  d = x + 1;
  x = c - 1;
  if (x > 52) throw new Error("bail: rubbing oversized pointer (>52 bits)");
  y = 2 ** x;
  z = Number(dv_cut(d, x, v));
  e = y + z;
  w = c + c;
  y = w + e;
  z = d + x;
  p = w + e;
  q = dv_cut(z, e, v);
  return {
    head: p,
    tail: new Atom(q)
  };
}
function insert(m, k, n) {
  return m[k] = n;
}
function get(m, k) {
  return m[k];
}
function cue_in(m, vv, l, b) {
  let head;
  let tailhead;
  if (0 === dv_bit(b, vv)) {
    const x = 1 + b;
    const c = rub(x, vv, l);
    head = c.head + 1;
    tailhead = c.tail;
    insert(m, b, tailhead);
  } else {
    let b2 = 2 + b;
    let b1 = 1 + b;
    if (0 === dv_bit(b1, vv)) {
      const u = cue_in(m, vv, l, b2);
      const x = u.head + b2;
      const v = cue_in(m, vv, l, x);
      const y = u.head + v.head;
      head = 2 + y;
      tailhead = new Cell(u.tail, v.tail);
      insert(m, b, tailhead);
    } else {
      const d = rub(b2, vv, l);
      const dd = get(m, Number(d.tail.number));
      if (void 0 === dd) throw new Error("Bail");
      head = 2 + d.head;
      tailhead = dd;
    }
  }
  return {
    head,
    tail: tailhead
  };
}
function cue_bytes(v) {
  return cue_in({}, v, dv_bitLength(v), 0).tail;
}
function mat(a) {
  if (Atom.zero.equals(a)) {
    return dwim(1, 1);
  } else {
    const b = dwim(bits.met(0, a)), c = dwim(bits.met(0, b)), u = bits.dec(c), v = bits.add(c, c), x = bits.end(Atom.zero, u, b), w = bits.bex(c), y = bits.lsh(Atom.zero, u, a), z = bits.mix(x, y), p = bits.add(v, b), q = bits.cat(Atom.zero, w, z);
    return dwim(p, q);
  }
}
function _jam_in_pair(m, h_a, t_a, b, l) {
  var w = dwim([2, 1], l), x = bits.add(Atom.two, b), d = _jam_in(m, h_a, x, w), y = bits.add(x, d.head), e = _jam_in(m, t_a, y, d.tail.head), z = bits.add(d.head, e.head);
  return dwim(bits.add(Atom.two, z), e.tail.head, Atom.zero);
}
function _jam_in_ptr(u_c, l) {
  var d = mat(u_c), x = bits.lsh(Atom.zero, Atom.two, d.tail), y = bits.add(Atom.two, d.head);
  return dwim(y, [[y, bits.mix(Atom.three, x)], l], Atom.zero);
}
function _jam_in_flat(a, l) {
  var d = mat(a), x = bits.add(Atom.one, d.head);
  return dwim(x, [[x, bits.lsh(Atom.zero, Atom.one, d.tail)], l], Atom.zero);
}
function _jam_in(m, a, b, l) {
  const c = m.get(a);
  if (void 0 == c) {
    m.insert(a, b);
    return a instanceof Cell ? _jam_in_pair(m, a.head, a.tail, b, l) : _jam_in_flat(a, l);
  } else if (a instanceof Atom && bits.met(0, a) <= bits.met(0, c)) {
    return _jam_in_flat(a, l);
  } else {
    return _jam_in_ptr(c, l);
  }
}
function jam(n) {
  const x = _jam_in(new NounMap(), n, Atom.zero, Atom.zero), q = list.flop(x.tail.head);
  return bits.can(Atom.zero, q);
}

// ../bin/transport-sidecar.mjs
var args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Theseus transport sidecar

Usage:
  node theseus-sidecar.mjs --lick-socket <path> --moons-map <json> \\
    --gateway <host>=127.0.0.1:<ames-port> --gateway-num <host-@p> \\
    --bind 0.0.0.0:<base-port>

Required for the recommended noun-Lick mode:
  --lick-socket <path>  <pier>/.urb/dev/theseus-pyre/ames
  --moons-map <json>    map of "~moon-name" to decimal @p
  --gateway <route>     host ship and its local Ames UDP address
  --gateway-num <@p>    host ship as a decimal @p
  --bind <address:port> first UDP address; one consecutive port per moon

Optional:
  --packet-log          log every inbound and outbound packet
  --galaxy-via-gateway  route galaxy packets through the host
  --turf <domain>       galaxy DNS suffix (default: urbit.org)
  --czar-base <port>    galaxy UDP base (default: 13337)
  --help                show this text
`);
  process.exit(0);
}
var ship = stripSig(args.ship || process.env.URBIT_SHIP || "zod");
var url = trimSlash(args.url || process.env.URBIT_URL || "http://localhost:8082");
var pier = args.pier || process.env.URBIT_PIER || "/Users/chris/Enviorment/urbit-dev/ships/zod";
var code = args.code || process.env.URBIT_CODE || readCode(pier);
var uid = `theseus-transport-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
var galaxyViaGateway = args["galaxy-via-gateway"] === "true";
var packetLogEnabled = args["packet-log"] === "true";
var bindSpec = args.bind || "0.0.0.0:39999";
var peers = /* @__PURE__ */ new Map();
if (args.fake) addPeer("~zod", "127.0.0.1:31337");
for (const p of asList(args.peer)) {
  const [who, hostport] = parsePeerSpec(p, "--peer");
  addPeer(who, hostport, "--peer");
}
var gatewayShip = null;
if (args.gateway) {
  const [who, hostport] = parsePeerSpec(args.gateway, "--gateway");
  addPeer(who, hostport, "--gateway");
  gatewayShip = who.startsWith("~") ? who : `~${who}`;
}
var gatewayNum = null;
if (args["gateway-num"] != null) {
  const text = String(args["gateway-num"]);
  if (!/^\d+$/.test(text)) fail(`--gateway-num must be an unsigned decimal @p: ${text}`);
  gatewayNum = BigInt(text);
  if (!gatewayShip) fail("--gateway-num requires --gateway");
}
var peersByAddr = /* @__PURE__ */ new Map();
for (const [who, { addr, port }] of peers) peersByAddr.set(`${addr}:${port}`, who);
var moonNums = loadMoonsMap(args);
var moons = /* @__PURE__ */ new Set([...Object.keys(moonNums), ...asList(args.moon).map(stripSig)]);
var moonByNum = /* @__PURE__ */ new Map();
for (const [name, num] of Object.entries(moonNums)) moonByNum.set(BigInt(num), name);
var RANK_BYTES = [2, 4, 8, 16];
var turf = args.turf || process.env.URBIT_TURF || "urbit.org";
var czarBase = parsePort(args["czar-base"] || (args.fake ? 31337 : 13337), "--czar-base");
var [bindAddr, bindPort] = parseHostPort(bindSpec, "--bind");
if (!galaxyViaGateway && !args.fake && isLoopbackBind(bindAddr)) {
  console.warn(`[transport] warning: ${bindSpec} is loopback-only; direct live-net replies usually need --bind 0.0.0.0:<port>`);
}
var lickSocket = args["lick-socket"] || "";
var lickConn = null;
var eventId = 1;
var lastSeenId = 0;
var lastAckedId = 0;
var pendingAckId = 0;
var ackInFlight = false;
var ackRetryTimer = null;
var ackErrorLogAt = 0;
var cookie = args.cookie || process.env.URBIT_COOKIE || "";
var EYRE_INGRESS_BATCH = 32;
var EYRE_INGRESS_MAX = 512;
var EYRE_RETRY_MS = 250;
var EYRE_ERROR_LOG_MS = 3e4;
var eyreIngressQueue = [];
var eyreIngressActive = false;
var eyreIngressRetryTimer = null;
var eyreIngressErrorLogAt = 0;
var eyreIngressDropLogAt = 0;
if (!lickSocket) {
  if (!code && !cookie) fail("No Urbit code or cookie. Pass --code / --cookie.");
  if (!cookie) cookie = await login(url, code);
}
var GALAXIES = "zodnecbudwessevpersutletfulpensytdurwepserwylsunrypsyxdyrnuphebpeglupdepdysputlughecryttyvsydnexlunmeplutseppesdelsulpedtemledtulmetwenbynhexfebpyldulhetmevruttylwydtepbesdexsefwycburderneppurrysrebdennutsubpetrulsynregtydsupsemwynrecmegnetsecmulnymtevwebsummutnyxrextebfushepbenmuswyxsymselrucdecwexsyrwetdylmynmesdetbetbeltuxtugmyrpelsyptermebsetdutdegtexsurfeltudnuxruxrenwytnubmedlytdusnebrumtynseglyxpunresredfunrevrefmectedrusbexlebduxrynnumpyxrygryxfeptyrtustyclegnemfermertenlusnussyltecmexpubrymtucfyllepdebbermughuttunbylsudpemdevlurdefbusbeprunmelpexdytbyttyplevmylwedducfurfexnulluclennerlexrupnedlecrydlydfenwelnydhusrelrudneshesfetdesretdunlernyrsebhulrylludremlysfynwerrycsugnysnyllyndyndemluxfedsedbecmunlyrtesmudnytbyrsenwegfyrmurtelreptegpecnelnevfes".match(/.{3}/g);
function galaxyNum(name) {
  return GALAXIES.indexOf(stripSig(name));
}
var DNS_OK_TTL_MS = 6e4;
var DNS_FAIL_TTL_MS = 1e4;
var DNS_FAIL_LOG_MS = 3e4;
var dnsCache = /* @__PURE__ */ new Map();
var dnsFailureLogAt = /* @__PURE__ */ new Map();
async function resolveHost(host) {
  const now = Date.now();
  const hit = dnsCache.get(host);
  if (hit?.pending) return hit.pending;
  if (hit && hit.exp > now) return hit.addr;
  const pending = dns.lookup(host, { family: 4 }).then(({ address }) => {
    dnsCache.set(host, { addr: address, exp: Date.now() + DNS_OK_TTL_MS });
    return address;
  }).catch(() => {
    dnsCache.set(host, { addr: null, exp: Date.now() + DNS_FAIL_TTL_MS });
    return null;
  });
  dnsCache.set(host, { addr: null, exp: 0, pending });
  return pending;
}
function logDnsFailure(host) {
  const now = Date.now();
  const last = dnsFailureLogAt.get(host) || 0;
  if (now - last < DNS_FAIL_LOG_MS) return;
  dnsFailureLogAt.set(host, now);
  console.log(`[transport] DNS fail ${host}, drop (suppressed for ${DNS_FAIL_LOG_MS / 1e3}s)`);
}
async function sendToGalaxy(udp, name, gnum, bytes, from) {
  const host = `${name}.${turf}`;
  const port = czarBase + gnum;
  const addr = await resolveHost(host);
  if (!addr) {
    logDnsFailure(host);
    return;
  }
  udp.send(bytes, port, addr, (e) => {
    if (e) console.error("[transport] galaxy send err:", e);
  });
  if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> ~${name} galaxy ${host}:${port} (${addr}) ${bytes.length}B ${packetSummary(bytes)}`);
}
var udpRecords = [];
var udpByName = /* @__PURE__ */ new Map();
var udpByNum = /* @__PURE__ */ new Map();
var moonNames = [...moons].sort((a, b) => {
  const an = moonNums[a] == null ? null : BigInt(moonNums[a]);
  const bn = moonNums[b] == null ? null : BigInt(moonNums[b]);
  if (an == null && bn == null) return a.localeCompare(b);
  if (an == null) return 1;
  if (bn == null) return -1;
  return an < bn ? -1 : an > bn ? 1 : 0;
});
if (!moonNames.length) fail("No virtual moons configured. Pass --moons-map or --moon.");
for (let i = 0; i < moonNames.length; i += 1) {
  const name = moonNames[i];
  const num = moonNums[name] == null ? null : BigInt(moonNums[name]);
  const port = bindPort + i;
  const udp = dgram.createSocket("udp4");
  const rec = { name, num, port, udp };
  udp.on("message", (buf, rinfo) => onUdpForMoon(rec, buf, rinfo));
  try {
    await bindUdp(udp, port, bindAddr);
  } catch (e) {
    fail(`Cannot bind UDP for ~${name} at ${bindAddr}:${port}: ${e.code || e.message}`);
  }
  udp.on("error", (e) => console.error(`[transport] udp ~${name} error:`, e));
  udpRecords.push(rec);
  udpByName.set(name, rec);
  if (num != null) udpByNum.set(num, rec);
  console.log(`[transport] udp ~${name} bound ${bindAddr}:${port}`);
}
console.log(galaxyViaGateway ? `[transport] galaxies via gateway: ${gatewayShip || "(missing --gateway)"}` : `[transport] galaxies via DNS: *.${turf} port ${czarBase}+n${args.fake ? " (fakenet)" : ""}`);
console.log(`[transport] peers: ${[...peers].map(([w, a]) => `${w}->${a.addr}:${a.port}`).join(", ") || "(none)"}`);
if (gatewayNum != null) console.log(`[transport] gateway direct-lane override: @p:${gatewayNum}`);
console.log(`[transport] moons: ${[...moons].map((m) => `~${m}`).join(", ") || "(none)"}`);
console.log(`[transport] packet log: ${packetLogEnabled ? "enabled" : "disabled (pass --packet-log to enable)"}`);
var heartbeatFile = args.heartbeat || process.env.SIDECAR_HEARTBEAT || "";
function beat() {
  if (!heartbeatFile) return;
  try {
    fs.writeFileSync(heartbeatFile, String(Date.now()));
  } catch {
  }
}
beat();
if (lickSocket) {
  await setupLickTransport(lickSocket);
} else {
  console.log(`[transport] host=~${ship} url=${url}, watching %theseus-pyre /ames/outbound`);
  await channelPut([
    { id: nextId(), action: "subscribe", ship, app: "theseus-pyre", path: "/ames/outbound" }
  ]);
  const sse = readSse(`${url}/~/channel/${uid}`, cookie, onChannel);
  const ackTimer = setInterval(() => {
    if (lastSeenId > lastAckedId) requestAck(lastSeenId);
  }, 500);
  const beatTimer = setInterval(() => {
    const p = lastSeenId > 0 ? channelPut([{ id: nextId(), action: "ack", "event-id": lastSeenId }]) : Promise.resolve();
    p.then(beat).catch((e) => console.error("[transport] heartbeat channel check failed:", e.message));
  }, 2e4);
  process.on("SIGINT", async () => {
    console.log("\n[transport] closing");
    clearInterval(ackTimer);
    clearInterval(beatTimer);
    sse.abort();
    for (const rec of udpRecords) {
      try {
        rec.udp.close();
      } catch {
      }
    }
    try {
      await channelDelete();
    } catch {
    }
    process.exit(0);
  });
  await sse.done;
}
function onChannel(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  beat();
  for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
    const msgId = channelEventId(msg);
    if (msgId != null) {
      if (msgId > lastSeenId) lastSeenId = msgId;
      requestAck(msgId);
    }
    if (msg && msg.response === "poke") {
      if (msg.err) console.error("[transport] POKE NACK:", msg.err);
      continue;
    }
    const fact = extractFact(msg);
    if (!fact) continue;
    const out = fact.ship && fact.blob ? fact : fact["ames-outbound"] || fact["mesa-outbound"];
    if (!out || !out.blob) continue;
    const from = stripSig(out.ship);
    const rec = udpByName.get(from) || (udpRecords.length === 1 ? udpRecords[0] : null);
    if (!rec) {
      console.log(`[transport] no UDP endpoint for ~${from}, drop`);
      continue;
    }
    const bytes = atomHexToBufferLE(out.blob, Number(out["blob-len"] ?? 0));
    if (Array.isArray(out["lane-jams"])) {
      for (const laneJam of out["lane-jams"]) {
        let lane;
        try {
          lane = cueAtomHex(laneJam);
        } catch (e) {
          console.error("[transport] malformed mesa lane jam:", e.message);
          continue;
        }
        sendMesaLane(rec, from, lane, bytes);
      }
      continue;
    }
    const target = out["lane-ship"] ? stripSig(out["lane-ship"]) : null;
    if (!target) {
      if (sendConfiguredGatewayOverride(rec, from, bytes)) continue;
      const la = decodeLane(out["lane-addr"]);
      if (la) {
        rec.udp.send(bytes, la.port, la.addr, (e) => {
          if (e) console.error("[transport] direct send err:", e);
        });
        if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> direct ${la.addr}:${la.port} ${bytes.length}B ${packetSummary(bytes)}`);
        continue;
      }
      console.log(`[transport] skip non-ship lane from ${from} (addr=${out["lane-addr"] ?? "none"})`);
      continue;
    }
    if (moons.has(target)) {
      const dest = udpByName.get(target);
      if (!dest) {
        console.log(`[transport] no local endpoint for ~${target}, drop`);
        continue;
      }
      rec.udp.send(bytes, dest.port, "127.0.0.1", (e) => {
        if (e) console.error("[transport] local moon send err:", e);
      });
      if (packetLogEnabled) console.log(`[transport] LOCAL ~${from} -> ~${target} ${bytes.length}B ${packetSummary(bytes)}`);
      continue;
    }
    const gnum = galaxyNum(target);
    if (gnum >= 0) {
      if (galaxyViaGateway) {
        sendViaGateway(rec, from, bytes, `galaxy ~${target}`);
      } else {
        sendToGalaxy(rec.udp, target, gnum, bytes, from);
      }
      continue;
    }
    const peer = peers.get(`~${target}`) || gatewayShip && peers.get(gatewayShip);
    if (!peer) {
      console.log(`[transport] no route for ~${target}, drop`);
      continue;
    }
    rec.udp.send(bytes, peer.port, peer.addr, (e) => {
      if (e) console.error("[transport] send err:", e);
    });
    if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> ~${target} (${peer.addr}:${peer.port}) ${bytes.length}B ${packetSummary(bytes)}`);
  }
}
function onUdpForMoon(rec, buf, rinfo) {
  if (lickSocket) {
    onUdpLick(rec, buf, rinfo);
    return;
  }
  onUdp(rec, buf, rinfo);
}
function onUdp(rec, buf, rinfo) {
  const isMesa = isMesaPact(buf);
  if (isMesa) {
    const hex2 = bufferLEToAtomHex(buf);
    if (packetLogEnabled) console.log(`[transport] IN mesa -> ~${rec.name} ${buf.length}B udp=:${rec.port} lane=${rinfo.address}:${rinfo.port} ${packetSummary(buf)}`);
    pokeMesaInbound(rec.name, rinfo.address, rinfo.port, hex2);
    return;
  }
  if (!legacyTargets(rec, buf)) return;
  const from = peersByAddr.get(`${rinfo.address}:${rinfo.port}`) || firstPeerShip();
  const hex = bufferLEToAtomHex(buf);
  if (packetLogEnabled) console.log(`[transport] IN  ${from} -> ~${rec.name} ${buf.length}B udp=:${rec.port} ${packetSummary(buf)}`);
  pokeInbound(rec.name, stripSig(from), hex);
}
function legacyTargets(rec, buf) {
  return legacyMatch(rec, buf) != null;
}
function legacyMatch(rec, buf) {
  if (rec.num == null) return udpRecords.length === 1 ? { sndr: 0n } : null;
  const s = parseShot(buf);
  if (s && s.rcvr === rec.num) return s;
  return null;
}
function isMesaPact(buf) {
  return buf.length >= 8 && buf.readUInt32LE(4) === 1742733824;
}
function leToBig(b) {
  let n = 0n;
  for (let i = b.length - 1; i >= 0; i -= 1) n = n << 8n | BigInt(b[i]);
  return n;
}
function parseShot(buf) {
  if (!buf || buf.length < 6) return null;
  const header = buf.readUInt32LE(0);
  const sndrSize = RANK_BYTES[buf[0] >> 7 & 1 | (buf[1] & 1) << 1];
  const rcvrSize = RANK_BYTES[buf[1] >> 1 & 3];
  const relayed = (header >>> 31 & 1) === 0;
  const rawBody = buf.subarray(4);
  if (relayed && rawBody.length < 7) return null;
  const body = relayed ? rawBody.subarray(6) : rawBody;
  const req = (header >>> 2 & 1) === 0;
  const sam = (header >>> 3 & 1) === 0;
  const content = body.subarray(1 + sndrSize + rcvrSize);
  let fineNum = null;
  let finePath = null;
  if (req && !sam && content.length >= 7 && content[0] === 0) {
    const len = content.readUInt16LE(5);
    if (content.length >= 7 + len) {
      fineNum = content.readUInt32LE(1);
      finePath = content.subarray(7, 7 + len).toString("utf8");
    }
  }
  return {
    sndr: leToBig(body.subarray(1, 1 + sndrSize)),
    rcvr: leToBig(body.subarray(1 + sndrSize, 1 + sndrSize + rcvrSize)),
    req,
    sam,
    version: header >>> 4 & 7,
    relayed,
    sndrTick: body[0] & 15,
    rcvrTick: body[0] >>> 4 & 15,
    headerHex: buf.subarray(0, 5).toString("hex"),
    fineNum,
    finePath
  };
}
function packetSummary(buf) {
  if (isMesaPact(buf)) return "pkt=mesa";
  const s = parseShot(buf);
  if (!s) return "pkt=unparsed";
  const fine = s.finePath == null ? "" : ` fine=${s.fineNum}:${s.finePath}`;
  return `pkt=ames sndr=${shipLabel(s.sndr)} rcvr=${shipLabel(s.rcvr)} req=${Number(s.req)} sam=${Number(s.sam)} relayed=${Number(s.relayed)} ticks=${s.sndrTick}/${s.rcvrTick} hdr=${s.headerHex}${fine}`;
}
function shipLabel(num) {
  if (moonByNum.has(num)) return `~${moonByNum.get(num)}`;
  const n = Number(num);
  if (Number.isInteger(n) && n >= 0 && n < GALAXIES.length) return `~${GALAXIES[n]}`;
  return `@p:${num}`;
}
function loadMoonsMap(a) {
  const out = {};
  if (a["moons-map"]) {
    try {
      const raw = JSON.parse(fs.readFileSync(a["moons-map"], "utf8"));
      for (const [k, v] of Object.entries(raw)) out[stripSig(k)] = v;
    } catch (e) {
      console.error("[transport] cannot read moons-map:", e.message);
    }
  }
  return out;
}
function pokeInbound(who, from, blobHex) {
  enqueueEyreIngress({
    id: nextId(),
    action: "poke",
    ship,
    app: "theseus",
    mark: "theseus-ames-in",
    // addr required by the ames-inbound dejs. 0x0 -> moon uses ship-lane
    // [%.y from], correct for sponsor-routed returns (reply via disden).
    // A raw galaxy/peer addr here would teach the moon a bogus direct lane.
    json: { "ames-inbound": { who: `~${who}`, from: `~${from}`, addr: "0x0", blob: blobHex } }
  });
}
function pokeMesaInbound(who, addr, port, blobHex) {
  enqueueEyreIngress({
    id: nextId(),
    action: "poke",
    ship,
    app: "theseus",
    mark: "theseus-ames-in",
    json: {
      "mesa-inbound": {
        who: `~${who}`,
        ip: bigToAtomHex(ipv4Big(addr)),
        port: bigToAtomHex(BigInt(port)),
        blob: blobHex
      }
    }
  });
}
function enqueueEyreIngress(command) {
  if (eyreIngressQueue.length >= EYRE_INGRESS_MAX) {
    const now = Date.now();
    if (now - eyreIngressDropLogAt >= EYRE_ERROR_LOG_MS) {
      eyreIngressDropLogAt = now;
      console.error(`[transport] Eyre ingress queue full (${EYRE_INGRESS_MAX}); dropping UDP packets until it drains`);
    }
    return false;
  }
  eyreIngressQueue.push(command);
  if (!eyreIngressActive && eyreIngressRetryTimer == null) void drainEyreIngress();
  return true;
}
async function drainEyreIngress() {
  if (eyreIngressActive || eyreIngressRetryTimer != null) return;
  eyreIngressActive = true;
  let failed = false;
  try {
    while (eyreIngressQueue.length) {
      const batch = eyreIngressQueue.slice(0, EYRE_INGRESS_BATCH);
      try {
        await channelPut(batch);
        eyreIngressQueue.splice(0, batch.length);
      } catch (e) {
        failed = true;
        const now = Date.now();
        if (now - eyreIngressErrorLogAt >= EYRE_ERROR_LOG_MS) {
          eyreIngressErrorLogAt = now;
          console.error("[transport] Eyre ingress PUT failed; retrying:", e.message || e);
        }
        eyreIngressRetryTimer = setTimeout(() => {
          eyreIngressRetryTimer = null;
          void drainEyreIngress();
        }, EYRE_RETRY_MS);
        break;
      }
    }
  } finally {
    eyreIngressActive = false;
    if (!failed && eyreIngressQueue.length) void drainEyreIngress();
  }
}
function decodeLane(scotHex) {
  if (!scotHex) return null;
  const clean = String(scotHex).replace(/^0x/i, "").replace(/\./g, "");
  if (!clean) return null;
  const p = BigInt("0x" + clean);
  const ip = Number(p & 0xffffffffn);
  const port = Number(p >> 32n & 0xffffn);
  const a = ip >>> 24 & 255, b = ip >>> 16 & 255, c = ip >>> 8 & 255, d = ip & 255;
  if (!port || a === 0 && b === 0 && c === 0 && d === 0) return null;
  return { addr: `${a}.${b}.${c}.${d}`, port };
}
function atomHexToBufferLE(scotHex, len) {
  const clean = String(scotHex).replace(/^0x/i, "").replace(/\./g, "");
  let n = clean === "" ? 0n : BigInt("0x" + clean);
  const size = len > 0 ? len : Math.ceil(clean.length / 2);
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i += 1) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}
function cueAtomHex(scotHex) {
  const bytes = atomHexToBufferLE(scotHex, 0);
  return cue_bytes(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}
function bufferLEToAtomHex(buf) {
  let n = 0n;
  for (let i = buf.length - 1; i >= 0; i -= 1) n = n << 8n | BigInt(buf[i]);
  return bigToAtomHex(n);
}
function bigToAtomHex(n) {
  let h = n.toString(16);
  if (h === "0") return "0x0";
  let out = "";
  while (h.length > 4) {
    out = "." + h.slice(-4) + out;
    h = h.slice(0, -4);
  }
  return "0x" + h + out;
}
function addPeer(who, hostport, label = "peer") {
  if (!who || !hostport) return;
  const [addr, port] = parseHostPort(hostport, label);
  peers.set(who.startsWith("~") ? who : `~${who}`, { addr, port });
}
function firstPeerShip() {
  const k = peers.keys().next().value;
  return k || "~zod";
}
function gatewayPeer() {
  return gatewayShip ? peers.get(gatewayShip) : null;
}
function sendViaGateway(rec, from, bytes, reason = "gateway") {
  const peer = gatewayPeer();
  if (!peer) {
    console.log(`[transport] OUT ~${from} no gateway for ${reason}, drop`);
    return false;
  }
  rec.udp.send(bytes, peer.port, peer.addr, (e) => {
    if (e) console.error("[transport] gateway send err:", e);
  });
  if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> ~${stripSig(gatewayShip)} gateway ${reason} ${bytes.length}B ${packetSummary(bytes)}`);
  return true;
}
function sendConfiguredGatewayOverride(rec, from, bytes) {
  if (gatewayNum == null) return false;
  const shot = parseShot(bytes);
  if (!shot || shot.rcvr !== gatewayNum) return false;
  return sendViaGateway(rec, from, bytes, "configured direct-lane override");
}
async function setupLickTransport(sockPath) {
  console.log(`[transport] lick mode -> ${sockPath}`);
  await new Promise((resolve) => {
    const c = net.connect(sockPath, () => {
      lickConn = c;
      beat();
      console.log(`[transport] lick connected ${sockPath}`);
      resolve();
    });
    let acc = Buffer.alloc(0);
    c.on("data", (chunk) => {
      beat();
      acc = Buffer.concat([acc, chunk]);
      while (acc.length >= 5) {
        const len = acc.readUInt32LE(1);
        if (acc.length < 5 + len) break;
        onLickOut(acc.subarray(5, 5 + len));
        acc = acc.subarray(5 + len);
      }
    });
    c.on("error", (e) => console.error("[transport] lick socket error:", e.message));
    c.on("close", () => {
      lickConn = null;
      console.error("[transport] lick socket closed; exiting for supervisor restart");
      process.exit(1);
    });
  });
  setInterval(() => {
    if (lickConn) beat();
  }, 15e3);
  process.on("SIGINT", () => {
    for (const rec of udpRecords) {
      try {
        rec.udp.close();
      } catch {
      }
    }
    try {
      lickConn && lickConn.end();
    } catch {
    }
    process.exit(0);
  });
  await new Promise(() => {
  });
}
function onLickOut(payload) {
  let noun;
  try {
    noun = cue_bytes(new DataView(payload.buffer, payload.byteOffset, payload.byteLength));
  } catch (e) {
    console.error("[transport] lick cue failed:", e.message);
    return;
  }
  if (!isCell(noun)) return;
  const mark = cordOf(atomBig(noun.head));
  if (mark === "mesa-out") {
    onLickMesaOut(noun.tail);
    return;
  }
  if (mark !== "ames-out") return;
  const who = atomBig(noun.tail.head);
  const lane = noun.tail.tail.head;
  const bytes = atomToLeBuf(atomBig(noun.tail.tail.tail));
  const from = moonByNum.get(who) || String(who);
  const rec = udpByNum.get(who) || (udpRecords.length === 1 ? udpRecords[0] : null);
  if (!rec) {
    console.log(`[transport] no UDP endpoint for ~${from}, drop`);
    return;
  }
  const tag = atomBig(lane.head);
  const val = atomBig(lane.tail);
  if (tag === 1n) {
    if (sendConfiguredGatewayOverride(rec, from, bytes)) return;
    const la = decodeLaneBig(val);
    if (!la) return;
    rec.udp.send(bytes, la.port, la.addr, (e) => {
      if (e) console.error("[transport] direct send err:", e);
    });
    if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> direct ${la.addr}:${la.port} ${bytes.length}B ${packetSummary(bytes)}`);
    return;
  }
  if (moonByNum.has(val)) {
    const dest = udpByNum.get(val);
    if (!dest) {
      console.log(`[transport] no local endpoint for ${val}, drop`);
      return;
    }
    rec.udp.send(bytes, dest.port, "127.0.0.1", (e) => {
      if (e) console.error("[transport] local moon send err:", e);
    });
    if (packetLogEnabled) console.log(`[transport] LOCAL ~${from} -> ~${dest.name} ${bytes.length}B ${packetSummary(bytes)}`);
    return;
  }
  const N = Number(val);
  if (N >= 0 && N < 256) {
    if (galaxyViaGateway) sendViaGateway(rec, from, bytes, `galaxy ~${GALAXIES[N]}`);
    else sendToGalaxy(rec.udp, GALAXIES[N], N, bytes, from);
    return;
  }
  const p = gatewayPeer();
  if (!p) {
    console.log(`[transport] OUT ~${from} no route (ship ${N}), drop`);
    return;
  }
  rec.udp.send(bytes, p.port, p.addr, (e) => {
    if (e) console.error("[transport] gw send err:", e);
  });
  if (packetLogEnabled) console.log(`[transport] OUT ~${from} -> ~${stripSig(gatewayShip)} gateway ${bytes.length}B ${packetSummary(bytes)}`);
}
function onLickMesaOut(noun) {
  if (!isCell(noun) || !isCell(noun.tail)) {
    console.log("[transport] malformed mesa-out noun; drop");
    return;
  }
  const who = atomBig(noun.head);
  const lanes = hoonList(noun.tail.head);
  const bytes = atomToLeBuf(atomBig(noun.tail.tail));
  const from = moonByNum.get(who) || String(who);
  const rec = udpByNum.get(who) || (udpRecords.length === 1 ? udpRecords[0] : null);
  if (!rec) {
    console.log(`[transport] no UDP endpoint for ~${from}, mesa drop`);
    return;
  }
  if (!lanes) {
    console.log(`[transport] malformed mesa lane list from ~${from}; drop`);
    return;
  }
  if (lanes.length === 0) {
    console.log(`[transport] OUT mesa ~${from} has no lanes; drop`);
    return;
  }
  for (const lane of lanes) sendMesaLane(rec, from, lane, bytes);
}
function sendMesaLane(rec, from, lane, bytes) {
  if (!isCell(lane)) {
    const val = atomBig(lane);
    if (moonByNum.has(val)) {
      const dest = udpByNum.get(val);
      if (!dest) {
        console.log(`[transport] no local endpoint for mesa lane ${val}; drop`);
        return;
      }
      rec.udp.send(bytes, dest.port, "127.0.0.1", (e) => {
        if (e) console.error("[transport] local mesa send err:", e);
      });
      if (packetLogEnabled) console.log(`[transport] OUT mesa ~${from} -> local ~${dest.name} ${bytes.length}B ${packetSummary(bytes)}`);
      return;
    }
    const n = Number(val);
    if (n >= 0 && n < 256) {
      if (galaxyViaGateway) sendViaGateway(rec, from, bytes, `mesa galaxy ~${GALAXIES[n]}`);
      else sendToGalaxy(rec.udp, GALAXIES[n], n, bytes, from);
      return;
    }
    const peer = gatewayPeer();
    if (!peer) {
      console.log(`[transport] OUT mesa ~${from} no route for ship ${val}; drop`);
      return;
    }
    rec.udp.send(bytes, peer.port, peer.addr, (e) => {
      if (e) console.error("[transport] mesa gateway send err:", e);
    });
    if (packetLogEnabled) console.log(`[transport] OUT mesa ~${from} -> ~${stripSig(gatewayShip)} gateway ${bytes.length}B ${packetSummary(bytes)}`);
    return;
  }
  const tag = cordOf(atomBig(lane.head));
  if (!isCell(lane.tail)) {
    console.log(`[transport] malformed mesa %${tag} lane; drop`);
    return;
  }
  const address = atomBig(lane.tail.head);
  const port = Number(atomBig(lane.tail.tail));
  if (!port) {
    console.log(`[transport] mesa %${tag} lane has no port; drop`);
    return;
  }
  if (tag === "if") {
    const addr = ipv4Text(address);
    rec.udp.send(bytes, port, addr, (e) => {
      if (e) console.error("[transport] mesa IPv4 send err:", e);
    });
    if (packetLogEnabled) console.log(`[transport] OUT mesa ~${from} -> ${addr}:${port} ${bytes.length}B ${packetSummary(bytes)}`);
    return;
  }
  if (tag === "is") {
    console.log(`[transport] OUT mesa ~${from} IPv6 lane unsupported; drop lane`);
    return;
  }
  console.log(`[transport] OUT mesa ~${from} unknown lane %${tag}; drop lane`);
}
function hoonList(noun) {
  const out = [];
  let cur = noun;
  while (isCell(cur)) {
    out.push(cur.head);
    cur = cur.tail;
  }
  return atomBig(cur) === 0n ? out : null;
}
function ipv4Text(ip) {
  const n = Number(ip & 0xffffffffn);
  return `${n >>> 24 & 255}.${n >>> 16 & 255}.${n >>> 8 & 255}.${n & 255}`;
}
function onUdpLick(rec, buf, rinfo) {
  const isMesa = isMesaPact(buf);
  const legacy = isMesa ? null : legacyMatch(rec, buf);
  if (!isMesa && !legacy) return;
  if (rec.num == null) {
    console.log(`[transport] no numeric @p for ~${rec.name}; inbound drop`);
    return;
  }
  const who = rec.num;
  if (!lickConn) return;
  const A = (v) => Atom.fromInt(v);
  const ip = ipv4Big(rinfo.address);
  let noun;
  if (isMesa) {
    const lane = new Cell(Atom.fromCord("if"), new Cell(A(ip), A(BigInt(rinfo.port))));
    noun = new Cell(
      Atom.fromCord("mesa-in"),
      new Cell(A(who), new Cell(lane, A(leToBig(buf))))
    );
  } else {
    const addr = ip | BigInt(rinfo.port) << 32n;
    noun = new Cell(
      Atom.fromCord("ames-in"),
      new Cell(A(who), new Cell(A(legacy.sndr), new Cell(A(addr), A(leToBig(buf)))))
    );
  }
  const jb = Buffer.from(jam(noun).bytes());
  const frame = Buffer.alloc(5 + jb.length);
  frame.writeUInt32LE(jb.length, 1);
  jb.copy(frame, 5);
  lickConn.write(frame);
  if (isMesa) {
    if (packetLogEnabled) console.log(`[transport] IN mesa -> ~${rec.name} ${buf.length}B udp=:${rec.port} lane=${rinfo.address}:${rinfo.port} ${packetSummary(buf)}`);
  } else if (packetLogEnabled) {
    const fine = legacy.finePath == null ? "" : ` fine=${legacy.fineNum}:${legacy.finePath}`;
    console.log(`[transport] IN ames ${legacy.sndr}->${legacy.rcvr} req=${Number(legacy.req)} sam=${Number(legacy.sam)} relayed=${Number(legacy.relayed)} ticks=${legacy.sndrTick}/${legacy.rcvrTick} hdr=${legacy.headerHex}${fine} ${buf.length}B udp=:${rec.port} lane=${rinfo.address}:${rinfo.port} ${packetSummary(buf)}`);
  }
}
function atomBig(x) {
  for (const k of ["number", "big", "n", "value"]) if (typeof x[k] === "bigint") return x[k];
  const v = x.valueOf && x.valueOf();
  return typeof v === "bigint" ? v : 0n;
}
function cordOf(bn) {
  let s = "";
  while (bn > 0n) {
    s += String.fromCharCode(Number(bn & 0xffn));
    bn >>= 8n;
  }
  return s;
}
function atomToLeBuf(bn) {
  const b = [];
  while (bn > 0n) {
    b.push(Number(bn & 0xffn));
    bn >>= 8n;
  }
  return Buffer.from(b);
}
function ipv4Big(addr) {
  const p = String(addr).split(".").map((x) => Number(x));
  return BigInt((p[0] << 24 >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]);
}
function decodeLaneBig(val) {
  const ip = Number(val & 0xffffffffn), port = Number(val >> 32n & 0xffffn);
  const a = ip >>> 24 & 255, b = ip >>> 16 & 255, c = ip >>> 8 & 255, d = ip & 255;
  if (!port || a === 0 && b === 0 && c === 0 && d === 0) return null;
  return { addr: `${a}.${b}.${c}.${d}`, port };
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = key in out ? [].concat(out[key], next) : next;
      i += 1;
    }
  }
  return out;
}
function asList(v) {
  return v == null ? [] : [].concat(v);
}
function trimSlash(s) {
  return String(s).replace(/\/+$/, "");
}
function stripSig(s) {
  return String(s).replace(/^~/, "");
}
function parsePeerSpec(spec, flag) {
  const text = String(spec || "");
  const eq = text.indexOf("=");
  if (eq <= 0 || eq === text.length - 1) fail(`${flag} must be ~ship=host:port`);
  return [text.slice(0, eq), text.slice(eq + 1)];
}
function parseHostPort(spec, flag) {
  const text = String(spec || "");
  const idx = text.lastIndexOf(":");
  if (idx <= 0 || idx === text.length - 1) fail(`${flag} must be host:port`);
  const addr = text.slice(0, idx);
  const port = parsePort(text.slice(idx + 1), flag);
  return [addr, port];
}
function parsePort(value, label) {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) fail(`${label} has invalid port: ${text || "(empty)"}`);
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`${label} port out of range: ${text}`);
  return port;
}
function isLoopbackBind(addr) {
  return addr === "127.0.0.1" || addr === "localhost";
}
function bindUdp(udp, port, addr) {
  return new Promise((resolve, reject) => {
    const onError = (e) => {
      udp.off("listening", onListening);
      reject(e);
    };
    const onListening = () => {
      udp.off("error", onError);
      resolve();
    };
    udp.once("error", onError);
    udp.once("listening", onListening);
    udp.bind(port, addr);
  });
}
function readCode(p) {
  try {
    return fs.readFileSync(path.join(p, ".urb", "code"), "utf8").trim();
  } catch {
    return "";
  }
}
async function login(baseUrl, password) {
  const res = await fetch(`${baseUrl}/~/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password }),
    redirect: "manual"
  });
  const sc = res.headers.get("set-cookie");
  if (!sc) fail(`Login returned no cookie. HTTP ${res.status}`);
  return sc.split(";")[0];
}
async function channelPut(commands) {
  const res = await fetch(`${url}/~/channel/${uid}`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(commands)
  });
  if (!res.ok) fail(`Channel PUT failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
  return res;
}
async function channelDelete() {
  await fetch(`${url}/~/channel/${uid}`, { method: "DELETE", headers: { cookie } });
}
function readSse(endpoint, cookieHeader, onMessage) {
  const controller = new AbortController();
  const done = (async () => {
    const res = await fetch(endpoint, {
      headers: { accept: "text/event-stream", cookie: cookieHeader },
      signal: controller.signal
    });
    if (!res.ok || !res.body) fail(`SSE failed: HTTP ${res.status}`);
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let split;
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const data = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
        if (data) onMessage(data);
      }
    }
  })().catch((err) => {
    if (err.name !== "AbortError") throw err;
  });
  return { abort: () => controller.abort(), done };
}
function extractFact(msg) {
  if (!msg || typeof msg !== "object") return null;
  if (msg.response === "diff" || msg.response === "fact") return msg.json ?? msg.data ?? msg;
  if (msg.json && typeof msg.json === "object") return msg.json;
  return null;
}
function requestAck(id) {
  if (!Number.isFinite(id) || id <= lastAckedId) return;
  if (id > pendingAckId) pendingAckId = id;
  if (!ackInFlight && ackRetryTimer == null) void flushAck();
}
async function flushAck() {
  if (ackInFlight || ackRetryTimer != null) return;
  ackInFlight = true;
  let failed = false;
  try {
    while (pendingAckId > lastAckedId) {
      const id = pendingAckId;
      await channelPut([{ id: nextId(), action: "ack", "event-id": id }]);
      if (id > lastAckedId) lastAckedId = id;
    }
  } catch (e) {
    failed = true;
    const now = Date.now();
    if (now - ackErrorLogAt >= EYRE_ERROR_LOG_MS) {
      ackErrorLogAt = now;
      console.error("[transport] channel ack failed; retrying:", e.message || e);
    }
    ackRetryTimer = setTimeout(() => {
      ackRetryTimer = null;
      if (pendingAckId > lastAckedId) void flushAck();
    }, EYRE_RETRY_MS);
  } finally {
    ackInFlight = false;
    if (!failed && pendingAckId > lastAckedId) void flushAck();
  }
}
function channelEventId(msg) {
  if (!msg || msg.id == null) return null;
  if (typeof msg.id === "number" && Number.isFinite(msg.id)) return msg.id;
  if (typeof msg.id === "string" && /^\d+$/.test(msg.id)) return Number(msg.id);
  return null;
}
function nextId() {
  return eventId++;
}
function fail(m) {
  console.error(`[transport] ${m}`);
  process.exit(1);
}
