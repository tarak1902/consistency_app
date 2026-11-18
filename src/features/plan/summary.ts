import { t } from '@/copy/en';
import type { PlanState, Work, WorkStats } from '@/domain/scoring';

export interface RankedWork {
  work: Work;
  stats: WorkStats;
}

/** Works sorted by score, highest first (ties keep plan order). */
export function rankWorks(works: readonly Work[], state: PlanState): RankedWork[] {
  const byId = new Map(state.stats.perWork.map((s) => [s.workId, s]));
  return works
    .map((work, i) => ({ work, stats: byId.get(work.id), i }))
    .filter((x): x is { work: Work; stats: WorkStats; i: number } => !!x.stats)
    .sort((a, b) => b.stats.score - a.stats.score || a.i - b.i)
    .map(({ work, stats }) => ({ work, stats }));
}

/** One honest sentence about how the plan went. */
export function summarySentence(works: readonly Work[], state: PlanState): string {
  const s = state.stats;
  if (s.closedNonRestDays === 0) return t.results.summaryNone;
  const ranked = rankWorks(works, state);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const spread = best && worst ? best.stats.score - worst.stats.score : 0;
  return t.results.summary(
    s.completeDays,
    s.closedNonRestDays,
    ranked.length > 1 && spread > 1e-9 ? (best?.work.title ?? null) : null,
    ranked.length > 1 && spread > 1e-9 ? (worst?.work.title ?? null) : null,
  );
}

/** Text summary of the overall trend, for chart accessibility labels. */
export function overallTrendLabel(state: PlanState): string {
  const pts = state.overallSeries;
  const last = pts[pts.length - 1];
  if (pts.length < 2 || !last) return t.progress.chartA11yEmpty;
  return t.progress.chartA11y(
    state.stats.closedDays,
    (pts[0]?.value ?? 100).toFixed(1),
    last.value.toFixed(1),
    state.stats.perfectScore.toFixed(1),
  );
}
