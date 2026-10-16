import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import site from '../data/site.json';
import { khutbahSchedule } from '../lib/jummah';

// Subscribable calendar feed of upcoming khutbahs (rebuilt with each deploy).
export const GET: APIRoute = async () => {
  const imams = await getCollection('imams');
  const name = (id: string) => imams.find((i) => i.id === id)?.data.shortName ?? 'TBA';
  const [h, m] = site.jummah.khutbahTime.split(':').map(Number);
  const [eh, em] = site.jummah.endTime.split(':').map(Number);
  const off = -site.location.utcOffset;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const t = (date: string, hh: number, mm: number) => `${date.replace(/-/g, '')}T${String(hh + off).padStart(2, '0')}${String(mm).padStart(2, '0')}00Z`;
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const events = khutbahSchedule(new Date(Date.now() - 28 * 86400_000), 56).map((k) => [
    'BEGIN:VEVENT',
    `UID:jummah-${k.date}@imams-corner`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${t(k.date, h, m)}`,
    `DTEND:${t(k.date, eh, em)}`,
    `SUMMARY:${esc(`Jumu'ah: ${name(k.khateeb)}`)}`,
    `DESCRIPTION:${esc(`${k.topic ? `Topic: ${k.topic}\n` : ''}Khutbah at the ${site.center}. ${site.jummah.label}`)}`,
    `LOCATION:${esc(`${site.center}, ${site.address}`)}`,
    'END:VEVENT',
  ].join('\r\n'));
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', "PRODID:-//Imam's Corner//Jummah//EN", 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:Jumu'ah at ICT`, 'X-WR-TIMEZONE:America/Phoenix', 'REFRESH-INTERVAL;VALUE=DURATION:P1D', ...events, 'END:VCALENDAR'].join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
