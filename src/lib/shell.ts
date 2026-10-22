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

  showEditButton();

  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

// Signed-in admins get a floating shortcut to the screen that edits the current page.
const EDIT: [RegExp, string, string][] = [
  [/^\/jummah/, '/admin/jummah', 'Edit Jummah'],
  [/^\/(classes|office-hours)/, '/admin/classes', 'Edit classes'],
  [/^\/library/, '/admin/library', 'Edit library'],
  [/^\/books/, '/admin/books', 'Edit books'],
  [/^\/imams/, '/admin/imams', 'Edit imams'],
  [/^\/(ask|services|new-muslims)/, '/admin/messages', 'Messages'],
  [/^\/$/, '/admin', 'Dashboard'],
];
function showEditButton() {
  let signedIn = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('sb-') && k.endsWith('-auth-token') && localStorage.getItem(k)?.includes('access_token')) signedIn = true;
    }
  } catch {}
  if (!signedIn) return;
  const [, href, label] = EDIT.find(([re]) => re.test(location.pathname)) ?? [null, '/admin', 'Dashboard'];
  const a = document.createElement('a');
  a.href = href; a.className = 'admin-edit';
  a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>' + label;
  document.body.appendChild(a);
}
