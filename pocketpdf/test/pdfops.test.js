import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  getPageCount,
  mergePdfs,
  buildFromPages,
  imageToPdf,
  splitToPages,
} from '../src/pdfops.js';

// Build a PDF whose page i has a distinctive width, so we can later prove the
// order pages came out in (widths are preserved across copy; rotation isn't a
// width change). widths[i] -> a page of size [widths[i], 200].
async function makePdf(widths) {
  const doc = await PDFDocument.create();
  for (const w of widths) doc.addPage([w, 200]);
  return doc.save();
}

// Read back the [width, rotation] of every page in a result PDF.
async function describe(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => [Math.round(p.getSize().width), p.getRotation().angle]);
}

// 1x1 transparent PNG.
const PNG_1x1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

test('getPageCount reports the number of pages', async () => {
  assert.equal(await getPageCount(await makePdf([100, 100, 100])), 3);
});

test('mergePdfs concatenates all pages in order', async () => {
  const a = await makePdf([110, 120]);
  const b = await makePdf([210, 220, 230]);
  const merged = await mergePdfs([a, b]);
  const pages = await describe(merged);
  assert.deepEqual(
    pages.map((p) => p[0]),
    [110, 120, 210, 220, 230],
  );
});

test('buildFromPages reorders, drops and rotates pages', async () => {
  const a = await makePdf([110, 120, 130]); // page widths identify pages
  // Want output: page2 (130), then page0 (110) rotated 90°. Page1 (120) dropped.
  const out = await buildFromPages(
    [{ id: 'a', bytes: a }],
    [
      { sourceId: 'a', pageIndex: 2 },
      { sourceId: 'a', pageIndex: 0, rotate: 90 },
    ],
  );
  assert.deepEqual(await describe(out), [
    [130, 0],
    [110, 90],
  ]);
});

test('buildFromPages can interleave pages from multiple sources', async () => {
  const a = await makePdf([110, 120]);
  const b = await makePdf([210, 220]);
  const out = await buildFromPages(
    [
      { id: 'a', bytes: a },
      { id: 'b', bytes: b },
    ],
    [
      { sourceId: 'b', pageIndex: 1 },
      { sourceId: 'a', pageIndex: 0 },
      { sourceId: 'b', pageIndex: 0 },
    ],
  );
  assert.deepEqual(
    (await describe(out)).map((p) => p[0]),
    [220, 110, 210],
  );
});

test('rotation accumulates on top of any existing rotation', async () => {
  const a = await makePdf([100]);
  const once = await buildFromPages([{ id: 'a', bytes: a }], [{ sourceId: 'a', pageIndex: 0, rotate: 90 }]);
  const twice = await buildFromPages([{ id: 'a', bytes: once }], [{ sourceId: 'a', pageIndex: 0, rotate: 90 }]);
  assert.equal((await describe(twice))[0][1], 180);
});

test('buildFromPages validates input', async () => {
  const a = await makePdf([100]);
  await assert.rejects(() => buildFromPages([{ id: 'a', bytes: a }], []), /zero pages/);
  await assert.rejects(
    () => buildFromPages([{ id: 'a', bytes: a }], [{ sourceId: 'a', pageIndex: 5 }]),
    /out of range/,
  );
  await assert.rejects(
    () => buildFromPages([{ id: 'a', bytes: a }], [{ sourceId: 'ghost', pageIndex: 0 }]),
    /unknown sourceId/,
  );
});

test('imageToPdf wraps a PNG into a one-page PDF sized to the image', async () => {
  const pdf = await imageToPdf(PNG_1x1, 'image/png');
  assert.deepEqual(await describe(pdf), [[1, 0]]);
});

test('imageToPdf rejects unsupported types', async () => {
  await assert.rejects(() => imageToPdf(PNG_1x1, 'image/webp'), /unsupported image type/);
});

test('splitToPages returns one single-page PDF per page', async () => {
  const a = await makePdf([110, 120, 130]);
  const parts = await splitToPages(a);
  assert.equal(parts.length, 3);
  for (const part of parts) assert.equal(await getPageCount(part), 1);
  // first part keeps the first page's width
  assert.equal((await describe(parts[0]))[0][0], 110);
});

test('unreadable bytes fail with a friendly error rather than a cryptic one', async () => {
  const garbage = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
  await assert.rejects(() => getPageCount(garbage), /could not read PDF/);
  await assert.rejects(() => mergePdfs([garbage]), /could not read PDF/);
});
