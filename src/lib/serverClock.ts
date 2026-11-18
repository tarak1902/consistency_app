import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/data/supabase';
import { parseTimestamp } from '@/data/timestamps';

/**
 * The server's clock is the time authority. We measure the offset between the
 * device clock and Postgres now() (correcting for half the round trip) and use
 * `serverNow()` for every countdown and state on the client.
 */
const KEY = 'compound.clockOffset';
let offset = 0;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    const n = Number(v);
    if (v !== null && Number.isFinite(n)) {
      offset = n;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => undefined);

export function serverNow(): number {
  return Date.now() + offset;
}

export async function syncServerClock(): Promise<void> {
  const t0 = Date.now();
  const { data, error } = await supabase.rpc('server_time');
  const t1 = Date.now();
  if (error || typeof data !== 'string') return;
  // Very slow round trips give a poor estimate; keep the previous offset.
  if (t1 - t0 > 5000) return;
  offset = parseTimestamp(data) - (t0 + t1) / 2;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, String(offset)).catch(() => undefined);
}

/** Re-renders every `tickMs` (and on foreground or resync) with server time. */
export function useServerNow(tickMs = 10_000): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const update = () => setNow(serverNow());
    listeners.add(update);
    const id = setInterval(update, tickMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        update();
        syncServerClock().catch(() => undefined);
      }
    });
    return () => {
      listeners.delete(update);
      clearInterval(id);
      sub.remove();
    };
  }, [tickMs]);
  return now;
}
