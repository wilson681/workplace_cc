/* ============================================================================
   LATENT — studio.js
   Shared helpers: nav behaviour, scroll reveals, fps meter, and a compact
   3D simplex-noise field used by several of the works.
   ========================================================================== */

/* ---- tiny DOM helpers ---------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/* ---- nav: shrink + reveal-on-scroll ------------------------------------- */
function initChrome() {
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }),
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  $$('.reveal').forEach((el) => io.observe(el));
}
if (document.readyState !== 'loading') initChrome();
else addEventListener('DOMContentLoaded', initChrome);

/* ---- hi-dpi canvas sizing ------------------------------------------------ */
function fitCanvas(canvas, { cap = 2 } = {}) {
  const dpr = Math.min(cap, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { dpr, w, h, cw: r.width, ch: r.height };
}

/* ---- a lightweight fps / frame meter ------------------------------------ */
function FPS(el) {
  let last = performance.now(), acc = 0, n = 0, shown = 0;
  return (now) => {
    const dt = now - last; last = now; acc += dt; n++;
    if (acc > 380) { shown = Math.round((n / acc) * 1000); acc = 0; n = 0;
      if (el) el.textContent = shown + ' fps'; }
    return shown;
  };
}

/* ---- color helpers ------------------------------------------------------- */
// hsl -> css; h in [0,360)
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

/* ============================================================================
   OpenSimplex-style 3D simplex noise (public-domain style port, compacted).
   Returns values in roughly [-1, 1]. Deterministic per seed.
   ========================================================================== */
function makeNoise(seed = 1337) {
  const perm = new Uint8Array(512), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // xorshift seeded shuffle
  let s = seed >>> 0 || 1;
  const rnd = () => (s ^= s << 13, s ^= s >>> 17, s ^= s << 5, (s >>> 0) / 4294967296);
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad3 = [
    1,1,0,-1,1,0,1,-1,0,-1,-1,0, 1,0,1,-1,0,1,1,0,-1,-1,0,-1,
    0,1,1,0,-1,1,0,1,-1,0,-1,-1
  ];
  const F3 = 1 / 3, G3 = 1 / 6;

  function noise3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const X0 = i - t, Y0 = j - t, Z0 = k - t;
    const x0 = x - X0, y0 = y - Y0, z0 = z - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    }

    const x1 = x0 - i1 + G3,  y1 = y0 - j1 + G3,  z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2*G3,y2 = y0 - j2 + 2*G3,z2 = z0 - k2 + 2*G3;
    const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    const corner = (gx, gy, gz, gi) => {
      let tt = 0.6 - gx*gx - gy*gy - gz*gz;
      if (tt < 0) return 0;
      const g = (perm[gi] % 12) * 3;
      tt *= tt;
      return tt * tt * (grad3[g]*gx + grad3[g+1]*gy + grad3[g+2]*gz);
    };
    n += corner(x0, y0, z0, ii + perm[jj + perm[kk]]);
    n += corner(x1, y1, z1, ii+i1 + perm[jj+j1 + perm[kk+k1]]);
    n += corner(x2, y2, z2, ii+i2 + perm[jj+j2 + perm[kk+k2]]);
    n += corner(x3, y3, z3, ii+1  + perm[jj+1  + perm[kk+1]]);
    return 32 * n;
  }
  return noise3;
}

/* ---- pause animation when the tab is hidden ----------------------------- */
function visibilityGate(onShow, onHide) {
  document.addEventListener('visibilitychange', () =>
    document.hidden ? onHide && onHide() : onShow && onShow());
}

/* ---- fullscreen toggle --------------------------------------------------- */
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

/* expose */
window.Studio = { $, $$, clamp, lerp, TAU, fitCanvas, FPS, hsl, makeNoise, visibilityGate, toggleFullscreen };
