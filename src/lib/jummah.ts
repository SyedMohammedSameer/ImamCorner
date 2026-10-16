import schedule from '../data/schedule.json';

export interface Khutbah { date: string; khateeb: string; topic?: string; note?: string; override: boolean }

const DAY = 86400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T12:00:00Z`);

/** Upcoming Fridays with the khateeb from the rotation rule, then per-date overrides. */
export function khutbahSchedule(from: Date, weeks = 26, startOffsetWeeks = 0): Khutbah[] {
  const { rotation, overrides } = schedule as { rotation: any; overrides: any[] };
  const anchor = parse(rotation.anchorDate);
  const start = parse(iso(from));
  const toFri = (5 - start.getUTCDay() + 7) % 7;
  const first = new Date(start.getTime() + (toFri - startOffsetWeeks * 7) * DAY);
  const list: Khutbah[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(first.getTime() + i * 7 * DAY);
    const date = iso(d);
    const weeksFromAnchor = Math.round((d.getTime() - anchor.getTime()) / (7 * DAY));
    const rotating = ((weeksFromAnchor % rotation.everyNthWeek) + rotation.everyNthWeek) % rotation.everyNthWeek === 0;
    const o = overrides.find((x) => x.date === date);
    list.push({
      date,
      khateeb: o?.khateeb || (rotating ? rotation.rotatingKhateeb : rotation.defaultKhateeb),
      topic: o?.topic || undefined,
      note: o?.note || undefined,
      override: !!o,
    });
  }
  return list;
}

export function fmtDate(isoDate: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(parse(isoDate));
}
