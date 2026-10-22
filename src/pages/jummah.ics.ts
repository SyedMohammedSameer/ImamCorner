import type { APIRoute } from 'astro';
import { getSchedule, todayInTucson, addDays, khateebLabel, jummahLabel } from '../lib/data';

// Subscribable calendar feed of upcoming khutbahs.
export const GET: APIRoute = async ({ locals }) => {
  const { settings, imams } = locals;
  const [h, m] = settings.jummah_time.split(':').map(Number);
  const [eh, em] = settings.jummah_end.split(':').map(Number);
  const off = -settings.utc_offset;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const t = (date: string, hh: number, mm: number) => `${date.replace(/-/g, '')}T${String(hh + off).padStart(2, '0')}${String(mm).padStart(2, '0')}00Z`;
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const list = await getSchedule(settings, imams, addDays(todayInTucson(settings.utc_offset), -28), 56);
  const events = list.map((k) => [
    'BEGIN:VEVENT',
    `UID:jummah-${k.date}@imams-corner`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${t(k.date, h, m)}`,
    `DTEND:${t(k.date, eh, em)}`,
    `SUMMARY:${esc(`Jumu'ah: ${khateebLabel(k)}`)}`,
    `DESCRIPTION:${esc(`${k.topic ? `Topic: ${k.topic}\n` : ''}${jummahLabel(settings)}`)}`,
    `LOCATION:${esc(`${settings.center_name}, ${settings.address}`)}`,
    'END:VEVENT',
  ].join('\r\n'));
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Imam's Corner//Jummah//EN", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', "X-WR-CALNAME:Jumu'ah at ICT", 'X-WR-TIMEZONE:America/Phoenix', 'REFRESH-INTERVAL;VALUE=DURATION:P1D', ...events, 'END:VCALENDAR'].join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
