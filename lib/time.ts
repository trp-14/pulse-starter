// Store-calendar helpers shared by server (repositories) and client (labels).
// The store reports in one fixed IANA time zone so "today" and the heatmap mean the
// same thing for every viewer and server and client render identical labels.

export const STORE_TIME_ZONE = 'Asia/Jakarta';
export const STORE_LOCALE = 'en-US';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export interface ZonedParts {
  /** Store-local calendar date, YYYY-MM-DD. */
  dateKey: string;
  /** Store-local hour, 0–23. */
  hour: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

const weekdayFormatter = new Intl.DateTimeFormat(STORE_LOCALE, { timeZone: 'UTC', weekday: 'short' });

export function zonedParts(date: Date): ZonedParts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

/** Shift a YYYY-MM-DD calendar date by whole days. */
export function addDays(dateKey: string, days: number): string {
  const base = Date.parse(`${dateKey}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

/** Short weekday of a calendar date ("Sat"), independent of any time zone. */
export function weekdayLabel(dateKey: string): string {
  return weekdayFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

/** The last `count` store-local calendar dates, oldest first, ending today. */
export function lastDateKeys(now: Date, count: number): string[] {
  const today = zonedParts(now).dateKey;
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

/** Start of the current hour. The store zone has a whole-hour offset, so UTC and local hour boundaries match. */
export function startOfHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);
}
