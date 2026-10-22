// Server-side reads from Supabase (publishable key, so row level security applies: published content only).
import { createClient } from '@supabase/supabase-js';
import { fridaysFrom, rotationImamId } from './schedule';
import type { Settings, Imam, Khutbah, Program, OfficeHour, Resource } from './schedule';
export * from './schedule';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client: ReturnType<typeof createClient> | null = null;
const sb = () => {
  if (!url || !key) throw new Error('Supabase is not configured: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  return (client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
};
const db = { from: (table: string) => sb().from(table) };

export const fileUrl = (path: string) => `${url}/storage/v1/object/public/library/${path.split('/').map(encodeURIComponent).join('/')}`;



export interface Book { id: string; title: string; author: string; category: string; level: string; why: string; resource_id: string | null; link: string; starter: boolean; sort: number }
export interface Announcement { id: string; title: string; body: string; link: string; link_label: string; starts_on: string; expires_on: string | null }
export interface Ayah { ref: string; ar: string; en: string }


function must<T>(res: { data: T | null; error: any }, what: string): T {
  if (res.error) throw new Error(`Couldn't load ${what}: ${res.error.message}`);
  return res.data as T;
}

export async function loadCore() {
  const [s, i] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('imams').select('*').order('sort'),
  ]);
  return { settings: must<Settings>(s, 'settings'), imams: must<Imam[]>(i, 'imams') };
}

export const imamName = (imams: Imam[], id: string | null | undefined) => imams.find((i) => i.id === id)?.short_name ?? '';

export async function getPrograms() {
  const [p, o] = await Promise.all([
    db.from('programs').select('*').eq('active', true).order('sort_minutes'),
    db.from('office_hours').select('*').order('sort'),
  ]);
  return { programs: must<Program[]>(p, 'classes'), officeHours: must<OfficeHour[]>(o, 'office hours') };
}

export async function getResources(opts: { type?: string; limit?: number; excludeId?: string } = {}) {
  let q = db.from('resources').select('*').eq('published', true).order('date', { ascending: false });
  if (opts.type) q = q.eq('type', opts.type);
  if (opts.excludeId) q = q.neq('id', opts.excludeId);
  if (opts.limit) q = q.limit(opts.limit);
  return must<Resource[]>(await q, 'library');
}

export async function getResource(slug: string) {
  const res = await db.from('resources').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  return must<Resource | null>(res, 'document');
}

export async function getBooks() {
  const [b, r] = await Promise.all([
    db.from('books').select('*').eq('published', true).order('sort'),
    db.from('resources').select('id, slug').eq('published', true),
  ]);
  const slugs = new Map(must<{ id: string; slug: string }[]>(r, 'library').map((x) => [x.id, x.slug]));
  return must<Book[]>(b, 'books').map((book) => ({ ...book, resourceSlug: book.resource_id ? slugs.get(book.resource_id) ?? null : null }));
}

export async function getAnnouncements(today: string) {
  const res = await db.from('announcements').select('*').lte('starts_on', today).or(`expires_on.is.null,expires_on.gte.${today}`).order('starts_on', { ascending: false });
  return must<Announcement[]>(res, 'announcements');
}

export async function getAyat() {
  return must<Ayah[]>(await db.from('ayat').select('ref, ar, en').order('sort'), 'reminders');
}

export async function getSchedule(settings: Settings, imams: Imam[], fromISO: string, weeks: number): Promise<Khutbah[]> {
  const dates = fridaysFrom(fromISO, weeks);
  const res = await db.from('khutbah_overrides').select('*').gte('date', dates[0]).lte('date', dates[dates.length - 1]);
  const overrides = must<any[]>(res, 'Jummah schedule');
  return dates.map((date) => {
    const o = overrides.find((x) => x.date === date);
    const imamId = o ? o.imam_id : rotationImamId(settings, date);
    return {
      date,
      imam: imams.find((i) => i.id === imamId) ?? null,
      guestName: o?.guest_name ?? '',
      topic: o?.topic ?? '',
      note: o?.note ?? '',
      override: !!o,
    };
  });
}

