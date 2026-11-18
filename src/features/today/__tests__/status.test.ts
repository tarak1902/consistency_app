import { computePlanState, type Plan, type Work } from '@/domain/scoring';
import { addDays, endDateFor, planWindow } from '@/domain/time';
import { statusLine } from '../status';

jest.mock('@/lib/config', () => ({ APP_NAME: 'Compound', config: {} }));

const plan: Plan = {
  id: 'p',
  rate: 0.02,
  durationDays: 30,
  restWeekdays: [7],
  sleepTime: '23:00',
  timezone: 'Asia/Kolkata',
  startDate: '2026-01-05',
  endDate: endDateFor('2026-01-05', 30),
  status: 'active',
  endedAt: null,
  createdAt: 0,
};
const works: Work[] = [0, 1].map((i) => ({
  id: `w${i}`,
  planId: 'p',
  title: `W${i}`,
  doneCriteria: null,
  colorIndex: i,
  position: i,
}));

function line(now: number, ticks: string[] = []) {
  const day = '2026-01-06';
  const s = computePlanState(
    plan,
    works,
    ticks.map((workId) => ({ workId, planDay: day })),
    now,
  );
  return statusLine(plan, s, now);
}

const w = planWindow('2026-01-06', plan);

describe('statusLine', () => {
  test('before the window: neutral with countdown', () => {
    const l = line(w.open - (3 * 60 + 12) * 60_000);
    expect(l?.tone).toBe('neutral');
    expect(l?.label).toContain('Check-in opens 9:00 PM');
    expect(l?.label).toContain('in 3h 12m');
  });

  test('open: accent, then caution in the last 30 minutes', () => {
    expect(line(w.open + 60_000)?.tone).toBe('accent');
    expect(line(w.close - 29 * 60_000)?.tone).toBe('caution');
    expect(line(w.close - 29 * 60_000)?.label).toContain('closes in 29m');
  });

  test('closed: growth when complete, decline when not', () => {
    expect(line(w.close + 1000, ['w0', 'w1'])).toEqual({ label: 'Day 2 complete', tone: 'growth' });
    expect(line(w.close + 1000, ['w0'])?.label).toBe('Day 2 closed · 1 of 2');
    expect(line(w.close + 1000, ['w0'])?.tone).toBe('decline');
  });

  test('rest day', () => {
    const sunday = planWindow('2026-01-11', plan).open + 1000;
    expect(line(sunday)?.label).toBe('Rest day · graphs paused');
  });

  test('not started: tomorrow', () => {
    const before = planWindow(addDays(plan.startDate, -1), plan).open - 3600_000;
    expect(line(before)?.label).toBe('Your plan starts tomorrow · first check-in 9:00 PM');
  });
});
