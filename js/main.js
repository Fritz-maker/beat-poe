// main.js : Beat Poe! plain playable skeleton (no author art or popups yet).
import L from './logic.js';
import { LINES, LOW_HP, reactionKey, foeTurnKey } from './lines.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'beatpoe.settings';
const ENEMY_DELAY = 700;          // ms pause before the foe hits back
const BANNER_MS = { life: 3800, close: 2400 };
const RESULT_DELAY = 1500;        // ms the defeated foe's cross face is shown before the result card

// Portraits: art/<id>-normal.webp and art/<id>-cross.webp for each foe.
// A foe whose pictures are not in the art folder yet gets the grey placeholder.
const artState = {};              // foe id -> 'ok' | 'missing' (unset while still checking)
const facePaths = (id) => ({ normal: `art/${id}-normal.webp`, cross: `art/${id}-cross.webp` });
const faceOf = (id) => (artState[id] === 'ok' ? facePaths(id) : null);
// Look for a foe's pictures; show them once they have loaded.
function checkArt(id) {
  if (artState[id]) return;
  const probe = new Image();
  probe.onload = () => { artState[id] = 'ok'; new Image().src = facePaths(id).cross; render(); };
  probe.onerror = () => { artState[id] = 'missing'; render(); };
  probe.src = facePaths(id).normal;
}

const S = {
  mode: 'loading',                // loading | fight | victory | defeat | won
  phase: 'player',                // player | enemy
  fight: null,
  sel: [],                        // selected tile indices, in order
  lastQu: null,                   // a Qu tile just picked by typing "q" (the next "u" is swallowed)
  playerHp: L.PLAYER_MAX_HP,
  lives: 0,
  foeCross: false,                // the foe has just been beaten and is showing the cross face
  overlayReady: false,            // the result card is up and can be dismissed
  showReview: true,               // setting: offer the "Show me" button after a miss
  reveal: null,                   // result of the last play, for the last-word line
  note: null,                     // { text, kind }: a short system note shown under the word tray
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
    if (typeof s.showReview === 'boolean') S.showReview = s.showReview;
  } catch (e) { /* private mode or blocked storage: just use defaults */ }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ commonOnly: L.commonOnly, showReview: S.showReview })); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------
const tiles = [];
let bannerTimer = 0, scrambleTimer = 0, enemyTimer = 0, resultTimer = 0;

// What the foe says (the speech bubble on the stage). " / " in a line is a verse line break.
function say(text) {
  const m = $('msg');
  m.textContent = text.replaceAll(' / ', '\n');
  fitBubble();
  restartAnim(m, 'pop');
}

// Say one of the current foe's lines (js/lines.js). Lines given as a list are used in rotation.
function sayLine(key) {
  const f = S.fight;
  const set = LINES[f.enemy.id] || {};
  let line = set[key];
  if (Array.isArray(line)) { line = line[f.said[key] % line.length]; f.said[key]++; }
  if (line) say(line);
}

// Shrink the bubble's text until it fits inside the stage (long lines on small phones).
function fitBubble() {
  const m = $('msg'), stage = $('foeBox');
  m.style.fontSize = '';
  let size = parseFloat(getComputedStyle(m).fontSize);
  const limit = () => stage.getBoundingClientRect().bottom - 10;   // the health bar overlaps the stage's bottom edge
  while (size > 10 && m.getBoundingClientRect().bottom > limit()) {
    size -= 1;
    m.style.fontSize = size + 'px';
  }
}

// A damage number that floats up off a health bar.
function floatNumber(holderId, text) {
  const el = document.createElement('span');
  el.className = 'floater';
  el.textContent = text;
  el.addEventListener('animationend', () => el.remove());
  $(holderId).append(el);
}

// A short system note under the word tray (shown while no word is being spelled).
function note(text, kind) {
  S.note = text ? { text, kind: kind || '' } : null;
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
  if (S.note && S.note.text.startsWith('Scramble gives')) { note(null); render(); }
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
  document.body.dataset.foe = e.id;                // picks this foe's colours and fonts (css/themes.css)
  const art = faceOf(e.id);
  const img = $('faceImg');
  $('face').classList.toggle('art', !!art);
  $('facePlaceholder').toggleAttribute('hidden', artState[e.id] !== 'missing');   // placeholder only when there is no art
  img.hidden = !art;
  if (art) {
    const want = S.foeCross ? art.cross : art.normal;
    if (img.getAttribute('src') !== want) img.src = want;
    img.alt = `${e.name}${S.foeCross ? ', cross' : ''}`;
  }
  $('foeCount').textContent = `Foe ${f.idx + 1} of ${L.ENEMIES.length}`;
  const ehp = Math.max(0, Math.ceil(f.hp));
  $('foeFill').style.width = (100 * ehp / e.hp) + '%';
  $('foeHp').textContent = `${ehp} / ${e.hp}`;

  // curse countdown: one bead per foe turn in the cycle, filling up as the wave gets closer
  const soon = f.waveIn <= 1;
  $('wave').className = 'wave' + (soon ? ' soon' : '');
  $('wave').setAttribute('aria-label', `Curse wave in ${f.waveIn} foe turns, ${e.waveSize} tiles`);
  $('waveText').textContent = soon ? `Curse next turn! (${e.waveSize})` : `Curse in ${f.waveIn}`;
  const beads = $('beads');
  if (beads.children.length !== e.waveEvery) {
    beads.replaceChildren(...Array.from({ length: e.waveEvery }, () => document.createElement('i')));
  }
  [...beads.children].forEach((b, k) => b.classList.toggle('on', k < e.waveEvery - f.waveIn));

  const php = Math.max(0, Math.ceil(S.playerHp));
  $('youFill').style.width = (100 * php / L.PLAYER_MAX_HP) + '%';
  $('youHp').textContent = `You ${php} / ${L.PLAYER_MAX_HP}`;
  $('livesNum').textContent = S.lives;
  $('lives').className = 'lives' + (S.lives > 0 ? ' has' : '');
  $('lives').setAttribute('aria-label', `${S.lives} bonus lives`);

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
    info.textContent = S.note ? S.note.text : '';
    info.className = 'small ' + (S.note ? S.note.kind : '');
  } else {
    const valid = word.length >= L.MIN_WORD && L.isWord(word);
    w.textContent = word;
    w.className = 'word' + (valid ? ' valid' : '');
    w.style.fontSize = word.length > 9 ? Math.max(16, Math.floor(32 * 9 / word.length)) + 'px' : '';
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
    last.append(b);
  }
  $('btnShow').hidden = !(S.showReview && r && r.best.word && r.dmg < r.best.dmg);
  $('setReviewOn').classList.toggle('on', S.showReview);
  $('setReviewOff').classList.toggle('on', !S.showReview);
  $('setCommon').classList.toggle('on', L.commonOnly);
  $('setAll').classList.toggle('on', !L.commonOnly);
}

function showOverlay(title, text, kind, button) {
  // the card covers the board but leaves the stage (and the foe's face) in view
  const app = $('app').getBoundingClientRect();
  $('overlay').style.top = Math.round(document.querySelector('.wall').getBoundingClientRect().bottom - app.top) + 'px';
  S.overlayReady = true;
  hideBanner();
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
const settingsOpen = () => !$('settings').hidden;

function startFight(idx) {
  S.fight = L.newFight(idx);
  S.fight.plays = 0; S.fight.perfect = 0; S.fight.longest = '';
  S.fight.said = { hit: 0 };      // rotation counters for lines said more than once
  S.fight.saidLow = false;        // the "nearly dead" line is said once per fight
  S.fight.held = false;           // the foe has reacted to the word just played and keeps that line up
  clearSel();
  S.reveal = null;
  S.phase = 'player';
  S.mode = 'fight';
  S.foeCross = false;
  S.overlayReady = false;
  clearTimeout(resultTimer);
  checkArt(S.fight.enemy.id);
  hideBanner(); disarmScramble();
  $('overlay').hidden = true;
  note(null);
  render();
  sayLine('intro');
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
  note(null);
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
  note(null);
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
  if (!res.ok) { clearSel(); note(res.reason, 'invalid'); render(); return; }

  f.plays++; S.totalPlays++;
  const verdict = L.judge(res.dmg, res.best.dmg);
  if (verdict === 'perfect') { f.perfect++; S.totalPerfect++; S.lives++; }
  if (res.word.length > f.longest.length) f.longest = res.word;
  S.reveal = res;
  clearSel();

  note(`${res.word} hits for ${res.dmg}.`, 'good');
  floatNumber('wallBox', `\u2212${res.dmg}`);
  const reaction = reactionKey(verdict, res.word.length);
  f.held = false;
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
    const last = f.idx >= L.ENEMIES.length - 1;
    if (last) S.mode = 'won';
    // the beaten foe turns cross; the result card follows after a beat
    S.foeCross = true;
    const art = faceOf(f.enemy.id);
    render();
    sayLine('beaten');
    restartAnim($('foeBox'), 'shake');
    if (art) restartAnim($('faceImg'), 'cross-in');
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      if (last) {
        showOverlay('You beat Poe!',
          `Best-word hits this run: ${S.totalPerfect} / ${S.totalPlays}\nLongest word: ${f.longest}`,
          'warn', 'Play again');
      } else {
        showOverlay(`${f.enemy.name} is defeated!`,
          `You recovered ${heal} HP.\nLongest word: ${f.longest}\nBest-word hits: ${f.perfect} / ${f.plays}`,
          'good', 'Next foe');
      }
    }, RESULT_DELAY);
    return;
  }
  beginEnemyPhase();
  render();
  if (reaction) { sayLine(reaction); f.held = true; }
  res.used.forEach((i) => restartAnim(tiles[i], 'fresh'));
  restartAnim($('foeBox'), 'shake');
}

function scramble() {
  if (!canAct()) return;
  const b = $('btnScramble');
  if (!b.classList.contains('armed')) {          // first tap arms, second tap confirms
    b.classList.add('armed');
    b.textContent = 'Tap again';
    clearSel();
    note('Scramble gives the foe a free hit. Tap again.', 'warn');
    render();
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
  note('Grid scrambled.', 'warn');
  beginEnemyPhase();
  render();
  sayLine('scramble');
  S.fight.held = true;
  tiles.forEach((el) => restartAnim(el, 'fresh'));
}

function enemyTurn() {
  if (S.mode !== 'fight' || S.phase !== 'enemy') return;
  const f = S.fight;
  const { dmg, replaced } = L.enemyAct(f);
  S.playerHp -= dmg;
  floatNumber('youBox', `\u2212${dmg}`);
  let lifeUsed = false;

  if (S.playerHp <= 0 && S.lives > 0 && f.idx === L.ENEMIES.length - 1) {
    S.lives--;                                    // spend a bonus life in the final fight
    S.playerHp = Math.floor(L.PLAYER_MAX_HP * L.REVIVE_FRAC);
    lifeUsed = true;
    note(`Bonus life used! Back with ${S.playerHp} health. Lives left: ${S.lives}`, 'warn');
    S.phase = 'player';
  } else if (S.playerHp <= 0) {
    S.playerHp = 0;
    S.mode = 'defeat';
    say('');                                      // the foe's last word goes on the result card
    const last = (LINES[f.enemy.id] || {}).win;
    showOverlay(`${f.enemy.name} wins`,
      `${last ? `\u201c${last}\u201d\n\n` : ''}Best-word hits this run: ${S.totalPerfect} / ${S.totalPlays}`,
      'bad', 'Try again');
  } else {
    S.phase = 'player';
    if (replaced) note(`Curse wave! ${replaced.length} tiles turned to hard letters.`, 'warn');
  }
  render();
  if (S.mode === 'fight') {
    const low = S.playerHp <= LOW_HP && !f.saidLow && !lifeUsed;
    const key = foeTurnKey({ lifeUsed, cursed: !!replaced, waveNext: f.waveIn <= 1, low, held: f.held });
    if (key === 'low') f.saidLow = true;
    if (key) sayLine(key);
  }
  f.held = false;
  restartAnim($('youBox'), 'shake');
  if (replaced) replaced.forEach((i) => restartAnim(tiles[i], 'fresh'));
}

function advance() {
  if (!S.overlayReady) return;                    // the result card is not up yet
  if (S.mode === 'victory') startFight(S.fight.idx + 1);
  else if (S.mode === 'defeat' || S.mode === 'won') startRun();
}

function setCommon(on) {
  if (L.commonArr.length === 0) return;
  L.commonOnly = on;
  saveSettings();
  render();
}
function toggleCommon() {
  setCommon(!L.commonOnly);
  if (S.mode === 'fight' && S.sel.length === 0) {
    note(L.commonOnly ? 'Best word: common words only' : 'Best word: every valid word', 'warn');
    render();
  }
}
function openSettings() { if (S.mode !== 'loading') $('settings').hidden = false; }
function closeSettings() { $('settings').hidden = true; }
// ---------------------------------------------------------------------------
// Missed-word review: the grid as it was, with the best word marked and numbered.
// ---------------------------------------------------------------------------
function miniGrid(before, tilesInOrder) {
  const order = new Map(tilesInOrder.map((idx, k) => [idx, k + 1]));
  const grid = document.createElement('div');
  grid.className = 'rv-grid';
  before.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'rv-tile' + (t.cursed ? ' cursed' : '') + (order.has(i) ? ' on' : '');
    el.textContent = L.tileLabel(t);
    if (order.has(i)) {
      const n = document.createElement('span'); n.className = 'ord'; n.textContent = order.get(i);
      el.append(n);
    }
    grid.append(el);
  });
  return grid;
}

function reviewColumn(title, cls, grid, word, dmg) {
  const col = document.createElement('div');
  col.className = 'rv-col ' + cls;
  const h = document.createElement('h2'); h.textContent = title;
  const w = document.createElement('div'); w.className = 'rv-word'; w.textContent = word;
  if (word.length > 8) w.style.fontSize = Math.max(11, Math.floor(20 * 8 / word.length)) + 'px';   // keep long words on one line
  const sub = document.createElement('div'); sub.className = 'rv-sub';
  sub.textContent = `${word.length} letters \u00d7${L.lengthMult(word.length).toFixed(2)} = ${dmg}`;
  col.append(h, grid, w, sub);
  return col;
}

function showMissed() {
  const r = S.reveal;
  if (!canAct() || !r || r.dmg >= r.best.dmg || !r.best.word) return;   // only on your own turn
  const body = $('reviewBody');
  body.replaceChildren();
  const cols = document.createElement('div');
  cols.className = 'rv-cols';
  cols.append(reviewColumn('You played', 'mine', miniGrid(r.before, r.used), r.word, r.dmg),
              reviewColumn('Best word', 'best', miniGrid(r.before, r.best.tiles), r.best.word, r.best.dmg));
  const gap = document.createElement('p'); gap.className = 'rv-gap';
  gap.append('Missed by ');
  const b = document.createElement('b'); b.textContent = `${r.best.dmg - r.dmg} damage`;
  gap.append(b, L.commonOnly ? ' (best common word)' : ' (best of all words)');
  body.append(cols, gap);
  const app = $('app').getBoundingClientRect();
  $('review').style.top = Math.round(document.querySelector('.wall').getBoundingClientRect().bottom - app.top) + 'px';
  $('review').hidden = false;
}
function closeReview() { $('review').hidden = true; }
const reviewOpen = () => !$('review').hidden;


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
  $('btnGear').addEventListener('click', openSettings);
  $('setCommon').addEventListener('click', () => setCommon(true));
  $('setAll').addEventListener('click', () => setCommon(false));
  $('setClose').addEventListener('click', closeSettings);
  $('btnShow').addEventListener('click', showMissed);
  $('reviewClose').addEventListener('click', closeReview);
  $('setReviewOn').addEventListener('click', () => { S.showReview = true; saveSettings(); render(); });
  $('setReviewOff').addEventListener('click', () => { S.showReview = false; saveSettings(); render(); });
  $('msg').addEventListener('animationend', () => $('msg').classList.remove('pop'));
  $('faceImg').addEventListener('animationend', () => $('faceImg').classList.remove('cross-in'));
  $('ovBtn').addEventListener('click', advance);
  for (const id of ['foeBox', 'youBox']) {
    $(id).addEventListener('animationend', () => $(id).classList.remove('shake'));
  }

  window.addEventListener('resize', fitBubble);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBubble);

  // desktop keyboard
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'F2') { ev.preventDefault(); toggleCommon(); return; }
    if (S.mode === 'loading') return;
    if (reviewOpen()) {                            // the fight waits while the review is open
      if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); closeReview(); }
      return;
    }
    if (settingsOpen()) {
      if (ev.key === 'Escape' || ev.key === 'Enter') { ev.preventDefault(); closeSettings(); }
      return;
    }
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
window.beatPoe = { S, L, LINES, render };

boot();
