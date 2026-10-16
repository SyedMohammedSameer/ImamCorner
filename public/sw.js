// Imam's Corner service worker — offline shell, cached pages and saved library PDFs.
const VERSION = 'v1';
const SHELL = `ic-shell-${VERSION}`;
const PAGES = `ic-pages-${VERSION}`;
const LIBRARY = 'ic-library-v1'; // written by the reader's "Save offline" button; kept across versions
const PRECACHE = ['/', '/offline', '/prayer-times', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, PAGES, LIBRARY].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/admin')) return;

  // Saved PDFs: offline copy first.
  if (url.pathname.startsWith('/files/')) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  // Hashed build assets and pdf.js data: cache-first.
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/pdfjs/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Pages: network-first, fall back to cache, then the offline page.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy));
      return res;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match('/offline')) || Response.error()));
  }
});
