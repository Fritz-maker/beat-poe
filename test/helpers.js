import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import L from '../js/logic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let loaded = false;
export function loadLists() {
  if (loaded) return;
  L.loadWords(readFileSync(join(root, 'data/words.txt'), 'utf8'));
  L.loadCommon(readFileSync(join(root, 'data/common.txt'), 'utf8'));
  loaded = true;
}

// Park-Miller generator: small enough to be exact in JS doubles and in Lua.
export function makeRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return (n) => {
    s = (s * 48271) % 2147483647;
    return (s % n) + 1;
  };
}

// Build a grid from a compact spec, e.g. "QU* Q U A T* ..." :
// letters separated by spaces, "QU" = a Qu tile, trailing * = cursed.
export function gridFrom(spec) {
  return spec.trim().split(/\s+/).map((tok) => {
    const cursed = tok.endsWith('*');
    const s = cursed ? tok.slice(0, -1) : tok;
    return s === 'QU' ? { ch: 'Q', qu: true, cursed } : { ch: s, qu: false, cursed };
  });
}

// Independent brute-force solver: for every word, try every possible number of
// Qu tiles and check letter counts the slow, obvious way.
export function bruteBest(grid, arr) {
  const plain = {};
  let nQu = 0;
  for (const t of grid) {
    if (t.qu) nQu++;
    else plain[t.ch] = (plain[t.ch] || 0) + 1;
  }
  let best = null, bestD = -1;
  for (const w of arr) {
    const pairs = (w.match(/QU/g) || []).length;
    let top = -1;
    for (let j = 0; j <= Math.min(nQu, pairs); j++) {
      // remove j "QU" pairs from the word, then the rest must come from plain tiles
      let rest = w;
      for (let k = 0; k < j; k++) rest = rest.replace('QU', '');
      const need = {};
      for (const c of rest) need[c] = (need[c] || 0) + 1;
      let ok = true;
      for (const c in need) if ((plain[c] || 0) < need[c]) { ok = false; break; }
      if (ok) top = Math.max(top, L.damage(w, j));
    }
    if (top > bestD) { best = w; bestD = top; }
  }
  return { word: best, dmg: bestD };
}
