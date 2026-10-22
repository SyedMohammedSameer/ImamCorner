import { useEffect, useState } from 'preact/hooks';
import { sb, check, publish } from '../sb';
import { Button, Field, Text, Area, Select, Toggle, Icon, PageHead, Sheet, Loading, Empty, Link, useAction, confirmAction, navigate } from '../ui';
import { BOOK_CATEGORIES } from '../../lib/schedule';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'].map((v) => ({ value: v, label: v }));
const BLANK = { title: '', author: '', category: BOOK_CATEGORIES[0], level: 'Beginner', why: '', resource_id: '', link: '', starter: false, published: true };

export default function Books() {
  const [items, setItems] = useState<any[] | null>(null);
  const [pdfs, setPdfs] = useState<{ id: string; title: string }[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const { busy, run } = useAction();

  const load = async () => {
    const [b, r] = await Promise.all([sb.from('books').select('*').order('sort'), sb.from('resources').select('id, title').order('title')]);
    setItems(check(b)); setPdfs(check(r));
  };
  useEffect(() => { load(); }, []);

  const persist = async () => {
    if (!edit.title.trim()) throw new Error('Title is required.');
    const row = { title: edit.title.trim(), author: edit.author.trim(), category: edit.category, level: edit.level, why: edit.why.trim(), resource_id: edit.resource_id || null, link: edit.link.trim(), starter: edit.starter, published: edit.published };
    if (edit.id) { check(await sb.from('books').update(row).eq('id', edit.id)); return edit.id as string; }
    const sort = Math.max(0, ...(items ?? []).map((b) => b.sort)) + 1;
    return (check(await sb.from('books').insert({ ...row, sort }).select('id').single()) as { id: string }).id;
  };
  const save = () => run(async () => { await persist(); await publish(); setEdit(null); await load(); }, 'Saved');
  const saveAndUpload = () => run(async () => { const id = await persist(); navigate(`/admin/library/upload?type=book&book=${id}`); });
  const remove = async () => {
    if (!(await confirmAction('Remove this book?', `"${edit.title}" will be removed from the recommended list. Any PDF in the library stays.`, 'Remove'))) return;
    run(async () => { check(await sb.from('books').delete().eq('id', edit.id)); await publish(); setEdit(null); await load(); }, 'Removed');
  };
  const move = (i: number, d: number) => run(async () => {
    const list = [...items!]; const [x] = list.splice(i, 1); list.splice(i + d, 0, x);
    setItems(list);
    await Promise.all(list.map((b, idx) => (b.sort !== idx ? sb.from('books').update({ sort: idx }).eq('id', b.id) : null)));
    await publish(); await load();
  });

  const categories = [...new Set([...BOOK_CATEGORIES, ...(items ?? []).map((b) => b.category)])].map((c) => ({ value: c, label: c }));

  return (
    <div class="page">
      <PageHead title="Recommended books" sub="The reading list on the Books page. Attach a PDF to show a Read button.">
        <Button kind="primary" icon="plus" onClick={() => setEdit({ ...BLANK })}>Add book</Button>
      </PageHead>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon="book" title="No books yet" /> : (
        <ul class="list">
          {items.map((b, i) => (
            <li class={b.published ? '' : 'muted-row'}>
              <button type="button" class="list-main" onClick={() => setEdit({ ...b, resource_id: b.resource_id ?? '' })}>
                <span class="type-dot t-book"><Icon name="book" size={18} /></span>
                <span class="grow"><strong>{b.title}</strong><small class="muted">{b.author} · {b.category}{b.resource_id && ' · Has PDF'}{b.starter && ' · Starter path'}{!b.published && ' · Hidden'}</small></span>
              </button>
              <div class="list-actions">
                <button type="button" class="icon-btn" aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}><Icon name="up" size={18} /></button>
                <button type="button" class="icon-btn" aria-label="Move down" disabled={i === items.length - 1 || busy} onClick={() => move(i, 1)}><Icon name="down" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit book' : 'New book'} footer={edit && <>
        {edit.id && <Button kind="danger-ghost" icon="trash" onClick={remove}>Remove</Button>}
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <Field label="Title" wide><Text value={edit.title} onInput={(v: string) => setEdit({ ...edit, title: v })} /></Field>
            <Field label="Author"><Text value={edit.author} onInput={(v: string) => setEdit({ ...edit, author: v })} /></Field>
            <Field label="Level"><Select value={edit.level} onChange={(v) => setEdit({ ...edit, level: v })} options={LEVELS} /></Field>
            <Field label="Category" wide><Select value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} options={categories} /></Field>
            <Field label="Why read it" hint="One or two sentences." wide><Area rows={3} value={edit.why} onInput={(v: string) => setEdit({ ...edit, why: v })} /></Field>
            <div class="wide pdf-attach card-tint">
              <strong>PDF to read on the site</strong>
              <p class="small muted">Pick a document already in the library, or upload a new one.</p>
              <Select value={edit.resource_id} onChange={(v) => setEdit({ ...edit, resource_id: v })} options={[{ value: '', label: 'No PDF' }, ...pdfs.map((p) => ({ value: p.id, label: p.title }))]} />
              <Button icon="upload" onClick={saveAndUpload} busy={busy}>Upload a PDF for this book</Button>
            </div>
            <Field label="Or a link to buy / read elsewhere (optional)" wide><Text type="url" value={edit.link} onInput={(v: string) => setEdit({ ...edit, link: v })} placeholder="https://" /></Field>
            <div class="wide toggles">
              <Toggle checked={edit.starter} onChange={(v) => setEdit({ ...edit, starter: v })} label='Include in "New here? Start with these"' />
              <Toggle checked={edit.published} onChange={(v) => setEdit({ ...edit, published: v })} label="Show on the website" />
            </div>
          </div>
        )}
      </Sheet>
      <p class="small muted center">Order here is the order on the website. <Link href="/admin/library" class="text-btn">Manage PDFs</Link></p>
    </div>
  );
}
