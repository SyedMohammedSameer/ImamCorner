// In-browser PDF compression for the admin uploader.
//
// Phone-captured PDFs are mostly huge photos. We re-render each page with pdf.js at a sensible
// resolution, optionally clean it up (grayscale + levels so paper turns white), re-encode as JPEG
// and rebuild the PDF with pdf-lib. Text-based PDFs are left alone by default: re-rendering them
// would lose selectable text and rarely makes them smaller.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

import { PRESETS, type Preset } from './presets';
export { PRESETS, type Preset };

const PDF_OPTS = { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/' } as any;

/** Opens a PDF; call close() to free the worker (pdf.js 6 destroys via the loading task). */
async function open(data: Blob) {
  const task = pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()), ...PDF_OPTS });
  return { doc: await task.promise, close: () => task.destroy() };
}

export interface Analysis { pages: number; scanned: boolean; textPages: number; size: number }

/** Counts pages and guesses whether the PDF is scanned (pages with almost no text). */
export async function analyzePdf(file: File): Promise<Analysis> {
  const { doc, close } = await open(file);
  const sample = Math.min(doc.numPages, 6);
  let textPages = 0;
  for (let i = 1; i <= sample; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    const chars = tc.items.reduce((n, it: any) => n + (it.str?.trim().length ?? 0), 0);
    if (chars > 80) textPages++;
  }
  const out = { pages: doc.numPages, scanned: textPages < Math.ceil(sample / 2), textPages, size: file.size };
  await close();
  return out;
}

interface Progress { (done: number, total: number): void }

/** Re-renders every page as a JPEG and returns a new, smaller PDF. */
export async function compressPdf(file: File, preset: Exclude<Preset, 'original'>, onProgress: Progress, signal?: AbortSignal): Promise<Blob> {
  const p = PRESETS[preset];
  const { doc: src, close } = await open(file);
  const out = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: p.clean })!;
  try {
    for (let i = 1; i <= src.numPages; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 }); // PDF points
      const scale = Math.min(p.maxSide / Math.max(base.width, base.height), 4);
      const vp = page.getViewport({ scale });
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // intent 'print' renders without requestAnimationFrame, so it keeps going in a background tab.
      // (Pass only `canvas`: pdf.js 6 stalls if canvasContext is passed too.)
      await page.render({ canvas, viewport: vp, intent: 'print' }).promise;
      if (p.clean) cleanScan(ctx, canvas.width, canvas.height);
      const jpg = await toJpeg(canvas, p.quality);
      const img = await out.embedJpg(jpg);
      out.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      onProgress(i, src.numPages);
    }
  } finally {
    await close();
  }
  return new Blob([await out.save({ useObjectStreams: true }) as BlobPart], { type: 'application/pdf' });
}

export interface PhotoPage { file: File; rotate: 0 | 90 | 180 | 270 }

/** Builds a PDF from phone photos (one photo per page, A4 width). */
export async function photosToPdf(photos: PhotoPage[], preset: Exclude<Preset, 'original'>, onProgress: Progress, signal?: AbortSignal): Promise<Blob> {
  const p = PRESETS[preset];
  const out = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: p.clean })!;
  for (let i = 0; i < photos.length; i++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const { file, rotate } = photos[i];
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any).catch(() => {
      throw new Error(`Couldn't read "${file.name}". Use JPG or PNG photos.`);
    });
    const sideways = rotate === 90 || rotate === 270;
    const w0 = sideways ? bmp.height : bmp.width, h0 = sideways ? bmp.width : bmp.height;
    const s = Math.min(1, p.maxSide / Math.max(w0, h0));
    canvas.width = Math.round(w0 * s);
    canvas.height = Math.round(h0 * s);
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    const dw = bmp.width * s, dh = bmp.height * s;
    ctx.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    bmp.close();
    if (p.clean) cleanScan(ctx, canvas.width, canvas.height);
    const img = await out.embedJpg(await toJpeg(canvas, p.quality));
    const pageW = 595.28, pageH = (pageW * canvas.height) / canvas.width;
    out.addPage([pageW, pageH]).drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
    onProgress(i + 1, photos.length);
  }
  return new Blob([await out.save({ useObjectStreams: true }) as BlobPart], { type: 'application/pdf' });
}

/** Renders page 1 of a PDF to a small data URL for previews. */
export async function thumbnail(blob: Blob, width = 360): Promise<string> {
  const { doc, close } = await open(blob);
  try {
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvas: c, viewport: vp, intent: 'print' }).promise;
    return c.toDataURL('image/jpeg', 0.8);
  } finally { await close(); }
}

/** Counts pages without rendering (used for files kept as-is). */
export async function countPages(blob: Blob) {
  const doc = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (b) => {
    if (!b) return reject(new Error('Could not encode page'));
    resolve(new Uint8Array(await b.arrayBuffer()));
  }, 'image/jpeg', quality));
}

/**
 * Document clean-up for phone photos:
 *  1. flat-field: estimate the paper brightness around every point (a downscaled, dilated and blurred
 *     copy where text disappears) and divide by it, removing shadows, vignetting and yellow tint;
 *  2. levels: the paper becomes pure white and ink near black, with a slight gamma to keep thin strokes.
 * The result is crisp and compresses to a fraction of the original JPEG size.
 */
function cleanScan(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const Y = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) Y[p] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;

  // 1. Background estimate on a coarse grid (~1/24 scale).
  const S = 24, gw = Math.max(1, Math.ceil(w / S)), gh = Math.max(1, Math.ceil(h / S));
  let grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    // brightest-ish value in the cell (90th percentile approximated by max of a sparse sample)
    let m = 0;
    for (let y = gy * S; y < Math.min(h, gy * S + S); y += 3) for (let x = gx * S; x < Math.min(w, gx * S + S); x += 3) { const v = Y[y * w + x]; if (v > m) m = v; }
    grid[gy * gw + gx] = m;
  }
  const pass = (src: Float32Array, fn: (vals: number[]) => number) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const vals: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) vals.push(src[yy * gw + xx]); }
      out[y * gw + x] = fn(vals);
    }
    return out;
  };
  grid = pass(grid, (v) => Math.max(...v)); // dilate: skip over dense text and photos' dark spots
  for (let k = 0; k < 3; k++) grid = pass(grid, (v) => v.reduce((a, b) => a + b, 0) / v.length); // smooth

  // Bilinear lookup of the background, then divide.
  const R = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, y / S - 0.5)), y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, x / S - 0.5)), x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const bg = (grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx) * (1 - ty) + (grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx) * ty;
      R[y * w + x] = Y[y * w + x] / Math.max(24, bg);
    }
  }

  // 2. Levels on the ratio image: ~paper (ratio ≈ 1) → white, darkest 1.5% → black.
  const hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) hist[Math.min(255, (R[p] * 200) | 0)]++;
  let acc = 0, lo = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.015) { lo = v / 200; break; } }
  const hi = 0.9;
  const span = Math.max(0.2, hi - lo);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const t = Math.min(1, Math.max(0, (R[p] - lo) / span));
    d[i] = d[i + 1] = d[i + 2] = 255 * Math.pow(t, 1.6);
  }
  ctx.putImageData(img, 0, 0);
}
