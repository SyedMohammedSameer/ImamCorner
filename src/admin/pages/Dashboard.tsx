import { useEffect, useState } from 'preact/hooks';
import { sb, check, mb } from '../sb';
import { useAdmin } from '../App';
import { Icon, Link, Loading } from '../ui';
import { fridaysFrom, rotationImamId, todayInTucson, fmtDate } from '../../lib/schedule';

const FREE_STORAGE = 1024 ** 3; // Supabase free plan: 1 GB

export default function Dashboard() {
  const { name, imams, settings, unread } = useAdmin();
  const [stats, setStats] = useState<null | { friday: { date: string; who: string; changed: boolean }; recent: any[]; used: number; docs: number }>(null);

  useEffect(() => {
    (async () => {
      const today = todayInTucson(settings.utc_offset);
      const [friday] = fridaysFrom(today, 1);
      const [o, recent, sizes] = await Promise.all([
        sb.from('khutbah_overrides').select('*').eq('date', friday).maybeSingle(),
        sb.from('resources').select('id, slug, title, type, date, file_size, published').order('created_at', { ascending: false }).limit(5),
        sb.from('resources').select('file_size'),
      ]);
      const ov = o.data;
      const imamId = ov ? ov.imam_id : rotationImamId(settings, friday);
      const who = ov?.guest_name || imams.find((i) => i.id === imamId)?.short_name || 'Not set';
      const all = check(sizes) as { file_size: number }[];
      setStats({ friday: { date: friday, who, changed: !!ov }, recent: check(recent), used: all.reduce((n, r) => n + (r.file_size || 0), 0), docs: all.length });
    })();
  }, []);

  const hour = new Date().getHours();
  return (
    <div class="page">
      <header class="hello">
        <p class="muted">{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}</p>
        <h1>Assalamu alaikum{name ? `, ${name}` : ''}</h1>
      </header>

      <div class="quick">
        <Link href="/admin/library/upload" class="quick-card primary">
          <span class="qi"><Icon name="upload" size={26} /></span>
          <strong>Upload a PDF</strong>
          <span>Khutbah notes, a book or a handout. Photos work too.</span>
        </Link>
        <Link href="/admin/jummah" class="quick-card">
          <span class="qi clay"><Icon name="mic" size={24} /></span>
          <strong>This Friday</strong>
          <span>{stats ? <>{fmtDate(stats.friday.date, { month: 'short', day: 'numeric' })}: <b>{stats.friday.who}</b>{stats.friday.changed && ' (changed)'}</> : 'Loading…'}</span>
        </Link>
        <Link href="/admin/classes" class="quick-card">
          <span class="qi green"><Icon name="graduation" size={24} /></span>
          <strong>Classes & hours</strong>
          <span>Edit the weekly timetable and office hours.</span>
        </Link>
        <Link href="/admin/messages" class="quick-card">
          <span class="qi gold"><Icon name="message" size={24} /></span>
          <strong>Messages</strong>
          <span>{unread ? <b>{unread} new</b> : 'No new messages'}</span>
        </Link>
        <Link href="/admin/announcements" class="quick-card">
          <span class="qi"><Icon name="bell" size={24} /></span>
          <strong>Post an announcement</strong>
          <span>Shows at the top of the home page.</span>
        </Link>
        <Link href="/admin/books" class="quick-card">
          <span class="qi clay"><Icon name="book" size={24} /></span>
          <strong>Recommended books</strong>
          <span>Add a book, or attach your own PDF.</span>
        </Link>
      </div>

      <section class="card">
        <div class="card-head"><h2>Recent uploads</h2><Link href="/admin/library" class="text-btn">All documents</Link></div>
        {!stats ? <Loading /> : stats.recent.length === 0 ? <p class="muted">Nothing uploaded yet.</p> : (
          <ul class="rows">
            {stats.recent.map((r) => (
              <li><Icon name="page" /><span class="grow"><strong>{r.title}</strong><small class="muted">{fmtDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' })} · {mb(r.file_size)}{!r.published && ' · Hidden'}</small></span>
                <a class="icon-btn" href={`/library/${r.slug}`} target="_blank" rel="noopener" aria-label="Open on website"><Icon name="external" size={18} /></a></li>
            ))}
          </ul>
        )}
      </section>

      {stats && (
        <section class="card">
          <div class="card-head"><h2>Storage</h2><span class="muted small">{stats.docs} documents</span></div>
          <div class="meter"><i style={{ width: `${Math.min(100, (stats.used / FREE_STORAGE) * 100).toFixed(1)}%` }} /></div>
          <p class="small muted">{mb(stats.used)} of 1 GB used on the free plan. PDFs are compressed before upload to save space.</p>
        </section>
      )}
    </div>
  );
}
