// Display formatting. Fixed locale + store time zone, so server and client render identical text.
import { STORE_LOCALE, STORE_TIME_ZONE } from '@/lib/time';

const currency = new Intl.NumberFormat(STORE_LOCALE, { style: 'currency', currency: 'USD' });
const currencyWhole = new Intl.NumberFormat(STORE_LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat(STORE_LOCALE, { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const hourMinute = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const compactCurrency = new Intl.NumberFormat(STORE_LOCALE, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const formatCurrency = (value: number): string => currency.format(value);
/** Axis ticks: $0, $500, $1.2K. */
export const formatCompactCurrency = (value: number): string => compactCurrency.format(value);
export const formatCurrencyWhole = (value: number): string => currencyWhole.format(value);
export const formatInteger = (value: number): string => integer.format(value);
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
export const formatHour = (iso: string): string => hourMinute.format(new Date(iso));

/** "14:00–15:00" for the hour starting at `iso`. */
export const formatHourRange = (iso: string): string =>
  `${formatHour(iso)}–${hourMinute.format(new Date(Date.parse(iso) + 3_600_000))}`;

/** "19:00" for a store-local hour index. */
export const formatHourIndex = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** "12s ago", "5m ago", "3h ago", "2d ago". */
export function formatRelative(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
