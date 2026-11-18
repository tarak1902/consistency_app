/**
 * All plan-time math lives here. It mirrors the SQL helper `plan_window`
 * (supabase/migrations) exactly; shared vectors in __tests__/vectors.json
 * keep the two in step.
 *
 * Conventions
 * - A calendar date is an ISO string `YYYY-MM-DD` (type `IsoDate`).
 * - An instant is epoch milliseconds (number).
 * - Local wall times are resolved in the plan's IANA timezone using the same
 *   rules as Postgres `timestamp AT TIME ZONE tz`:
 *     - a wall time inside a spring-forward gap uses the UTC offset that was in
 *       effect just BEFORE the transition;
 *     - an ambiguous wall time inside a fall-back overlap uses the UTC offset in
 *       effect just AFTER the transition.
 */
import { tzOffset } from '@date-fns/tz';

export type IsoDate = string;
export type Rate = 0.01 | 0.02 | 0.03;
export const RATES: readonly Rate[] = [0.01, 0.02, 0.03];

export const MIN_DURATION = 30;
export const MAX_DURATION = 90;
export const MAX_WORKS = 8;
export const MAX_REST_DAYS = 2;
export const WINDOW_MS = 2 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface PlanTimeConfig {
  /** `HH:MM` or `HH:MM:SS`, local to `timezone`. */
  sleepTime: string;
  timezone: string;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  restWeekdays: readonly number[];
}

export interface PlanRange extends PlanTimeConfig {
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface Window {
  open: number;
  close: number;
}

// ---------------------------------------------------------------------------
// Calendar dates (timezone-free)
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(day: IsoDate): { y: number; m: number; d: number } {
  const match = ISO_DATE.exec(day);
  if (!match) throw new Error(`Invalid ISO date: ${day}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function dateToUtcMs(day: IsoDate): number {
  const { y, m, d } = parseIsoDate(day);
  return Date.UTC(y, m - 1, d);
}

function utcMsToDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: IsoDate, n: number): IsoDate {
  return utcMsToDate(dateToUtcMs(day) + n * DAY_MS);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(day: IsoDate): number {
  const js = new Date(dateToUtcMs(day)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

// ---------------------------------------------------------------------------
// Time zone conversion
// ---------------------------------------------------------------------------

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/**
 * UTC offset in ms of `tz` at `instant`.
 * Uses `formatToParts` (supported by Hermes) rather than the `longOffset`
 * time-zone-name style, which some engines lack; falls back to @date-fns/tz.
 */
export function offsetMs(tz: string, instant: number): number {
  const at = Math.floor(instant / 1000) * 1000; // whole seconds, like the formatter
  try {
    const fields: Record<string, number> = {};
    for (const p of partsFormatter(tz).formatToParts(new Date(at))) {
      if (p.type !== 'literal') fields[p.type] = Number(p.value);
    }
    const asUtc = Date.UTC(
      fields.year ?? NaN,
      (fields.month ?? NaN) - 1,
      fields.day ?? NaN,
      (fields.hour ?? 0) % 24,
      fields.minute ?? 0,
      fields.second ?? 0,
    );
    if (Number.isFinite(asUtc)) return asUtc - at;
  } catch {
    // fall through
  }
  return tzOffset(tz, new Date(instant)) * MINUTE_MS;
}

/** True when `tz` is an IANA zone this runtime knows. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The local calendar date in `tz` at `instant`. */
export function localDateAt(instant: number, tz: string): IsoDate {
  return utcMsToDate(instant + offsetMs(tz, instant));
}

/** Minutes since local midnight in `tz` at `instant`. */
export function localMinutesAt(instant: number, tz: string): number {
  const local = instant + offsetMs(tz, instant);
  return Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / MINUTE_MS);
}

/**
 * Resolve a local wall time (`day` at `minutes` past midnight) in `tz` to an
 * instant, using Postgres' rules for gaps and overlaps (see file header).
 */
export function zonedWallToInstant(day: IsoDate, minutes: number, tz: string): number {
  const wallAsUtc = dateToUtcMs(day) + minutes * MINUTE_MS;
  // Offsets in force a day either side. DST transitions are months apart, so
  // these are the "before" and "after" offsets of any nearby transition.
  const before = offsetMs(tz, wallAsUtc - DAY_MS);
  const after = offsetMs(tz, wallAsUtc + DAY_MS);
  const tBefore = wallAsUtc - before;
  const tAfter = wallAsUtc - after;
  if (before === after) return tBefore;
  const beforeValid = offsetMs(tz, tBefore) === before;
  const afterValid = offsetMs(tz, tAfter) === after;
  if (beforeValid && afterValid) return tAfter; // ambiguous → offset after
  if (afterValid) return tAfter;
  if (beforeValid) return tBefore;
  return tBefore; // in the gap → offset before
}

// ---------------------------------------------------------------------------
// Sleep time
// ---------------------------------------------------------------------------

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Minutes since midnight for `HH:MM[:SS]`. */
export function parseSleepTime(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time: ${value}`);
  return h * 60 + m;
}

export function formatSleepTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Allowed sleep range 20:00 → 04:00 inclusive, wrapping past midnight. */
export const SLEEP_MIN = 20 * 60;
export const SLEEP_MAX = 4 * 60;

export function isSleepTimeAllowed(minutes: number): boolean {
  return minutes >= SLEEP_MIN || minutes <= SLEEP_MAX;
}

// ---------------------------------------------------------------------------
// Plan windows
// ---------------------------------------------------------------------------

/**
 * close(D) = D 12:00 local + ((sleep − 12:00) mod 24h)
 * open(D)  = close(D) − 2h
 */
export function planWindow(day: IsoDate, plan: PlanTimeConfig): Window {
  const sleep = parseSleepTime(plan.sleepTime);
  const closeDay = sleep >= 12 * 60 ? day : addDays(day, 1);
  const close = zonedWallToInstant(closeDay, sleep, plan.timezone);
  return { open: close - WINDOW_MS, close };
}

export function isRestDay(day: IsoDate, plan: Pick<PlanTimeConfig, 'restWeekdays'>): boolean {
  return plan.restWeekdays.includes(isoWeekday(day));
}

/** The plan day whose check-in window contains `instant`, or null. Ignores the plan range. */
export function planDayAt(instant: number, plan: PlanTimeConfig): IsoDate | null {
  const local = localDateAt(instant, plan.timezone);
  for (const day of [local, addDays(local, -1)]) {
    const w = planWindow(day, plan);
    if (w.open <= instant && instant < w.close) return day;
  }
  return null;
}

/** First plan day whose window has not yet opened at `createdAt`. */
export function startDateFor(createdAt: number, plan: PlanTimeConfig): IsoDate {
  const local = localDateAt(createdAt, plan.timezone);
  for (let i = -1; i <= 3; i += 1) {
    const day = addDays(local, i);
    if (planWindow(day, plan).open > createdAt) return day;
  }
  // Unreachable for valid configs; keep a safe answer.
  return addDays(local, 1);
}

export function endDateFor(startDate: IsoDate, durationDays: number): IsoDate {
  return addDays(startDate, durationDays - 1);
}

export function dayList(plan: Pick<PlanRange, 'startDate' | 'endDate'>): IsoDate[] {
  const n = diffDays(plan.startDate, plan.endDate) + 1;
  const days: IsoDate[] = [];
  for (let i = 0; i < n; i += 1) days.push(addDays(plan.startDate, i));
  return days;
}

export function isInPlan(day: IsoDate, plan: Pick<PlanRange, 'startDate' | 'endDate'>): boolean {
  return day >= plan.startDate && day <= plan.endDate;
}

/** The open time of the next window (non-rest, inside the plan) that opens after `now`. */
export function nextWindowOpen(now: number, plan: PlanRange): number | null {
  const local = localDateAt(now, plan.timezone);
  let day = local < plan.startDate ? plan.startDate : addDays(local, -1);
  for (let guard = 0; guard < 120 && day <= plan.endDate; guard += 1) {
    if (!isRestDay(day, plan)) {
      const w = planWindow(day, plan);
      if (w.open > now) return w.open;
    }
    day = addDays(day, 1);
  }
  return null;
}

/**
 * The day the Today screen talks about at `now`:
 * the day whose window is open, otherwise the local calendar date.
 * Not clamped to the plan range.
 */
export function displayDayAt(now: number, plan: PlanTimeConfig): IsoDate {
  return planDayAt(now, plan) ?? localDateAt(now, plan.timezone);
}

export type WindowPhase = 'before' | 'open' | 'closed';

export function windowPhase(day: IsoDate, plan: PlanTimeConfig, now: number): WindowPhase {
  const w = planWindow(day, plan);
  if (now < w.open) return 'before';
  if (now < w.close) return 'open';
  return 'closed';
}

/** Compounding multiplier after `days` days at rate `r` (positive: perfect, negative: missed). */
export function multiplier(rate: number, days: number, direction: 'up' | 'down'): number {
  return Math.pow(direction === 'up' ? 1 + rate : 1 - rate, days);
}
