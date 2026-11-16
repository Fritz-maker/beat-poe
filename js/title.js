// title.js : the title screen shown once when the game is opened (not between fights).
// It is a layer on top of the game (see ".title" in css/style.css); the game is already set up behind it.
//
//   const title = initTitle({ onPlay, onSettings });
//   title.open();   title.isOpen();   title.play();   title.isHowOpen();   title.closeHow();

const $ = (id) => document.getElementById(id);

// The title is spelled in letter tiles, one font per author:
// [letter, value, font, weight, tile colour, ink colour, extra top padding]
const LOGO = [
  [['B', '1.5', '"Rye"', 400, '#f1dfb6', '#3b2414', 0], ['E', '1', '"Alfa Slab One"', 400, '#f6f1e3', '#2f3a2c', 0],
   ['A', '1', '"Cormorant Garamond"', 700, '#cfdcc6', '#1c2a22', 0], ['T', '1', '"Pirata One"', 400, '#ddd5c3', '#1d1418', 0]],
  [['P', '1.5', '"Special Elite"', 400, '#cfdcc6', '#1c2a22', '6%'], ['O', '1', '"IM Fell English SC"', 400, '#ddd5c3', '#1d1418', 0],
   ['E', '1', '"Rye"', 400, '#f1dfb6', '#3b2414', 0], ['!', '', '"Alfa Slab One"', 400, '', '', 0]],
];
const TILT = [-2, 1.5, -1, 2, 1, -2, 1.5, -1];

// The four authors, in fight order, with their stage colours (the same ones as css/themes.css).
const FOES = [
  { id: 'twain', n: 'Twain', st: 'linear-gradient(180deg,#2c5563,#1d3742)', ed: '#4c7482', tx: '#f4e6c8', nf: '"Rye"' },
  { id: 'dickinson', n: 'Dickinson', st: 'linear-gradient(180deg,#34503d,#213228)', ed: '#55735f', tx: '#f3efe2', nf: '"Cormorant Garamond"', nw: 600, ns: 'italic' },
  { id: 'shelley', n: 'Shelley', st: 'linear-gradient(180deg,#2e3a73,#1b2140)', ed: '#4a5a94', tx: '#e6ecf5', nf: '"Pirata One"' },
  { id: 'poe', n: 'Poe', st: 'linear-gradient(180deg,#7a2f3d,#4a1b27)', ed: '#8a4a55', tx: '#f1e6d0', nf: '"IM Fell English SC"', nt: '.5px' },
];

export function initTitle({ onPlay, onSettings }) {
  const root = $('title');

  let k = 0;
  for (const row of LOGO) {
    const r = document.createElement('div'); r.className = 'ti-row';
    for (const [ch, v, f, w, t, ink, pt] of row) {
      const b = document.createElement('button');
      b.className = 'lt' + (ch === '!' ? ' cursed' : '');
      b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
      b.style.cssText = `--f:${f};--w:${w};--t:${t};--k:${ink};--pt:${pt};--i:${k};--r:${TILT[k]}deg`;
      b.textContent = ch;
      if (v) { const s = document.createElement('small'); s.textContent = v; b.append(s); }
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.toggle('up'); });   // tiles are tappable, just for fun
      r.append(b); k++;
    }
    $('logo').append(r);
  }

  FOES.forEach((f, i) => {
    const c = document.createElement('div');
    c.className = 'pc' + (f.id === 'poe' ? ' final' : '');
    c.style.cssText = `--st:${f.st};--ed:${f.ed};--tx:${f.tx};--nf:${f.nf};--nw:${f.nw || 400};--ns:${f.ns || 'normal'};--nt:${f.nt || 0};--i:${i}`;
    const img = document.createElement('img'); img.src = `art/${f.id}-normal.webp`; img.alt = f.n;
    const name = document.createElement('b'); name.textContent = f.n;
    const num = document.createElement('i'); num.textContent = i + 1;
    c.append(img, name, num);
    if (f.id === 'poe') { const tag = document.createElement('em'); tag.textContent = 'FINAL'; c.append(tag); }
    $('lineA').append(c);
  });

  const isOpen = () => !root.hidden;
  const isHowOpen = () => !$('howPanel').hidden;
  const closeHow = () => { $('howPanel').hidden = true; };
  let leaving = 0;
  function open() {
    clearTimeout(leaving);
    root.classList.remove('leaving');
    root.hidden = false;
    // keyboard players can just press Enter; on a touch phone a focus ring on Play would only look odd
    if (window.matchMedia && matchMedia('(pointer: fine)').matches) $('titlePlay').focus({ preventScroll: true });
  }
  function play() {
    if (!isOpen() || root.classList.contains('leaving')) return;
    root.classList.add('leaving');                          // a short fade, then it is gone
    onPlay();
    leaving = setTimeout(() => { root.hidden = true; root.classList.remove('leaving'); }, 220);
  }
  $('titlePlay').addEventListener('click', play);
  $('titleHow').addEventListener('click', () => { $('howPanel').hidden = false; });
  $('howClose').addEventListener('click', closeHow);
  $('titleGear').addEventListener('click', onSettings);
  return { open, play, isOpen, isHowOpen, closeHow };
}
