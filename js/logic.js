// logic.js : pure game rules for Beat Poe! (ported from the LÖVE version's logic.lua).
// No DOM in here, so it runs the same in the browser and in Node tests.
//
// Conventions: tile indices are 0-based. `rand(n)` must return an integer in 1..n
// (same contract as the Lua version, so both can be driven by the same generator).

export const L = {
  // -------------------------------------------------------------------------
  // Tuning knobs (change these to rebalance the game)
  // -------------------------------------------------------------------------
  GRID: 16,               // number of tiles (shown as 4x4)
  MIN_VOWELS: 5,          // fresh grids always have at least this many vowels
  PLAYER_MAX_HP: 80,
  HEAL_BETWEEN: 0.40,     // fraction of max HP restored after each victory
  QU_CHANCE: 0.5,         // chance that a Q tile appears as a "Qu" tile
  QU_VALUE: 3,            // value of a Qu tile (a plain Q is worth 4)
  CLOSE_FRAC: 0.70,       // at least this fraction of the best word = "nice try, you were close"
  REVIVE_FRAC: 0.50,      // HP fraction you come back with when a bonus life is used
  MIN_WORD: 3,
  LENGTH_CURVE: 0.35,     // bigger = long words are rewarded more
  // true  = a grid never has fewer than MIN_VOWELS - 1 vowels after a play (Beat Poe! rule)
  // false = the original LÖVE behaviour (fixes at most one tile); kept for the parity test
  STRICT_VOWEL_FLOOR: true,

  commonOnly: false,      // best-word check uses the common list only
};

// Letter values: rarer letters hit harder.
const VAL = {};
function setvals(letters, v) { for (const c of letters) VAL[c] = v; }
setvals('EAIONRTLSUDG', 1);
setvals('BCFHMP', 1.5);
setvals('VWYK', 2);
setvals('JX', 3);
setvals('QZ', 4);
L.VALUES = VAL;

// How often each letter shows up in a normal grid (Scrabble-style distribution)
const NORMAL_FREQ = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};
// Letters a curse wave can drop onto the grid
const CURSE_FREQ = { Q: 2, Z: 2, X: 2, J: 2, V: 3, K: 3, W: 3 };

const VOWELS = { A: true, E: true, I: true, O: true, U: true };
const FIX_VOWELS = ['A', 'E', 'I', 'O'];

// Foes. dmgMin/dmgMax = damage per enemy turn. A curse wave hits every
// `waveEvery` enemy turns and swaps `waveSize` tiles for hard letters.
L.ENEMIES = [
  { id: 'twain',     name: 'Mark Twain',      hp: 70,  dmgMin: 3,  dmgMax: 8,  waveEvery: 4, waveSize: 2 },
  { id: 'dickinson', name: 'Emily Dickinson', hp: 110, dmgMin: 7,  dmgMax: 8,  waveEvery: 2, waveSize: 2 },
  { id: 'shelley',   name: 'Mary Shelley',    hp: 200, dmgMin: 7,  dmgMax: 13, waveEvery: 4, waveSize: 5 },
  { id: 'poe',       name: 'Edgar Allan Poe', hp: 300, dmgMin: 10, dmgMax: 15, waveEvery: 2, waveSize: 5 },
];
// The original LÖVE foes (used by the parity test and for balance comparisons).
L.CLASSIC_ENEMIES = [
  { id: 'gnome',  name: 'Gutter Gnome',          hp: 70,  dmgMin: 4,  dmgMax: 7,  waveEvery: 4, waveSize: 2 },
  { id: 'wraith', name: 'Mildew Wraith',         hp: 120, dmgMin: 6,  dmgMax: 9,  waveEvery: 3, waveSize: 3 },
  { id: 'troll',  name: 'Ink-Blot Troll',        hp: 190, dmgMin: 8,  dmgMax: 12, waveEvery: 3, waveSize: 4 },
  { id: 'dragon', name: 'The Dictionary Dragon', hp: 300, dmgMin: 10, dmgMax: 15, waveEvery: 2, waveSize: 5 },
];

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------
function defaultRand(n) { return 1 + Math.floor(Math.random() * n); }

function makeBag(t) {
  const keys = Object.keys(t).sort();
  const bag = { items: [], total: 0 };
  for (const k of keys) { bag.items.push([k, t[k]]); bag.total += t[k]; }
  return bag;
}
const NORMAL_BAG = makeBag(NORMAL_FREQ);
const CURSE_BAG = makeBag(CURSE_FREQ);

function draw(bag, rand) {
  let r = rand(bag.total);
  for (const e of bag.items) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return bag.items[bag.items.length - 1][0];
}

function countVowels(grid) {
  let n = 0;
  for (const t of grid) if (VOWELS[t.ch]) n++;
  return n;
}
L.countVowels = countVowels;

// Tiles are { ch: "A".."Z", cursed: bool, qu: bool }. A "Qu" tile has ch = "Q"
// and qu = true: it spells the two letters QU but is worth less than a plain Q.
function newTile(bag, rand, cursed) {
  const ch = draw(bag, rand);
  return { ch, cursed: !!cursed, qu: ch === 'Q' && rand(100) <= L.QU_CHANCE * 100 };
}
L.tileText = (t) => (t.qu ? 'QU' : t.ch);     // what it adds to the word
L.tileLabel = (t) => (t.qu ? 'Qu' : t.ch);    // what is drawn on the tile
L.tileValue = (t) => (t.qu ? L.QU_VALUE : VAL[t.ch]);

// ---------------------------------------------------------------------------
// Word lists
// ---------------------------------------------------------------------------
L.wordSet = new Set();
L.wordArr = [];
L.wordMask = new Uint32Array(0);
L.commonArr = [];
L.commonMask = new Uint32Array(0);

function letterMask(w) {
  let m = 0;
  for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - 65);
  return m;
}
function masksFor(arr) {
  const m = new Uint32Array(arr.length);
  for (let i = 0; i < arr.length; i++) m[i] = letterMask(arr[i]);
  return m;
}

// `text` is the whole word file, one word per line. Returns how many words were kept.
L.loadWords = function (text) {
  const set = new Set(), arr = [];
  for (const line of text.split('\n')) {
    const w = line.replace(/\s/g, '').toUpperCase();
    if (w.length >= L.MIN_WORD && w.length <= L.GRID && /^[A-Z]+$/.test(w)) {
      set.add(w);
      arr.push(w);
    }
  }
  L.wordSet = set; L.wordArr = arr; L.wordMask = masksFor(arr);
  return arr.length;
};

L.isWord = (w) => L.wordSet.has(w);

// Optional "common words" subset, used only for the best-word check.
// Any valid word can still be played; this just keeps SELAMLIK-style
// obscurities out of the "best word available" panel.
L.loadCommon = function (text) {
  const arr = [];
  for (const line of text.split('\n')) {
    const w = line.replace(/\s/g, '').toUpperCase();
    if (L.wordSet.has(w)) arr.push(w);
  }
  L.commonArr = arr; L.commonMask = masksFor(arr);
  return arr.length;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
L.lengthMult = function (n) {
  if (n <= L.MIN_WORD) return 1;
  return 1 + L.LENGTH_CURVE * Math.pow(n - L.MIN_WORD, 1.5);
};

L.rawValue = function (word) {
  let s = 0;
  for (let i = 0; i < word.length; i++) s += VAL[word[i]];
  return s;
};

// quTiles = how many of the word's "QU" pairs came from single Qu tiles
// (each one is worth QU_VALUE instead of Q + U).
L.damage = function (word, quTiles) {
  let raw = L.rawValue(word);
  if (quTiles && quTiles > 0) raw -= quTiles * (VAL.Q + VAL.U - L.QU_VALUE);
  return Math.floor(raw * L.lengthMult(word.length) + 0.5);
};

// 'perfect' | 'close' | 'miss'
L.judge = function (dmg, bestDmg) {
  if (dmg >= bestDmg) return 'perfect';
  if (dmg >= bestDmg * L.CLOSE_FRAC) return 'close';
  return 'miss';
};

const Q = 16, U = 20;   // 0-based letter numbers

function countQuPairs(w) {
  let n = 0;
  for (let i = 0; i + 1 < w.length; i++) {
    if (w.charCodeAt(i) === 81 && w.charCodeAt(i + 1) === 85) { n++; i++; }
  }
  return n;
}

// Words containing Q: a "QU" pair can come from one Qu tile, or from a plain Q
// tile plus a U tile (worth more). Use as few Qu tiles as the grid allows.
// Returns the number of Qu tiles needed, or -1 if the grid cannot spell the word.
function quTilesNeeded(w, cnt, nQu, need) {
  need.fill(0);
  for (let i = 0; i < w.length; i++) need[w.charCodeAt(i) - 65]++;
  const j = Math.max(0, need[Q] - cnt[Q], need[U] - cnt[U]);
  if (j > nQu || j > countQuPairs(w)) return -1;
  for (let b = 0; b < 26; b++) {
    if (b !== Q && b !== U && cnt[b] < need[b]) return -1;
  }
  return j;
}

// Which tiles spell `word`, in order, using exactly `quTiles` Qu tiles.
// A Qu tile appears once in the list even though it covers two letters.
function assignTiles(grid, word, quTiles) {
  const byLetter = {};     // letter -> queue of plain tile indices
  const quIdx = [];
  grid.forEach((t, i) => {
    if (t.qu) quIdx.push(i);
    else (byLetter[t.ch] = byLetter[t.ch] || []).push(i);
  });
  const tiles = [];
  let left = quTiles;
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (c === 'Q' && left > 0 && word[i + 1] === 'U') {
      tiles.push(quIdx.shift());
      left--;
      i++;                 // the Qu tile also covers the U
    } else {
      tiles.push(byLetter[c].shift());
    }
  }
  return tiles;
}

// Search the dictionary for the highest-damage word the grid can spell.
// Returns { word, dmg, tiles, quTiles }; word is null (dmg -1) if nothing fits.
// opts.maxLen limits word length (used by the balance bots).
// opts.common overrides L.commonOnly.
L.bestWord = function (grid, opts) {
  opts = opts || {};
  const cnt = new Int8Array(26);
  let nQu = 0, gridMask = 0;
  for (const t of grid) {
    if (t.qu) { nQu++; gridMask |= (1 << Q) | (1 << U); }
    else { const b = t.ch.charCodeAt(0) - 65; cnt[b]++; gridMask |= 1 << b; }
  }
  const useCommon = (opts.common !== undefined ? opts.common : L.commonOnly) && L.commonArr.length > 0;
  const arr = useCommon ? L.commonArr : L.wordArr;
  const masks = useCommon ? L.commonMask : L.wordMask;
  const maxLen = opts.maxLen || 99;
  const notInGrid = ~gridMask;
  const qBit = 1 << Q;
  const need = new Int8Array(26);

  let best = null, bestD = -1, bestQu = 0;
  for (let k = 0; k < arr.length; k++) {
    const m = masks[k];
    if (m & notInGrid) continue;          // needs a letter the grid does not have
    const w = arr[k];
    const n = w.length;
    if (n > maxLen) continue;
    let d = -1, j = 0;
    if (m & qBit) {
      j = quTilesNeeded(w, cnt, nQu, need);
      if (j >= 0) d = L.damage(w, j);
    } else {
      let used = 0, ok = true;
      for (let i = 0; i < n; i++) {
        const b = w.charCodeAt(i) - 65;
        if (cnt[b] === 0) { ok = false; break; }
        cnt[b]--;
        used = i + 1;
      }
      for (let i = 0; i < used; i++) cnt[w.charCodeAt(i) - 65]++;
      if (ok) d = L.damage(w);
    }
    if (d > bestD) { best = w; bestD = d; bestQu = j; }
  }
  if (best === null) return { word: null, dmg: -1, tiles: [], quTiles: 0 };
  return { word: best, dmg: bestD, tiles: assignTiles(grid, best, bestQu), quTiles: bestQu };
};

// ---------------------------------------------------------------------------
// Grid and fights
// ---------------------------------------------------------------------------
L.newGrid = function (rand) {
  rand = rand || defaultRand;
  let grid;
  do {
    grid = [];
    for (let i = 0; i < L.GRID; i++) grid.push(newTile(NORMAL_BAG, rand, false));
  } while (countVowels(grid) < L.MIN_VOWELS);
  return grid;
};

L.newFight = function (idx, rand) {
  const e = L.ENEMIES[idx];
  return { idx, enemy: e, hp: e.hp, grid: L.newGrid(rand), waveIn: e.waveEvery, turn: 0 };
};

L.wordFromSel = (grid, sel) => sel.map((i) => L.tileText(grid[i])).join('');

// The word spelled by the selected tiles, and the damage it would do.
L.selDamage = function (grid, sel) {
  let nQu = 0;
  for (const i of sel) if (grid[i].qu) nQu++;
  const word = L.wordFromSel(grid, sel);
  return { word, dmg: L.damage(word, nQu) };
};

// After tiles refresh, keep the grid playable.
function fixVowels(grid, fresh, rand) {
  const floor = L.MIN_VOWELS - 1;
  const fixOne = (i) => {
    grid[i].ch = FIX_VOWELS[rand(FIX_VOWELS.length) - 1];
    grid[i].qu = false;
  };
  const fixable = (i) => !grid[i].cursed && !VOWELS[grid[i].ch];
  if (!L.STRICT_VOWEL_FLOOR) {
    // original rule: fix the first plain consonant, once
    if (countVowels(grid) < floor) {
      for (let i = 0; i < grid.length; i++) if (fixable(i)) { fixOne(i); break; }
    }
    return;
  }
  // strict rule: fix until the floor is met, changing the freshly drawn tiles first
  // (so a tile the player did not use never changes under their thumb unless it must)
  const order = fresh.slice();
  for (let i = 0; i < grid.length; i++) if (!fresh.includes(i)) order.push(i);
  let v = countVowels(grid);
  for (const i of order) {
    if (v >= floor) break;
    if (fixable(i)) { fixOne(i); v++; }
  }
}

// Play the tiles in `sel` (array of grid indices).
// Returns { ok: false, reason } if the play is not allowed (the turn is NOT used up),
// otherwise { ok: true, word, dmg, best, before, used }.
//   best   = { word, dmg, tiles, quTiles } from the solver, computed BEFORE tiles refresh
//   before = a copy of the grid as it was when the word was played (for the review screen)
L.playWord = function (fight, sel, rand) {
  rand = rand || defaultRand;
  if (sel.length < L.MIN_WORD) return { ok: false, reason: `Words need at least ${L.MIN_WORD} letters.` };
  const seen = new Set();
  for (const i of sel) {
    if (seen.has(i)) return { ok: false, reason: 'A tile can only be used once.' };
    seen.add(i);
  }
  const { word, dmg } = L.selDamage(fight.grid, sel);
  if (!L.isWord(word)) return { ok: false, reason: `${word} is not in the word list.` };

  const best = L.bestWord(fight.grid);
  const before = fight.grid.map((t) => ({ ...t }));

  for (const i of sel) fight.grid[i] = newTile(NORMAL_BAG, rand, false);
  fixVowels(fight.grid, sel, rand);

  fight.hp -= dmg;
  fight.turn++;
  return { ok: true, word, dmg, best, before, used: sel.slice() };
};

// Throw the whole grid away (also clears curses). Costs the turn.
L.scramble = function (fight, rand) {
  fight.grid = L.newGrid(rand);
  fight.turn++;
};

// Swap some tiles for hard letters. Returns the list of changed tile indices.
L.curseWave = function (fight, rand) {
  rand = rand || defaultRand;
  const grid = fight.grid;
  const idx = grid.map((_, i) => i);
  for (let i = idx.length; i >= 2; i--) {
    const j = rand(i);
    [idx[i - 1], idx[j - 1]] = [idx[j - 1], idx[i - 1]];
  }
  let vowels = countVowels(grid);
  const replaced = [];
  for (const i of idx) {
    if (replaced.length >= fight.enemy.waveSize) break;
    const t = grid[i];
    if (!t.cursed) {
      const isV = !!VOWELS[t.ch];
      if (!isV || vowels > L.MIN_VOWELS - 1) {
        if (isV) vowels--;
        grid[i] = newTile(CURSE_BAG, rand, true);
        replaced.push(i);
      }
    }
  }
  return replaced;
};

// The enemy's turn. Returns { dmg, replaced } where replaced is the list of
// tiles a curse wave changed, or null if no wave fired.
L.enemyAct = function (fight, rand) {
  rand = rand || defaultRand;
  const e = fight.enemy;
  const dmg = e.dmgMin + rand(e.dmgMax - e.dmgMin + 1) - 1;
  fight.waveIn--;
  let replaced = null;
  if (fight.waveIn <= 0) {
    replaced = L.curseWave(fight, rand);
    fight.waveIn = e.waveEvery;
  }
  return { dmg, replaced };
};

// ---------------------------------------------------------------------------
// Keyboard typing: which tile should a typed letter pick?
// `taken` is a Set of already selected tile indices.
// Returns { index, qu } or null. qu = true means a Qu tile was picked, so a
// following "U" keystroke should be swallowed.
// ---------------------------------------------------------------------------
L.pickForLetter = function (grid, taken, ch) {
  ch = ch.toUpperCase();
  if (ch === 'Q') {
    // prefer a plain Q while a U tile is free (Q + U scores more than a Qu tile)
    let plain = -1, qu = -1, uFree = false;
    grid.forEach((t, i) => {
      if (taken.has(i)) return;
      if (t.ch === 'Q' && !t.qu && plain < 0) plain = i;
      if (t.ch === 'Q' && t.qu && qu < 0) qu = i;
      if (t.ch === 'U') uFree = true;
    });
    if (plain >= 0 && uFree) return { index: plain, qu: false };
    if (qu >= 0) return { index: qu, qu: true };
    if (plain >= 0) return { index: plain, qu: false };
    return null;
  }
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].ch === ch && !grid[i].qu && !taken.has(i)) return { index: i, qu: false };
  }
  return null;
};

export default L;
