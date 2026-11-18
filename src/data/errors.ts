import { t } from '@/copy/en';
import { dayAndTime } from '@/lib/format';
import { parseTimestamp } from './timestamps';

/** Stable error codes raised by the RPC functions. */
export const ERROR_CODES = [
  'WINDOW_CLOSED',
  'OUTSIDE_PLAN',
  'REST_DAY',
  'PLAN_NOT_ACTIVE',
  'ACTIVE_PLAN_EXISTS',
  'WORK_NOT_FOUND',
  'PLAN_NOT_FOUND',
  'CONFIRMATION_REQUIRED',
  'INVALID_RATE',
  'INVALID_DURATION',
  'INVALID_REST_DAYS',
  'INVALID_SLEEP_TIME',
  'INVALID_TIMEZONE',
  'INVALID_WORKS',
  'INVALID_WORK_TITLE',
  'INVALID_DONE_CRITERIA',
  'NOT_AUTHENTICATED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  code: ErrorCode | 'NETWORK' | 'SERVER' | 'UNKNOWN';
  detail: string | null;
  constructor(code: ErrorCode | 'NETWORK' | 'SERVER' | 'UNKNOWN', detail: string | null = null) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

interface MaybePgError {
  message?: unknown;
  details?: unknown;
  name?: unknown;
  status?: unknown;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err: MaybePgError = typeof e === 'object' && e !== null ? e : {};
  const message = typeof err.message === 'string' ? err.message : '';
  const code = ERROR_CODES.find((c) => message === c);
  if (code) return new AppError(code, typeof err.details === 'string' ? err.details : null);
  const status = typeof err.status === 'number' ? err.status : 0;
  // auth-js uses AuthRetryableFetchError both for real connection failures
  // (status 0) and for 5xx answers from the server. Only the first is offline.
  if (err.name === 'AuthRetryableFetchError' && status >= 500) {
    return new AppError('SERVER', message || null);
  }
  if (
    /network request failed|failed to fetch|fetch failed|networkerror|timed? ?out/i.test(message) ||
    err.name === 'FunctionsFetchError' ||
    err.name === 'AuthRetryableFetchError'
  ) {
    return new AppError('NETWORK');
  }
  return new AppError('UNKNOWN', message || null);
}

/** Human copy for any error. `tz` formats the next-open time in the plan's zone. */
export function errorMessage(e: unknown, tz?: string): string {
  const err = toAppError(e);
  switch (err.code) {
    case 'NETWORK':
      return t.errors.network;
    case 'SERVER':
      return t.errors.server;
    case 'UNKNOWN':
      return t.errors.generic;
    case 'WINDOW_CLOSED':
      if (err.detail && tz) {
        try {
          return t.errors.WINDOW_CLOSED_NEXT(dayAndTime(parseTimestamp(err.detail), tz));
        } catch {
          return t.errors.WINDOW_CLOSED;
        }
      }
      return t.errors.WINDOW_CLOSED;
    default:
      return t.errors[err.code];
  }
}
