// Renders app icons and the social share image from SVG (run once; outputs are committed).
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const icon = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const inner = icon.replace(/<svg[^>]*>/, '').replace('</svg>', '');
const tile = (size, pad, bg = '#f7f2ea') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/><g transform="translate(${pad} ${pad}) scale(${(size - pad * 2) / 40})">${inner}</g></svg>`);
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname;
await sharp(tile(180, 22)).png().toFile(out('icons/apple-touch-icon.png'));
await sharp(tile(192, 24)).png().toFile(out('icons/icon-192.png'));
await sharp(tile(512, 64)).png().toFile(out('icons/icon-512.png'));
await sharp(tile(512, 110)).png().toFile(out('icons/maskable-512.png'));

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f2ea"/><stop offset=".5" stop-color="#f7f2ea"/><stop offset=".75" stop-color="#fbd9b0"/><stop offset=".9" stop-color="#f3a07a"/><stop offset="1" stop-color="#d9768b"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <circle cx="860" cy="500" r="70" fill="#fff0d6"/>
  <path d="M0 470 120 440 220 452 330 405 420 425 520 380 610 402 700 368 800 395 900 372 1000 408 1100 390 1200 420V630H0Z" fill="#b78a8f" opacity=".75"/>
  <path d="M0 520 150 495 300 515 450 492 600 518 750 498 900 522 1050 500 1200 515V630H0Z" fill="#7c5a6a"/>
  <path d="M0 565C300 548 600 580 1200 560V630H0Z" fill="#3d3240"/>
  <g fill="none" stroke="#3d3240" stroke-linecap="round"><path d="M140 590V430" stroke-width="18"/><path d="M140 535H116V485" stroke-width="13"/><path d="M140 510H162V462" stroke-width="13"/><path d="M1080 590V460" stroke-width="15"/><path d="M1080 540H1060V500" stroke-width="11"/></g>
  <g transform="translate(80 80) scale(2.2)">${inner}</g>
  <text x="80" y="250" font-family="Helvetica, Arial, sans-serif" font-size="84" font-weight="700" fill="#1c1915" letter-spacing="-3">Imam's Corner</text>
  <text x="82" y="310" font-family="Georgia, serif" font-style="italic" font-size="38" fill="#c2552b">Islamic Center of Tucson</text>
  <text x="82" y="365" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#4a433b">Khutbahs · Classes · Library · Prayer times · Ask the Imam</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(out('og.png'));
console.log('icons + og image written');
