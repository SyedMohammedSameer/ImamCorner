// Hijri calendar, Islamic dates and qibla, all computed on-device.

const KAABA = { lat: 21.4225, lng: 39.8262 };

export function hijri(date = new Date(), tz = 'America/Phoenix') {
  const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: tz }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { day: get('day'), month: get('month'), year: get('year') };
}

export const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʿdah', 'Dhu al-Hijjah'];
export const HIJRI_MONTHS_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

export function hijriLabel(date = new Date(), tz = 'America/Phoenix') {
  const h = hijri(date, tz);
  return { ...h, text: `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} AH`, arabic: `${h.day} ${HIJRI_MONTHS_AR[h.month - 1]} ${h.year}` };
}

const EVENTS: { m: number; d: number; name: string; note: string }[] = [
  { m: 1, d: 1, name: 'Islamic New Year', note: '1 Muharram' },
  { m: 1, d: 10, name: 'Day of ʿAshura', note: 'A recommended fast' },
  { m: 9, d: 1, name: 'Ramadan begins', note: 'Subject to moon sighting' },
  { m: 9, d: 21, name: 'Last ten nights', note: 'Seek Laylat al-Qadr' },
  { m: 10, d: 1, name: 'ʿEid al-Fitr', note: '1 Shawwal' },
  { m: 12, d: 1, name: 'First ten days of Dhu al-Hijjah', note: 'The best days of the year' },
  { m: 12, d: 9, name: 'Day of ʿArafah', note: 'A recommended fast' },
  { m: 12, d: 10, name: 'ʿEid al-Adha', note: '10 Dhu al-Hijjah' },
];

/** Upcoming Islamic dates over the next ~year (Umm al-Qura calendar; local dates may differ by a day). */
export function upcomingIslamicDates(from = new Date(), limit = 6, tz = 'America/Phoenix') {
  const out: { date: Date; name: string; note: string; days: number }[] = [];
  const start = new Date(from); start.setHours(12, 0, 0, 0);
  for (let i = 0; i < 400 && out.length < limit; i++) {
    const d = new Date(start.getTime() + i * 86400_000);
    const h = hijri(d, tz);
    const ev = EVENTS.find((e) => e.m === h.month && e.d === h.day);
    if (ev) out.push({ date: d, name: ev.name, note: ev.note, days: i });
  }
  return out;
}

/** Initial great-circle bearing from a point to the Kaaba, degrees from true north. */
export function qiblaBearing(lat: number, lng: number) {
  const φ1 = (lat * Math.PI) / 180, φ2 = (KAABA.lat * Math.PI) / 180;
  const Δλ = ((KAABA.lng - lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function distanceToKaabaKm(lat: number, lng: number) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dφ = toR(KAABA.lat - lat), dλ = toR(KAABA.lng - lng);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(toR(lat)) * Math.cos(toR(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function compassPoint(deg: number) {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];
}
