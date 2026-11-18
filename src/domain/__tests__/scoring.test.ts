import {
  activeDayCount,
  computePlanState,
  effectiveStatus,
  referenceMultipliers,
  type Checkin,
  type Plan,
  type Work,
} from '../scoring';
import { addDays, endDateFor, planWindow } from '../time';

const START = '2026-01-05'; // Monday

function makePlan(over: Partial<Plan> = {}): Plan {
  const startDate = over.startDate ?? START;
  const durationDays = over.durationDays ?? 30;
  return {
    id: 'p1',
    rate: 0.02,
    durationDays,
    restWeekdays: [],
    sleepTime: '23:00',
    timezone: 'Asia/Kolkata',
    startDate,
    endDate: endDateFor(startDate, durationDays),
    status: 'active',
    endedAt: null,
    createdAt: Date.parse('2026-01-05T00:00:00Z'),
    ...over,
  };
}

function makeWorks(n: number): Work[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    planId: 'p1',
    title: `Work ${i}`,
    doneCriteria: null,
    colorIndex: i,
    position: i,
  }));
}

/** Tick `workIds` on each day offset (0-based from start). */
function ticks(plan: Plan, spec: Record<number, string[]>): Checkin[] {
  return Object.entries(spec).flatMap(([offset, ids]) =>
    ids.map((workId) => ({ workId, planDay: addDays(plan.startDate, Number(offset)) })),
  );
}

/** The instant day `offset` (0-based) closes. */
function afterClose(plan: Plan, offset: number): number {
  return planWindow(addDays(plan.startDate, offset), plan).close;
}

describe('all-complete runs', () => {
  test.each([0.01, 0.02, 0.03])('r=%p matches 100*(1+r)^n to 1e-9', (rate) => {
    const plan = makePlan({ rate, durationDays: 90 });
    const works = makeWorks(3);
    const all: Record<number, string[]> = {};
    for (let i = 0; i < 90; i += 1) all[i] = works.map((w) => w.id);
    for (const n of [1, 7, 45, 90]) {
      const s = computePlanState(plan, works, ticks(plan, all), afterClose(plan, n - 1));
      const expected = 100 * Math.pow(1 + rate, n);
      expect(Math.abs(s.stats.currentScore - expected)).toBeLessThan(1e-9);
      expect(Math.abs(s.stats.perfectScore - expected)).toBeLessThan(1e-9);
      for (const w of s.stats.perWork) expect(Math.abs(w.score - expected)).toBeLessThan(1e-9);
      expect(Math.abs(s.stats.gapPct)).toBeLessThan(1e-12);
      expect(s.stats.currentStreak).toBe(n);
      expect(s.stats.bestStreak).toBe(n);
      expect(s.stats.completionRate).toBe(1);
      expect(s.overallSeries).toHaveLength(n + 1);
    }
  });
});

describe('partial and missed days', () => {
  test('partial: per-work up and down, overall down', () => {
    const plan = makePlan({ rate: 0.01 });
    const works = makeWorks(2);
    const s = computePlanState(plan, works, ticks(plan, { 0: ['w0'] }), afterClose(plan, 0));
    expect(s.days[0]?.status).toBe('partial');
    expect(s.stats.perWork[0]?.score).toBeCloseTo(101, 10);
    expect(s.stats.perWork[1]?.score).toBeCloseTo(99, 10);
    expect(s.stats.currentScore).toBeCloseTo(99, 10);
    expect(s.stats.perfectScore).toBeCloseTo(101, 10);
    expect(s.stats.gapPct).toBeCloseTo(99 / 101 - 1, 12);
    expect(s.stats.lastDelta).toBe(-0.01);
    expect(s.stats.completionRate).toBe(0);
    expect(s.stats.perWork[0]?.rate).toBe(1);
    expect(s.stats.perWork[1]?.rate).toBe(0);
  });

  test('3 of 4 done still lowers the day score', () => {
    const plan = makePlan({ rate: 0.03 });
    const works = makeWorks(4);
    const s = computePlanState(
      plan,
      works,
      ticks(plan, { 0: ['w0', 'w1', 'w2'] }),
      afterClose(plan, 0),
    );
    expect(s.stats.currentScore).toBeCloseTo(97, 10);
    expect(s.stats.perWork.filter((w) => w.score > 100)).toHaveLength(3);
  });

  test('nothing ticked: missed, everything down', () => {
    const plan = makePlan({ rate: 0.02 });
    const works = makeWorks(2);
    const s = computePlanState(plan, works, [], afterClose(plan, 1));
    expect(s.days.slice(0, 2).map((d) => d.status)).toEqual(['missed', 'missed']);
    expect(s.stats.currentScore).toBeCloseTo(100 * 0.98 * 0.98, 10);
    expect(s.stats.missedDays).toBe(2);
  });

  test('checkins for unknown works are ignored', () => {
    const plan = makePlan();
    const works = makeWorks(1);
    const s = computePlanState(
      plan,
      works,
      [{ workId: 'other', planDay: plan.startDate }],
      afterClose(plan, 0),
    );
    expect(s.days[0]?.status).toBe('missed');
  });
});

describe('rest days', () => {
  // Start Monday 2026-01-05; rest on Wednesday (3).
  const plan = makePlan({ restWeekdays: [3], rate: 0.02 });
  const works = makeWorks(2);
  const both = ['w0', 'w1'];

  test('rest days freeze every score and the target', () => {
    const s = computePlanState(plan, works, ticks(plan, { 0: both, 1: both }), afterClose(plan, 2));
    const [d1, d2, d3] = s.days;
    expect(d3?.status).toBe('rest');
    expect(d3?.overall).toBe(d2?.overall);
    expect(d3?.target).toBe(d2?.target);
    expect(d1?.status).toBe('complete');
    expect(s.stats.closedNonRestDays).toBe(2);
    expect(s.stats.restDaysClosed).toBe(1);
    expect(s.perWorkSeries.w0?.[3]?.value).toBe(s.perWorkSeries.w0?.[2]?.value);
  });

  test('ticks on a rest day are ignored by scoring', () => {
    const s = computePlanState(plan, works, ticks(plan, { 2: both }), afterClose(plan, 2));
    expect(s.days[2]?.status).toBe('rest');
    expect(s.stats.currentScore).toBeCloseTo(100 * 0.98 * 0.98, 10);
  });

  test('rest days count toward the calendar duration', () => {
    expect(computePlanState(plan, works, [], afterClose(plan, 0)).days).toHaveLength(30);
    expect(activeDayCount(plan)).toBeLessThan(30);
  });
});

describe('streaks', () => {
  test('rest days are skipped over and do not break the streak', () => {
    // Mon..Sun: C C C P C R(Sat) C(Sun)
    const plan = makePlan({ restWeekdays: [6] });
    const works = makeWorks(2);
    const b = ['w0', 'w1'];
    const s = computePlanState(
      plan,
      works,
      ticks(plan, { 0: b, 1: b, 2: b, 3: ['w0'], 4: b, 6: b }),
      afterClose(plan, 6),
    );
    expect(s.days.slice(0, 7).map((d) => d.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'partial',
      'complete',
      'rest',
      'complete',
    ]);
    expect(s.stats.currentStreak).toBe(2);
    expect(s.stats.bestStreak).toBe(3);
  });

  test('current streak is 0 when the latest closed day is not complete', () => {
    const plan = makePlan();
    const works = makeWorks(1);
    const s = computePlanState(plan, works, ticks(plan, { 0: ['w0'] }), afterClose(plan, 1));
    expect(s.stats.currentStreak).toBe(0);
    expect(s.stats.bestStreak).toBe(1);
  });
});

describe('today and stakes preview', () => {
  const plan = makePlan({ rate: 0.02 });
  const works = makeWorks(2);
  const both = ['w0', 'w1'];
  const day3 = planWindow(addDays(plan.startDate, 2), plan);

  test('pending (before window): stakes shown', () => {
    const s = computePlanState(plan, works, ticks(plan, { 0: both, 1: both }), day3.open - 60_000);
    expect(s.today?.status).toBe('pending');
    expect(s.today?.index).toBe(3);
    const O = 100 * 1.02 * 1.02;
    expect(s.today?.stakes?.ifAllDone).toBeCloseTo(O * 1.02, 10);
    expect(s.today?.stakes?.ifAnyMissed).toBeCloseTo(O * 0.98, 10);
  });

  test('open with one of two ticked: stakes shown, per-work stakes', () => {
    const s = computePlanState(
      plan,
      works,
      ticks(plan, { 0: both, 1: both, 2: ['w0'] }),
      day3.open + 60_000,
    );
    expect(s.today?.status).toBe('open');
    expect(s.today?.doneCount).toBe(1);
    expect(s.today?.stakes).not.toBeNull();
    expect(s.today?.workStakes.w1?.ifAllDone).toBeCloseTo(100 * 1.02 ** 3, 10);
    // The open day is not scored yet.
    expect(s.stats.closedNonRestDays).toBe(2);
  });

  test('all ticked: no stakes', () => {
    const s = computePlanState(
      plan,
      works,
      ticks(plan, { 0: both, 1: both, 2: both }),
      day3.open + 60_000,
    );
    expect(s.today?.stakes).toBeNull();
  });

  test('after close: today shows the closed result', () => {
    const s = computePlanState(plan, works, ticks(plan, { 2: ['w1'] }), day3.close + 60_000);
    expect(s.today?.status).toBe('partial');
    expect(s.today?.stakes).toBeNull();
  });

  test('not started', () => {
    const s = computePlanState(plan, works, [], Date.parse('2026-01-01T00:00:00Z'));
    expect(s.phase).toBe('not_started');
    expect(s.today).toBeNull();
    expect(s.nextOpen).toBe(planWindow(plan.startDate, plan).open);
  });
});

describe('plan end', () => {
  test('ended early: only days closed before ended_at count', () => {
    const plan = makePlan({
      status: 'ended_early',
      endedAt: afterClose(makePlan(), 2) + 3_600_000, // 1h after day 3 closed
    });
    const works = makeWorks(1);
    const all: Record<number, string[]> = {};
    for (let i = 0; i < 30; i += 1) all[i] = ['w0'];
    const s = computePlanState(plan, works, ticks(plan, all), afterClose(plan, 20));
    expect(s.stats.closedDays).toBe(3);
    expect(s.stats.currentScore).toBeCloseTo(100 * 1.02 ** 3, 10);
    expect(s.days[3]?.closed).toBe(false);
    expect(s.days[3]?.status).toBe('upcoming');
    expect(s.phase).toBe('finished');
    expect(s.effectiveStatus).toBe('ended_early');
    expect(s.today).toBeNull();
    expect(s.nextOpen).toBeNull();
  });

  test('active plan past its last close is effectively completed', () => {
    const plan = makePlan();
    const end = planWindow(plan.endDate, plan).close;
    expect(effectiveStatus(plan, end - 1)).toBe('active');
    expect(effectiveStatus(plan, end)).toBe('completed');
    const s = computePlanState(plan, makeWorks(1), [], end + 1);
    expect(s.phase).toBe('finished');
    expect(s.stats.closedDays).toBe(30);
  });
});

describe('sleep time past midnight', () => {
  const plan = makePlan({ sleepTime: '01:00', rate: 0.01 });
  const works = makeWorks(1);
  const w = planWindow(plan.startDate, plan); // closes Jan 6 01:00 IST

  test('day D window is open at 00:30 on D+1', () => {
    const now = Date.parse('2026-01-05T19:00:00Z'); // 00:30 IST Jan 6
    const s = computePlanState(plan, works, ticks(plan, { 0: ['w0'] }), now);
    expect(s.today?.day).toBe('2026-01-05');
    expect(s.today?.status).toBe('open');
    expect(now).toBeLessThan(w.close);
  });

  test('closes at 01:00 on D+1 and counts for D', () => {
    const s = computePlanState(plan, works, ticks(plan, { 0: ['w0'] }), w.close);
    expect(s.days[0]?.status).toBe('complete');
    expect(s.stats.currentScore).toBeCloseTo(101, 10);
    expect(s.today?.day).toBe('2026-01-06');
    expect(s.today?.status).toBe('pending');
  });
});

describe('DST zone (America/New_York)', () => {
  test('a plan spanning spring-forward scores every day exactly once', () => {
    const plan = makePlan({
      timezone: 'America/New_York',
      startDate: '2026-03-01',
      durationDays: 30,
      sleepTime: '23:30',
      rate: 0.01,
    });
    const works = makeWorks(2);
    const all: Record<number, string[]> = {};
    for (let i = 0; i < 30; i += 1) all[i] = ['w0', 'w1'];
    // After day 10 (2026-03-10) closes. Spring-forward is 2026-03-08.
    const s = computePlanState(plan, works, ticks(plan, all), afterClose(plan, 9));
    expect(s.stats.closedDays).toBe(10);
    expect(s.stats.currentScore).toBeCloseTo(100 * 1.01 ** 10, 9);
    const d8 = s.days[7];
    expect(d8).toBeDefined();
    if (!d8) return;
    expect(d8.window.close - d8.window.open).toBe(2 * 3600_000);
    expect(new Date(d8.window.close).toISOString()).toBe('2026-03-09T03:30:00.000Z');
  });

  test('a window spanning fall-back stays 2h and keeps its day', () => {
    const plan = makePlan({
      timezone: 'America/New_York',
      startDate: '2026-10-20',
      durationDays: 30,
      sleepTime: '01:30',
    });
    const s = computePlanState(plan, makeWorks(1), [], Date.parse('2026-11-01T05:45:00Z'));
    expect(s.today?.day).toBe('2026-10-31');
    expect(s.today?.status).toBe('open');
  });
});

describe('reference multipliers (onboarding copy)', () => {
  test.each([
    [0.01, 2.45, 0.4],
    [0.02, 5.94, 0.16],
    [0.03, 14.3, 0.06],
  ])('r=%p over 90 days', (rate, perfect, missed) => {
    const m = referenceMultipliers(rate, 90);
    expect(Math.abs(m.perfect - perfect)).toBeLessThan(0.01 * perfect);
    expect(Math.abs(m.missed - missed)).toBeLessThan(0.01);
  });
});
