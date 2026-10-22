import { useState } from 'preact/hooks';
import { sb, check, publish, slugify, uploadWithProgress, publicUrl } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Area, Tags, Icon, PageHead, Sheet, useAction, confirmAction } from '../ui';
import { compressImage } from '../image';
import { initials } from '../../lib/schedule';

const BLANK = { name: '', short_name: '', role: '', email: '', photo_url: '', bio: '', focus: [] as string[] };

export default function Imams() {
  const { imams, refresh } = useAdmin();
  const [edit, setEdit] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const { busy, run } = useAction();

  const save = () => run(async () => {
    if (!edit.name.trim()) throw new Error('Name is required.');
    const row = { name: edit.name.trim(), short_name: edit.short_name.trim() || edit.name.trim(), role: edit.role.trim(), email: edit.email.trim(), photo_url: edit.photo_url, bio: edit.bio.trim(), focus: edit.focus };
    if (edit.id) check(await sb.from('imams').update(row).eq('id', edit.id));
    else check(await sb.from('imams').insert({ ...row, slug: slugify(edit.name.replace(/^(Sheikh|Sh\.|Shaykh|Imam)\s+/i, '')), sort: imams.length + 1 }));
    await publish(); await refresh(); setEdit(null);
  }, 'Saved');
  const remove = async () => {
    if (!(await confirmAction('Remove this imam?', `${edit.name} will be removed from the website. Fridays and classes assigned to them will show "To be announced".`, 'Remove'))) return;
    run(async () => { check(await sb.from('imams').delete().eq('id', edit.id)); await publish(); await refresh(); setEdit(null); }, 'Removed');
  };
  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const ok = await run(async () => {
      const blob = await compressImage(file);
      const path = `imams/${slugify(edit.name || 'imam')}-${Date.now()}.jpg`;
      await uploadWithProgress('media', path, new File([blob], 'photo.jpg', { type: 'image/jpeg' }), () => {});
      setEdit((e: any) => ({ ...e, photo_url: publicUrl('media', path) }));
    });
    setUploading(false);
    return ok;
  };
  const move = (i: number, d: number) => run(async () => {
    const list = [...imams]; const [x] = list.splice(i, 1); list.splice(i + d, 0, x);
    await Promise.all(list.map((im, idx) => sb.from('imams').update({ sort: idx + 1 }).eq('id', im.id)));
    await publish(); await refresh();
  });

  return (
    <div class="page">
      <PageHead title="Imams" sub="Bios and photos on the Imams page. The first imam is shown as the office-hours host.">
        <Button kind="primary" icon="plus" onClick={() => setEdit({ ...BLANK })}>Add imam</Button>
      </PageHead>
      <ul class="list">
        {imams.map((im, i) => (
          <li>
            <button type="button" class="list-main" onClick={() => setEdit({ ...im })}>
              {im.photo_url ? <img class="avatar-sm" src={im.photo_url} alt="" /> : <span class="avatar-sm">{initials(im.name)}</span>}
              <span class="grow"><strong>{im.name}</strong><small class="muted">{im.role}{!im.bio && ' · No bio yet'}</small></span>
            </button>
            <div class="list-actions">
              <button type="button" class="icon-btn" aria-label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}><Icon name="up" size={18} /></button>
              <button type="button" class="icon-btn" aria-label="Move down" disabled={i === imams.length - 1 || busy} onClick={() => move(i, 1)}><Icon name="down" size={18} /></button>
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit imam' : 'New imam'} footer={edit && <>
        {edit.id && <Button kind="danger-ghost" icon="trash" onClick={remove}>Remove</Button>}
        <span class="grow" />
        <Button onClick={() => setEdit(null)}>Cancel</Button>
        <Button kind="primary" busy={busy || uploading} onClick={save}>Save</Button>
      </>}>
        {edit && (
          <div class="form-grid">
            <div class="wide photo-pick">
              {edit.photo_url ? <img src={edit.photo_url} alt="" /> : <span class="avatar-lg">{initials(edit.name || '?')}</span>}
              <div>
                <label class="btn btn-sm"><input type="file" accept="image/*" hidden onChange={(e) => pickPhoto((e.target as HTMLInputElement).files?.[0])} /><Icon name="camera" size={16} />{uploading ? 'Uploading…' : edit.photo_url ? 'Change photo' : 'Add photo'}</label>
                {edit.photo_url && <button type="button" class="text-btn" onClick={() => setEdit({ ...edit, photo_url: '' })}>Remove photo</button>}
                <p class="small muted">A portrait photo works best. It is resized automatically.</p>
              </div>
            </div>
            <Field label="Full name"><Text value={edit.name} onInput={(v: string) => setEdit({ ...edit, name: v })} placeholder="Sheikh …" /></Field>
            <Field label="Short name" hint="Used in schedules, e.g. Sh. Burhan Hamdan"><Text value={edit.short_name} onInput={(v: string) => setEdit({ ...edit, short_name: v })} /></Field>
            <Field label="Role"><Text value={edit.role} onInput={(v: string) => setEdit({ ...edit, role: v })} placeholder="e.g. Director of Islamic Affairs" /></Field>
            <Field label="Email (optional)"><Text type="email" value={edit.email} onInput={(v: string) => setEdit({ ...edit, email: v })} /></Field>
            <Field label="Biography" hint="Blank line between paragraphs. Start a line with ## for a heading, or - for a bullet point." wide><Area rows={8} value={edit.bio} onInput={(v: string) => setEdit({ ...edit, bio: v })} /></Field>
            <Field label="Areas of focus" wide><Tags value={edit.focus} onChange={(v) => setEdit({ ...edit, focus: v })} placeholder="e.g. Tafsir, Youth" /></Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
