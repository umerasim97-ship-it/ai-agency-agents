/* ============================================================
   BG Remover — 100% in-browser background removal
   - AI mode   : @imgly/background-removal (ISNet via WASM) — vendored locally
   - Color Key : instant canvas chroma-key for solid backgrounds
   No API. No uploads. Everything stays on the device.
   ============================================================ */
'use strict';

const $ = (s) => document.querySelector(s);

/* ---------- Constants ---------- */
const IMGLY_LOCAL = new URL('vendor/imgly.mjs', import.meta.url).href;
const IMGLY_FALLBACKS = [
  'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm',
  'https://esm.sh/@imgly/background-removal@1.4.5',
];
const CDN_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/';
const MAX_DIM = 4096;

/* ---------- Elements ---------- */
const els = {
  dropzone: $('#dropzone'),
  fileInput: $('#fileInput'),
  canvasArea: $('#canvasArea'),
  canvas: $('#canvas'),
  overlay: $('#overlay'),
  ovTitle: $('#ovTitle'),
  ovSub: $('#ovSub'),
  ovBar: $('#ovBar'),
  panel: $('#panel'),
  modeTabs: $('#modeTabs'),
  qualityTabs: $('#qualityTabs'),
  qualityGroup: $('#qualityGroup'),
  chromaGroup: $('#chromaGroup'),
  modeHint: $('#modeHint'),
  tolerance: $('#tolerance'),
  tolVal: $('#tolVal'),
  swatches: $('#swatches'),
  customColor: $('#customColor'),
  btnDownload: $('#btnDownload'),
  btnCopy: $('#btnCopy'),
  btnOriginal: $('#btnOriginal'),
  btnNew: $('#btnNew'),
  toast: $('#toast'),
  engineDot: $('#engineDot').querySelector('.dot'),
  engineText: $('#engineText'),
};

/* ---------- State ---------- */
const state = {
  mode: 'ai',              // 'ai' | 'chroma'
  quality: 'fast',         // 'fast' → local model | 'high' → CDN model
  file: null,              // original File
  fileName: 'photo',
  orig: null,              // { canvas, w, h } downscaled source
  cutout: null,            // canvas with alpha
  bg: 'transparent',       // 'transparent' | 'blur' | '#hex'
  chroma: { color: null, tol: 40 },
  busy: false,
  libPromise: null,
  engineReady: false,
};

/* ---------- Tiny helpers ---------- */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function bitmapToCanvas(bmp) {
  const c = makeCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  return c;
}

let toastTimer = null;
function toast(msg, ms = 3200, isErr = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('err', isErr);
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function setEngine(status) {
  els.engineDot.classList.remove('ready', 'busy');
  if (status === 'ready') { els.engineDot.classList.add('ready'); els.engineText.textContent = 'Engine: ready'; }
  else if (status === 'busy') { els.engineDot.classList.add('busy'); els.engineText.textContent = 'Engine: loading…'; }
  else els.engineText.textContent = 'Engine: idle';
}

function showOverlay(title, sub = '') {
  els.overlay.hidden = false;
  els.ovTitle.textContent = title;
  els.ovSub.textContent = sub;
  els.ovBar.style.width = '0%';
}

function hideOverlay() { els.overlay.hidden = true; }

function setProgress(frac, sub) {
  els.ovBar.style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
  if (sub !== undefined) els.ovSub.textContent = sub;
}

/* ---------- AI library loading (local → CDN fallbacks) ---------- */
function ensureLib() {
  if (!state.libPromise) {
    setEngine('busy');
    const sources = [IMGLY_LOCAL, ...IMGLY_FALLBACKS];
    state.libPromise = (async () => {
      let lastErr = null;
      for (const src of sources) {
        try {
          const m = await import(/* @vite-ignore */ src);
          if (m && typeof m.removeBackground === 'function') return m;
        } catch (e) { lastErr = e; }
      }
      state.libPromise = null;
      setEngine('idle');
      throw lastErr ?? new Error('AI library load nahi ho saki');
    })();
  }
  return state.libPromise;
}

function imglyConfig() {
  const local = state.quality === 'fast';
  const prog = new Map(); // key -> [cur, tot] (aggregate across resources)
  return {
    model: local ? 'small' : 'medium',
    publicPath: local ? new URL('models/', location.href).href : CDN_PUBLIC_PATH,
    output: { format: 'image/png', quality: 1 },
    progress: (key, cur, tot) => {
      if (!tot) return;
      prog.set(key, [cur, tot]);
      let c = 0, t = 0;
      for (const [a, b] of prog.values()) { c += a; t += b; }
      const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
      let label = 'Download';
      if (/models|isnet|small|medium/i.test(key)) label = 'AI model download';
      else if (/wasm|onnxruntime/i.test(key)) label = 'Engine (wasm) download';
      setProgress(c / t, `${label} — ${mb(c)} / ${mb(t)} · cache ho jaye ga`);
    },
  };
}

function preloadEngine() {
  if (state.engineReady || state.busy) return;
  ensureLib()
    .then((lib) => (lib.preload ? lib.preload(imglyConfig()) : Promise.resolve()))
    .then(() => { state.engineReady = true; setEngine('ready'); })
    .catch(() => setEngine('idle'));
}

/* ---------- File loading ---------- */
async function loadFile(file) {
  if (state.busy) return;
  if (!file || !/^image\//.test(file.type || '')) {
    toast('Sirf image files chalti hain (JPG / PNG / WebP)', 3000, true);
    return;
  }

  let bmp = null;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      bmp = await createImageBitmap(img);
      URL.revokeObjectURL(url);
    } catch {
      toast('Yeh format browser decode nahi kar saka — JPG/PNG/WebP try karein', 3600, true);
      return;
    }
  }

  const sc = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(Math.round(bmp.width * sc), Math.round(bmp.height * sc));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();

  state.orig = { canvas: c, w: c.width, h: c.height };
  state.file = file;
  state.fileName = (file.name || 'photo').replace(/\.[^.]+$/, '');
  state.chroma.color = null;
  state.bg = 'transparent';
  syncSwatches();

  if (state.mode === 'ai') runAI();
  else { state.cutout = state.orig.canvas; enterEditor(); render(); }
}

/* ---------- AI pipeline ---------- */
async function runAI() {
  if (!state.orig || state.busy) return;
  state.busy = true;
  setButtonsDisabled(true);
  showOverlay(state.engineReady ? 'Background hataya ja raha hai…' : 'AI engine load ho raha hai — pehli dafa model download hoga…');

  const t0 = performance.now();
  try {
    const lib = await ensureLib();
    setProgress(1, state.engineReady ? '' : 'Model ready — ab process ho raha hai…');
    const blob = await lib.removeBackground(state.file, imglyConfig());
    state.engineReady = true;
    setEngine('ready');
    const bmp = await createImageBitmap(blob);
    state.cutout = bitmapToCanvas(bmp);
    enterEditor();
    render();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    toast(`Ho gaya ✓ (${secs}s) — background option laga ke download karein`);
  } catch (e) {
    console.error(e);
    const hint = state.quality === 'high'
      ? ' — "Fast" quality try karein (local model)'
      : ' — internet check karein ya "Color Key" mode use karein';
    toast('AI fail: ' + (e?.message || e) + hint, 5200, true);
    if (!state.cutout) backToDropzone();
  } finally {
    state.busy = false;
    setButtonsDisabled(false);
    hideOverlay();
  }
}

/* ---------- Chroma (color key) pipeline ---------- */
function applyChroma() {
  if (!state.orig) return;
  if (!state.chroma.color) { state.cutout = state.orig.canvas; render(); return; }

  const { canvas: src } = state.orig;
  const w = src.width, h = src.height;
  const out = makeCanvas(w, h);
  const img = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  const d = img.data;

  const [r0, g0, b0] = state.chroma.color;
  const hard = state.chroma.tol;                 // fully removed inside
  const soft = Math.max(hard + 1, hard * 1.75);  // feather ramp zone
  const scale = 255 / (soft - hard);

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= hard) d[i + 3] = 0;
    else if (dist < soft) d[i + 3] = Math.min(d[i + 3], Math.round((dist - hard) * scale));
  }

  out.getContext('2d').putImageData(img, 0, 0);
  state.cutout = out;
  render();
}

/* ---------- Rendering ---------- */
function render() {
  const co = state.cutout;
  if (!co) return;
  const cv = els.canvas;
  cv.width = co.width;
  cv.height = co.height;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);

  if (state.bg === 'blur') {
    ctx.save();
    ctx.filter = 'blur(18px)';
    ctx.drawImage(state.orig.canvas, 0, 0, cv.width, cv.height);
    ctx.restore();
  } else if (state.bg !== 'transparent') {
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.drawImage(co, 0, 0);
  cv.classList.toggle('checker', state.bg === 'transparent');
}

/* ---------- View transitions ---------- */
function enterEditor() {
  els.dropzone.style.display = 'none';
  els.canvasArea.hidden = false;
  updateModeUI();
}

function backToDropzone() {
  els.dropzone.style.display = '';
  els.canvasArea.hidden = true;
  state.orig = null;
  state.cutout = null;
  state.file = null;
}

function setButtonsDisabled(dis) {
  [els.btnDownload, els.btnCopy, els.btnNew].forEach((b) => (b.disabled = dis));
}

function updateModeUI() {
  const isAI = state.mode === 'ai';
  els.qualityGroup.hidden = !isAI;
  els.chromaGroup.hidden = isAI;
  els.modeHint.textContent = isAI
    ? 'AI kisi bhi photo se background hata deta hai — log, products, animals.'
    : 'Solid background (studio color) wali photos ke liye instant — image pe click kar ke color pick karein.';
}

/* ---------- Events: upload ---------- */
els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') els.fileInput.click(); });
els.fileInput.addEventListener('change', () => {
  if (els.fileInput.files?.[0]) loadFile(els.fileInput.files[0]);
  els.fileInput.value = '';
});

['dragenter', 'dragover'].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add('over'); })
);
['dragleave', 'drop'].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.remove('over'); })
);
els.dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) loadFile(f);
});
/* drop anywhere on stage too */
$('.stage').addEventListener('drop', (e) => {
  if (state.orig) { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f); }
});
$('.stage').addEventListener('dragover', (e) => e.preventDefault());

window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

/* ---------- Events: mode & quality ---------- */
els.modeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn || state.busy) return;
  state.mode = btn.dataset.mode;
  [...els.modeTabs.children].forEach((t) => t.classList.toggle('active', t === btn));

  if (!state.orig) { updateModeUI(); return; }
  if (state.mode === 'ai') runAI();
  else { state.cutout = state.orig.canvas; enterEditor(); applyChroma(); if (!state.chroma.color) toast('Image pe click kar ke background ka color pick karein', 4200); }
});

els.qualityTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn || state.busy) return;
  state.quality = btn.dataset.quality;
  [...els.qualityTabs.children].forEach((t) => t.classList.toggle('active', t === btn));
  state.engineReady = false;
  setEngine('idle');
  if (state.orig && state.mode === 'ai') runAI();
  else preloadEngine();
});

els.tolerance.addEventListener('input', () => {
  state.chroma.tol = +els.tolerance.value;
  els.tolVal.textContent = els.tolerance.value;
  if (state.chroma.color && !state.busy) applyChroma();
});

/* ---------- Events: color pick on canvas (chroma mode) ---------- */
els.canvas.addEventListener('click', (e) => {
  if (state.mode !== 'chroma' || !state.orig || state.busy) return;
  const r = els.canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) * els.canvas.width) / r.width);
  const y = Math.floor(((e.clientY - r.top) * els.canvas.height) / r.height);
  const px = state.orig.canvas.getContext('2d', { willReadFrequently: true }).getImageData(
    Math.min(x, state.orig.w - 1), Math.min(y, state.orig.h - 1), 1, 1
  ).data;
  state.chroma.color = [px[0], px[1], px[2]];
  const hex = '#' + [...state.chroma.color].map((v) => v.toString(16).padStart(2, '0')).join('');
  document.querySelector('.swatch.custom').style.background = hex;
  toast(`Color pick hua ${hex} — background remove ho gaya`, 2400);
  applyChroma();
});

/* ---------- Events: background swatches ---------- */
function syncSwatches() {
  [...els.swatches.querySelectorAll('.swatch')].forEach((s) => {
    s.classList.toggle('active', s.dataset.bg === state.bg);
  });
}

els.swatches.addEventListener('click', (e) => {
  const s = e.target.closest('.swatch');
  if (!s) return;
  if (s.classList.contains('custom')) return; // handled by color input
  state.bg = s.dataset.bg;
  syncSwatches();
  render();
});

els.customColor.addEventListener('input', () => {
  state.bg = els.customColor.value;
  document.querySelector('.swatch.custom').style.background = els.customColor.value;
  syncSwatches();
  render();
});

/* ---------- Events: actions ---------- */
els.btnDownload.addEventListener('click', () => {
  if (!state.cutout) return;
  els.canvas.toBlob((b) => {
    if (!b) { toast('Export fail hua', 2500, true); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `${state.fileName}-no-bg.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    toast('Download shuru ✓');
  }, 'image/png');
});

els.btnCopy.addEventListener('click', async () => {
  if (!state.cutout) return;
  try {
    const b = await new Promise((r) => els.canvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    toast('Clipboard pe copy ho gaya ✓');
  } catch {
    toast('Copy support nahi hai — Download use karein', 3000, true);
  }
});

/* Hold-to-compare original */
let comparing = false;
function compareStart(e) { if (!state.orig || comparing) return; comparing = true; e.preventDefault(); const cv = els.canvas; cv.width = state.orig.w; cv.height = state.orig.h; cv.getContext('2d').drawImage(state.orig.canvas, 0, 0); cv.classList.remove('checker'); }
function compareEnd() { if (!comparing) return; comparing = false; render(); }
els.btnOriginal.addEventListener('mousedown', compareStart);
els.btnOriginal.addEventListener('touchstart', compareStart, { passive: false });
['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((ev) =>
  els.btnOriginal.addEventListener(ev, compareEnd)
);

els.btnNew.addEventListener('click', () => { if (!state.busy) backToDropzone(); });

/* ---------- Preload engine on first interaction (AI mode only) ---------- */
window.addEventListener('pointerdown', () => { if (state.mode === 'ai') preloadEngine(); }, { once: true, capture: true });

/* ---------- Demo image (great for Color Key testing) ---------- */
function makeDemo() {
  const c = makeCanvas(1000, 700);
  const x = c.getContext('2d');
  x.fillStyle = '#0ea5a4';                       // solid teal studio bg
  x.fillRect(0, 0, 1000, 700);
  const g = x.createRadialGradient(420, 290, 30, 500, 380, 330);
  g.addColorStop(0, '#fff7ed');
  g.addColorStop(0.5, '#f59e0b');
  g.addColorStop(1, '#92400e');
  x.fillStyle = g;
  x.beginPath(); x.arc(500, 380, 240, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,.85)';
  x.beginPath(); x.ellipse(430, 285, 46, 26, -0.6, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(0,0,0,.18)';
  x.beginPath(); x.ellipse(520, 640, 190, 26, 0, 0, Math.PI * 2); x.fill();
  c.toBlob((b) => b && loadFile(new File([b], 'demo.png', { type: 'image/png' })), 'image/png');
}
window.addEventListener('keydown', (e) => { if (e.key === 'd' && !state.orig && !state.busy) makeDemo(); });
window.addEventListener('dblclick', () => { if (!state.orig && !state.busy) makeDemo(); });

/* ---------- Boot ---------- */
updateModeUI();
setEngine('idle');
console.log('%cBG Remover', 'font-weight:bold', '— 100% in-browser. Koi API nahi, koi upload nahi.');
