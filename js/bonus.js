// bonus.js : the BONUS LIFE splash (dimmed board, gold flash, sunbursts, confetti, ~3.8 s).
// It only draws; the game decides when to call it. The styles are in css/style.css (".bl-" classes).
//
//   const stop = playBonusLife({ app, wallEl, livesEl, livesNumEl, lives, onLand, onDone });
//
// app         the #app element the splash is drawn inside
// wallEl      the splash covers everything below this element (so the foe's face stays visible)
// livesEl     the "bonus lives" counter the star flies into; livesNumEl is its number
// lives       the new number of lives (shown when the star lands)
// onLand      called when the star lands in the counter
// onDone      called when the splash has finished by itself (not when stopped early)
// Returns stop(): removes the splash at once.

export const SPLASH_MS = 3800;
const CALM_MS = 2400;                    // the reduced-motion version is shorter and has no movement

const STAR_PATH = 'M12 2l3 6.6 7 .8-5.2 4.8 1.5 7L12 17.6l-6.3 3.6 1.5-7L2 9.4l7-.8z';
let gradId = 0;
const starSVG = (cls) => {
  const g = 'blg' + (gradId++);
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c2"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9d00"/></linearGradient></defs><path d="${STAR_PATH}" fill="url(#${g})" stroke="#6b3300" stroke-width="1" stroke-linejoin="round"/></svg>`;
};

export function playBonusLife(o) {
  const { app, wallEl, livesEl, livesNumEl, lives } = o;
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DUR = SPLASH_MS;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const aRect = app.getBoundingClientRect();
  const wallBottom = wallEl.getBoundingClientRect().bottom - aRect.top;

  const root = document.createElement('div');          // one wrapper, so cleaning up is one remove()
  root.className = 'bl-root';
  const zone = document.createElement('div');
  zone.className = 'bl-zone' + (calm ? ' calm' : '');
  zone.style.top = Math.round(wallBottom) + 'px';
  zone.innerHTML = `<div class="bl-dim"></div><div class="bl-rays a"></div><div class="bl-rays b"></div>
    <div class="bl-ring"></div><div class="bl-ring two"></div>
    <i class="bl-tw" style="left:14%;top:26%;--at:.14"></i><i class="bl-tw" style="right:12%;top:22%;--at:.22"></i>
    <i class="bl-tw" style="left:20%;bottom:24%;--at:.30"></i><i class="bl-tw" style="right:18%;bottom:27%;--at:.18"></i>
    <i class="bl-tw" style="left:44%;top:12%;--at:.36"></i>
    <div class="bl-card">${starSVG('bl-star')}
      <div class="bl-title"><span>Bonus</span><span>Life!</span></div>
      <div class="bl-sub">Perfect word!</div>
      <div class="bl-count">Lives saved for the final fight: ${lives}</div></div>`;
  root.append(zone);
  app.append(root);
  const star = zone.querySelector('.bl-star');

  let stopConfetti = () => {};
  if (!calm) {
    const flash = document.createElement('div'); flash.className = 'bl-flash'; root.append(flash);
    const canvas = document.createElement('canvas'); canvas.className = 'bl-confetti'; root.append(canvas);
    stopConfetti = runConfetti(canvas, wallBottom);
  }

  // the star leaves the title and flies down into the lives counter, which then ticks up
  const flyAt = calm ? 0.55 * DUR : 0.70 * DUR, flyMs = 0.17 * DUR;
  function land(l) {
    livesNumEl.textContent = lives;
    livesEl.classList.remove('bump'); void livesEl.offsetWidth; livesEl.classList.add('bump');
    if (!calm) {
      const r = document.createElement('div'); r.className = 'bl-land';
      r.style.left = (l.left + l.width / 2 - aRect.left) + 'px';
      r.style.top = (l.top + l.height / 2 - aRect.top) + 'px';
      root.append(r);
    }
    if (o.onLand) o.onLand();
  }
  later(() => {
    const s = star.getBoundingClientRect(), l = livesEl.querySelector('svg').getBoundingClientRect();
    if (calm || !star.animate) { star.classList.add('gone'); land(l); return; }
    const fl = document.createElement('div'); fl.className = 'bl-flyer'; fl.innerHTML = starSVG('');
    fl.style.width = s.width + 'px'; fl.style.height = s.height + 'px';
    fl.style.left = (s.left - aRect.left) + 'px'; fl.style.top = (s.top - aRect.top) + 'px';
    fl.firstChild.style.cssText = 'width:100%;height:100%;display:block';
    root.append(fl); star.classList.add('gone');
    const dx = (l.left + l.width / 2) - (s.left + s.width / 2), dy = (l.top + l.height / 2) - (s.top + s.height / 2), sc = l.width / s.width;
    const a = fl.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 },
      { transform: `translate(${dx * .25}px, ${dy * .18 - 30}px) scale(.85) rotate(160deg)`, offset: .35 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(540deg)`, offset: 1 },
    ], { duration: flyMs, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
    a.onfinish = () => { fl.remove(); land(l); };
  }, flyAt);

  const END = calm ? CALM_MS : DUR;
  if (calm) later(() => zone.classList.add('fade'), END - 500);
  function cleanup() { timers.forEach(clearTimeout); stopConfetti(); root.remove(); }
  later(() => { cleanup(); if (o.onDone) o.onDone(); }, END);
  return cleanup;
}

// Confetti: one canvas, about 190 pieces. Movement is in pixels per second, so it looks the
// same at any frame rate. Returns stop().
function runConfetti(canvas, zoneTop) {
  const ctx = canvas.getContext('2d');
  const r = canvas.getBoundingClientRect(), W = r.width, H = r.height, dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.body);
  const accent = ['--curse-edge', '--good', '--ehp', '--tile-sel'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
  const COLORS = ['#ffd23f', '#ffd23f', '#ffb81f', '#fff1a8', '#ffffff', '#ff9d00', ...accent];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const parts = [];
  const cy = zoneTop + (H - zoneTop) * 0.46;
  function add(n, x, y, aMin, aMax, vMin, vMax) {
    for (let i = 0; i < n; i++) {
      const a = rnd(aMin, aMax), v = rnd(vMin, vMax), shape = Math.random();
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, 6.28), vr: rnd(-9, 9),
        w: rnd(7, 13), h: rnd(10, 20), c: COLORS[(Math.random() * COLORS.length) | 0], ph: rnd(0, 6.28), pv: rnd(5, 11),
        sway: rnd(10, 40), life: rnd(2.0, 3.0), age: 0, kind: shape < .62 ? 0 : shape < .85 ? 1 : 2 });
    }
  }
  const t0 = performance.now();
  let last = t0, fired1 = false, fired2 = false, rainDebt = 0, raf = 0;
  function frame(now) {
    const sec = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!fired1 && sec >= 0.22) { fired1 = true; add(80, W / 2, cy, 0, 6.283, 320, 980); parts.forEach((p) => { p.vy -= 260; }); }
    if (!fired2 && sec >= 0.70) {
      fired2 = true;
      add(45, -4, H + 4, -1.25, -0.80, 900, 1500);            // left cannon, aimed up and in
      add(45, W + 4, H + 4, -2.34, -1.89, 900, 1500);         // right cannon
    }
    if (sec > 0.9 && sec < 2.5) {                             // a steady rain from the top keeps the fall going
      rainDebt += 55 * dt;
      while (rainDebt >= 1) { rainDebt--; add(1, rnd(0, W), -14, 1.2, 1.9, 40, 160); }
    }
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.age > p.life || p.y > H + 30) { parts.splice(i, 1); continue; }
      p.vx *= Math.exp(-2.1 * dt); p.vy = p.vy * Math.exp(-3.0 * dt) + 880 * dt;
      p.ph += p.pv * dt; p.rot += p.vr * dt;
      p.x += (p.vx + Math.cos(p.ph * .6) * p.sway) * dt; p.y += p.vy * dt;
      const left = p.life - p.age; ctx.globalAlpha = left < .45 ? left / .45 : 1;
      ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.kind === 2) { ctx.beginPath(); ctx.arc(0, 0, p.w * .42, 0, 6.283); ctx.fill(); }
      else { ctx.scale(1, Math.cos(p.ph)); if (p.kind === 1) ctx.fillRect(-p.w * .2, -p.h * .8, p.w * .4, p.h * 1.6); else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
