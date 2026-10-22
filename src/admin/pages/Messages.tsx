import { useEffect, useState } from 'preact/hooks';
import { sb, check } from '../sb';
import { useAdmin } from '../App';
import { Button, Icon, PageHead, Sheet, Loading, Empty, useAction, confirmAction } from '../ui';

const KIND: Record<string, string> = { ask: 'Question', service: 'Service request', 'new-muslim': 'New to Islam' };
const SERVICE: Record<string, string> = { nikah: 'Nikah', janazah: 'Janazah', counseling: 'Counseling', visits: 'Hospital & home visit', shahadah: 'Shahadah', other: 'Other' };

export default function Messages() {
  const { refresh } = useAdmin();
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState<any>(null);
  const { busy, run } = useAction();

  const load = async () => {
    let q = sb.from('messages').select('*').order('created_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.neq('status', 'done');
    if (filter === 'done') q = q.eq('status', 'done');
    setItems(check(await q));
  };
  useEffect(() => { load(); }, [filter]);

  const view = async (m: any) => {
    setOpen(m);
    if (m.status === 'new') { await sb.from('messages').update({ status: 'read' }).eq('id', m.id); load(); refresh(); }
  };
  const setStatus = (status: string) => run(async () => {
    check(await sb.from('messages').update({ status }).eq('id', open.id));
    setOpen(null); await load(); await refresh();
  }, status === 'done' ? 'Marked as done' : 'Moved back to open');
  const remove = async () => {
    if (!(await confirmAction('Delete message?', 'This permanently removes the message.'))) return;
    run(async () => { check(await sb.from('messages').delete().eq('id', open.id)); setOpen(null); await load(); await refresh(); }, 'Deleted');
  };

  const when = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix' }).format(new Date(iso));
  const short = (iso: string) => {
    const tz = { timeZone: 'America/Phoenix' } as const;
    const day = (d: Date) => new Intl.DateTimeFormat('en-CA', tz).format(d);
    const d = new Date(iso);
    return day(d) === day(new Date())
      ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', ...tz }).format(d)
      : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...tz }).format(d);
  };
  const topic = (m: any) => (m.kind === 'service' ? SERVICE[m.topic] ?? m.topic : m.topic);
  const reply = (m: any) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${topic(m) || KIND[m.kind]}`)}&body=${encodeURIComponent(`Assalamu alaikum${m.name ? ` ${m.name}` : ''},\n\n\n\n> ${m.body.split('\n').join('\n> ')}`)}`;

  return (
    <div class="page">
      <PageHead title="Messages" sub="Questions and requests sent from the website." />
      <div class="seg">
        {(['open', 'done', 'all'] as const).map((f) => <button type="button" class={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'open' ? 'Open' : f === 'done' ? 'Done' : 'All'}</button>)}
      </div>
      {!items ? <Loading /> : items.length === 0 ? <Empty icon="message" title={filter === 'open' ? 'All caught up' : 'No messages'} text="New questions from Ask the Imam and service requests appear here." /> : (
        <ul class="list">
          {items.map((m) => (
            <li class={m.status === 'new' ? 'unread' : m.status === 'done' ? 'muted-row' : ''}>
              <button type="button" class="list-main" onClick={() => view(m)}>
                <span class={`type-dot m-${m.kind}`}><Icon name={m.kind === 'ask' ? 'message' : m.kind === 'service' ? 'calendar' : 'sparkles'} size={18} /></span>
                <span class="grow">
                  <strong>{m.name || 'Anonymous'}<span class="muted"> · {KIND[m.kind]}{topic(m) && `: ${topic(m)}`}</span></strong>
                  <small class="muted clamp1">{m.body || '(no message)'}</small>
                </span>
                <small class="muted nowrap">{short(m.created_at)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${KIND[open.kind]}${topic(open) ? `: ${topic(open)}` : ''}` : ''} footer={open && <>
        <Button kind="danger-ghost" icon="trash" onClick={remove}>Delete</Button>
        <span class="grow" />
        {open.status === 'done' ? <Button busy={busy} onClick={() => setStatus('read')}>Reopen</Button> : <Button kind="primary" icon="check" busy={busy} onClick={() => setStatus('done')}>Mark done</Button>}
      </>}>
        {open && (
          <div class="message">
            <p class="muted small">{when(open.created_at)}</p>
            <p class="msg-body">{open.body || '(no message)'}</p>
            <dl>
              <dt>From</dt><dd>{open.name || 'Anonymous'}</dd>
              {open.email && <><dt>Email</dt><dd><a href={`mailto:${open.email}`}>{open.email}</a></dd></>}
              {open.phone && <><dt>Phone</dt><dd><a href={`tel:${open.phone}`}>{open.phone}</a></dd></>}
              {open.details?.preferredDate && <><dt>Preferred date</dt><dd>{open.details.preferredDate}</dd></>}
              {open.details?.mayShare && <><dt>May answer publicly</dt><dd>{open.details.mayShare === 'yes' ? 'Yes, without name' : 'No'}</dd></>}
            </dl>
            <div class="row-start">
              {open.email && <a class="btn btn-primary" href={reply(open)}><Icon name="mail" size={18} />Reply by email</a>}
              {open.phone && <a class="btn" href={`tel:${open.phone}`}><Icon name="phone" size={18} />Call</a>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
