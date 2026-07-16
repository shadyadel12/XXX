/** Full weekday names indexed by JS getDay() (Sun=0 ... Sat=6). */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Short weekday labels indexed by JS getDay(). */
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Display order for a Saturday-first week: [6, 0, 1, 2, 3, 4, 5]
 * i.e. Saturday, Sunday, Monday, ..., Friday. Values are the underlying
 * day_of_week integers used by the DB (JS getDay() convention).
 */
export const WEEK_ORDER_SAT_FIRST = [6, 0, 1, 2, 3, 4, 5];

/** Today's day_of_week using JS convention (Sun=0 ... Sat=6). */
export function todayDayOfWeek(): number {
  return new Date().getDay();
}

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
