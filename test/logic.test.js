import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../js/logic.js';
import { loadLists, makeRand, gridFrom, bruteBest } from './helpers.js';

loadLists();

test('word lists load with the expected sizes', () => {
  assert.equal(L.wordArr.length, 271684);
  assert.equal(L.commonArr.length, 55616);
  assert.ok(L.isWord('RAVEN'));
  assert.ok(!L.isWord('ZZ'));
  assert.ok(!L.isWord('XQZV'));
});

test('letter values match the design', () => {
  for (const c of 'EAIONRTLSUDG') assert.equal(L.VALUES[c], 1);
  for (const c of 'BCFHMP') assert.equal(L.VALUES[c], 1.5);
  for (const c of 'VWYK') assert.equal(L.VALUES[c], 2);
  for (const c of 'JX') assert.equal(L.VALUES[c], 3);
  for (const c of 'QZ') assert.equal(L.VALUES[c], 4);
  assert.equal(Object.keys(L.VALUES).length, 26);
});

test('length multiplier and damage', () => {
  assert.equal(L.lengthMult(3), 1);
  assert.equal(L.lengthMult(4).toFixed(2), '1.35');
  assert.equal(L.lengthMult(6).toFixed(2), '2.82');
  assert.equal(L.lengthMult(8).toFixed(2), '4.91');
  assert.equal(L.damage('CAT'), 4);              // 1.5 + 1 + 1 = 3.5 -> rounds to 4
  assert.equal(L.damage('RAVEN'), Math.round(6 * L.lengthMult(5)));
  // Qu tile: QUIT with a Qu tile = (3 + 1 + 1) x 1.35, with plain Q + U = (4 + 1 + 1 + 1) x 1.35
  assert.equal(L.damage('QUIT', 1), Math.floor(5 * 1.35 + 0.5));
  assert.equal(L.damage('QUIT', 0), Math.floor(7 * 1.35 + 0.5));
});

test('judge: perfect / close / miss', () => {
  assert.equal(L.judge(20, 20), 'perfect');
  assert.equal(L.judge(21, 20), 'perfect');
  assert.equal(L.judge(14, 20), 'close');
  assert.equal(L.judge(13, 20), 'miss');
});

test('fresh grids: 16 tiles, at least 5 vowels, sane letters', () => {
  const rand = makeRand(11);
  const seen = {};
  let q = 0, qu = 0;
  for (let k = 0; k < 3000; k++) {
    const g = L.newGrid(rand);
    assert.equal(g.length, 16);
    assert.ok(L.countVowels(g) >= 5);
    for (const t of g) {
      seen[t.ch] = true;
      assert.equal(t.cursed, false);
      if (t.ch === 'Q') { q++; if (t.qu) qu++; } else assert.equal(t.qu, false);
    }
  }
  assert.equal(Object.keys(seen).length, 26);
  const share = qu / q;
  assert.ok(share > 0.4 && share < 0.6, `Qu share was ${share}`);
});

function checkTiles(grid, best) {
  // the tiles the solver reports must really spell the word and score its damage
  assert.equal(new Set(best.tiles).size, best.tiles.length, 'tiles are distinct');
  for (const i of best.tiles) assert.ok(i >= 0 && i < grid.length);
  const { word, dmg } = L.selDamage(grid, best.tiles);
  assert.equal(word, best.word);
  assert.equal(dmg, best.dmg);
  assert.equal(best.tiles.filter((i) => grid[i].qu).length, best.quTiles);
}

test('solver agrees with brute force on random grids (all words and common)', () => {
  const rand = makeRand(2026);
  for (let k = 0; k < 120; k++) {
    const fight = { enemy: { waveSize: 1 + (k % 6) }, grid: L.newGrid(rand) };
    if (k % 2) L.curseWave(fight, rand);
    if (k % 5 === 0) L.curseWave(fight, rand);
    for (const common of [false, true]) {
      const fast = L.bestWord(fight.grid, { common });
      const slow = bruteBest(fight.grid, common ? L.commonArr : L.wordArr);
      assert.equal(fast.dmg, slow.dmg, `grid ${k} common=${common}: ${fast.word} vs ${slow.word}`);
      assert.equal(fast.word, slow.word);
      if (fast.word) checkTiles(fight.grid, fast);
    }
  }
});

test('solver handles Qu tiles, plain Q, and mixtures', () => {
  const cases = [
    'QU I T E A R S N O L D G E A I O',            // only a Qu tile
    'Q U I T E A R S N O L D G E A I',             // plain Q and a U
    'QU Q U I T E A R S N O L D G E A',            // both kinds
    'QU QU I T E A R S N O L D G E A I',           // two Qu tiles, no U
    'QU Q I T E A R S N O L D G E A I',            // Qu tile plus a plain Q with no U
    'Q I T E A R S N O L D G E A I O',             // plain Q, no U at all
    'QU* Q* U Z* X* J* K* E A I O E A I O E',      // cursed pile-up
    'QU U E U E A T S R I N D L O E A',            // Qu tile plus spare U tiles
  ];
  for (const spec of cases) {
    const grid = gridFrom(spec);
    for (const common of [false, true]) {
      const fast = L.bestWord(grid, { common });
      const slow = bruteBest(grid, common ? L.commonArr : L.wordArr);
      assert.equal(fast.dmg, slow.dmg, `${spec} common=${common}: ${fast.word} vs ${slow.word}`);
      assert.equal(fast.word, slow.word);
      checkTiles(grid, fast);
    }
  }
});

test('a Qu tile is only used when the grid forces it', () => {
  // QUIT: with a plain Q and a U available, the solver should score it the expensive way
  const grid = gridFrom('QU Q U I T B B B B B B B B B B B');
  const best = L.bestWord(grid);
  if (best.word.includes('Q')) assert.equal(best.quTiles, 0);
  // with no plain Q the Qu tile must be used: one tile covers two letters
  const only = gridFrom('QU I T B B B B B B B B B B B B B');
  const b2 = L.bestWord(only);
  assert.ok(b2.word.includes('QU'), b2.word);
  assert.equal(b2.quTiles, 1);
  assert.equal(b2.tiles.length, b2.word.length - 1);
  assert.equal(b2.tiles[b2.word.indexOf('QU')], 0);
  assert.equal(b2.dmg, L.damage(b2.word, 1));
});

test('maxLen option limits the solver', () => {
  const rand = makeRand(5);
  for (let k = 0; k < 20; k++) {
    const g = L.newGrid(rand);
    const b = L.bestWord(g, { maxLen: 5 });
    if (b.word) assert.ok(b.word.length <= 5);
    assert.ok(b.dmg <= L.bestWord(g).dmg);
  }
});

test('playWord: rejects bad plays without using the turn', () => {
  const rand = makeRand(3);
  const fight = L.newFight(0, rand);
  fight.grid = gridFrom('C A T X Z Q J K V W E A I O U E');
  const hp = fight.hp;
  assert.equal(L.playWord(fight, [0, 1], rand).ok, false);
  assert.equal(L.playWord(fight, [0, 1, 1], rand).ok, false);
  assert.equal(L.playWord(fight, [3, 4, 5], rand).ok, false);
  assert.equal(fight.hp, hp);
  assert.equal(fight.turn, 0);
  assert.equal(L.tileLabel(fight.grid[0]), 'C');
});

test('playWord: applies damage, refreshes only used tiles, reports the best word', () => {
  const rand = makeRand(4);
  const fight = L.newFight(0, rand);
  fight.grid = gridFrom('C A T S R E N I O D L G U E A T');
  const snapshot = fight.grid.map((t) => L.tileLabel(t));
  const res = L.playWord(fight, [0, 1, 2], rand);
  assert.equal(res.ok, true);
  assert.equal(res.word, 'CAT');
  assert.equal(res.dmg, 4);
  assert.equal(fight.hp, L.ENEMIES[0].hp - 4);
  assert.equal(fight.turn, 1);
  assert.deepEqual(res.before.map((t) => L.tileLabel(t)), snapshot);
  for (let i = 3; i < 16; i++) assert.equal(L.tileLabel(fight.grid[i]), snapshot[i]);
  assert.ok(res.best.dmg > res.dmg);
  // best word tiles refer to the grid as it was before the play
  const { word, dmg } = L.selDamage(res.before, res.best.tiles);
  assert.equal(word, res.best.word);
  assert.equal(dmg, res.best.dmg);
});

test('vowel floor: never fewer than 4 vowels after any play, wave, or scramble', () => {
  const rand = makeRand(77);
  let plays = 0, lowest = 99;
  for (let run = 0; run < 40; run++) {
    for (let idx = 0; idx < L.ENEMIES.length; idx++) {
      const fight = L.newFight(idx, rand);
      for (let turn = 0; turn < 40 && fight.hp > 0; turn++) {
        // a vowel-hungry bot: play the word that uses the most vowels it can find
        const best = L.bestWord(fight.grid, { common: true, maxLen: 4 + (turn % 6) });
        if (!best.word) L.scramble(fight, rand);
        else { assert.equal(L.playWord(fight, best.tiles, rand).ok, true); plays++; }
        lowest = Math.min(lowest, L.countVowels(fight.grid));
        assert.ok(L.countVowels(fight.grid) >= 4, 'after a play');
        L.enemyAct(fight, rand);
        lowest = Math.min(lowest, L.countVowels(fight.grid));
        assert.ok(L.countVowels(fight.grid) >= 4, 'after the enemy turn');
        assert.equal(fight.grid.length, 16);
      }
    }
  }
  assert.ok(plays > 500);
  assert.equal(lowest, 4);   // the floor is actually reached, so the test is exercising it
});

test('vowel floor repairs fresh tiles first', () => {
  // all-consonant leftovers force repairs; untouched tiles should keep their letters
  for (let seed = 1; seed <= 200; seed++) {
    const rand = makeRand(seed);
    const fight = L.newFight(0, rand);
    fight.grid = gridFrom('A E I O U T S R N D L G B C T S');
    const res = L.playWord(fight, [0, 5, 1], rand);   // "ATE" leaves I O U = 3 vowels
    assert.equal(res.ok, true);
    assert.ok(L.countVowels(fight.grid) >= 4);
    for (const i of [2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      assert.equal(fight.grid[i].ch, res.before[i].ch, `tile ${i} should be untouched`);
    }
  }
});

test('curse wave: right count, hard letters only, marks tiles cursed', () => {
  const rand = makeRand(9);
  for (let k = 0; k < 300; k++) {
    const idx = k % 4;
    const fight = L.newFight(idx, rand);
    const replaced = L.curseWave(fight, rand);
    assert.equal(replaced.length, fight.enemy.waveSize);
    for (const i of replaced) {
      assert.ok('QZXJVKW'.includes(fight.grid[i].ch));
      assert.equal(fight.grid[i].cursed, true);
    }
    assert.equal(fight.grid.filter((t) => t.cursed).length, fight.enemy.waveSize);
  }
});

test('enemy turn: damage stays in range and waves fire on schedule', () => {
  const rand = makeRand(21);
  for (let idx = 0; idx < 4; idx++) {
    const fight = L.newFight(idx, rand);
    const e = fight.enemy;
    const lo = { v: 99 }, hi = { v: 0 };
    for (let turn = 1; turn <= 400; turn++) {
      const { dmg, replaced } = L.enemyAct(fight, rand);
      assert.ok(dmg >= e.dmgMin && dmg <= e.dmgMax);
      lo.v = Math.min(lo.v, dmg); hi.v = Math.max(hi.v, dmg);
      assert.equal(replaced !== null, turn % e.waveEvery === 0, `turn ${turn}`);
    }
    assert.equal(lo.v, e.dmgMin);
    assert.equal(hi.v, e.dmgMax);
  }
});

test('scramble: new grid, no curses, uses the turn', () => {
  const rand = makeRand(31);
  const fight = L.newFight(3, rand);
  L.curseWave(fight, rand);
  L.scramble(fight, rand);
  assert.equal(fight.turn, 1);
  assert.equal(fight.grid.filter((t) => t.cursed).length, 0);
  assert.ok(L.countVowels(fight.grid) >= 5);
});

test('typing: Q prefers a plain Q when a U is free, else the Qu tile', () => {
  let g = gridFrom('QU Q U A B C D E F G H I J K L M');
  assert.deepEqual(L.pickForLetter(g, new Set(), 'q'), { index: 1, qu: false });
  assert.deepEqual(L.pickForLetter(g, new Set([2]), 'q'), { index: 0, qu: true });   // U already taken
  assert.deepEqual(L.pickForLetter(g, new Set([0, 2]), 'q'), { index: 1, qu: false });
  assert.equal(L.pickForLetter(g, new Set([0, 1]), 'q'), null);
  // "U" never grabs a Qu tile; repeated letters take the next free tile
  g = gridFrom('QU A A B C D E F G H I J K L M N');
  assert.equal(L.pickForLetter(g, new Set(), 'u'), null);
  assert.deepEqual(L.pickForLetter(g, new Set(), 'a'), { index: 1, qu: false });
  assert.deepEqual(L.pickForLetter(g, new Set([1]), 'a'), { index: 2, qu: false });
  assert.equal(L.pickForLetter(g, new Set([1, 2]), 'a'), null);
});

test('foes: four authors in order, Poe last', () => {
  assert.deepEqual(L.ENEMIES.map((e) => e.id), ['twain', 'dickinson', 'shelley', 'poe']);
  const avg = (e) => (e.dmgMin + e.dmgMax) / 2;
  // tuned stat lines keep the same average damage as the original foes
  L.ENEMIES.forEach((e, i) => assert.equal(avg(e), avg(L.CLASSIC_ENEMIES[i])));
});
