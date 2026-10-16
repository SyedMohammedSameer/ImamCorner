// Static pages are built once; these helpers keep date-based content correct on the day it is viewed.
const TZ_OFFSET = -7; // America/Phoenix (no DST)
export const todayISO = () => new Date(Date.now() + TZ_OFFSET * 3600_000).toISOString().slice(0, 10);
export const todayDay = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.now() + TZ_OFFSET * 3600_000).getUTCDay()];

/** In each [data-upcoming] list, hide items whose data-date is past; keep at most data-limit; mark the first. */
export function applyUpcoming(root: ParentNode = document) {
  const today = todayISO();
  root.querySelectorAll<HTMLElement>('[data-upcoming]').forEach((list) => {
    const limit = Number(list.dataset.limit || Infinity);
    let shown = 0;
    list.querySelectorAll<HTMLElement>('[data-date]').forEach((el) => {
      const keep = el.dataset.date! >= today && shown < limit;
      el.hidden = !keep;
      el.classList.toggle('is-next', keep && shown === 0);
      if (keep) shown++;
    });
    list.classList.add('ready');
  });
}

/** Show only [data-days] items that include today's weekday; reveal [data-empty] when none. */
export function applyToday(root: ParentNode = document) {
  const d = todayDay();
  root.querySelectorAll<HTMLElement>('[data-today-list]').forEach((list) => {
    let n = 0;
    list.querySelectorAll<HTMLElement>('[data-days]').forEach((el) => {
      const on = el.dataset.days!.split(' ').includes(d);
      el.hidden = !on; if (on) n++;
    });
    const empty = list.querySelector<HTMLElement>('[data-empty]');
    if (empty) empty.hidden = n > 0;
  });
  root.querySelectorAll<HTMLElement>('[data-day-label]').forEach((el) => (el.textContent = ({ Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' } as any)[d]));
}
