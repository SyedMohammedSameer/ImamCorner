// Small UI kit for the admin dashboard (Preact).
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';

// ───────── Icons (same set as the public site) ─────────
const P: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
  library: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="m15.5 5.2 3.9-1 3.6 15-3.9 1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  graduation: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  message: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  upload: '<path d="M12 16V3M7.5 7.5 12 3l4.5 4.5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  page: '<path d="M6 2.5h8l4.5 4.5V21.5H6z"/><path d="M14 2.5V7h4.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={1.75} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name] ?? '' }} />;
}

// ───────── Toasts ─────────
type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = (text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, text, tone }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div class="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} class={`toast ${t.tone}`}><Icon name={t.tone === 'ok' ? 'check' : 'x'} size={18} />{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Wraps an async action: shows a spinner state, a success toast, or the error. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await fn(); if (success) toast(success); return true; }
    catch (e: any) { toast(e?.message || 'Something went wrong', 'error'); return false; }
    finally { setBusy(false); }
  };
  return { busy, run };
}

// ───────── Layout pieces ─────────
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div><h1>{title}</h1>{sub && <p class="muted">{sub}</p>}</div>
      {children && <div class="page-actions">{children}</div>}
    </header>
  );
}

export function Button({ children, kind = 'default', icon, busy, ...rest }: any) {
  return (
    <button type="button" class={`btn btn-${kind}`} disabled={busy || rest.disabled} {...rest}>
      {busy ? <span class="spin" /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <label class={`field${wide ? ' wide' : ''}`}>
      <span class="label">{label}</span>
      {children}
      {hint && <span class="hint">{hint}</span>}
    </label>
  );
}

export function Text({ value, onInput, ...rest }: any) {
  return <input class="input" value={value ?? ''} onInput={(e) => onInput((e.target as HTMLInputElement).value)} {...rest} />;
}
export function Area({ value, onInput, rows = 4, ...rest }: any) {
  return <textarea class="input area" rows={rows} value={value ?? ''} onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} {...rest} />;
}
export function Select({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; [k: string]: any }) {
  return (
    <select class="input select" value={value ?? ''} onChange={(e) => onChange((e.target as HTMLSelectElement).value)} {...rest}>
      {options.map((o) => <option value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="track"><span class="thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

/** Comma/enter separated tags. */
export function Tags({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(''); };
  return (
    <div class="tags input">
      {value.map((t) => <span class="tag">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><Icon name="x" size={14} /></button></span>)}
      <input value={draft} placeholder={value.length ? '' : placeholder} onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} />
    </div>
  );
}

export function DayPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div class="days">
      {DAYS.map((d) => (
        <button type="button" class={value.includes(d) ? 'on' : ''} aria-pressed={value.includes(d)}
          onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : DAYS.filter((x) => x === d || value.includes(x)))}>{d}</button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centered dialog on desktop. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren; footer?: ComponentChildren }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} class="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div class="sheet-box">
          <div class="sheet-head"><h2>{title}</h2><button type="button" class="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
          <div class="sheet-body">{children}</div>
          {footer && <div class="sheet-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Promise-based confirm dialog. */
let confirmHook: ((q: { title: string; text: string; ok: string; resolve: (v: boolean) => void }) => void) | null = null;
export const confirmAction = (title: string, text: string, ok = 'Delete') => new Promise<boolean>((resolve) => confirmHook ? confirmHook({ title, text, ok, resolve }) : resolve(window.confirm(`${title}\n\n${text}`)));
export function ConfirmHost() {
  const [q, setQ] = useState<null | { title: string; text: string; ok: string; resolve: (v: boolean) => void }>(null);
  useEffect(() => { confirmHook = setQ; return () => { confirmHook = null; }; }, []);
  const done = (v: boolean) => { q?.resolve(v); setQ(null); };
  return (
    <Sheet open={!!q} onClose={() => done(false)} title={q?.title ?? ''} footer={<><Button onClick={() => done(false)}>Cancel</Button><Button kind="danger" onClick={() => done(true)}>{q?.ok}</Button></>}>
      <p class="muted">{q?.text}</p>
    </Sheet>
  );
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ComponentChildren }) {
  return <div class="empty"><span class="empty-icon"><Icon name={icon} size={26} /></span><strong>{title}</strong>{text && <p class="muted">{text}</p>}{children}</div>;
}

export function Loading() {
  return <div class="loading"><span class="spin big" /></div>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div class="progress">
      <div class="bar"><i style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, value))})` }} /></div>
      {label && <span class="small muted">{label}</span>}
    </div>
  );
}

// ───────── Navigation ─────────
export const navigate = (to: string) => { history.pushState(null, '', to); dispatchEvent(new PopStateEvent('popstate')); scrollTo(0, 0); };
export function Link({ href, children, ...rest }: any) {
  return <a href={href} onClick={(e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || href.startsWith('http')) return; e.preventDefault(); navigate(href); }} {...rest}>{children}</a>;
}
export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const on = () => setPath(location.pathname); addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  return path.replace(/\/$/, '') || '/admin';
}
