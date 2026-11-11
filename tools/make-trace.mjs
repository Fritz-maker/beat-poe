// Plays scripted games with the JS rules and writes every step to a JSON trace.
// tools/parity_lua.py then replays the same steps in the original logic.lua
// (same random generator) and checks that both versions agree.
//
//   node tools/make-trace.mjs > /tmp/trace.json
import L from '../js/logic.js';
import { loadLists, makeRand } from '../test/helpers.js';

loadLists();
L.STRICT_VOWEL_FLOOR = false;       // the Lua original fixes at most one tile
L.ENEMIES = L.CLASSIC_ENEMIES;      // and has the original foes

const label = (g) => g.map((t) => L.tileLabel(t) + (t.cursed ? '*' : '')).join(' ');
const games = [];
for (let seed = 1; seed <= 12; seed++) {
  const common = seed % 2 === 0;
  L.commonOnly = common;
  const rand = makeRand(seed * 7919);
  const steps = [];
  for (let idx = 0; idx < 4; idx++) {
    const fight = L.newFight(idx, rand);
    steps.push({ op: 'fight', idx, grid: label(fight.grid) });
    for (let n = 1; n <= 30 && fight.hp > 0; n++) {
      // vary word length so short and long plays are both covered
      const best = L.bestWord(fight.grid, { maxLen: 3 + ((n * 5 + seed) % 9) });
      if (n % 7 === 0 || !best.word) {
        L.scramble(fight, rand);
        steps.push({ op: 'scramble', grid: label(fight.grid) });
      } else {
        const res = L.playWord(fight, best.tiles, rand);
        steps.push({
          op: 'play', sel: best.tiles, word: res.word, dmg: res.dmg,
          bestWord: res.best.word, bestDmg: res.best.dmg, hp: fight.hp, grid: label(fight.grid),
        });
      }
      if (fight.hp > 0) {
        const { dmg, replaced } = L.enemyAct(fight, rand);
        steps.push({ op: 'enemy', dmg, replaced, waveIn: fight.waveIn, grid: label(fight.grid) });
      }
    }
  }
  games.push({ seed: seed * 7919, common, steps });
}
process.stdout.write(JSON.stringify(games));
