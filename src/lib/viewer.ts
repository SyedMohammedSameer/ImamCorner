// Imam's Corner PDF reader: pdf.js PDFViewer wrapped in a mobile-first UI.
// Features: lazy page rendering, text selection, in-document search, pinch & button zoom,
// remembered position, deep links (?page=N), night mode, focus mode, share, download, offline save.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';

const OFFLINE_CACHE = 'ic-library-v1';

export async function mountViewer(root: HTMLElement) {
  const src = root.dataset.src!;
  const title = root.dataset.title || 'Document';
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;

  const container = $('[data-container]');
  const status = $('[data-status]');
  const progress = $<HTMLElement>('[data-progress]');
  const pageInput = $<HTMLInputElement>('[data-page]');
  const pageCount = $('[data-count]');
  const floatPage = $('[data-float]');
  const zoomLabel = $('[data-zoom]');
  const findBar = $('[data-findbar]');
  const findInput = $<HTMLInputElement>('[data-find]');
  const findCount = $('[data-find-count]');
  const toast = $('[data-toast]');

  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  (globalThis as any).pdfjsLib = pdfjsLib;
  const { EventBus, PDFLinkService, PDFFindController, PDFViewer } = await import('pdfjs-dist/web/pdf_viewer.mjs');

  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus });
  const findController = new PDFFindController({ eventBus, linkService });
  const viewer = new PDFViewer({ container: container as HTMLDivElement, eventBus, linkService, findController, removePageBorders: true });
  linkService.setViewer(viewer);

  // ── Load with progress (full fetch so the service worker can cache whole files) ──
  let data: Uint8Array;
  try {
    data = await fetchWithProgress(src, (p) => { progress.style.transform = `scaleX(${p})`; });
  } catch {
    status.innerHTML = `<strong>Couldn't load this document.</strong><span>Check your connection, or <a href="${src}" download>download the PDF</a>.</span>`;
    root.classList.add('is-error');
    return;
  }
  // pdf.js transfers `data` to its worker (detaching it); keep a Blob copy for "Save offline".
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
  const doc = await pdfjsLib.getDocument({
    data,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
  } as any).promise;

  viewer.setDocument(doc);
  linkService.setDocument(doc, null);
  pageCount.textContent = String(doc.numPages);
  pageInput.max = String(doc.numPages);

  const storeKey = `ic:pos:${src}`;
  const fitMode = () => (container.clientWidth < 760 ? 'page-width' : 'auto');

  eventBus.on('pagesinit', () => {
    viewer.currentScaleValue = fitMode();
    const q = new URLSearchParams(location.search).get('page');
    let start = q ? Number(q) : 0;
    if (!start) { try { start = Number(localStorage.getItem(storeKey)) || 1; } catch { start = 1; } }
    if (start > 1 && start <= doc.numPages) viewer.currentPageNumber = start;
    root.classList.add('is-ready');
    progress.parentElement!.hidden = true;
  });

  let floatTimer: number;
  eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
    pageInput.value = String(pageNumber);
    floatPage.textContent = `${pageNumber} / ${doc.numPages}`;
    floatPage.classList.add('show');
    clearTimeout(floatTimer);
    floatTimer = window.setTimeout(() => floatPage.classList.remove('show'), 1200);
    try { localStorage.setItem(storeKey, String(pageNumber)); } catch {}
  });
  eventBus.on('scalechanging', ({ scale }: { scale: number }) => { zoomLabel.textContent = `${Math.round(scale * 100)}%`; });

  // ── Toolbar ──
  pageInput.addEventListener('change', () => {
    const n = Math.min(doc.numPages, Math.max(1, Number(pageInput.value) || 1));
    viewer.currentPageNumber = n;
  });
  pageInput.addEventListener('focus', () => pageInput.select());

  const act: Record<string, () => void> = {
    'zoom-in': () => viewer.increaseScale(),
    'zoom-out': () => viewer.decreaseScale(),
    fit: () => { viewer.currentScaleValue = viewer.currentScaleValue === 'page-fit' ? fitMode() : 'page-fit'; },
    prev: () => viewer.previousPage(),
    next: () => viewer.nextPage(),
    night: () => { const on = root.classList.toggle('is-night'); try { localStorage.setItem('ic:night', on ? '1' : ''); } catch {} },
    focus: () => {
      const on = root.classList.toggle('is-focus');
      document.documentElement.classList.toggle('reader-focus', on);
      setTimeout(() => (viewer.currentScaleValue = viewer.currentScaleValue), 50);
    },
    search: () => openFind(),
    'find-close': () => closeFind(),
    'find-next': () => find('again', false),
    'find-prev': () => find('again', true),
    share: () => share(),
    offline: () => saveOffline(),
    more: () => root.classList.toggle('menu-open'),
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) { if (!(e.target as HTMLElement).closest('[data-menu-panel]')) root.classList.remove('menu-open'); return; }
    if (b.dataset.act !== 'more') root.classList.remove('menu-open');
    act[b.dataset.act!]?.();
  });
  try { if (localStorage.getItem('ic:night')) root.classList.add('is-night'); } catch {}

  // ── Search ──
  // pdf.js scrolls matches with native scrollIntoView, which would also scroll the page, so pin the window while searching.
  let lockY: number | null = null, lockTimer: number;
  addEventListener('scroll', () => { if (lockY !== null && Math.abs(scrollY - lockY) > 1) scrollTo(0, lockY); }, { passive: true });
  const lockWindow = () => { lockY = scrollY; clearTimeout(lockTimer); lockTimer = window.setTimeout(() => (lockY = null), 900); };
  function openFind() {
    findBar.hidden = false; root.classList.add('find-open');
    const r = root.getBoundingClientRect();
    if (!root.classList.contains('is-focus') && (r.top < 0 || r.bottom > innerHeight + 2)) root.scrollIntoView({ block: 'start' });
    findInput.focus({ preventScroll: true }); findInput.select();
  }
  function closeFind() {
    findBar.hidden = true; root.classList.remove('find-open');
    eventBus.dispatch('findbarclose', { source: null });
  }
  function find(type: '' | 'again', previous = false) {
    lockWindow();
    eventBus.dispatch('find', { source: null, type, query: findInput.value, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false });
  }
  let findTimer: number;
  findInput.addEventListener('input', () => { clearTimeout(findTimer); findTimer = window.setTimeout(() => find(''), 180); });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); find('again', e.shiftKey); }
    if (e.key === 'Escape') closeFind();
  });
  eventBus.on('updatefindmatchescount', ({ matchesCount }: any) => updateCount(matchesCount));
  eventBus.on('updatefindcontrolstate', ({ state, matchesCount }: any) => {
    updateCount(matchesCount);
    findBar.classList.toggle('not-found', state === 1 && !!findInput.value);
  });
  function updateCount(m?: { current: number; total: number }) {
    if (!findInput.value) { findCount.textContent = ''; return; }
    findCount.textContent = m && m.total ? `${m.current} of ${m.total}` : 'No matches';
  }
  root.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-focus') && findBar.hidden) act.focus();
  });

  // ── Pinch to zoom ──
  try {
    const TouchManager = (pdfjsLib as any).TouchManager;
    if (TouchManager) new TouchManager({
      container,
      signal: new AbortController().signal,
      isPinchingDisabled: () => false,
      onPinching: (origin: [number, number], prev: number, dist: number) => {
        viewer.updateScale({ scaleFactor: dist / prev, origin, drawingDelay: 400 });
      },
    });
  } catch (err) { console.warn('[reader] pinch zoom unavailable', err); }

  // ── Share / offline ──
  async function share() {
    const url = new URL(location.href);
    url.searchParams.set('page', String(viewer.currentPageNumber));
    const payload = { title, text: `${title} | Imam's Corner`, url: url.toString() };
    try {
      if (navigator.share) { await navigator.share(payload); return; }
      await navigator.clipboard.writeText(payload.url);
      say('Link to this page copied');
    } catch (err: any) { if (err?.name !== 'AbortError') say('Couldn’t share. Copy the address bar instead.'); }
  }
  const offlineBtns = root.querySelectorAll<HTMLElement>('[data-act="offline"]');
  const markSaved = () => offlineBtns.forEach((b) => { b.classList.add('saved'); b.querySelector('span')!.textContent = 'Saved offline'; });
  if ('caches' in window) caches.match(src).then((r) => r && markSaved()).catch(() => {});
  async function saveOffline() {
    if (!('caches' in window)) { say('Offline saving isn’t supported in this browser'); return; }
    try {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.put(src, new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }));
      markSaved();
      say('Saved for offline reading');
    } catch (err) { console.warn('[reader] save offline failed', err); say('Couldn’t save offline'); }
  }
  function say(msg: string) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }
}

async function fetchWithProgress(url: string, onProgress: (p: number) => void): Promise<Uint8Array> {
  // Prefer an offline copy if the reader saved one.
  if ('caches' in window) {
    try {
      const hit = await caches.match(url);
      if (hit) { onProgress(1); return new Uint8Array(await hit.arrayBuffer()); }
    } catch {}
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress(total ? got / total : Math.min(0.9, got / 2_000_000));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  onProgress(1);
  return out;
}
