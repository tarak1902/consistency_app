import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { qk, type CheckinRow } from './queries';
import { supabase } from './supabase';

/**
 * Keeps devices in sync: any change to the user's plans or checkins
 * invalidates the cached queries. DELETE events can't be filtered by column
 * (and carry only the primary key), so they're matched against cached ids.
 */
export function useRealtimeSync(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const filter = `user_id=eq.${userId}`;
    const channel = supabase
      .channel(`sync:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkins', filter },
        (p) => {
          const planId = (p.new as { plan_id?: string }).plan_id;
          if (planId) qc.invalidateQueries({ queryKey: qk.checkins(planId) });
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'checkins' }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (!id) return;
        for (const [key, rows] of qc.getQueriesData<CheckinRow[]>({ queryKey: ['checkins'] })) {
          if (rows?.some((r) => r.id === id)) qc.invalidateQueries({ queryKey: key });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter }, () => {
        qc.invalidateQueries({ queryKey: qk.plans });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [userId, qc]);
}
