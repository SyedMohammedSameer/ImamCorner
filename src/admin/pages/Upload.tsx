import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sb, check, publish, slugify, mb, uploadWithProgress } from '../sb';
import { useAdmin } from '../App';
import { Button, Field, Text, Area, Select, Tags, Toggle, Icon, Progress, PageHead, Link, useToast } from '../ui';
import { PRESETS, type Preset } from '../presets';
import type { Analysis, PhotoPage } from '../compress';

// pdf.js and pdf-lib are large, so they load only when this screen needs them.
const engine = () => import('../compress');
import { todayInTucson } from '../../lib/schedule';

const TYPES = [
  { value: 'khutbah', label: 'Khutbah notes' },
  { value: 'book', label: 'Book' },
  { value: 'notes', label: 'Class notes' },
  { value: 'guide', label: 'Guide' },
];
const LIMIT = 50 * 1024 * 1024;

type Result = { blob: Blob; pages: number; thumb: string };

export default function Upload() {
  const { imams, settings } = useAdmin();
  const toast = useToast();
  const params = new URLSearchParams(location.search);
  const replaceId = params.get('replace');
  const bookId = params.get('book');

  const [step, setStep] = useState<'pick' | 'compress' | 'details' | 'uploading' | 'done'>('pick');
  const [pdf, setPdf] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoPage[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [preset, setPreset] = useState<Preset>('document');
  const [results, setResults] = useState<Partial<Record<Preset, Result>>>({});
  const [work, setWork] = useState<{ done: number; total: number } | null>(null);
  const [upPct, setUpPct] = useState(0);
  const [saved, setSaved] = useState<{ slug: string } | null>(null);
  const [existing, setExisting] = useState<any>(null);
  const abort = useRef<AbortController | null>(null);

  const [meta, setMeta] = useState({
    title: '', type: params.get('type') || 'khutbah', date: todayInTucson(settings.utc_offset), imam_id: imams[0]?.id ?? '',
    author: '', summary: '', tags: [] as string[], published: true, featured: false,
  });
  const set = (k: keyof typeof meta) => (v: any) => setMeta((m) => ({ ...m, [k]: v }));

  useEffect(() => {
    if (!replaceId) return;
    sb.from('resources').select('*').eq('id', replaceId).single().then(({ data }) => {
      if (!data) return;
      setExisting(data);
      setMeta({ title: data.title, type: data.type, date: data.date, imam_id: data.imam_id ?? '', author: data.author, summary: data.summary, tags: data.tags, published: data.published, featured: data.featured });
    });
  }, [replaceId]);

  useEffect(() => { scrollTo({ top: 0 }); }, [step]);

  // ───────── Step 1: pick ─────────
  const onPdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return toast('Please choose a PDF file.', 'error');
    setPdf(file); setPhotos([]); setResults({}); setAnalysis(null); setStep('compress');
    if (!meta.title) setMeta((m) => ({ ...m, title: prettyName(file.name) }));
    try {
      const a = await (await engine()).analyzePdf(file);
      setAnalysis(a);
      setPreset(a.scanned ? 'document' : 'original');
    } catch {
      toast("This PDF couldn't be opened. It may be damaged or password-protected.", 'error');
      setStep('pick');
    }
  };
  const onPhotos = (files: FileList) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return toast('Please choose photos (JPG or PNG).', 'error');
    setPdf(null); setAnalysis(null); setResults({});
    setPhotos((p) => [...p, ...list.map((file) => ({ file, rotate: 0 as const }))]);
    setPreset('document'); setStep('compress');
  };

  // ───────── Step 2: compress (computed when a preset is chosen) ─────────
  useEffect(() => {
    if (step !== 'compress' || results[preset]) return;
    if (pdf && !analysis) return;
    if (!pdf && !photos.length) return;
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    (async () => {
      try {
        let blob: Blob;
        if (preset === 'original') {
          if (!pdf) return;
          blob = pdf;
        } else {
          setWork({ done: 0, total: pdf ? analysis!.pages : photos.length });
          const prog = (done: number, total: number) => setWork({ done, total });
          blob = pdf ? await (await engine()).compressPdf(pdf, preset, prog, ac.signal) : await (await engine()).photosToPdf(photos, preset, prog, ac.signal);
        }
        if (ac.signal.aborted) return;
        const [thumb, pages] = await Promise.all([(await engine()).thumbnail(blob), preset === 'original' ? (await engine()).countPages(blob) : Promise.resolve(pdf ? analysis!.pages : photos.length)]);
        setResults((r) => ({ ...r, [preset]: { blob, pages, thumb } }));
      } catch (e: any) {
        if (e?.name !== 'AbortError') toast(e?.message || 'Compression failed', 'error');
      } finally { if (!ac.signal.aborted) setWork(null); }
    })();
    return () => ac.abort();
  }, [step, preset, analysis, photos]);

  const photoChanged = (next: PhotoPage[]) => { setPhotos(next); setResults({}); };
  const current = results[preset];
  const originalSize = pdf ? pdf.size : photos.reduce((n, p) => n + p.file.size, 0);
  const options: Preset[] = pdf ? ['original', 'balanced', 'document', 'smallest'] : ['balanced', 'document', 'smallest'];

  // ───────── Step 4: upload ─────────
  const upload = async () => {
    if (!current) return;
    if (!meta.title.trim()) return toast('Please add a title.', 'error');
    if (current.blob.size > LIMIT) return toast(`This file is ${mb(current.blob.size)}. The limit is 50 MB; choose a smaller setting.`, 'error');
    setStep('uploading'); setUpPct(0);
    try {
      const base = slugify(meta.title);
      const path = `${meta.date.slice(0, 4)}/${base}-${Math.random().toString(36).slice(2, 7)}.pdf`;
      await uploadWithProgress('library', path, current.blob, setUpPct);
      const row = {
        title: meta.title.trim(), type: meta.type, date: meta.date, author: meta.type === 'khutbah' ? '' : meta.author.trim(),
        imam_id: meta.type === 'khutbah' && meta.imam_id ? meta.imam_id : null, summary: meta.summary.trim(), tags: meta.tags,
        published: meta.published, featured: meta.featured, file_path: path, file_size: current.blob.size, original_size: originalSize, pages: current.pages,
      };
      let slug: string;
      if (existing) {
        check(await sb.from('resources').update(row).eq('id', existing.id));
        await sb.storage.from('library').remove([existing.file_path]);
        slug = existing.slug;
      } else {
        slug = await uniqueSlug(base);
        const created = check(await sb.from('resources').insert({ ...row, slug }).select('id').single()) as { id: string };
        if (bookId) await sb.from('books').update({ resource_id: created.id }).eq('id', bookId);
      }
      await publish();
      setSaved({ slug }); setStep('done');
    } catch (e: any) {
      toast(e?.message || 'Upload failed', 'error');
      setStep('details');
    }
  };

  const reset = () => { setStep('pick'); setPdf(null); setPhotos([]); setResults({}); setAnalysis(null); setSaved(null); setMeta((m) => ({ ...m, title: '', summary: '', tags: [] })); };

  return (
    <div class="page narrow">
      <PageHead title={existing ? 'Replace PDF' : 'Upload a PDF'} sub={existing ? existing.title : 'Shrink it, describe it, publish it.'}>
        <Link href="/admin/library" class="btn btn-ghost">Cancel</Link>
      </PageHead>
      <ol class="steps">{['Choose', 'Compress', 'Details'].map((s, i) => <li class={i <= ['pick', 'compress', 'details'].indexOf(step === 'uploading' || step === 'done' ? 'details' : step) ? 'on' : ''}>{s}</li>)}</ol>

      {step === 'pick' && <Picker onPdf={onPdf} onPhotos={onPhotos} />}

      {step === 'compress' && (
        <section class="card stack">
          {pdf && <div class="file-line"><Icon name="page" /><span class="grow"><strong>{pdf.name}</strong><small class="muted">{mb(pdf.size)}{analysis && ` · ${analysis.pages} pages · ${analysis.scanned ? 'looks scanned' : 'has text'}`}</small></span><button class="text-btn" onClick={reset}>Change</button></div>}
          {photos.length > 0 && <PhotoGrid photos={photos} onChange={photoChanged} onAdd={onPhotos} />}
          {pdf && !analysis ? <Progress value={0.3} label="Reading the PDF…" /> : (
            <>
              <h3>Compression</h3>
              {analysis && !analysis.scanned && <p class="small muted">This PDF has real text, so keeping the original is usually best (text stays searchable).</p>}
              {analysis?.scanned && <p class="small muted">This looks like photographed or scanned pages. <b>Clean document</b> makes them crisp and much smaller.</p>}
              <div class="presets">
                {options.map((p) => {
                  const r = results[p];
                  return (
                    <button type="button" class={`preset${preset === p ? ' on' : ''}`} onClick={() => setPreset(p)}>
                      <strong>{p === 'original' ? 'Keep original' : PRESETS[p].label}</strong>
                      <span class="small muted">{p === 'original' ? 'No changes.' : PRESETS[p].hint}</span>
                      <span class="size">{r ? <>{mb(r.blob.size)}{p !== 'original' && <em> −{Math.max(0, Math.round((1 - r.blob.size / originalSize) * 100))}%</em>}</> : preset === p && work ? '…' : ''}</span>
                    </button>
                  );
                })}
              </div>
              {work && <Progress value={work.done / work.total} label={`Processing page ${Math.min(work.done + 1, work.total)} of ${work.total}…`} />}
              {current && (
                <div class="result">
                  <img src={current.thumb} alt="Preview of the first page" />
                  <div>
                    <p class="big">{mb(originalSize)} → <b>{mb(current.blob.size)}</b></p>
                    <p class="small muted">{current.pages} pages. Check the preview looks right.</p>
                    {current.blob.size > LIMIT && <p class="small error">Over the 50 MB limit. Choose a smaller setting.</p>}
                  </div>
                </div>
              )}
              <div class="row-end"><Button kind="primary" icon="right" disabled={!current || !!work || current.blob.size > LIMIT} onClick={() => setStep('details')}>Next: details</Button></div>
            </>
          )}
        </section>
      )}

      {(step === 'details' || step === 'uploading') && (
        <section class="card">
          <div class="form-grid">
            <Field label="Title" wide><Text value={meta.title} onInput={set('title')} required /></Field>
            <Field label="Type"><Select value={meta.type} onChange={set('type')} options={TYPES} /></Field>
            <Field label="Date"><Text type="date" value={meta.date} onInput={set('date')} /></Field>
            {meta.type === 'khutbah'
              ? <Field label="Khateeb"><Select value={meta.imam_id} onChange={set('imam_id')} options={[...imams.map((i) => ({ value: i.id, label: i.name })), { value: '', label: 'Other / guest' }]} /></Field>
              : <Field label="Author"><Text value={meta.author} onInput={set('author')} placeholder="e.g. Imam an-Nawawi" /></Field>}
            <Field label="Short description" hint="One or two sentences shown on the library card." wide><Area rows={3} value={meta.summary} onInput={set('summary')} /></Field>
            <Field label="Tags" hint="Press Enter after each tag. Helps people search." wide><Tags value={meta.tags} onChange={set('tags')} placeholder="e.g. Ramadan, Patience" /></Field>
            <div class="wide toggles"><Toggle checked={meta.published} onChange={set('published')} label="Visible on the website" /><Toggle checked={meta.featured} onChange={set('featured')} label="Feature on the home page" /></div>
          </div>
          {step === 'uploading' ? <Progress value={upPct} label={`Uploading ${Math.round(upPct * 100)}%…`} /> : (
            <div class="row-between">
              <Button icon="left" onClick={() => setStep('compress')}>Back</Button>
              <Button kind="primary" icon="upload" onClick={upload}>{existing ? 'Replace file' : 'Publish'} ({current && mb(current.blob.size)})</Button>
            </div>
          )}
        </section>
      )}

      {step === 'done' && saved && (
        <section class="card done">
          <span class="done-icon"><Icon name="check" size={30} /></span>
          <h2>{existing ? 'File replaced' : 'Published'}</h2>
          <p class="muted">{meta.published ? 'It is live in the library now.' : 'Saved as hidden. Turn on "Visible" in the library when ready.'}</p>
          <div class="row-center">
            <a class="btn btn-primary" href={`/library/${saved.slug}`} target="_blank" rel="noopener"><Icon name="external" size={18} />View on website</a>
            {bookId ? <Link class="btn" href="/admin/books">Back to books</Link> : <Button icon="upload" onClick={reset}>Upload another</Button>}
          </div>
        </section>
      )}
    </div>
  );
}

function Picker({ onPdf, onPhotos }: { onPdf: (f: File) => void; onPhotos: (f: FileList) => void }) {
  const [drag, setDrag] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault(); setDrag(false);
    const files = e.dataTransfer?.files; if (!files?.length) return;
    if (files[0].type === 'application/pdf') onPdf(files[0]); else onPhotos(files);
  };
  return (
    <div class="pickers">
      <label class={`drop${drag ? ' drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}>
        <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onPdf(f); }} />
        <span class="qi"><Icon name="page" size={28} /></span>
        <strong>Choose a PDF</strong>
        <span class="muted small">Or drag it here. Large scanned PDFs are shrunk automatically.</span>
      </label>
      <label class="drop alt">
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f?.length) onPhotos(f); }} />
        <span class="qi gold"><Icon name="camera" size={28} /></span>
        <strong>Make a PDF from photos</strong>
        <span class="muted small">Pick photos of pages from your phone. We'll straighten the colours and combine them.</span>
      </label>
    </div>
  );
}

function PhotoGrid({ photos, onChange, onAdd }: { photos: PhotoPage[]; onChange: (p: PhotoPage[]) => void; onAdd: (f: FileList) => void }) {
  const urls = useMemo(() => photos.map((p) => URL.createObjectURL(p.file)), [photos.map((p) => p.file).join()]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);
  const move = (i: number, d: number) => { const n = [...photos]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div class="photos">
      {photos.map((p, i) => (
        <figure>
          <div class="ph"><img src={urls[i]} alt={`Page ${i + 1}`} style={{ transform: `rotate(${p.rotate}deg)` }} /><span class="pn">{i + 1}</span></div>
          <div class="ph-tools">
            <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="left" size={16} /></button>
            <button type="button" aria-label="Rotate" onClick={() => onChange(photos.map((x, j) => (j === i ? { ...x, rotate: (((x.rotate + 90) % 360) as PhotoPage['rotate']) } : x)))}><Icon name="rotate" size={16} /></button>
            <button type="button" aria-label="Remove" onClick={() => onChange(photos.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
            <button type="button" aria-label="Move later" disabled={i === photos.length - 1} onClick={() => move(i, 1)}><Icon name="right" size={16} /></button>
          </div>
        </figure>
      ))}
      <label class="ph-add"><input type="file" accept="image/*" multiple hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f?.length) onAdd(f); }} /><Icon name="plus" />Add photos</label>
    </div>
  );
}

async function uniqueSlug(base: string) {
  const { data } = await sb.from('resources').select('slug').like('slug', `${base}%`);
  const taken = new Set((data ?? []).map((r: any) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2; while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const prettyName = (name: string) => name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());

