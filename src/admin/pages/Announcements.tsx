import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Area, Icon, PageHead, Sheet, Loading, Empty, useAction, confirmAction } from '../ui';
import { todayInTucson, fmtDate, addDays } from '../../lib/schedule';

export default function Announcements() {
  const { settings } = useAdmin();
  const today = todayInTucson(settings.utc_offset);
  const [items, setItems] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();

  const load = async () => setItems(check(await sb.from('announcements').select('*').order('starts_on', { ascending: false })));
  useEffect(() => { load(); }, []);

  const save = () => run(async () => {
    if (!edit.title.trim()) throw new Error('Title is required.');
    const row = { title: edit.title.trim(), body: edit.body.trim(), link: edit.link.trim(), link_label: edit.link_label.trim(), starts_on: edit.starts_on, expires_on: edit.expires_on || null };
    check(edit.id ? await sb.from('announcements').update(row).eq('id', edit.id) : await sb.from('announcements').insert(row));
    await publish(); setEdit(null); await load();
  }, 'Saved');
  const remove = async () => {
    if (!(await confirmAction('Delete announcement?', `"${edit.title}" will be removed.`))) return;
    run(async () => { check(await sb.from('announcements').delete().eq('id', edit.id)); await publish(); setEdit(null); await load(); }, 'Deleted');
  };
  const status = (a: any) => (a.starts_on > today ? `Starts ${fmtDate(a.starts_on)}` : a.expires_on && a.expires_on < today ? 'Ended' : a.expires_on ? `Showing until ${fmtDate(a.expires_on)}` : 'Showing');

  return (
    <div class="page">
      <PageHead title="Announcements" sub="Shown at the top of the home page while active.">
        <Button kind="primary" icon="plus" onClick={() => setEdit({ title: '', body: '', link: '', link_label: '', starts_on: today, expires_on: addDays(today, 14) })}>New announcement</Button>
      </PageHead>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon="bell" title="No announcements" text="Post one for an event, a change of time or Eid prayers." /> : (
        <ul class="list">
          {items.map((a) => (
            <li class={status(a) === 'Ended' ? 'muted-row' : ''}>
              <button type="button" class="list-main" onClick={() => setEdit({ ...a, expires_on: a.expires_on ?? '' })}>
                <span class="type-dot"><Icon name="bell" size={18} /></span>
                <span class="grow"><strong>{a.title}</strong><small class="muted">{status(a)}</small></span>
                <Icon name="edit" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit announcement' : 'New announcement'} footer={edit && <>
        {edit.id && <Button kind="danger-ghost" icon="trash" onClick={remove}>Delete</Button>}
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <Field label="Title" wide><Text value={edit.title} onInput={(v: string) => setEdit({ ...edit, title: v })} placeholder="e.g. Eid al-Adha prayer times" /></Field>
            <Field label="Message" wide><Area rows={3} value={edit.body} onInput={(v: string) => setEdit({ ...edit, body: v })} /></Field>
            <Field label="Show from"><Text type="date" value={edit.starts_on} onInput={(v: string) => setEdit({ ...edit, starts_on: v })} /></Field>
            <Field label="Hide after" hint="Leave empty to keep it up."><Text type="date" value={edit.expires_on} onInput={(v: string) => setEdit({ ...edit, expires_on: v })} /></Field>
            <Field label="Button link (optional)"><Text value={edit.link} onInput={(v: string) => setEdit({ ...edit, link: v })} placeholder="/library or https://…" /></Field>
            <Field label="Button text"><Text value={edit.link_label} onInput={(v: string) => setEdit({ ...edit, link_label: v })} placeholder="Learn more" /></Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
