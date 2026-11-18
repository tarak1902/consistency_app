import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IsoDate } from '@/domain/time';
import { AppError } from './errors';
import { qk, type CheckinRow } from './queries';
import { supabase } from './supabase';

interface ToggleVars {
  workId: string;
  planDay: IsoDate;
  /** true = tick, false = untick */
  checked: boolean;
}

/** Optimistic tick/untick with rollback. The server decides the plan day. */
export function useToggleCheckin(planId: string | undefined) {
  const qc = useQueryClient();
  const key = qk.checkins(planId ?? 'none');
  return useMutation({
    mutationKey: ['toggle', planId],
    networkMode: 'always',
    mutationFn: async ({ workId, checked }: ToggleVars) => {
      if (checked) {
        const { data, error } = await supabase.rpc('check_in', { p_work_id: workId });
        if (error) throw error;
        return data;
      }
      const { error } = await supabase.rpc('uncheck', { p_work_id: workId });
      if (error) throw error;
      return null;
    },
    onMutate: async ({ workId, planDay, checked }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CheckinRow[]>(key);
      qc.setQueryData<CheckinRow[]>(key, (rows = []) => {
        const rest = rows.filter((r) => !(r.workId === workId && r.planDay === planDay));
        return checked
          ? [...rest, { id: `optimistic-${workId}-${planDay}`, workId, planDay }]
          : rest;
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export interface CreatePlanInput {
  rate: number;
  durationDays: number;
  restWeekdays: number[];
  sleepTime: string;
  timezone: string;
  works: { title: string; done_criteria: string | null }[];
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const { data, error } = await supabase.rpc('create_plan', {
        p_rate: input.rate,
        p_duration_days: input.durationDays,
        p_rest_weekdays: input.restWeekdays,
        p_sleep_time: input.sleepTime,
        p_timezone: input.timezone,
        p_works: input.works,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}

export function useEndPlanEarly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, confirm }: { planId: string; confirm: string }) => {
      const { error } = await supabase.rpc('end_plan_early', {
        p_plan_id: planId,
        p_confirm: confirm,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.plans }),
  });
}

/** Calls the delete-account Edge Function; the server deletes the auth user. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error)
    throw new AppError(error.name === 'FunctionsFetchError' ? 'NETWORK' : 'UNKNOWN', error.message);
}
