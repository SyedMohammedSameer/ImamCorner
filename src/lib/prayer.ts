// Astronomical prayer-time calculation (after the PrayTimes.org algorithm, ISNA defaults).
// Runs entirely in the browser: no API, works offline.

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYERS: { key: PrayerName; label: string; arabic: string }[] = [
  { key: 'fajr', label: 'Fajr', arabic: 'الفجر' },
  { key: 'sunrise', label: 'Sunrise', arabic: 'الشروق' },
  { key: 'dhuhr', label: 'Dhuhr', arabic: 'الظهر' },
  { key: 'asr', label: 'Asr', arabic: 'العصر' },
  { key: 'maghrib', label: 'Maghrib', arabic: 'المغرب' },
  { key: 'isha', label: 'Isha', arabic: 'العشاء' },
];

export interface PrayerConfig {
  lat: number;
  lng: number;
  utcOffset: number; // hours; Arizona stays on MST (-7) all year
  fajrAngle?: number;
  ishaAngle?: number;
  asrFactor?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const tan = (d: number) => Math.tan(rad(d));
const arcsin = (x: number) => deg(Math.asin(x));
const arccos = (x: number) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const arctan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const arccot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => { const r = a - b * Math.floor(a / b); return r < 0 ? r + b : r; };

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
  const eqt = q / 15 - fix(RA, 24);
  const decl = arcsin(sin(e) * sin(L));
  return { decl, eqt };
}

/** Returns prayer times for a calendar date (local to the config's offset) as Date objects. */
export function prayerTimes(date: { y: number; m: number; d: number }, cfg: PrayerConfig): Record<PrayerName, Date> {
  const { lat, lng, utcOffset } = cfg;
  const fajrA = cfg.fajrAngle ?? 15, ishaA = cfg.ishaAngle ?? 15, asrF = cfg.asrFactor ?? 1;
  const jd = julian(date.y, date.m, date.d) - lng / (15 * 24);

  const midDay = (t: number) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, ccw = false) => {
    const { decl } = sunPosition(jd + t);
    const noon = midDay(t);
    const T = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (ccw ? -T : T);
  };
  const asrTime = (factor: number, t: number) => {
    const { decl } = sunPosition(jd + t);
    return angleTime(-arccot(factor + tan(Math.abs(lat - decl))), t);
  };

  const t = { fajr: 5 / 24, sunrise: 6 / 24, dhuhr: 12 / 24, asr: 13 / 24, sunset: 18 / 24, isha: 18 / 24 };
  const hours: Record<PrayerName, number> = {
    fajr: angleTime(fajrA, t.fajr, true),
    sunrise: angleTime(0.833, t.sunrise, true),
    dhuhr: midDay(t.dhuhr) + 1 / 60,
    asr: asrTime(asrF, t.asr),
    maghrib: angleTime(0.833, t.sunset),
    isha: angleTime(ishaA, t.isha),
  };

  const out = {} as Record<PrayerName, Date>;
  // Solar hours → UTC hours (local clock would be + utcOffset). Anchor to local midnight in UTC.
  const midnightUtc = Date.UTC(date.y, date.m - 1, date.d) - utcOffset * 3600_000;
  for (const k of Object.keys(hours) as PrayerName[]) {
    const localClock = hours[k] + utcOffset - lng / 15;
    out[k] = new Date(midnightUtc + Math.round(localClock * 3600) * 1000);
  }
  return out;
}

/** Current calendar date at a fixed UTC offset. */
export function localDate(offset: number, now = new Date()) {
  const d = new Date(now.getTime() + offset * 3600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), weekday: d.getUTCDay() };
}

export function formatTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(date);
}

export function nextPrayer(times: Record<PrayerName, Date>, now = new Date()) {
  const order: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  for (const k of order) if (times[k] > now) return k;
  return null; // after Isha → tomorrow's Fajr
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
