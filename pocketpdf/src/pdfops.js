// Core PDF operations for PocketPDF.
//
// Every function takes and returns plain bytes (Uint8Array), so the exact same
// module runs in Node (where the tests live) and in the browser (where the UI
// lives). It is built on pdf-lib, which is itself isomorphic. Crucially, none
// of this touches the network — all work happens in-process / in-tab, which is
// the entire point of the product: your files never leave your device.
//
// In the browser, "pdf-lib" is resolved by an import map to the vendored copy
// in web/vendor/; in Node it resolves from node_modules. Same code either way.

import { PDFDocument, degrees } from 'pdf-lib';

/** Normalise input to something pdf-lib accepts and validate it's non-empty. */
function asBytes(input, label = 'input') {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError(`${label} must be a Uint8Array or ArrayBuffer`);
}

async function load(bytes, label) {
  try {
    return await PDFDocument.load(asBytes(bytes, label), { ignoreEncryption: false });
  } catch (err) {
    // Surface a friendlier message; encrypted/corrupt files are the usual cause.
    throw new Error(`could not read PDF (${label}): ${err.message}`);
  }
}

/** Page count of a PDF given its bytes. */
export async function getPageCount(bytes) {
  return (await load(bytes, 'pdf')).getPageCount();
}

/**
 * The workhorse. Build a brand-new PDF from an explicit, ordered list of pages
 * drawn from one or more source documents — with optional per-page rotation.
 *
 * This single operation expresses merge, reorder, delete/keep-subset, extract
 * and rotate all at once: the UI just describes the pages it wants, in order.
 *
 * @param {{id: string, bytes: Uint8Array|ArrayBuffer}[]} sources
 * @param {{sourceId: string, pageIndex: number, rotate?: 0|90|180|270}[]} pages
 * @returns {Promise<Uint8Array>}
 */
export async function buildFromPages(sources, pages) {
  if (!Array.isArray(sources) || !Array.isArray(pages)) {
    throw new TypeError('buildFromPages(sources[], pages[])');
  }
  if (pages.length === 0) throw new Error('cannot build a PDF with zero pages');

  // Load each source exactly once.
  const docs = new Map();
  for (const s of sources) docs.set(s.id, await load(s.bytes, s.id));

  const out = await PDFDocument.create();
  for (const p of pages) {
    const src = docs.get(p.sourceId);
    if (!src) throw new Error(`unknown sourceId: ${p.sourceId}`);
    if (p.pageIndex < 0 || p.pageIndex >= src.getPageCount()) {
      throw new RangeError(`page ${p.pageIndex} out of range for ${p.sourceId}`);
    }
    const [copied] = await out.copyPages(src, [p.pageIndex]);
    const turn = ((p.rotate || 0) % 360 + 360) % 360;
    if (turn) {
      const base = copied.getRotation().angle || 0;
      copied.setRotation(degrees((base + turn) % 360));
    }
    out.addPage(copied);
  }
  return out.save();
}

/**
 * Concatenate whole PDFs in the given order. Convenience wrapper over
 * buildFromPages that keeps every page of every input.
 * @param {(Uint8Array|ArrayBuffer)[]} pdfBytesList
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfs(pdfBytesList) {
  if (!Array.isArray(pdfBytesList) || pdfBytesList.length === 0) {
    throw new Error('mergePdfs needs at least one PDF');
  }
  const sources = [];
  const pages = [];
  for (let i = 0; i < pdfBytesList.length; i++) {
    const id = `doc${i}`;
    const doc = await load(pdfBytesList[i], id);
    sources.push({ id, bytes: pdfBytesList[i] });
    for (let p = 0; p < doc.getPageCount(); p++) pages.push({ sourceId: id, pageIndex: p });
  }
  return buildFromPages(sources, pages);
}

/**
 * Wrap a single raster image into a one-page PDF sized to the image.
 * pdf-lib can embed PNG and JPEG; the browser converts anything else (WebP,
 * HEIC, …) to PNG via a canvas before calling this.
 * @param {Uint8Array|ArrayBuffer} imageBytes
 * @param {string} mimeType  'image/png' | 'image/jpeg'
 * @returns {Promise<Uint8Array>}
 */
export async function imageToPdf(imageBytes, mimeType) {
  const bytes = asBytes(imageBytes, 'image');
  const doc = await PDFDocument.create();
  let img;
  if (mimeType === 'image/png') img = await doc.embedPng(bytes);
  else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') img = await doc.embedJpg(bytes);
  else throw new Error(`unsupported image type: ${mimeType} (convert to PNG/JPEG first)`);

  const page = doc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return doc.save();
}

/** Split a PDF into an array of single-page PDFs (one per page). */
export async function splitToPages(bytes) {
  const doc = await load(bytes, 'pdf');
  const out = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const one = await PDFDocument.create();
    const [pg] = await one.copyPages(doc, [i]);
    one.addPage(pg);
    out.push(await one.save());
  }
  return out;
}
