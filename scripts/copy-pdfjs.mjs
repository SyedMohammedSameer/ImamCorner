// Copies pdf.js runtime assets (fonts, cmaps, wasm decoders) to public/pdfjs so PDFs render faithfully.
import { cp, mkdir } from 'node:fs/promises';
const src = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const dest = new URL('../public/pdfjs/', import.meta.url);
await mkdir(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(new URL(dir, src), new URL(dir, dest), { recursive: true });
}
console.log('pdf.js assets copied to public/pdfjs');
