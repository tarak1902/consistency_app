import vectors from './vectors.json';
import {
  addDays,
  dayList,
  diffDays,
  displayDayAt,
  endDateFor,
  isRestDay,
  isSleepTimeAllowed,
  isoWeekday,
  localDateAt,
  nextWindowOpen,
  parseSleepTime,
  planDayAt,
  planWindow,
  startDateFor,
  windowPhase,
  zonedWallToInstant,
} from '../time';

const ms = (iso: string) => Date.parse(iso);
const cfg = (tz: string, sleep: string, rest: number[] = []) => ({
  timezone: tz,
  sleepTime: sleep,
  restWeekdays: rest,
});

describe('vectors: planWindow', () => {
  test.each(vectors.windows)('$name', ({ tz, sleep, day, open, close }) => {
    const w = planWindow(day, cfg(tz, sleep));
    expect(new Date(w.open).toISOString()).toBe(new Date(ms(open)).toISOString());
    expect(new Date(w.close).toISOString()).toBe(new Date(ms(close)).toISOString());
  });
});

describe('vectors: planDayAt', () => {
  test.each(vectors.planDayAt)('$tz $sleep at $at -> $day', ({ tz, sleep, at, day }) => {
    expect(planDayAt(ms(at), cfg(tz, sleep))).toBe(day);
  });
});

describe('vectors: startDateFor', () => {
  test.each(vectors.startDate)(
    '$tz $sleep created $createdAt -> $start',
    ({ tz, sleep, createdAt, start }) => {
      expect(startDateFor(ms(createdAt), cfg(tz, sleep))).toBe(start);
    },
  );
});

describe('calendar helpers', () => {
  test('addDays / diffDays across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-01-01', '2026-03-01')).toBe(59);
  });

  test('isoWeekday', () => {
    expect(isoWeekday('2026-01-05')).toBe(1); // Monday
    expect(isoWeekday('2026-01-11')).toBe(7); // Sunday
  });

  test('isRestDay', () => {
    expect(isRestDay('2026-01-11', { restWeekdays: [7] })).toBe(true);
    expect(isRestDay('2026-01-12', { restWeekdays: [7] })).toBe(false);
    expect(isRestDay('2026-01-12', { restWeekdays: [] })).toBe(false);
  });

  test('dayList and endDateFor give `duration` days inclusive', () => {
    const start = '2026-01-15';
    const end = endDateFor(start, 30);
    expect(end).toBe('2026-02-13');
    const days = dayList({ startDate: start, endDate: end });
    expect(days).toHaveLength(30);
    expect(days[0]).toBe(start);
    expect(days[29]).toBe(end);
  });
});

describe('sleep time', () => {
  test('parse', () => {
    expect(parseSleepTime('23:00')).toBe(1380);
    expect(parseSleepTime('01:30:00')).toBe(90);
    expect(() => parseSleepTime('24:00')).toThrow();
  });

  test('allowed range wraps past midnight', () => {
    expect(isSleepTimeAllowed(parseSleepTime('20:00'))).toBe(true);
    expect(isSleepTimeAllowed(parseSleepTime('04:00'))).toBe(true);
    expect(isSleepTimeAllowed(parseSleepTime('00:00'))).toBe(true);
    expect(isSleepTimeAllowed(parseSleepTime('19:59'))).toBe(false);
    expect(isSleepTimeAllowed(parseSleepTime('04:01'))).toBe(false);
    expect(isSleepTimeAllowed(parseSleepTime('12:00'))).toBe(false);
  });
});

describe('time zone conversion', () => {
  test('Asia/Kolkata has a fixed +05:30 offset', () => {
    expect(new Date(zonedWallToInstant('2026-06-01', 0, 'Asia/Kolkata')).toISOString()).toBe(
      '2026-05-31T18:30:00.000Z',
    );
    expect(localDateAt(ms('2026-05-31T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-05-31');
    expect(localDateAt(ms('2026-05-31T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-06-01');
  });

  test('America/New_York window is exactly 2h even across spring-forward', () => {
    const w = planWindow('2026-03-07', cfg('America/New_York', '02:30'));
    expect(w.close - w.open).toBe(2 * 3600 * 1000);
  });
});

describe('window boundaries', () => {
  const plan = cfg('Asia/Kolkata', '23:00');
  const w = planWindow('2026-01-15', plan);
  test('phases', () => {
    expect(windowPhase('2026-01-15', plan, w.open - 1000)).toBe('before');
    expect(windowPhase('2026-01-15', plan, w.open)).toBe('open');
    expect(windowPhase('2026-01-15', plan, w.close - 1000)).toBe('open');
    expect(windowPhase('2026-01-15', plan, w.close)).toBe('closed');
  });

  test('displayDayAt is the local date unless a window from yesterday is open', () => {
    const late = cfg('Asia/Kolkata', '01:00');
    // 00:30 IST on Jan 16: Jan 15's window is still open
    expect(displayDayAt(ms('2026-01-15T19:00:00Z'), late)).toBe('2026-01-15');
    // 01:30 IST on Jan 16: closed; Today talks about Jan 16
    expect(displayDayAt(ms('2026-01-15T20:00:00Z'), late)).toBe('2026-01-16');
  });
});

describe('nextWindowOpen', () => {
  const plan = {
    ...cfg('Asia/Kolkata', '23:00', [5]), // Friday rest
    startDate: '2026-01-12', // Monday
    endDate: '2026-01-18',
  };
  test('before the plan starts: first day', () => {
    expect(nextWindowOpen(ms('2026-01-01T00:00:00Z'), plan)).toBe(
      planWindow('2026-01-12', plan).open,
    );
  });
  test('during an open window: next day', () => {
    const now = planWindow('2026-01-13', plan).open + 1000;
    expect(nextWindowOpen(now, plan)).toBe(planWindow('2026-01-14', plan).open);
  });
  test('skips rest days', () => {
    const now = planWindow('2026-01-15', plan).close; // Thu closed, Fri rest, so Sat
    expect(nextWindowOpen(now, plan)).toBe(planWindow('2026-01-17', plan).open);
  });
  test('after the last day: null', () => {
    expect(nextWindowOpen(planWindow('2026-01-18', plan).close, plan)).toBeNull();
  });
});
