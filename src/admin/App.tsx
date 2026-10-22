import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { sb, check } from './sb';
import { ToastProvider, ConfirmHost, Icon, Link, Loading, usePath, navigate, Button, Field, Text, useAction } from './ui';
import type { Imam, Settings } from '../lib/schedule';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Upload from './pages/Upload';
import Jummah from './pages/Jummah';
import Classes from './pages/Classes';
import Books from './pages/Books';
import Announcements from './pages/Announcements';
import Imams from './pages/Imams';
import Messages from './pages/Messages';
import SettingsPage from './pages/Settings';

interface Ctx { session: Session; name: string; imams: Imam[]; settings: Settings; unread: number; refresh: () => Promise<void> }
const AdminCtx = createContext<Ctx>(null as any);
export const useAdmin = () => useContext(AdminCtx);

export const NAV = [
  { href: '/admin', label: 'Home', icon: 'home' },
  { href: '/admin/library', label: 'Library', icon: 'library' },
  { href: '/admin/jummah', label: 'Jummah', icon: 'mic' },
  { href: '/admin/classes', label: 'Classes', icon: 'graduation' },
  { href: '/admin/messages', label: 'Messages', icon: 'message' },
  { href: '/admin/books', label: 'Books', icon: 'book' },
  { href: '/admin/announcements', label: 'Announcements', icon: 'bell' },
  { href: '/admin/imams', label: 'Imams', icon: 'users' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' },
];
const MOBILE_TABS = ['/admin', '/admin/library', '/admin/jummah', '/admin/messages'];

export default function App() {
  return <ToastProvider><Root /><ConfirmHost /></ToastProvider>;
}

function Root() {
  const path = usePath();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(undefined); return; }
    sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle().then(({ data }) => setIsAdmin(!!data));
  }, [session?.user.id]);

  // Links from invite / reset emails land here with a session in the URL.
  const needsPassword = recovery || path === '/admin/welcome' || /type=(invite|recovery)/.test(location.hash);

  if (session === undefined) return <Loading />;
  if (!session) return <Login />;
  if (needsPassword) return <SetPassword onDone={() => { setRecovery(false); history.replaceState(null, '', '/admin'); navigate('/admin'); }} />;
  if (isAdmin === undefined) return <Loading />;
  if (!isAdmin) return <NotAdmin email={session.user.email ?? ''} />;
  return <Shell session={session} path={path} />;
}

function Shell({ session, path }: { session: Session; path: string }) {
  const [data, setData] = useState<Omit<Ctx, 'session' | 'refresh'> | null>(null);
  const [menu, setMenu] = useState(false);
  const load = async () => {
    const [imams, settings, unread, me] = await Promise.all([
      sb.from('imams').select('*').order('sort'),
      sb.from('settings').select('*').eq('id', 1).single(),
      sb.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      sb.from('admins').select('name').eq('user_id', session.user.id).single(),
    ]);
    setData({ imams: check(imams), settings: check(settings), unread: unread.count ?? 0, name: me.data?.name || session.user.email?.split('@')[0] || '' });
  };
  useEffect(() => { load().catch((e) => alert(e.message)); }, []);
  useEffect(() => setMenu(false), [path]);
  if (!data) return <Loading />;

  const route = path.replace(/^\/admin/, '') || '/';
  const page = route === '/' ? <Dashboard />
    : route === '/library' ? <Library />
    : route.startsWith('/library/upload') ? <Upload />
    : route === '/jummah' ? <Jummah />
    : route === '/classes' ? <Classes />
    : route === '/books' ? <Books />
    : route === '/announcements' ? <Announcements />
    : route === '/imams' ? <Imams />
    : route === '/messages' ? <Messages />
    : route === '/settings' ? <SettingsPage />
    : <Dashboard />;
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));

  return (
    <AdminCtx.Provider value={{ session, ...data, refresh: load }}>
      <div class="shell">
        <aside class={`side${menu ? ' open' : ''}`}>
          <a class="brand" href="/" target="_blank" rel="noopener"><img src="/icons/icon.svg" alt="" width={30} height={30} /><span><strong>Imam's Corner</strong><small>Admin</small></span></a>
          <nav>
            {NAV.map((n) => (
              <Link href={n.href} class={active(n.href) ? 'on' : ''}>
                <Icon name={n.icon} />{n.label}
                {n.href === '/admin/messages' && data.unread > 0 && <span class="badge">{data.unread}</span>}
              </Link>
            ))}
          </nav>
          <div class="side-foot">
            <a href="/" target="_blank" rel="noopener" class="side-link"><Icon name="external" />View website</a>
            <button type="button" class="side-link" onClick={() => sb.auth.signOut()}><Icon name="logout" />Sign out</button>
          </div>
        </aside>
        {menu && <div class="scrim" onClick={() => setMenu(false)} />}
        <main class="main">{page}</main>
        <nav class="tabs">
          {MOBILE_TABS.map((h) => { const n = NAV.find((x) => x.href === h)!; return (
            <Link href={h} class={active(h) ? 'on' : ''}><Icon name={n.icon} size={22} /><span>{n.label}</span>{h === '/admin/messages' && data.unread > 0 && <span class="dot" />}</Link>
          ); })}
          <button type="button" onClick={() => setMenu(true)}><Icon name="menu" size={22} /><span>More</span></button>
        </nav>
      </div>
    </AdminCtx.Provider>
  );
}

function AuthCard({ title, sub, children }: { title: string; sub?: string; children: any }) {
  return (
    <div class="auth">
      <div class="auth-card">
        <img src="/icons/icon.svg" alt="" width={48} height={48} />
        <h1>{title}</h1>
        {sub && <p class="muted">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'reset' | 'sent'>('login');
  const { busy, run } = useAction();
  const submit = (e: Event) => {
    e.preventDefault();
    if (mode === 'login') run(async () => { check(await sb.auth.signInWithPassword({ email: email.trim(), password })); });
    else run(async () => { check(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/admin/welcome` })); setMode('sent'); });
  };
  if (mode === 'sent') return <AuthCard title="Check your email" sub={`We sent a link to ${email}. Open it on this device to choose a new password.`}><Button onClick={() => setMode('login')}>Back to sign in</Button></AuthCard>;
  return (
    <AuthCard title={mode === 'login' ? 'Staff sign in' : 'Reset password'} sub={mode === 'login' ? "Imam's Corner admin" : "We'll email you a reset link."}>
      <form onSubmit={submit} class="stack">
        <Field label="Email"><Text type="email" autocomplete="email" required value={email} onInput={setEmail} /></Field>
        {mode === 'login' && <Field label="Password"><Text type="password" autocomplete="current-password" required value={password} onInput={setPassword} /></Field>}
        <Button type="submit" kind="primary" busy={busy}>{mode === 'login' ? 'Sign in' : 'Send reset link'}</Button>
      </form>
      <button type="button" class="text-btn" onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}>{mode === 'login' ? 'Forgot password?' : 'Back to sign in'}</button>
    </AuthCard>
  );
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const { busy, run } = useAction();
  const submit = (e: Event) => {
    e.preventDefault();
    if (pw.length < 8) return run(async () => { throw new Error('Use at least 8 characters.'); });
    if (pw !== pw2) return run(async () => { throw new Error('The two passwords do not match.'); });
    run(async () => { check(await sb.auth.updateUser({ password: pw })); onDone(); }, 'Password saved. Welcome!');
  };
  return (
    <AuthCard title="Choose a password" sub="You'll use it with your email to sign in.">
      <form onSubmit={submit} class="stack">
        <Field label="New password"><Text type="password" autocomplete="new-password" required value={pw} onInput={setPw} /></Field>
        <Field label="Repeat password"><Text type="password" autocomplete="new-password" required value={pw2} onInput={setPw2} /></Field>
        <Button type="submit" kind="primary" busy={busy}>Save and continue</Button>
      </form>
    </AuthCard>
  );
}

function NotAdmin({ email }: { email: string }) {
  return (
    <AuthCard title="No admin access" sub={`${email} isn't on the admin team. Ask an existing admin to invite you.`}>
      <Button onClick={() => sb.auth.signOut()}>Sign out</Button>
    </AuthCard>
  );
}
