// Forms post to /api/submit, which saves them for the admin inbox. With JavaScript they submit in place;
// without it the browser posts normally and is redirected to /thanks.
export function initForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector<HTMLButtonElement>('[type=submit]');
      const err = form.querySelector<HTMLElement>('[data-form-error]');
      btn?.setAttribute('disabled', ''); btn?.classList.add('loading');
      err && (err.hidden = true);
      try {
        const body = new URLSearchParams(new FormData(form) as any).toString();
        const res = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
        if (!res.ok) throw new Error(String(res.status));
        const done = document.querySelector<HTMLElement>(`[data-form-done="${form.getAttribute('name')}"]`);
        form.hidden = true;
        if (done) { done.hidden = false; done.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      } catch {
        if (err) { err.hidden = false; err.textContent = 'That didn’t send. Please try again or email the Imam.'; }
      } finally { btn?.removeAttribute('disabled'); btn?.classList.remove('loading'); }
    });
  });
  // Prefill from query string, e.g. /ask?topic=Book%20recommendation or /services?service=nikah
  const q = new URLSearchParams(location.search);
  q.forEach((v, k) => {
    const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`form [name="${CSS.escape(k)}"]`);
    if (el && 'value' in el) el.value = v;
  });
}
