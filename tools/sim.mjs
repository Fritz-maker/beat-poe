// Balance check: bots that can only "see" words up to a certain length play
// full runs against the foes. Compares the original foes with the author foes.
//
//   node tools/sim.mjs [runs]
import L from '../js/logic.js';
import { loadLists, makeRand } from '../test/helpers.js';

loadLists();
L.commonOnly = true;                     // the default setting: perfect = best common word
const RUNS = Number(process.argv[2] || 1500);

function run(cap, rand) {
  let hp = L.PLAYER_MAX_HP, lives = 0;
  for (let idx = 0; idx < L.ENEMIES.length; idx++) {
    const fight = L.newFight(idx, rand);
    while (true) {
      const pick = L.bestWord(fight.grid, { maxLen: cap });   // common words only
      if (!pick.word) {
        L.scramble(fight, rand);
      } else {
        const res = L.playWord(fight, pick.tiles, rand);
        if (L.judge(res.dmg, res.best.dmg) === 'perfect') lives++;
      }
      if (fight.hp <= 0) break;
      hp -= L.enemyAct(fight, rand).dmg;
      if (hp <= 0) {
        if (lives > 0 && idx === L.ENEMIES.length - 1) {
          lives--;
          hp = Math.floor(L.PLAYER_MAX_HP * L.REVIVE_FRAC);
        } else {
          return { won: false, diedAt: idx };
        }
      }
    }
    hp = Math.min(L.PLAYER_MAX_HP, hp + Math.floor(L.PLAYER_MAX_HP * L.HEAL_BETWEEN));
  }
  return { won: true };
}

const sets = { 'original foes': L.CLASSIC_ENEMIES, 'author foes': L.ENEMIES };
for (const [name, foes] of Object.entries(sets)) {
  L.ENEMIES = foes;
  console.log(`\n${name}: ${foes.map((e) => e.name).join(', ')}   (${RUNS} runs each)`);
  console.log('bot sees up to | wins  | died at foe 1 / 2 / 3 / 4');
  for (const cap of [5, 6, 7, 8, 10]) {
    const rand = makeRand(1000 + cap);
    let wins = 0;
    const died = [0, 0, 0, 0];
    for (let r = 0; r < RUNS; r++) {
      const out = run(cap, rand);
      if (out.won) wins++; else died[out.diedAt]++;
    }
    const pct = (n) => ((100 * n) / RUNS).toFixed(0).padStart(3) + '%';
    console.log(`${String(cap).padStart(8)} letters | ${pct(wins)}  | ${died.map(pct).join(' / ')}`);
  }
}
