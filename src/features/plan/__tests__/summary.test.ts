import { computePlanState, type Plan, type Work } from '@/domain/scoring';
import { addDays, endDateFor, planWindow } from '@/domain/time';
import { rankWorks, summarySentence } from '../summary';

jest.mock('@/lib/config', () => ({ APP_NAME: 'Compound', config: {} }));

const plan: Plan = {
  id: 'p',
  rate: 0.02,
  durationDays: 30,
  restWeekdays: [],
  sleepTime: '23:00',
  timezone: 'Asia/Kolkata',
  startDate: '2026-01-05',
  endDate: endDateFor('2026-01-05', 30),
  status: 'active',
  endedAt: null,
  createdAt: 0,
};
const works: Work[] = ['Reasoning', 'Quant', 'English'].map((title, i) => ({
  id: `w${i}`,
  planId: 'p',
  title,
  doneCriteria: null,
  colorIndex: i,
  position: i,
}));

test('names the strongest and weakest work', () => {
  const checkins = [0, 1, 2, 3].flatMap((d) => {
    const day = addDays(plan.startDate, d);
    const ids = d === 3 ? ['w0', 'w2'] : d === 2 ? ['w0', 'w1', 'w2'] : ['w0', 'w2'];
    return ids.map((workId) => ({ workId, planDay: day }));
  });
  const s = computePlanState(
    plan,
    works,
    checkins,
    planWindow(addDays(plan.startDate, 3), plan).close,
  );
  expect(rankWorks(works, s).map((r) => r.work.title)).toEqual(['Reasoning', 'English', 'Quant']);
  expect(summarySentence(works, s)).toBe(
    'You completed 1 of 4 active days. Reasoning carried you; Quant held you back.',
  );
});

test('no closed days', () => {
  const s = computePlanState(plan, works, [], 0);
  expect(summarySentence(works, s)).toBe('No active days closed in this plan.');
});
