import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish, api } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Area, Select, Icon, PageHead, Loading, useAction, useToast, confirmAction } from '../ui';

export default function Settings() {
  const { settings, refresh, session } = useAdmin();
  const [s, setS] = useState({ ...settings });
  const set = (k: keyof typeof s) => (v: any) => setS((x) => ({ ...x, [k]: v }));
  const { busy, run } = useAction();

  const saveCenter = () => run(async () => {
    const { center_name, tagline, email, phone, address, maps_url, website_url, booking_url, fajr_angle, isha_angle, asr_factor } = s;
    check(await sb.from('settings').update({ center_name, tagline, email, phone, address, maps_url, website_url, booking_url, fajr_angle: Number(fajr_angle), isha_angle: Number(isha_angle), asr_factor: Number(asr_factor) }).eq('id', 1));
    await publish(); await refresh();
  }, 'Settings saved');

  return (
    <div class="page">
      <PageHead title="Settings" />

      <section class="card">
        <div class="card-head"><h2>Masjid details</h2></div>
        <div class="form-grid">
          <Field label="Name"><Text value={s.center_name} onInput={set('center_name')} /></Field>
          <Field label="Phone" hint="Shown in the footer and for urgent requests."><Text type="tel" value={s.phone} onInput={set('phone')} /></Field>
          <Field label="Email"><Text type="email" value={s.email} onInput={set('email')} /></Field>
          <Field label="Website"><Text type="url" value={s.website_url} onInput={set('website_url')} /></Field>
          <Field label="Address" wide><Text value={s.address} onInput={set('address')} /></Field>
          <Field label="Google Maps link"><Text type="url" value={s.maps_url} onInput={set('maps_url')} /></Field>
          <Field label="Office hours booking link" hint="Google Calendar appointment page."><Text type="url" value={s.booking_url} onInput={set('booking_url')} /></Field>
          <Field label="Tagline" wide><Text value={s.tagline} onInput={set('tagline')} /></Field>
        </div>
        <h3 class="sub-h">Prayer time calculation</h3>
        <div class="form-grid">
          <Field label="Fajr angle"><Text type="number" step="0.5" value={s.fajr_angle} onInput={set('fajr_angle')} /></Field>
          <Field label="Isha angle"><Text type="number" step="0.5" value={s.isha_angle} onInput={set('isha_angle')} /></Field>
          <Field label="Asr"><Select value={String(s.asr_factor)} onChange={set('asr_factor')} options={[{ value: '1', label: 'Standard (Shafiʿi, Maliki, Hanbali)' }, { value: '2', label: 'Hanafi' }]} /></Field>
        </div>
        <p class="small muted">ISNA uses 15° and 15°. Muslim World League uses 18° and 17°.</p>
        <div class="row-end"><Button kind="primary" busy={busy} onClick={saveCenter}>Save</Button></div>
      </section>

      <Ayat />
      <Team me={session.user.id} />
    </div>
  );
}

function Ayat() {
  const [items, setItems] = useState<any[] | null>(null);
  const { busy, run } = useAction();
  const load = async () => setItems(check(await sb.from('ayat').select('*').order('sort')));
  useEffect(() => { load(); }, []);
  const save = () => run(async () => {
    const rows = items!.filter((a) => a.ar.trim() || a.en.trim()).map((a, i) => ({ ...(a.id ? { id: a.id } : {}), ref: a.ref.trim(), ar: a.ar.trim(), en: a.en.trim(), sort: i }));
    const keep = rows.filter((r: any) => r.id).map((r: any) => r.id);
    const { data: all } = await sb.from('ayat').select('id');
    const gone = (all ?? []).map((r: any) => r.id).filter((id: string) => !keep.includes(id));
    if (gone.length) check(await sb.from('ayat').delete().in('id', gone));
    if (rows.length) check(await sb.from('ayat').upsert(rows));
    await publish(); await load();
  }, 'Reminders saved');
  const upd = (i: number, k: string, v: string) => setItems(items!.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  return (
    <section class="card">
      <div class="card-head"><h2>Reminder of the day</h2><Button kind="primary" busy={busy} onClick={save}>Save</Button></div>
      <p class="small muted">One is shown on the home page each day, in rotation.</p>
      {!items ? <Loading /> : (
        <div class="ayat">
          {items.map((a, i) => (
            <div class="ayah-row">
              <div class="form-grid">
                <Field label="Reference"><Text value={a.ref} onInput={(v: string) => upd(i, 'ref', v)} placeholder="Al-Baqarah 2:286" /></Field>
                <Field label="Arabic"><Text dir="rtl" value={a.ar} onInput={(v: string) => upd(i, 'ar', v)} /></Field>
                <Field label="Translation" wide><Area rows={2} value={a.en} onInput={(v: string) => upd(i, 'en', v)} /></Field>
              </div>
              <button type="button" class="icon-btn" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></button>
            </div>
          ))}
          <Button icon="plus" onClick={() => setItems([...items, { ref: '', ar: '', en: '' }])}>Add reminder</Button>
        </div>
      )}
    </section>
  );
}

function Team({ me }: { me: string }) {
  const [admins, setAdmins] = useState<any[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const { busy, run } = useAction();
  const toast = useToast();
  const load = async () => setAdmins(check(await sb.from('admins').select('*').order('created_at')));
  useEffect(() => { load(); }, []);
  const invite = (e: Event) => {
    e.preventDefault();
    run(async () => {
      const r = await api('/api/admin/invite', { email, name });
      toast(r.existing ? `${email} already had an account and now has admin access.` : `Invite sent to ${email}`);
      setEmail(''); setName(''); await load();
    });
  };
  const remove = async (a: any) => {
    if (!(await confirmAction('Remove admin access?', `${a.email} will no longer be able to sign in to the dashboard.`, 'Remove'))) return;
    run(async () => { check(await sb.from('admins').delete().eq('user_id', a.user_id)); await load(); }, 'Access removed');
  };
  return (
    <section class="card">
      <div class="card-head"><h2>Admin team</h2></div>
      {!admins ? <Loading /> : (
        <ul class="rows">
          {admins.map((a) => (
            <li><Icon name="users" /><span class="grow"><strong>{a.name || a.email}</strong><small class="muted">{a.email}{a.user_id === me && ' · You'}</small></span>
              {a.user_id !== me && <button type="button" class="icon-btn" aria-label={`Remove ${a.email}`} onClick={() => remove(a)}><Icon name="trash" size={18} /></button>}</li>
          ))}
        </ul>
      )}
      <form class="invite" onSubmit={invite}>
        <Field label="Invite by email"><Text type="email" required value={email} onInput={setEmail} placeholder="name@ictucson.org" /></Field>
        <Field label="Name (optional)"><Text value={name} onInput={setName} /></Field>
        <Button type="submit" kind="primary" icon="mail" busy={busy}>Send invite</Button>
      </form>
      <p class="small muted">They'll get an email with a link to choose a password.</p>
    </section>
  );
}
