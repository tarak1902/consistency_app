import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '@/copy/en';
import type { Plan, PlanState } from '@/domain/scoring';
import { DOT, clockTime } from './format';

/**
 * Local notifications only. Per plan day (skipping rest days):
 *  - "Check-in is open" at open(D)
 *  - "30 minutes left · 2 of 4 done" at close(D) − 30m, for today only,
 *    rescheduled after every tick.
 * We schedule a rolling 14 days to stay well under iOS's 64-pending limit,
 * and reschedule on foreground and after plan changes.
 */
const PREFS_KEY = 'compound.notifPrefs';
const CHANNEL = 'checkin';
const HORIZON_DAYS = 14;
const LAST_CALL_MS = 30 * 60_000;

export interface NotifPrefs {
  open: boolean;
  lastCall: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { open: true, lastCall: true };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: Partial<NotifPrefs> = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setPrefs(p: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => undefined);
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function permissionState(): Promise<PermissionState> {
  const s = await Notifications.getPermissionsAsync();
  if (s.granted) return 'granted';
  return s.canAskAgain ? 'undetermined' : 'denied';
}

/** Ask contextually (end of the wizard / Settings), never at launch. */
export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Check-in reminders',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const s = await Notifications.requestPermissionsAsync();
  if (s.granted) return 'granted';
  return s.canAskAgain ? 'undetermined' : 'denied';
}

async function at(date: number, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { kind: 'compound' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(date),
      channelId: CHANNEL,
    },
  });
}

let running: Promise<void> | null = null;

/** Rebuild every scheduled reminder from the current plan state. */
export function reschedule(plan: Plan | null, state: PlanState | null, now: number): Promise<void> {
  const job = (running ?? Promise.resolve())
    .then(() => doReschedule(plan, state, now))
    .catch(() => undefined);
  running = job;
  return job;
}

async function doReschedule(
  plan: Plan | null,
  state: PlanState | null,
  now: number,
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!plan || !state || state.effectiveStatus !== 'active') return;
  if ((await permissionState()) !== 'granted') return;
  const prefs = await getPrefs();
  const horizon = now + HORIZON_DAYS * 86_400_000;

  for (const d of state.days) {
    if (d.isRest || d.closed || d.window.open > horizon) continue;
    if (prefs.open && d.window.open > now) {
      await at(
        d.window.open,
        'Check-in is open',
        `Tick today's works before ${clockTime(d.window.close, plan.timezone)}.`,
      );
    }
  }

  const today = state.today;
  if (prefs.lastCall && today && !today.isRest && today.doneCount < today.totalWorks) {
    const when = today.window.close - LAST_CALL_MS;
    if (when > now) {
      await at(
        when,
        `30 minutes left ${DOT} ${today.doneCount} of ${today.totalWorks} done`,
        t.today.dayOf(today.index, plan.durationDays),
      );
    }
  }
}
