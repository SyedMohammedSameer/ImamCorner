// Pure helpers shared by the public site (server) and the admin dashboard (browser).

export interface Settings {
  center_name: string; tagline: string; email: string; phone: string; address: string; maps_url: string; website_url: string;
  booking_url: string; office_location: string; jummah_time: string; jummah_end: string; jummah_note: string;
  rotation_anchor: string; rotation_every: number; rotation_imam: string | null; default_imam: string | null;
  lat: number; lng: number; utc_offset: number; fajr_angle: number; isha_angle: number; asr_factor: number;
}
export interface Imam { id: string; slug: string; name: string; short_name: string; role: string; email: string; photo_url: string; bio: string; focus: string[]; sort: number }
export interface Program { id: string; title: string; arabic: string; subtitle: string; kind: 'reminder' | 'class' | 'youth' | 'quran'; days: string[]; time_label: string; sort_minutes: number; presenter: string | null; audience: string }
export interface OfficeHour { day: string; time_label: string; sort: number }
export interface Resource {
  id: string; slug: string; title: string; type: 'khutbah' | 'book' | 'notes' | 'guide'; date: string; file_path: string; file_size: number;
  pages: number; author: string; imam_id: string | null; summary: string; tags: string[]; audio_url: string; featured: boolean;
}
export const BOOK_CATEGORIES = ['Start here', 'Qur’an & Tafsir', 'Prophetic biography', 'Hadith', 'Belief', 'Spirituality', 'Family & youth'];
export interface Khutbah { date: string; imam: Imam | null; guestName: string; topic: string; note: string; override: boolean }

// ───────── Jummah schedule: rotation rule + per-Friday overrides ─────────
const DAY = 86400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const noon = (s: string) => new Date(`${s}T12:00:00Z`);

export function fridaysFrom(fromISO: string, weeks: number) {
  const start = noon(fromISO);
  const first = new Date(start.getTime() + ((5 - start.getUTCDay() + 7) % 7) * DAY);
  return Array.from({ length: weeks }, (_, i) => iso(new Date(first.getTime() + i * 7 * DAY)));
}

export function rotationImamId(settings: Settings, date: string) {
  const weeks = Math.round((noon(date).getTime() - noon(settings.rotation_anchor).getTime()) / (7 * DAY));
  const n = settings.rotation_every;
  return ((weeks % n) + n) % n === 0 ? settings.rotation_imam : settings.default_imam;
}

// ───────── Formatting helpers ─────────
export const todayInTucson = (offset = -7) => new Date(Date.now() + offset * 3600_000).toISOString().slice(0, 10);
export const addDays = (isoDate: string, n: number) => iso(new Date(noon(isoDate).getTime() + n * DAY));
export function fmtDate(isoDate: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(noon(isoDate));
}
export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export const jummahLabel = (s: Settings) => `Khutbah begins ${fmtTime(s.jummah_time)} · Salah ends around ${fmtTime(s.jummah_end)}`;
export const khateebLabel = (k: Khutbah) => k.guestName || k.imam?.short_name || 'To be announced';
export const paragraphs = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
/** Bio text → blocks. "## " starts a heading, "- " a list item; anything else is a paragraph. */
export type BioBlock = { t: 'h'; text: string } | { t: 'p'; text: string } | { t: 'ul'; items: string[] };
export function bioBlocks(text: string): BioBlock[] {
  const out: BioBlock[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) out.push({ t: 'p', text: para.join(' ') }); para = []; };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('## ')) { flush(); out.push({ t: 'h', text: line.slice(3) }); continue; }
    if (/^[-•] /.test(line)) {
      flush();
      const last = out[out.length - 1];
      if (last?.t === 'ul') last.items.push(line.slice(2)); else out.push({ t: 'ul', items: [line.slice(2)] });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}
export const initials = (name: string) => name.replace(/^(Sheikh|Sh\.|Shaykh|Imam)\s+/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const prayerConfig = (s: Settings) => ({ lat: s.lat, lng: s.lng, utcOffset: s.utc_offset, timezone: 'America/Phoenix', fajrAngle: s.fajr_angle, ishaAngle: s.isha_angle, asrFactor: s.asr_factor });
