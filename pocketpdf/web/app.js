// PocketPDF browser app.
//
// Wiring only: file intake → thumbnails (pdf.js) → a draggable page organiser →
// export (pdf-lib, via ../src/pdfops.js). All heavy lifting is in pdfops.js and
// runs entirely in this tab. No fetch(), no upload, ever.

import { buildFromPages, imageToPdf, getPageCount } from '../src/pdfops.js';
import { getDocument, GlobalWorkerOptions } from './vendor/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

// ---------------------------------------------------------------- state
/** @type {Map<string, {id:string,name:string,kind:'pdf'|'image',bytes:Uint8Array,mime?:string,objectUrl?:string,pdfBytes?:Uint8Array}>} */
const sources = new Map();
/** @type {{uid:number,sourceId:string,kind:string,name:string,pageIndex:number,rotate:number,thumb:string|null}[]} */
let pages = [];
let uidSeq = 0;
let srcSeq = 0;
const newUid = () => ++uidSeq;
const newSourceId = () => `s${++srcSeq}`;

// ---------------------------------------------------------------- elements
const $ = (id) => document.getElementById(id);
const fileInput = $('file-input');
const grid = $('grid');
const dropzone = $('dropzone');
const countEl = $('count');
const statusEl = $('status');
const downloadBtn = $('download');
const clearBtn = $('clear');

// ---------------------------------------------------------------- intake
async function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setBusy(true);
  const before = pages.length;
  const skipped = [];

  // Each file is handled independently: one password-protected or corrupt PDF
  // must not abort the whole batch.
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        await addPdf(file.name, bytes);
      } else if (file.type.startsWith('image/')) {
        addImage(file, bytes);
      } else {
        skipped.push(`${file.name} (not a PDF or image)`);
      }
    } catch (err) {
      skipped.push(`${file.name} (${err.message})`);
    }
  }

  render();
  setBusy(false);

  const added = pages.length - before;
  if (skipped.length && added) {
    setStatus(`Added ${added} page${added === 1 ? '' : 's'}. Skipped ${skipped.join('; ')}.`, 'warn');
  } else if (skipped.length) {
    setStatus(`Couldn't add ${skipped.join('; ')}.`, 'err');
  } else if (added) {
    setStatus(`Added ${added} page${added === 1 ? '' : 's'} — nothing left your device.`, 'ok');
  }
}

async function addPdf(name, bytes) {
  const id = newSourceId();
  sources.set(id, { id, name, kind: 'pdf', bytes });
  let thumbs;
  try {
    thumbs = await renderPdfThumbs(bytes);
  } catch {
    // pdf.js failed (e.g. worker blocked): still usable, just without previews.
    const n = await getPageCount(bytes);
    thumbs = Array.from({ length: n }, (_, i) => ({ pageIndex: i, thumb: null }));
    setStatus('Loaded PDF without page previews (rendering unavailable here).', 'warn');
  }
  for (const t of thumbs) {
    pages.push({ uid: newUid(), sourceId: id, kind: 'pdf', name, pageIndex: t.pageIndex, rotate: 0, thumb: t.thumb });
  }
}

function addImage(file, bytes) {
  const id = newSourceId();
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.type }));
  sources.set(id, { id, name: file.name, kind: 'image', bytes, mime: file.type, objectUrl });
  pages.push({ uid: newUid(), sourceId: id, kind: 'image', name: file.name, pageIndex: 0, rotate: 0, thumb: objectUrl });
}

/** Render each page of a PDF to a small PNG data URL using pdf.js. */
async function renderPdfThumbs(bytes) {
  const doc = await getDocument({ data: bytes.slice(), disableAutoFetch: true }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.5, 220 / base.width);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    out.push({ pageIndex: i - 1, thumb: canvas.toDataURL('image/png') });
  }
  doc.destroy();
  return out;
}

// ---------------------------------------------------------------- rendering
function render() {
  const has = pages.length > 0;
  dropzone.hidden = has;
  grid.hidden = !has;
  downloadBtn.disabled = !has;
  clearBtn.disabled = !has;
  countEl.textContent = has ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : 'no pages yet';

  grid.replaceChildren(...pages.map((p, i) => card(p, i)));
}

function card(p, index) {
  const el = document.createElement('div');
  el.className = 'page-card';
  el.draggable = true;
  el.dataset.uid = String(p.uid);

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (p.thumb) {
    const img = document.createElement('img');
    img.src = p.thumb;
    img.alt = `${p.name} page ${p.pageIndex + 1}`;
    img.style.transform = `rotate(${p.rotate}deg)`;
    thumb.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = `Page ${p.pageIndex + 1}`;
    thumb.appendChild(ph);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = p.kind === 'image' ? `🖼 ${p.name}` : `${p.name} · p${p.pageIndex + 1}`;

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(
    iconBtn('◀', 'move left', () => move(index, -1)),
    iconBtn('↻', 'rotate', () => rotate(p.uid)),
    iconBtn('▶', 'move right', () => move(index, 1)),
    iconBtn('✕', 'delete', () => remove(p.uid), 'del'),
  );

  el.append(thumb, meta, actions);
  wireDrag(el);
  return el;
}

function iconBtn(label, title, onClick, cls = '') {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------- edits
function rotate(uid) {
  const p = pages.find((x) => x.uid === uid);
  if (p) {
    p.rotate = (p.rotate + 90) % 360;
    render();
  }
}
function remove(uid) {
  pages = pages.filter((x) => x.uid !== uid);
  render();
}
function move(index, dir) {
  const j = index + dir;
  if (j < 0 || j >= pages.length) return;
  [pages[index], pages[j]] = [pages[j], pages[index]];
  render();
}
function reorder(fromUid, toUid) {
  if (fromUid === toUid) return;
  const from = pages.findIndex((p) => p.uid === fromUid);
  const to = pages.findIndex((p) => p.uid === toUid);
  if (from < 0 || to < 0) return;
  const [moved] = pages.splice(from, 1);
  pages.splice(to, 0, moved);
  render();
}

// ---------------------------------------------------------------- drag & drop reordering
let dragUid = null;
function wireDrag(el) {
  el.addEventListener('dragstart', () => {
    dragUid = Number(el.dataset.uid);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    dragUid = null;
    el.classList.remove('dragging');
    grid.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragUid != null) reorder(dragUid, Number(el.dataset.uid));
  });
}

// ---------------------------------------------------------------- export
async function download() {
  if (!pages.length) return;
  setBusy(true);
  setStatus('Building your PDF…', 'ok');
  try {
    const usedIds = [...new Set(pages.map((p) => p.sourceId))];
    const built = [];
    for (const id of usedIds) {
      const s = sources.get(id);
      built.push({ id, bytes: s.kind === 'pdf' ? s.bytes : await ensureImagePdf(s) });
    }
    const out = await buildFromPages(
      built,
      pages.map((p) => ({ sourceId: p.sourceId, pageIndex: p.kind === 'image' ? 0 : p.pageIndex, rotate: p.rotate })),
    );
    saveBlob(out, 'pocketpdf.pdf');
    setStatus(`Saved pocketpdf.pdf — ${pages.length} page${pages.length === 1 ? '' : 's'}, never uploaded.`, 'ok');
  } catch (err) {
    setStatus(`Export failed: ${err.message}`, 'err');
  } finally {
    setBusy(false);
  }
}

/** Convert an image source to a one-page PDF (caching the result). */
async function ensureImagePdf(s) {
  if (s.pdfBytes) return s.pdfBytes;
  let { bytes, mime } = s;
  if (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/jpg') {
    bytes = await rasterToPng(s.objectUrl); // WebP/etc. → PNG via canvas
    mime = 'image/png';
  }
  s.pdfBytes = await imageToPdf(bytes, mime);
  return s.pdfBytes;
}

function rasterToPng(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('image conversion failed'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('could not decode image'));
    img.src = url;
  });
}

function saveBlob(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- misc ui
function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
  statusEl.hidden = false;
}
function setBusy(on) {
  document.body.classList.toggle('busy', on);
  downloadBtn.disabled = on || pages.length === 0;
}
function clearAll() {
  for (const s of sources.values()) if (s.objectUrl) URL.revokeObjectURL(s.objectUrl);
  sources.clear();
  pages = [];
  statusEl.hidden = true;
  render();
}

// ---------------------------------------------------------------- events
fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = ''; // allow re-adding the same file
});
downloadBtn.addEventListener('click', download);
clearBtn.addEventListener('click', clearAll);

for (const evt of ['dragenter', 'dragover']) {
  document.addEventListener(evt, (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      dropzone.classList.add('drag');
    }
  });
}
document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) dropzone.classList.remove('drag');
});
document.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.length) {
    e.preventDefault();
    dropzone.classList.remove('drag');
    addFiles(e.dataTransfer.files);
  }
});

render();
