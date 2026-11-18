import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  computePlanState,
  type Checkin,
  type Plan,
  type PlanState,
  type Work,
} from '@/domain/scoring';
import type { Tables } from './database.types';
import { supabase } from './supabase';
import { parseTimestamp } from './timestamps';

export interface PlanBundle {
  plan: Plan;
  works: Work[];
}

export interface CheckinRow extends Checkin {
  id: string;
}

export const qk = {
  plans: ['plans'] as const,
  checkins: (planId: string) => ['checkins', planId] as const,
  profile: ['profile'] as const,
};

export function toPlan(row: Tables<'plans'>): Plan {
  return {
    id: row.id,
    rate: Number(row.rate),
    durationDays: row.duration_days,
    restWeekdays: row.rest_weekdays ?? [],
    sleepTime: row.sleep_time,
    timezone: row.timezone,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    endedAt: row.ended_at ? parseTimestamp(row.ended_at) : null,
    createdAt: parseTimestamp(row.created_at),
  };
}

export function toWork(row: Tables<'works'>): Work {
  return {
    id: row.id,
    planId: row.plan_id,
    title: row.title,
    doneCriteria: row.done_criteria,
    colorIndex: row.color_index,
    position: row.position,
  };
}

async function fetchPlans(): Promise<PlanBundle[]> {
  const [plans, works] = await Promise.all([
    supabase.from('plans').select('*').order('created_at', { ascending: false }),
    supabase.from('works').select('*').order('position', { ascending: true }),
  ]);
  if (plans.error) throw plans.error;
  if (works.error) throw works.error;
  const byPlan = new Map<string, Work[]>();
  for (const w of works.data) {
    const list = byPlan.get(w.plan_id) ?? [];
    list.push(toWork(w));
    byPlan.set(w.plan_id, list);
  }
  return plans.data.map((p) => ({ plan: toPlan(p), works: byPlan.get(p.id) ?? [] }));
}

async function fetchCheckins(planId: string): Promise<CheckinRow[]> {
  const { data, error } = await supabase
    .from('checkins')
    .select('id, work_id, plan_day')
    .eq('plan_id', planId);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, workId: r.work_id, planDay: r.plan_day }));
}

export function usePlans(enabled = true) {
  return useQuery({ queryKey: qk.plans, queryFn: fetchPlans, enabled });
}

/** The user's active plan (as stored), if any. */
export function useCurrentPlan(enabled = true): {
  bundle: PlanBundle | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const q = usePlans(enabled);
  const bundle = useMemo(() => q.data?.find((b) => b.plan.status === 'active') ?? null, [q.data]);
  return {
    bundle,
    isLoading: q.isLoading,
    isError: q.isError && !q.data,
    refetch: () => void q.refetch(),
  };
}

export function usePlanBundle(planId: string | undefined): PlanBundle | null {
  const q = usePlans(!!planId);
  return useMemo(() => q.data?.find((b) => b.plan.id === planId) ?? null, [q.data, planId]);
}

export function useCheckins(planId: string | undefined) {
  return useQuery({
    queryKey: qk.checkins(planId ?? 'none'),
    queryFn: () => fetchCheckins(planId ?? ''),
    enabled: !!planId,
  });
}

/** Memoized scoring for a plan bundle at a given server time. */
export function usePlanState(
  bundle: PlanBundle | null,
  checkins: readonly Checkin[] | undefined,
  now: number,
): PlanState | null {
  return useMemo(() => {
    if (!bundle || !checkins) return null;
    return computePlanState(bundle.plan, bundle.works, checkins, now);
  }, [bundle, checkins, now]);
}

export async function fetchProfileName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  return data?.display_name ?? null;
}

export function useProfileName(userId: string | undefined) {
  return useQuery({
    queryKey: [...qk.profile, userId],
    queryFn: () => fetchProfileName(userId ?? ''),
    enabled: !!userId,
  });
}

/** Everything the user owns, for export. */
export async function fetchExport(): Promise<{
  plans: Tables<'plans'>[];
  works: Tables<'works'>[];
  checkins: Tables<'checkins'>[];
}> {
  const [plans, works, checkins] = await Promise.all([
    supabase.from('plans').select('*').order('created_at'),
    supabase.from('works').select('*').order('position'),
    supabase.from('checkins').select('*').order('plan_day'),
  ]);
  if (plans.error) throw plans.error;
  if (works.error) throw works.error;
  if (checkins.error) throw checkins.error;
  return { plans: plans.data, works: works.data, checkins: checkins.data };
}
