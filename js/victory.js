// victory.js : the big "You beat Poe!" screen at the end of a winning run.
// The markup is in index.html (#vic), the styles in css/style.css (".vic" / ".v-" classes).
//
//   const stop = showVictory({ best, plays, longest, lives });
// Returns stop(): hides the screen and stops the confetti.

const $ = (id) => document.getElementById(id);

const FOES = [
  ['twain', 'Twain', 'linear-gradient(180deg,#2c5563,#1d3742)', '#4c7482', '#f4e6c8', '"Rye"'],
  ['dickinson', 'Dickinson', 'linear-gradient(180deg,#34503d,#213228)', '#55735f', '#f3efe2', '"Cormorant Garamond"'],
  ['shelley', 'Shelley', 'linear-gradient(180deg,#2e3a73,#1b2140)', '#4a5a94', '#e6ecf5', '"Pirata One"'],
  ['poe', 'Poe', 'linear-gradient(180deg,#7a2f3d,#4a1b27)', '#8a4a55', '#f1e6d0', '"IM Fell English SC"'],
];

let built = false;
function build() {
  built = true;
  FOES.forEach(([id, n, st, ed, tx, nf], i) => {
    const c = document.createElement('div');
    c.className = 'pc' + (id === 'poe' ? ' final' : '');
    c.style.cssText = `--st:${st};--ed:${ed};--tx:${tx};--nf:${nf};--i:${i}`;
    const img = document.createElement('img'); img.src = `art/${id}-cross.webp`; img.alt = `${n}, beaten`;
    const b = document.createElement('b'); b.textContent = n;
    c.append(img, b);
    $('vLine').append(c);
  });
}

export function showVictory({ best, plays, longest, lives }) {
  if (!built) build();
  const v = $('vic');
  $('vBest').textContent = `${best} / ${plays}`;
  $('vLongest').textContent = longest || '—';
  $('vLives').textContent = lives;
  v.hidden = false;
  // start every animation from the beginning
  v.querySelectorAll('*').forEach((el) => { el.style.animation = 'none'; });
  void v.offsetWidth;
  v.querySelectorAll('*').forEach((el) => { el.style.animation = ''; });
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stopConfetti = calm ? () => {} : celebrate($('vConf'));
  return () => { stopConfetti(); v.hidden = true; };
}

// Gold confetti in two bursts, then a slow fall of raven feathers. Returns stop().
function celebrate(cv) {
  const ctx = cv.getContext('2d'), r = cv.getBoundingClientRect(), W = r.width, H = r.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = (a, b) => a + Math.random() * (b - a), P = [];
  const GOLD = ['#ffd23f', '#ffb81f', '#fff1a8', '#ffffff', '#ff9d00', '#e0364c', '#e9b949'];
  const confetti = (n, x, y, a0, a1, v0, v1) => {
    for (let i = 0; i < n; i++) {
      const a = rnd(a0, a1), v = rnd(v0, v1);
      P.push({ k: 'c', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, 6.3), vr: rnd(-9, 9),
        w: rnd(7, 12), h: rnd(10, 18), c: GOLD[i % GOLD.length], ph: rnd(0, 6.3), life: rnd(2.2, 3.4), age: 0 });
    }
  };
  const feather = (x, y) => P.push({ k: 'f', x, y, vx: rnd(-20, 20), vy: rnd(30, 70), rot: rnd(-.6, .6), ph: rnd(0, 6.3), s: rnd(.7, 1.3), life: 12, age: 0 });
  const t0 = performance.now();
  let last = t0, f1 = false, f2 = false, fDebt = 0, raf = 0;
  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!f1 && t > 0.55) { f1 = true; confetti(110, W / 2, H * 0.22, 0, 6.28, 300, 1000); }
    if (!f2 && t > 1.8) { f2 = true; confetti(50, -4, H + 4, -1.25, -0.8, 900, 1500); confetti(50, W + 4, H + 4, -2.34, -1.89, 900, 1500); }
    if (t > 0.9 && t < 20) { fDebt += 2.2 * dt; while (fDebt >= 1) { fDebt--; feather(rnd(0, W), -30); } }
    ctx.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt;
      if (p.age > p.life || p.y > H + 60) { P.splice(i, 1); continue; }
      ctx.save();
      if (p.k === 'c') {
        p.vx *= Math.exp(-2.1 * dt); p.vy = p.vy * Math.exp(-3 * dt) + 880 * dt; p.ph += 8 * dt; p.rot += p.vr * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.min(1, (p.life - p.age) / 0.45); ctx.fillStyle = p.c;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.ph)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        p.ph += 1.6 * dt; p.x += (p.vx + Math.sin(p.ph) * 40) * dt; p.y += p.vy * dt;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.ph) * 0.5); ctx.scale(p.s, p.s);
        ctx.fillStyle = '#120b10'; ctx.strokeStyle = 'rgba(150,120,170,.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(9, -6, 2, 18); ctx.lineTo(-2, 18); ctx.quadraticCurveTo(-9, -6, 0, -22); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 26); ctx.strokeStyle = 'rgba(200,180,210,.6)'; ctx.stroke();
      }
      ctx.restore();
    }
    if (t < 30) raf = requestAnimationFrame(frame);    // the feathers stop after a while, so an idle phone can rest
    else ctx.clearRect(0, 0, W, H);
  }
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
}
