/**
 * Number, date and time formatting. Numbers: score to 1 decimal, deltas as
 * signed % to 1 decimal, multipliers as ×2.45. Uses a real minus sign (−).
 */
import type { IsoDate } from '@/domain/time';
import { parseIsoDate } from '@/domain/time';

export const MINUS = '−';
export const TIMES = '×';
export const UP = '▲';
export const DOWN = '▼';
export const DOT = '·';
export const EN_DASH = '–';

export function score(n: number): string {
  return n.toFixed(1);
}

/** Signed percent: +1.0% / −1.0% / 0.0% */
export function signedPct(fraction: number, digits = 1): string {
  const v = fraction * 100;
  const abs = Math.abs(v).toFixed(digits);
  if (Number(abs) === 0) return `${(0).toFixed(digits)}%`;
  return `${v > 0 ? '+' : MINUS}${abs}%`;
}

/** Unsigned percent, e.g. completion rate: 78% */
export function pct(fraction: number | null, digits = 0): string {
  if (fraction === null) return `${MINUS}`;
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function multiplier(x: number): string {
  return `${TIMES}${x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;
}

export function rateLabel(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function glyphFor(delta: number): string {
  return delta > 0 ? UP : delta < 0 ? DOWN : '';
}

// ---------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = cache.get(key);
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

function dateAtUtcNoon(day: IsoDate): Date {
  const { y, m, d } = parseIsoDate(day);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "Tuesday, 18 November" */
export function longDate(day: IsoDate): string {
  return fmt(
    'long',
    () =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }),
  ).format(dateAtUtcNoon(day));
}

/** "18 Nov" */
export function shortDate(day: IsoDate): string {
  return fmt(
    'short',
    () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  ).format(dateAtUtcNoon(day));
}

/** "Tue 18 Nov" */
export function mediumDate(day: IsoDate): string {
  return fmt(
    'medium',
    () =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
  ).format(dateAtUtcNoon(day));
}

/** "18 Nov 2026" */
export function fullDate(day: IsoDate): string {
  return fmt(
    'full',
    () =>
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
  ).format(dateAtUtcNoon(day));
}

/** "12 Oct – 10 Dec 2026" */
export function dateRange(start: IsoDate, end: IsoDate): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${sameYear ? shortDate(start) : fullDate(start)} ${EN_DASH} ${fullDate(end)}`;
}

/** "9:00 PM" for an instant, in the plan's time zone. */
export function clockTime(instant: number, tz: string): string {
  return fmt(
    `clock:${tz}`,
    () => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }),
  ).format(new Date(instant));
}

/** "9:00 PM" for minutes since midnight (no time zone involved). */
export function clockFromMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "Tue 18 Nov, 9:00 PM" */
export function dayAndTime(instant: number, tz: string): string {
  return fmt(
    `dayTime:${tz}`,
    () =>
      new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
      }),
  ).format(new Date(instant));
}

/** Countdown: "3h 12m", "45m", "under 1m". */
export function countdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  if (totalMin < 1) return 'under 1m';
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function weekdayName(iso: number, long = false): string {
  return (long ? WEEKDAY_LONG : WEEKDAY_SHORT)[iso - 1] ?? '';
}

export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
