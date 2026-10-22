import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Select, Toggle, DayPicker, Icon, PageHead, Sheet, Loading, Empty, useAction, confirmAction } from '../ui';

const KINDS = [
  { value: 'reminder', label: 'Daily reminder' },
  { value: 'class', label: 'Class' },
  { value: 'youth', label: 'Youth program' },
  { value: 'quran', label: 'Qur’an circle' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const BLANK = { title: '', arabic: '', subtitle: '', kind: 'class', days: [] as string[], time_label: '', sort_minutes: 1200, presenter: '', audience: 'Everyone', active: true };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export default function Classes() {
  const { imams, settings, refresh } = useAdmin();
  const [items, setItems] = useState<any[] | null>(null);
  const [hours, setHours] = useState<any[] | null>(null);
  const [location, setLocation] = useState(settings.office_location);
  const [edit, setEdit] = useState<any>(null);
  const [day, setDay] = useState('all');
  const { busy, run } = useAction();

  const load = async () => {
    const [p, o] = await Promise.all([sb.from('programs').select('*').order('sort_minutes'), sb.from('office_hours').select('*').order('sort')]);
    setItems(check(p)); setHours(check(o));
  };
  useEffect(() => { load(); }, []);

  const save = () => run(async () => {
    if (!edit.title.trim()) throw new Error('Title is required.');
    if (!edit.days.length) throw new Error('Pick at least one day.');
    const row = { title: edit.title.trim(), arabic: edit.arabic.trim(), subtitle: edit.subtitle.trim(), kind: edit.kind, days: edit.days, time_label: edit.time_label.trim(), sort_minutes: edit.sort_minutes, presenter: edit.presenter || null, audience: edit.audience.trim(), active: edit.active };
    check(edit.id ? await sb.from('programs').update(row).eq('id', edit.id) : await sb.from('programs').insert(row));
    await publish(); setEdit(null); await load();
  }, 'Saved');
  const remove = async () => {
    if (!(await confirmAction('Delete this class?', `"${edit.title}" will be removed from the timetable.`))) return;
    run(async () => { check(await sb.from('programs').delete().eq('id', edit.id)); await publish(); setEdit(null); await load(); }, 'Deleted');
  };
  const saveHours = () => run(async () => {
    check(await sb.from('office_hours').upsert(hours!.map(({ day, time_label, sort }) => ({ day, time_label: time_label.trim(), sort }))));
    if (location !== settings.office_location) { check(await sb.from('settings').update({ office_location: location }).eq('id', 1)); await refresh(); }
    await publish();
  }, 'Office hours saved');

  const shown = (items ?? []).filter((p) => day === 'all' || p.days.includes(day));
  const name = (id: string) => imams.find((i) => i.id === id)?.short_name ?? '';

  return (
    <div class="page">
      <PageHead title="Classes & reminders" sub="The weekly timetable on the Classes page.">
        <Button kind="primary" icon="plus" onClick={() => setEdit({ ...BLANK, presenter: imams[0]?.id ?? '' })}>Add class</Button>
      </PageHead>

      <div class="seg wide-seg">
        {['all', ...DAYS].map((d) => <button type="button" class={day === d ? 'on' : ''} onClick={() => setDay(d)}>{d === 'all' ? 'All' : d}</button>)}
      </div>

      {!items ? <Loading /> : shown.length === 0 ? <Empty icon="graduation" title="No classes" text={day === 'all' ? 'Add the first class.' : `Nothing on ${FULL[day]}.`} /> : (
        <ul class="list">
          {shown.map((p) => (
            <li class={p.active ? '' : 'muted-row'}>
              <button type="button" class="list-main" onClick={() => setEdit({ ...p, presenter: p.presenter ?? '' })}>
                <span class={`type-dot k-${p.kind}`}><Icon name={p.kind === 'quran' ? 'book' : p.kind === 'youth' ? 'sparkles' : 'graduation'} size={18} /></span>
                <span class="grow">
                  <strong>{p.title}</strong>
                  <small class="muted">{p.days.join(', ')} · {p.time_label}{p.presenter && ` · ${name(p.presenter)}`}{!p.active && ' · Hidden'}</small>
                </span>
                <Icon name="edit" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <section class="card">
        <div class="card-head"><h2>Office hours</h2><Button kind="primary" busy={busy} onClick={saveHours}>Save hours</Button></div>
        <p class="small muted">Leave a day empty to show it as closed.</p>
        {!hours ? <Loading /> : (
          <div class="hours-grid">
            {hours.map((h, i) => (
              <label class="hour-row">
                <span>{FULL[h.day]}</span>
                <input class="input" value={h.time_label} placeholder="Closed" onInput={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, time_label: (e.target as HTMLInputElement).value } : x)))} />
              </label>
            ))}
          </div>
        )}
        <Field label="Where"><Text value={location} onInput={setLocation} /></Field>
      </section>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit class' : 'New class'} footer={edit && <>
        {edit.id && <Button kind="danger-ghost" icon="trash" onClick={remove}>Delete</Button>}
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <Field label="Title" wide><Text value={edit.title} onInput={(v: string) => setEdit({ ...edit, title: v })} placeholder="e.g. Tafsir al-Qur'an" /></Field>
            <Field label="Arabic title (optional)"><Text dir="rtl" value={edit.arabic} onInput={(v: string) => setEdit({ ...edit, arabic: v })} /></Field>
            <Field label="Type"><Select value={edit.kind} onChange={(v) => setEdit({ ...edit, kind: v })} options={KINDS} /></Field>
            <Field label="Days" wide><DayPicker value={edit.days} onChange={(v) => setEdit({ ...edit, days: v })} /></Field>
            <Field label="Time, as shown" hint="e.g. After Isha, or 5:00–7:00 PM"><Text value={edit.time_label} onInput={(v: string) => setEdit({ ...edit, time_label: v })} /></Field>
            <Field label="Roughly starts at" hint="Only used to order the day."><Text type="time" value={toHHMM(edit.sort_minutes)} onInput={(v: string) => { const [h, m] = v.split(':').map(Number); setEdit({ ...edit, sort_minutes: (h || 0) * 60 + (m || 0) }); }} /></Field>
            <Field label="Teacher"><Select value={edit.presenter} onChange={(v) => setEdit({ ...edit, presenter: v })} options={[...imams.map((i) => ({ value: i.id, label: i.name })), { value: '', label: 'Other' }]} /></Field>
            <Field label="Who it's for"><Text value={edit.audience} onInput={(v: string) => setEdit({ ...edit, audience: v })} placeholder="e.g. Sisters only · Ages 15–30" /></Field>
            <div class="wide"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Show on the website" /></div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
