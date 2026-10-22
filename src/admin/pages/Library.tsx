import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish, mb } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Area, Select, Tags, Toggle, Icon, PageHead, Link, Sheet, Loading, Empty, useAction, confirmAction } from '../ui';
import { fmtDate } from '../../lib/schedule';

const TYPES: Record<string, string> = { khutbah: 'Khutbah', book: 'Book', notes: 'Class notes', guide: 'Guide' };

export default function Library() {
  const { imams } = useAdmin();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();

  const load = async () => setItems(check(await sb.from('resources').select('*').order('date', { ascending: false })));
  useEffect(() => { load(); }, []);

  const shown = (items ?? []).filter((r) => (type === 'all' || r.type === type) && (!q || `${r.title} ${r.author} ${r.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  const save = () => run(async () => {
    const { id, title, type, date, imam_id, author, summary, tags, published, featured } = edit;
    if (!title.trim()) throw new Error('Title is required.');
    check(await sb.from('resources').update({ title: title.trim(), type, date, imam_id: type === 'khutbah' ? imam_id || null : null, author, summary, tags, published, featured }).eq('id', id));
    await publish(); setEdit(null); await load();
  }, 'Saved');

  const toggleVisible = (r: any) => run(async () => {
    check(await sb.from('resources').update({ published: !r.published }).eq('id', r.id));
    await publish(); await load();
  }, r.published ? 'Hidden from the website' : 'Visible on the website');

  const remove = async (r: any) => {
    if (!(await confirmAction('Delete this document?', `"${r.title}" will be removed from the website and its PDF deleted. This can't be undone.`))) return;
    run(async () => {
      check(await sb.from('resources').delete().eq('id', r.id));
      await sb.storage.from('library').remove([r.file_path]);
      await publish(); setEdit(null); await load();
    }, 'Deleted');
  };

  return (
    <div class="page">
      <PageHead title="Library" sub="Everything in the public library and reader.">
        <Link href="/admin/library/upload" class="btn btn-primary"><Icon name="upload" size={18} />Upload</Link>
      </PageHead>

      <div class="toolbar">
        <label class="search"><Icon name="search" size={18} /><input type="search" placeholder="Search documents" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        <div class="seg">
          {['all', 'khutbah', 'book', 'notes', 'guide'].map((t) => <button type="button" class={type === t ? 'on' : ''} onClick={() => setType(t)}>{t === 'all' ? 'All' : TYPES[t]}</button>)}
        </div>
      </div>

      {!items ? <Loading /> : shown.length === 0 ? (
        <Empty icon="library" title={items.length ? 'No matches' : 'No documents yet'} text={items.length ? 'Try another search.' : 'Upload your first khutbah notes or book.'}>
          {!items.length && <Link href="/admin/library/upload" class="btn btn-primary">Upload a PDF</Link>}
        </Empty>
      ) : (
        <ul class="list">
          {shown.map((r) => (
            <li class={r.published ? '' : 'muted-row'}>
              <button type="button" class="list-main" onClick={() => setEdit({ ...r })}>
                <span class={`type-dot t-${r.type}`}><Icon name={r.type === 'khutbah' ? 'mic' : r.type === 'book' ? 'book' : 'page'} size={18} /></span>
                <span class="grow">
                  <strong>{r.title}</strong>
                  <small class="muted">{TYPES[r.type]} · {fmtDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {r.pages} pages · {mb(r.file_size)}
                    {r.original_size > r.file_size * 1.1 && ` (was ${mb(r.original_size)})`}{!r.published && ' · Hidden'}{r.featured && ' · Featured'}</small>
                </span>
              </button>
              <div class="list-actions">
                <button type="button" class="icon-btn" title={r.published ? 'Hide' : 'Show'} aria-label={r.published ? 'Hide from website' : 'Show on website'} disabled={busy} onClick={() => toggleVisible(r)}><Icon name="eye" size={18} /></button>
                <a class="icon-btn" href={`/library/${r.slug}`} target="_blank" rel="noopener" aria-label="Open on website"><Icon name="external" size={18} /></a>
                <button type="button" class="icon-btn danger" title="Delete" aria-label={`Delete ${r.title}`} disabled={busy} onClick={() => remove(r)}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Edit document" footer={edit && <>
        <Button kind="danger-ghost" icon="trash" onClick={() => remove(edit)}>Delete</Button>
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <Field label="Title" wide><Text value={edit.title} onInput={(v: string) => setEdit({ ...edit, title: v })} /></Field>
            <Field label="Type"><Select value={edit.type} onChange={(v) => setEdit({ ...edit, type: v })} options={Object.entries(TYPES).map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Date"><Text type="date" value={edit.date} onInput={(v: string) => setEdit({ ...edit, date: v })} /></Field>
            {edit.type === 'khutbah'
              ? <Field label="Khateeb"><Select value={edit.imam_id ?? ''} onChange={(v) => setEdit({ ...edit, imam_id: v })} options={[...imams.map((i) => ({ value: i.id, label: i.name })), { value: '', label: 'Other / guest' }]} /></Field>
              : <Field label="Author"><Text value={edit.author} onInput={(v: string) => setEdit({ ...edit, author: v })} /></Field>}
            <Field label="Short description" wide><Area rows={3} value={edit.summary} onInput={(v: string) => setEdit({ ...edit, summary: v })} /></Field>
            <Field label="Tags" wide><Tags value={edit.tags} onChange={(v) => setEdit({ ...edit, tags: v })} /></Field>
            <div class="wide toggles">
              <Toggle checked={edit.published} onChange={(v) => setEdit({ ...edit, published: v })} label="Visible on the website" />
              <Toggle checked={edit.featured} onChange={(v) => setEdit({ ...edit, featured: v })} label="Feature on the home page" />
            </div>
            <div class="wide file-line">
              <Icon name="page" /><span class="grow"><strong>PDF file</strong><small class="muted">{edit.pages} pages · {mb(edit.file_size)}</small></span>
              <Link class="btn btn-sm" href={`/admin/library/upload?replace=${edit.id}`}>Replace file</Link>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
