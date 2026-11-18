import { errorMessage, toAppError } from '../errors';
import { parseTimestamp } from '../timestamps';

jest.mock('@/lib/config', () => ({ APP_NAME: 'Compound', config: {} }));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@/data/queries', () => ({ fetchExport: jest.fn() }));

// eslint-disable-next-line import/first
import { toCsv } from '@/lib/exportData';

describe('parseTimestamp', () => {
  test.each([
    ['2026-01-15T15:30:00+00:00', '2026-01-15T15:30:00.000Z'],
    ['2026-01-15T15:30:00.123456+00:00', '2026-01-15T15:30:00.123Z'],
    ['2026-01-15 21:00:00+05:30', '2026-01-15T15:30:00.000Z'],
    ['2026-01-15 15:30:00+00', '2026-01-15T15:30:00.000Z'],
    ['2026-01-15T15:30:00Z', '2026-01-15T15:30:00.000Z'],
  ])('%s', (input, iso) => {
    expect(new Date(parseTimestamp(input)).toISOString()).toBe(iso);
  });
  test('rejects garbage', () => {
    expect(() => parseTimestamp('soon')).toThrow();
  });
});

describe('error mapping', () => {
  test('RPC codes map to copy', () => {
    expect(toAppError({ message: 'REST_DAY', details: '' }).code).toBe('REST_DAY');
    expect(errorMessage({ message: 'ACTIVE_PLAN_EXISTS' })).toBe(
      'You already have an active plan.',
    );
  });
  test('WINDOW_CLOSED includes the next open time in the plan zone', () => {
    const msg = errorMessage(
      { message: 'WINDOW_CLOSED', details: '2026-01-16T15:30:00Z' },
      'Asia/Kolkata',
    );
    expect(msg).toContain('The check-in window is closed. It opens');
    expect(msg).toContain('9:00');
  });
  test('network failures', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('NETWORK');
  });
  test('unknown errors get generic copy, never raw text', () => {
    expect(errorMessage(new Error('duplicate key value violates unique constraint'))).toBe(
      'Something went wrong. Try again.',
    );
  });
});

describe('toCsv', () => {
  test('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 3, 'x\ny']])).toBe(
      'a,"b,c","say ""hi""",,3,"x\ny"\n',
    );
  });
});
