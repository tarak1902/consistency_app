/**
 * Scoring is pure and deterministic. Nothing here is stored; every screen
 * derives what it needs from (plan, works, checkins, serverNow).
 */
import {
  type IsoDate,
  type PlanRange,
  type Window,
  dayList,
  displayDayAt,
  isInPlan,
  isRestDay,
  nextWindowOpen,
  planWindow,
} from './time';

export const START_SCORE = 100;

export type PlanStatus = 'active' | 'completed' | 'ended_early';

export interface Plan extends PlanRange {
  id: string;
  rate: number;
  durationDays: number;
  status: PlanStatus;
  /** Epoch ms, set when ended early. */
  endedAt: number | null;
  createdAt: number;
}

export interface Work {
  id: string;
  planId: string;
  title: string;
  doneCriteria: string | null;
  colorIndex: number;
  position: number;
}

export interface Checkin {
  workId: string;
  planDay: IsoDate;
}

export type ClosedDayStatus = 'rest' | 'complete' | 'partial' | 'missed';
export type OpenDayStatus = 'open' | 'pending' | 'upcoming';
export type DayStatus = ClosedDayStatus | OpenDayStatus;

export interface DayResult {
  day: IsoDate;
  /** 1-based position in the plan. */
  index: number;
  status: DayStatus;
  closed: boolean;
  isRest: boolean;
  window: Window;
  /** Work ids ticked for this day. */
  doneWorkIds: ReadonlySet<string>;
  doneCount: number;
  /** Overall score after this day (only for closed days). */
  overall: number | null;
  /** Perfect-path score after this day (only for closed days). */
  target: number | null;
  /** Overall fractional change applied on this day (+r, −r or 0). Null when not closed. */
  overallDelta: number | null;
}

export interface SeriesPoint {
  /** 0 = plan start (before day 1), n = after day n. */
  index: number;
  day: IsoDate | null;
  value: number;
  status: ClosedDayStatus | 'start';
}

export interface WorkStats {
  workId: string;
  score: number;
  /** score / 100 − 1 */
  deltaSinceStart: number;
  doneCount: number;
  /** doneCount / closedNonRestDays, or null when no active day has closed. */
  rate: number | null;
  /** Change on the latest closed non-rest day (+r / −r), or null. */
  lastDelta: number | null;
}

export interface PlanStats {
  currentScore: number;
  perfectScore: number;
  gapPct: number;
  completeDays: number;
  partialDays: number;
  missedDays: number;
  restDaysClosed: number;
  closedDays: number;
  closedNonRestDays: number;
  completionRate: number | null;
  currentStreak: number;
  bestStreak: number;
  /** Overall change on the latest closed non-rest day, or null. */
  lastDelta: number | null;
  perWork: WorkStats[];
}

export type PlanPhase = 'not_started' | 'active' | 'finished';

export interface Stakes {
  ifAllDone: number;
  ifAnyMissed: number;
}

export interface TodayState {
  day: IsoDate;
  index: number;
  status: DayStatus;
  window: Window;
  isRest: boolean;
  doneWorkIds: ReadonlySet<string>;
  doneCount: number;
  totalWorks: number;
  /** Shown while open or pending and not all works are ticked. */
  stakes: Stakes | null;
  /** Per-work projected scores if done / skipped today. */
  workStakes: Record<string, Stakes>;
}

export interface PlanState {
  phase: PlanPhase;
  effectiveStatus: PlanStatus;
  /** Instant after which no more days are scored. */
  cutoff: number;
  days: DayResult[];
  overallSeries: SeriesPoint[];
  targetSeries: SeriesPoint[];
  perWorkSeries: Record<string, SeriesPoint[]>;
  stats: PlanStats;
  /** Null when the plan hasn't started or has finished. */
  today: TodayState | null;
  nextOpen: number | null;
}

/** The plan's status as the client should treat it at `now`. */
export function effectiveStatus(plan: Plan, now: number): PlanStatus {
  if (plan.status !== 'active') return plan.status;
  return now >= planWindow(plan.endDate, plan).close ? 'completed' : 'active';
}

/** Instant after which days stop counting (now, or the early-end instant). */
export function scoringCutoff(plan: Plan, now: number): number {
  if (plan.status === 'ended_early' && plan.endedAt !== null) return Math.min(plan.endedAt, now);
  return now;
}

function groupCheckins(checkins: readonly Checkin[]): Map<IsoDate, Set<string>> {
  const map = new Map<IsoDate, Set<string>>();
  for (const c of checkins) {
    let set = map.get(c.planDay);
    if (!set) {
      set = new Set();
      map.set(c.planDay, set);
    }
    set.add(c.workId);
  }
  return map;
}

export function computePlanState(
  plan: Plan,
  works: readonly Work[],
  checkins: readonly Checkin[],
  serverNow: number,
): PlanState {
  const r = plan.rate;
  const up = 1 + r;
  const down = 1 - r;
  const ordered = [...works].sort((a, b) => a.position - b.position);
  const workIds = new Set(ordered.map((w) => w.id));
  const byDay = groupCheckins(checkins.filter((c) => workIds.has(c.workId)));
  const status = effectiveStatus(plan, serverNow);
  const cutoff = scoringCutoff(plan, serverNow);
  const displayDay = displayDayAt(serverNow, plan);

  let overall = START_SCORE;
  let target = START_SCORE;
  const perWork = new Map<string, number>(ordered.map((w) => [w.id, START_SCORE]));
  const doneCounts = new Map<string, number>(ordered.map((w) => [w.id, 0]));
  const lastWorkDelta = new Map<string, number | null>(ordered.map((w) => [w.id, null]));

  const overallSeries: SeriesPoint[] = [
    { index: 0, day: null, value: START_SCORE, status: 'start' },
  ];
  const targetSeries: SeriesPoint[] = [
    { index: 0, day: null, value: START_SCORE, status: 'start' },
  ];
  const perWorkSeries: Record<string, SeriesPoint[]> = {};
  for (const w of ordered) {
    perWorkSeries[w.id] = [{ index: 0, day: null, value: START_SCORE, status: 'start' }];
  }

  const days: DayResult[] = [];
  let completeDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let restDaysClosed = 0;
  let closedNonRest = 0;
  let run = 0;
  let bestStreak = 0;
  let lastDelta: number | null = null;

  const all = dayList(plan);
  all.forEach((day, i) => {
    const index = i + 1;
    const window = planWindow(day, plan);
    const isRest = isRestDay(day, plan);
    const done = byDay.get(day) ?? new Set<string>();
    const doneCount = ordered.reduce((n, w) => n + (done.has(w.id) ? 1 : 0), 0);
    const closed = window.close <= cutoff;

    if (!closed) {
      let st: DayStatus;
      if (isRest) st = 'rest';
      else if (window.open <= serverNow && serverNow < window.close && status === 'active')
        st = 'open';
      else if (day === displayDay) st = 'pending';
      else st = 'upcoming';
      days.push({
        day,
        index,
        status: st,
        closed: false,
        isRest,
        window,
        doneWorkIds: done,
        doneCount,
        overall: null,
        target: null,
        overallDelta: null,
      });
      return;
    }

    let st: ClosedDayStatus;
    let delta = 0;
    if (isRest) {
      st = 'rest';
      restDaysClosed += 1;
    } else {
      closedNonRest += 1;
      const allDone = ordered.length > 0 && doneCount === ordered.length;
      st = allDone ? 'complete' : doneCount > 0 ? 'partial' : 'missed';
      for (const w of ordered) {
        const isDone = done.has(w.id);
        perWork.set(w.id, (perWork.get(w.id) ?? START_SCORE) * (isDone ? up : down));
        lastWorkDelta.set(w.id, isDone ? r : -r);
        if (isDone) doneCounts.set(w.id, (doneCounts.get(w.id) ?? 0) + 1);
      }
      overall *= allDone ? up : down;
      target *= up;
      delta = allDone ? r : -r;
      lastDelta = delta;
      if (st === 'complete') {
        completeDays += 1;
        run += 1;
        bestStreak = Math.max(bestStreak, run);
      } else {
        run = 0;
        if (st === 'partial') partialDays += 1;
        else missedDays += 1;
      }
    }

    overallSeries.push({ index, day, value: overall, status: st });
    targetSeries.push({ index, day, value: target, status: st });
    for (const w of ordered) {
      perWorkSeries[w.id]?.push({
        index,
        day,
        value: perWork.get(w.id) ?? START_SCORE,
        status: st,
      });
    }
    days.push({
      day,
      index,
      status: st,
      closed: true,
      isRest,
      window,
      doneWorkIds: done,
      doneCount,
      overall,
      target,
      overallDelta: delta,
    });
  });

  const perWorkStats: WorkStats[] = ordered.map((w) => {
    const score = perWork.get(w.id) ?? START_SCORE;
    const doneCount = doneCounts.get(w.id) ?? 0;
    return {
      workId: w.id,
      score,
      deltaSinceStart: score / START_SCORE - 1,
      doneCount,
      rate: closedNonRest > 0 ? doneCount / closedNonRest : null,
      lastDelta: lastWorkDelta.get(w.id) ?? null,
    };
  });

  const stats: PlanStats = {
    currentScore: overall,
    perfectScore: target,
    gapPct: overall / target - 1,
    completeDays,
    partialDays,
    missedDays,
    restDaysClosed,
    closedDays: closedNonRest + restDaysClosed,
    closedNonRestDays: closedNonRest,
    completionRate: closedNonRest > 0 ? completeDays / closedNonRest : null,
    currentStreak: run,
    bestStreak,
    lastDelta,
    perWork: perWorkStats,
  };

  // Phase and today.
  let phase: PlanPhase;
  if (status !== 'active') phase = 'finished';
  else if (displayDay < plan.startDate) phase = 'not_started';
  else phase = 'active';

  let today: TodayState | null = null;
  if (phase === 'active' && isInPlan(displayDay, plan)) {
    const d = days.find((x) => x.day === displayDay);
    if (d) {
      const allTicked = ordered.length > 0 && d.doneCount === ordered.length;
      const showStakes = !d.isRest && (d.status === 'open' || d.status === 'pending') && !allTicked;
      const workStakes: Record<string, Stakes> = {};
      if (!d.isRest && !d.closed) {
        for (const w of ordered) {
          const s = perWork.get(w.id) ?? START_SCORE;
          workStakes[w.id] = { ifAllDone: s * up, ifAnyMissed: s * down };
        }
      }
      today = {
        day: d.day,
        index: d.index,
        status: d.status,
        window: d.window,
        isRest: d.isRest,
        doneWorkIds: d.doneWorkIds,
        doneCount: d.doneCount,
        totalWorks: ordered.length,
        stakes: showStakes ? { ifAllDone: overall * up, ifAnyMissed: overall * down } : null,
        workStakes,
      };
    }
  }

  return {
    phase,
    effectiveStatus: status,
    cutoff,
    days,
    overallSeries,
    targetSeries,
    perWorkSeries,
    stats,
    today,
    nextOpen: status === 'active' ? nextWindowOpen(serverNow, plan) : null,
  };
}

/** Multipliers for onboarding/wizard copy: perfect path vs. every day missed. */
export function referenceMultipliers(
  rate: number,
  days: number,
): { perfect: number; missed: number } {
  return { perfect: Math.pow(1 + rate, days), missed: Math.pow(1 - rate, days) };
}

/** Active (non-rest) day count for a plan configuration. */
export function activeDayCount(
  plan: Pick<PlanRange, 'startDate' | 'endDate' | 'restWeekdays'>,
): number {
  return dayList(plan).filter((d) => !isRestDay(d, plan)).length;
}
