import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { computePlanState, type PlanState } from '@/domain/scoring';
import {
  qk,
  useCheckins,
  usePlanState,
  usePlans,
  type CheckinRow,
  type PlanBundle,
} from '@/data/queries';
import { supabase } from '@/data/supabase';
import { useServerNow } from '@/lib/serverClock';

/** A plan bundle plus its computed state at server time. */
export function usePlanComputed(planId: string | undefined, tickMs = 60_000) {
  const plans = usePlans();
  const bundle = useMemo(
    () => plans.data?.find((b) => b.plan.id === planId) ?? null,
    [plans.data, planId],
  );
  const checkins = useCheckins(bundle?.plan.id);
  const now = useServerNow(tickMs);
  const state = usePlanState(bundle, checkins.data, now);
  return {
    bundle,
    state,
    now,
    isLoading: plans.isLoading || (!!bundle && checkins.isLoading),
    isError: (plans.isError && !plans.data) || (checkins.isError && !checkins.data),
    refetch: () => {
      void plans.refetch();
      void checkins.refetch();
    },
  };
}

async function fetchCheckins(planId: string): Promise<CheckinRow[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, work_id, plan_day')
    .eq('plan_id', planId);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, workId: r.work_id, planDay: r.plan_day }));
}

/** Computed states for many plans at once (History). */
export function useManyPlanStates(bundles: readonly PlanBundle[]): {
  states: Map<string, PlanState>;
  isLoading: boolean;
} {
  const now = useServerNow(60_000);
  const results = useQueries({
    queries: bundles.map((b) => ({
      queryKey: qk.checkins(b.plan.id),
      queryFn: () => fetchCheckins(b.plan.id),
    })),
  });
  // A cheap signature that changes whenever any plan's checkins change.
  const signature = results.map((r) => r.dataUpdatedAt).join(',');
  const datas = results.map((r) => r.data);
  const states = useMemo(() => {
    const m = new Map<string, PlanState>();
    bundles.forEach((b, i) => {
      const d = datas[i];
      if (d) m.set(b.plan.id, computePlanState(b.plan, b.works, d, now));
    });
    return m;
    // `datas` is a fresh array each render; `signature` tracks its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundles, now, signature]);
  return { states, isLoading: results.some((r) => r.isLoading) };
}
