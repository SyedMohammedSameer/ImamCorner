import { initForms } from './forms';

// Site-wide behaviour: header shadow, theme toggle, menu sheet, scroll reveal, service worker.
export function initShell() {
  initForms();
  const header = document.querySelector<HTMLElement>('[data-header]');
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 4);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  });

  const menu = document.querySelector<HTMLDialogElement>('[data-menu]');
  document.querySelectorAll('[data-menu-open]').forEach((b) => b.addEventListener('click', () => menu?.showModal()));
  menu?.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
  menu?.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
