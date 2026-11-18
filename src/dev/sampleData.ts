/**
 * Deterministic sample plan for the /dev/ui gallery and design work.
 * Built with the real domain module so charts look exactly like production.
 */
import {
  computePlanState,
  type Checkin,
  type Plan,
  type PlanState,
  type Work,
} from '@/domain/scoring';
import { addDays, endDateFor, planWindow } from '@/domain/time';

export interface Sample {
  plan: Plan;
  works: Work[];
  checkins: Checkin[];
  now: number;
  state: PlanState;
}

export function buildSample(daysIn = 40, duration = 60, rate = 0.02): Sample {
  const startDate = '2026-01-05';
  const plan: Plan = {
    id: 'sample',
    rate,
    durationDays: duration,
    restWeekdays: [7],
    sleepTime: '23:00',
    timezone: 'Asia/Kolkata',
    startDate,
    endDate: endDateFor(startDate, duration),
    status: 'active',
    endedAt: null,
    createdAt: Date.parse('2026-01-04T10:00:00Z'),
  };
  const titles: [string, string | null][] = [
    ['Static GK', '1 chapter + 20 MCQs'],
    ['English reading', '1 editorial, note 10 words'],
    ['Reasoning', '1 sectional test'],
    ['Quant', '30 questions, timed'],
  ];
  const works: Work[] = titles.map(([title, doneCriteria], i) => ({
    id: `w${i}`,
    planId: plan.id,
    title,
    doneCriteria,
    colorIndex: i,
    position: i,
  }));
  const checkins: Checkin[] = [];
  for (let i = 0; i < daysIn - 1; i += 1) {
    const day = addDays(startDate, i);
    const h = (i * 53 + 7) % 100;
    works.forEach((w, k) => {
      const skip = (i % 2 === 0 ? 3 : (i % 3) + 0) === k;
      if (h < 62 || (h < 85 && !skip)) checkins.push({ workId: w.id, planDay: day });
    });
  }
  // Today: two of four ticked, window open.
  const today = addDays(startDate, daysIn - 1);
  checkins.push({ workId: 'w0', planDay: today }, { workId: 'w2', planDay: today });
  const now = planWindow(today, plan).open + 45 * 60_000;
  return { plan, works, checkins, now, state: computePlanState(plan, works, checkins, now) };
}
