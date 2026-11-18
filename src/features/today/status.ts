import { t } from '@/copy/en';
import type { Plan, PlanState } from '@/domain/scoring';
import { addDays, localDateAt, planWindow } from '@/domain/time';
import { clockTime, countdown, mediumDate } from '@/lib/format';
import type { PillTone } from '@/components/Pill';

export const LAST_CALL_MS = 30 * 60_000;

export interface StatusLine {
  label: string;
  tone: PillTone;
}

/** The live status pill on Today. Pure: derived from plan state and server time. */
export function statusLine(plan: Plan, state: PlanState, now: number): StatusLine | null {
  if (state.phase === 'not_started') {
    const first = planWindow(plan.startDate, plan).open;
    const tomorrow = addDays(localDateAt(now, plan.timezone), 1);
    const time = clockTime(first, plan.timezone);
    return {
      label:
        plan.startDate === tomorrow
          ? t.today.pillNotStartedTomorrow(time)
          : t.today.pillNotStartedOn(mediumDate(plan.startDate), time),
      tone: 'neutral',
    };
  }
  const today = state.today;
  if (!today) return null;
  if (today.isRest) return { label: t.today.pillRest, tone: 'neutral' };
  switch (today.status) {
    case 'pending':
    case 'upcoming':
      return {
        label: t.today.pillBefore(
          clockTime(today.window.open, plan.timezone),
          countdown(today.window.open - now),
        ),
        tone: 'neutral',
      };
    case 'open': {
      const left = today.window.close - now;
      return {
        label: t.today.pillOpen(countdown(left)),
        tone: left <= LAST_CALL_MS ? 'caution' : 'accent',
      };
    }
    case 'complete':
      return { label: t.today.pillComplete(today.index), tone: 'growth' };
    case 'partial':
    case 'missed':
      return {
        label: t.today.pillClosed(today.index, today.doneCount, today.totalWorks),
        tone: 'decline',
      };
    default:
      return null;
  }
}
