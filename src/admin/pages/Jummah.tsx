import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Select, Icon, PageHead, Loading, useAction, Sheet } from '../ui';
import { fridaysFrom, rotationImamId, todayInTucson, fmtDate } from '../../lib/schedule';

const GUEST = '__guest';

export default function Jummah() {
  const { imams, settings, refresh } = useAdmin();
  const [weeks, setWeeks] = useState(12);
  const [overrides, setOverrides] = useState<Record<string, any> | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [rule, setRule] = useState<any>(null);
  const { busy, run } = useAction();
  const today = todayInTucson(settings.utc_offset);
  const dates = fridaysFrom(today, weeks);

  const load = async () => {
    const rows = check(await sb.from('khutbah_overrides').select('*').gte('date', dates[0]).lte('date', dates[dates.length - 1])) as any[];
    setOverrides(Object.fromEntries(rows.map((r) => [r.date, r])));
  };
  useEffect(() => { load(); }, [weeks, settings.rotation_anchor, settings.rotation_every, settings.rotation_imam, settings.default_imam]);

  const imamOpts = [...imams.map((i) => ({ value: i.id, label: i.name })), { value: GUEST, label: 'Guest speaker…' }];
  const nameOf = (id: string | null) => imams.find((i) => i.id === id)?.short_name ?? 'Not set';

  const openEdit = (date: string) => {
    const o = overrides?.[date];
    setEdit({ date, who: o ? (o.guest_name ? GUEST : o.imam_id ?? '') : rotationImamId(settings, date) ?? '', guest: o?.guest_name ?? '', topic: o?.topic ?? '', note: o?.note ?? '', exists: !!o });
  };
  const save = () => run(async () => {
    const guest = edit.who === GUEST;
    if (guest && !edit.guest.trim()) throw new Error("Enter the guest speaker's name.");
    check(await sb.from('khutbah_overrides').upsert({ date: edit.date, imam_id: guest ? null : edit.who || null, guest_name: guest ? edit.guest.trim() : '', topic: edit.topic.trim(), note: edit.note.trim() }));
    await publish(); setEdit(null); await load();
  }, 'Friday updated');
  const resetDay = () => run(async () => {
    check(await sb.from('khutbah_overrides').delete().eq('date', edit.date));
    await publish(); setEdit(null); await load();
  }, 'Back to the regular rotation');

  const saveRule = () => run(async () => {
    check(await sb.from('settings').update({ rotation_anchor: rule.rotation_anchor, rotation_every: Number(rule.rotation_every), rotation_imam: rule.rotation_imam || null, default_imam: rule.default_imam || null, jummah_time: rule.jummah_time, jummah_end: rule.jummah_end, jummah_note: rule.jummah_note }).eq('id', 1));
    await publish(); await refresh(); setRule(null);
  }, 'Rotation saved');

  return (
    <div class="page">
      <PageHead title="Jummah schedule" sub="Tap a Friday to change the khateeb or add a topic.">
        <Button icon="settings" onClick={() => setRule({ ...settings })}>Rotation & times</Button>
      </PageHead>

      <div class="card rule-card">
        <Icon name="rotate" />
        <p class="small">
          <b>{nameOf(settings.rotation_imam)}</b> every {settings.rotation_every === 1 ? 'week' : `${ordinal(settings.rotation_every)} week`}, <b>{nameOf(settings.default_imam)}</b> otherwise.
          Khutbah at <b>{settings.jummah_time.slice(0, 5)}</b>.
        </p>
      </div>

      {!overrides ? <Loading /> : (
        <ul class="list fridays">
          {dates.map((d) => {
            const o = overrides[d];
            const who = o ? o.guest_name || nameOf(o.imam_id) : nameOf(rotationImamId(settings, d));
            return (
              <li class={o ? 'changed' : ''}>
                <button type="button" class="list-main" onClick={() => openEdit(d)}>
                  <time><span>{fmtDate(d, { month: 'short' })}</span><strong>{fmtDate(d, { day: 'numeric' })}</strong></time>
                  <span class="grow">
                    <strong>{who}</strong>
                    <small class="muted">{d === dates[0] ? 'This Friday' : fmtDate(d, { weekday: 'long' })}{o?.topic && ` · ${o.topic}`}</small>
                  </span>
                  {o && <span class="pill gold">{o.guest_name ? 'Guest' : 'Changed'}</span>}
                  <Icon name="edit" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div class="row-center"><Button onClick={() => setWeeks((w) => w + 12)}>Show more Fridays</Button></div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? fmtDate(edit.date, { weekday: 'long', month: 'long', day: 'numeric' }) : ''} footer={edit && <>
        {edit.exists && <Button kind="ghost" icon="undo" onClick={resetDay}>Use rotation</Button>}
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <Field label="Khateeb" wide><Select value={edit.who} onChange={(v) => setEdit({ ...edit, who: v })} options={imamOpts} /></Field>
            {edit.who === GUEST && <Field label="Guest speaker's name" wide><Text value={edit.guest} onInput={(v: string) => setEdit({ ...edit, guest: v })} placeholder="e.g. Sh. Yusuf Ahmed" /></Field>}
            <Field label="Topic (optional)" wide><Text value={edit.topic} onInput={(v: string) => setEdit({ ...edit, topic: v })} placeholder="e.g. Preparing for Ramadan" /></Field>
            <Field label="Note (optional)" hint="Shown under the khateeb, e.g. 'Two Jummahs this week'." wide><Text value={edit.note} onInput={(v: string) => setEdit({ ...edit, note: v })} /></Field>
          </div>
        )}
      </Sheet>

      <Sheet open={!!rule} onClose={() => setRule(null)} title="Rotation & times" footer={<><Button onClick={() => setRule(null)}>Cancel</Button><Button kind="primary" busy={busy} onClick={saveRule}>Save</Button></>}>
        {rule && (
          <div class="form-grid">
            <Field label="Usual khateeb"><Select value={rule.default_imam ?? ''} onChange={(v) => setRule({ ...rule, default_imam: v })} options={imams.map((i) => ({ value: i.id, label: i.name }))} /></Field>
            <Field label="Rotating khateeb"><Select value={rule.rotation_imam ?? ''} onChange={(v) => setRule({ ...rule, rotation_imam: v })} options={imams.map((i) => ({ value: i.id, label: i.name }))} /></Field>
            <Field label="Rotating khateeb gives one in every"><Select value={String(rule.rotation_every)} onChange={(v) => setRule({ ...rule, rotation_every: v })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: n === 1 ? 'Every week' : `${n} weeks` }))} /></Field>
            <Field label="Starting from (a Friday they give)"><Text type="date" value={rule.rotation_anchor} onInput={(v: string) => setRule({ ...rule, rotation_anchor: v })} /></Field>
            <Field label="Khutbah starts"><Text type="time" value={rule.jummah_time.slice(0, 5)} onInput={(v: string) => setRule({ ...rule, jummah_time: v })} /></Field>
            <Field label="Salah ends around"><Text type="time" value={rule.jummah_end.slice(0, 5)} onInput={(v: string) => setRule({ ...rule, jummah_end: v })} /></Field>
            <Field label="Note on the Jummah page (optional)" wide><Text value={rule.jummah_note} onInput={(v: string) => setRule({ ...rule, jummah_note: v })} placeholder="e.g. Please arrive early; parking fills quickly." /></Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}

const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;
