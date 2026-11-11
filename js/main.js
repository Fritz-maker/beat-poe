// main.js : Beat Poe! plain playable skeleton (no author art or popups yet).
import L from './logic.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'beatpoe.settings';
const ENEMY_DELAY = 700;          // ms pause before the foe hits back
const BANNER_MS = { life: 3800, close: 2400 };

const S = {
  mode: 'loading',                // loading | fight | victory | defeat | won
  phase: 'player',                // player | enemy
  fight: null,
  sel: [],                        // selected tile indices, in order
  lastQu: null,                   // a Qu tile just picked by typing "q" (the next "u" is swallowed)
  playerHp: L.PLAYER_MAX_HP,
  lives: 0,
  reveal: null,                   // result of the last play, for the last-word line
  totalPlays: 0, totalPerfect: 0,
  healed: 0,
};

// ---------------------------------------------------------------------------
// Settings (saved on this device)
// ---------------------------------------------------------------------------
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (typeof s.commonOnly === 'boolean') L.commonOnly = s.commonOnly;
  } catch (e) { /* private mode or blocked storage: just use defaults */ }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ commonOnly: L.commonOnly })); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------
const tiles = [];
let bannerTimer = 0, scrambleTimer = 0, enemyTimer = 0;

function say(text, kind) {
  const m = $('msg');
  m.textContent = text;
  m.className = 'msg small ' + (kind || '');
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;            // lets the animation play again
  el.classList.add(cls);
}

function showBanner(kind, title, sub) {
  const b = $('banner');
  b.className = 'banner ' + kind;
  b.replaceChildren();
  const t = document.createElement('div'); t.textContent = title;
  const s = document.createElement('div'); s.className = 'small'; s.textContent = sub;
  b.append(t, s);
  b.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, BANNER_MS[kind]);
}
function hideBanner() { clearTimeout(bannerTimer); $('banner').hidden = true; }

function disarmScramble() {
  clearTimeout(scrambleTimer);
  const b = $('btnScramble');
  b.classList.remove('armed');
  b.textContent = 'Scramble';
}

const canAct = () => S.mode === 'fight' && S.phase === 'player';
const fmt = (v) => String(v);     // 1.5 shows as 1.5, 2 as 2

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function render() {
  const f = S.fight;
  if (!f) return;
  const e = f.enemy;

  $('foeName').textContent = e.name;
  $('foeCount').textContent = `Foe ${f.idx + 1} of ${L.ENEMIES.length}`;
  const ehp = Math.max(0, Math.ceil(f.hp));
  $('foeFill').style.width = (100 * ehp / e.hp) + '%';
  $('foeHp').textContent = `${ehp} / ${e.hp}`;

  const wave = $('wave');
  if (f.waveIn <= 1) {
    wave.textContent = `CURSE WAVE on the next foe turn! (${e.waveSize} tiles)`;
    wave.className = 'small wave soon';
  } else {
    wave.textContent = `Curse wave in ${f.waveIn} foe turns (${e.waveSize} tiles)`;
    wave.className = 'small wave';
  }

  const php = Math.max(0, Math.ceil(S.playerHp));
  $('youFill').style.width = (100 * php / L.PLAYER_MAX_HP) + '%';
  $('youHp').textContent = `You ${php} / ${L.PLAYER_MAX_HP}`;
  const lives = $('lives');
  lives.textContent = `♥ ${S.lives}`;
  lives.className = 'lives' + (S.lives > 0 ? ' has' : '');

  // tiles
  const order = new Map(S.sel.map((idx, k) => [idx, k + 1]));
  f.grid.forEach((t, i) => {
    const el = tiles[i];
    el.firstChild.textContent = L.tileLabel(t);
    el.children[0].textContent = fmt(L.tileValue(t));
    el.children[1].textContent = order.has(i) ? order.get(i) : '';
    el.classList.toggle('cursed', t.cursed);
    el.classList.toggle('picked', order.has(i));
    el.setAttribute('aria-label',
      `${L.tileLabel(t)}, worth ${fmt(L.tileValue(t))}${t.cursed ? ', cursed' : ''}${order.has(i) ? ', selected' : ''}`);
  });

  // word tray
  const w = $('word'), info = $('wordInfo');
  const { word, dmg } = L.selDamage(f.grid, S.sel);
  if (word.length === 0) {
    w.textContent = S.phase === 'enemy' ? '…' : 'tap tiles to spell a word';
    w.className = 'word empty';
    w.style.fontSize = '';
    info.textContent = '';
    info.className = 'small';
  } else {
    const valid = word.length >= L.MIN_WORD && L.isWord(word);
    w.textContent = word;
    w.className = 'word' + (valid ? ' valid' : '');
    w.style.fontSize = word.length > 9 ? Math.max(16, Math.floor(34 * 9 / word.length)) + 'px' : '';
    if (word.length < L.MIN_WORD) {
      info.textContent = ''; info.className = 'small';
    } else if (valid) {
      info.textContent = `${word.length} letters  ×${L.lengthMult(word.length).toFixed(2)}  =  ${dmg} damage`;
      info.className = 'small valid';
    } else {
      info.textContent = 'not in the word list'; info.className = 'small invalid';
    }
  }

  // buttons
  const act = canAct();
  $('btnBack').disabled = !act || S.sel.length === 0;
  $('btnClear').disabled = !act || S.sel.length === 0;
  $('btnPlay').disabled = !act || S.sel.length < L.MIN_WORD;
  $('btnScramble').disabled = !act;

  // last word
  const last = $('lastLine');
  last.replaceChildren();
  const r = S.reveal;
  if (!r) {
    last.textContent = 'Play a word to see the best one.';
  } else if (r.dmg >= r.best.dmg) {
    last.append(`You ${r.word} ${r.dmg} \u00b7 `);
    const p = document.createElement('span'); p.className = 'perfect'; p.textContent = 'Perfect!';
    last.append(p);
  } else {
    last.append(`You ${r.word} ${r.dmg} \u00b7 Best `);
    const b = document.createElement('b'); b.textContent = `${r.best.word} ${r.best.dmg}`;
    last.append(b, ` \u00b7 missed by ${r.best.dmg - r.dmg}`);
  }
  $('btnCommon').textContent = L.commonOnly ? 'Best from: common' : 'Best from: all words';
}

function showOverlay(title, text, kind, button) {
  $('ovTitle').textContent = title;
  $('ovTitle').className = kind;
  $('ovText').textContent = text;
  $('ovBtn').textContent = button;
  $('overlay').hidden = false;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function clearSel() { S.sel = []; S.lastQu = null; }

function startFight(idx) {
  S.fight = L.newFight(idx);
  S.fight.plays = 0; S.fight.perfect = 0; S.fight.longest = '';
  clearSel();
  S.reveal = null;
  S.phase = 'player';
  S.mode = 'fight';
  hideBanner(); disarmScramble();
  $('overlay').hidden = true;
  say(`${S.fight.enemy.name} blocks the way!`, 'warn');
  render();
  tiles.forEach((el) => restartAnim(el, 'fresh'));
}

function startRun() {
  S.playerHp = L.PLAYER_MAX_HP;
  S.lives = 0;
  S.totalPlays = 0; S.totalPerfect = 0;
  startFight(0);
}

function toggleTile(i) {
  if (!canAct()) return;
  disarmScramble();
  S.lastQu = null;
  const k = S.sel.indexOf(i);
  if (k >= 0) S.sel.splice(k, 1); else S.sel.push(i);
  render();
}

function removeLast() {
  if (!canAct() || S.sel.length === 0) return;
  S.sel.pop();
  S.lastQu = null;
  render();
}

function typeLetter(ch) {
  if (!canAct()) return;
  ch = ch.toUpperCase();
  // typing "qu" onto a Qu tile: the tile already spells QU, so the "u" is swallowed
  if (ch === 'U' && S.lastQu !== null && S.sel[S.sel.length - 1] === S.lastQu) { S.lastQu = null; return; }
  S.lastQu = null;
  const pick = L.pickForLetter(S.fight.grid, new Set(S.sel), ch);
  if (!pick) return;
  S.sel.push(pick.index);
  if (pick.qu) S.lastQu = pick.index;
  render();
}

function beginEnemyPhase() {
  S.phase = 'enemy';
  clearTimeout(enemyTimer);
  enemyTimer = setTimeout(enemyTurn, ENEMY_DELAY);
}

function submit() {
  if (!canAct()) return;
  disarmScramble();
  const f = S.fight;
  const res = L.playWord(f, S.sel);
  if (!res.ok) { say(res.reason, 'warn'); return; }

  f.plays++; S.totalPlays++;
  const verdict = L.judge(res.dmg, res.best.dmg);
  if (verdict === 'perfect') { f.perfect++; S.totalPerfect++; S.lives++; }
  if (res.word.length > f.longest.length) f.longest = res.word;
  S.reveal = res;
  clearSel();

  say(`You: ${res.word} for ${res.dmg} damage.`, 'good');
  if (verdict === 'perfect') {
    showBanner('life', 'BONUS LIFE!', `Perfect word! Lives saved for the final fight: ${S.lives}`);
  } else if (verdict === 'close') {
    showBanner('close', 'Nice try, you were close!', `${res.best.dmg - res.dmg} damage short of ${res.best.word}`);
  } else {
    hideBanner();
  }

  if (f.hp <= 0) {
    f.hp = 0;
    S.mode = 'victory';
    const heal = Math.floor(L.PLAYER_MAX_HP * L.HEAL_BETWEEN);
    S.playerHp = Math.min(L.PLAYER_MAX_HP, S.playerHp + heal);
    S.healed = heal;
    render();
    restartAnim($('foeBox'), 'shake');
    const last = f.idx >= L.ENEMIES.length - 1;
    if (last) {
      S.mode = 'won';
      showOverlay('You beat Poe!',
        `Best-word hits this run: ${S.totalPerfect} / ${S.totalPlays}\nLongest word: ${f.longest}`,
        'warn', 'Play again');
    } else {
      showOverlay(`${f.enemy.name} is defeated!`,
        `You recovered ${heal} HP.\nLongest word: ${f.longest}\nBest-word hits: ${f.perfect} / ${f.plays}`,
        'good', 'Next foe');
    }
    return;
  }
  beginEnemyPhase();
  render();
  res.used.forEach((i) => restartAnim(tiles[i], 'fresh'));
  restartAnim($('foeBox'), 'shake');
}

function scramble() {
  if (!canAct()) return;
  const b = $('btnScramble');
  if (!b.classList.contains('armed')) {          // first tap arms, second tap confirms
    b.classList.add('armed');
    b.textContent = 'Tap again';
    say('Scramble gives the foe a free hit. Tap again.', 'warn');
    clearTimeout(scrambleTimer);
    scrambleTimer = setTimeout(disarmScramble, 3000);
    return;
  }
  doScramble();
}

function doScramble() {
  if (!canAct()) return;
  disarmScramble();
  clearSel();
  L.scramble(S.fight);
  S.reveal = null;
  hideBanner();
  say('You scramble the grid. The foe gets a free swing.', 'warn');
  beginEnemyPhase();
  render();
  tiles.forEach((el) => restartAnim(el, 'fresh'));
}

function enemyTurn() {
  if (S.mode !== 'fight' || S.phase !== 'enemy') return;
  const f = S.fight;
  const { dmg, replaced } = L.enemyAct(f);
  S.playerHp -= dmg;
  let text = `${f.enemy.name} hits you for ${dmg}.`, kind = 'bad';
  if (replaced) { text += `  CURSE WAVE! ${replaced.length} tiles turn to hard letters.`; kind = 'curse'; }

  if (S.playerHp <= 0 && S.lives > 0 && f.idx === L.ENEMIES.length - 1) {
    S.lives--;                                    // spend a bonus life in the final fight
    S.playerHp = Math.floor(L.PLAYER_MAX_HP * L.REVIVE_FRAC);
    text = `${f.enemy.name} hits for ${dmg}. BONUS LIFE used! Back with ${S.playerHp} HP (${S.lives} left).`;
    kind = 'warn';
    S.phase = 'player';
  } else if (S.playerHp <= 0) {
    S.playerHp = 0;
    S.mode = 'defeat';
    showOverlay(`${f.enemy.name} wins`,
      `You were spelled to death.\nBest-word hits this run: ${S.totalPerfect} / ${S.totalPlays}`,
      'bad', 'Try again');
  } else {
    S.phase = 'player';
  }
  say(text, kind);
  render();
  restartAnim($('youBox'), 'shake');
  if (replaced) replaced.forEach((i) => restartAnim(tiles[i], 'fresh'));
}

function advance() {
  if (S.mode === 'victory') startFight(S.fight.idx + 1);
  else if (S.mode === 'defeat' || S.mode === 'won') startRun();
}

function toggleCommon() {
  if (L.commonArr.length === 0) return;
  L.commonOnly = !L.commonOnly;
  saveSettings();
  say(L.commonOnly ? 'Best-word check: common words only' : 'Best-word check: every valid word', 'warn');
  render();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function buildTiles() {
  const grid = $('grid');
  for (let i = 0; i < L.GRID; i++) {
    const el = document.createElement('button');
    el.className = 'tile';
    el.append(document.createTextNode(''));
    const val = document.createElement('span'); val.className = 'val';
    const ord = document.createElement('span'); ord.className = 'ord';
    el.append(val, ord);
    // pointerdown (not click) so a tile reacts the instant a finger lands
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); toggleTile(i); });
    el.addEventListener('animationend', () => el.classList.remove('fresh'));
    // keyboard users can still activate a focused tile
    el.addEventListener('keydown', (ev) => { if (ev.key === ' ') { ev.preventDefault(); toggleTile(i); } });
    grid.append(el);
    tiles.push(el);
  }
}

function wire() {
  $('btnPlay').addEventListener('click', submit);
  $('btnClear').addEventListener('click', () => { if (canAct()) { clearSel(); render(); } });
  $('btnBack').addEventListener('click', removeLast);
  $('btnScramble').addEventListener('click', scramble);
  $('btnCommon').addEventListener('click', toggleCommon);
  $('ovBtn').addEventListener('click', advance);
  for (const id of ['foeBox', 'youBox']) {
    $(id).addEventListener('animationend', () => $(id).classList.remove('shake'));
  }

  // desktop keyboard
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'F2') { ev.preventDefault(); toggleCommon(); return; }
    if (S.mode === 'loading') return;
    if (S.mode !== 'fight') {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); advance(); }
      return;
    }
    if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); removeLast(); }
    else if (ev.key === 'Tab') { ev.preventDefault(); doScramble(); }
    else if (ev.key === 'Escape') { if (canAct()) { clearSel(); render(); } }
    else if (/^[a-zA-Z]$/.test(ev.key)) { typeLetter(ev.key); }
  });
}

async function boot() {
  buildTiles();
  wire();
  try {
    const [words, common] = await Promise.all(['data/words.txt', 'data/common.txt'].map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.text();
    }));
    L.loadWords(words);
    L.loadCommon(common);
  } catch (err) {
    $('loadText').textContent =
      'Could not load the word lists. The game has to be opened through a web server ' +
      '(see the README), not by double-clicking index.html.\n\n' + err.message;
    return;
  }
  L.commonOnly = L.commonArr.length > 0;          // default: common words only
  loadSettings();
  $('loading').hidden = true;
  $('app').classList.remove('loading');
  startRun();
}

// handy for testing from the browser console
window.beatPoe = { S, L, render };

boot();
