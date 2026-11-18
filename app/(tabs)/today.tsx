import { router } from 'expo-router';
import { ChevronRight, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import {
  Card,
  DeltaBadge,
  EmptyState,
  ErrorState,
  IconButton,
  OfflineBanner,
  ProgressRing,
  Screen,
  SectionLabel,
  Sparkline,
  StatusPill,
  Text,
  TodaySkeleton,
  WorkCheckRow,
  useToast,
} from '@/components';
import { t } from '@/copy/en';
import { useIsOffline } from '@/data/QueryProvider';
import { errorMessage } from '@/data/errors';
import { useToggleCheckin } from '@/data/mutations';
import { useCheckins, usePlanState, usePlans, type PlanBundle } from '@/data/queries';
import type { PlanState } from '@/domain/scoring';
import { deviceTimeZone, displayDayAt, localDateAt } from '@/domain/time';
import { statusLine } from '@/features/today/status';
import { DOT, dayAndTime, longDate, mediumDate, score, signedPct } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { reschedule } from '@/lib/notifications';
import { serverNow, syncServerClock, useServerNow } from '@/lib/serverClock';
import { radius, space, useTheme } from '@/theme';

export default function TodayScreen() {
  const { c } = useTheme();
  const now = useServerNow(10_000);
  const offline = useIsOffline();
  const plans = usePlans();
  const active = useMemo(
    () => plans.data?.find((b) => b.plan.status === 'active') ?? null,
    [plans.data],
  );
  const latest = plans.data?.[0] ?? null;
  const checkins = useCheckins(active?.plan.id);
  const state = usePlanState(active, checkins.data, now);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([plans.refetch(), checkins.refetch(), syncServerClock()]).catch(
      () => undefined,
    );
    setRefreshing(false);
  }, [plans, checkins]);

  const settingsButton = (
    <IconButton
      accessibilityLabel={t.a11y.settingsButton}
      variant="filled"
      icon={<UserRound size={20} color={c.text} />}
      onPress={() => router.push('/settings')}
    />
  );

  const banner = offline ? <OfflineBanner message={t.offline} /> : null;
  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.text3} />
  );

  if (plans.isLoading || (active && checkins.isLoading)) {
    return (
      <Screen banner={banner}>
        <TodaySkeleton />
      </Screen>
    );
  }

  if (plans.isError && !plans.data) {
    return (
      <Screen banner={banner} refreshControl={refresh}>
        <Header eyebrow={t.appName} title={t.today.worksHeader} right={settingsButton} />
        <ErrorState
          message={t.errors.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => void plans.refetch()}
        />
      </Screen>
    );
  }

  if (!active || !state) {
    const finished = latest && latest.plan.status !== 'active' ? latest : null;
    return (
      <Screen banner={banner} refreshControl={refresh}>
        <Header
          eyebrow={t.appName}
          title={longDate(localDateAt(now, deviceTimeZone()))}
          right={settingsButton}
        />
        {finished ? <FinishedCard planId={finished.plan.id} /> : null}
        <EmptyState
          title={t.today.noPlanTitle}
          body={t.today.noPlanBody}
          actionLabel={t.today.noPlanCta}
          onAction={() =>
            router.push(
              finished
                ? { pathname: '/plan/new', params: { from: finished.plan.id } }
                : '/plan/new',
            )
          }
        />
      </Screen>
    );
  }

  return (
    <ActivePlan
      bundle={active}
      state={state}
      now={now}
      banner={banner}
      refresh={refresh}
      settingsButton={settingsButton}
    />
  );
}

function Header({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <Text variant="subhead" tone="secondary">
          {eyebrow}
        </Text>
        <Text variant="title2" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

function FinishedCard({ planId }: { planId: string }) {
  const { c } = useTheme();
  return (
    <Card
      onPress={() => router.push({ pathname: '/results/[id]', params: { id: planId } })}
      accessibilityLabel={`${t.today.planFinished}. ${t.today.seeResults}`}
    >
      <View style={styles.rowCenter}>
        <View style={styles.flex}>
          <Text variant="headline">{t.today.planFinished}</Text>
          <Text variant="callout" tone="secondary">
            {t.today.planFinishedBody}
          </Text>
        </View>
        <Text variant="callout" tone="accent">
          {t.today.seeResults}
        </Text>
        <ChevronRight size={18} color={c.accent} />
      </View>
    </Card>
  );
}

interface ActiveProps {
  bundle: PlanBundle;
  state: PlanState;
  now: number;
  banner: React.ReactNode;
  refresh: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  settingsButton: React.ReactNode;
}

function ActivePlan({ bundle, state, now, banner, refresh, settingsButton }: ActiveProps) {
  const { c } = useTheme();
  const toast = useToast();
  const reduce = useReducedMotion();
  const offline = useIsOffline();
  const { plan, works } = bundle;
  const toggle = useToggleCheckin(plan.id);
  const today = state.today;
  const stats = state.stats;
  const pill = statusLine(plan, state, now);
  const allTicked = !!today && today.totalWorks > 0 && today.doneCount === today.totalWorks;
  const finished = state.phase === 'finished';

  // Keep local reminders in step with the plan and today's ticks.
  const doneCount = today?.doneCount ?? -1;
  const day = today?.day ?? '';
  useEffect(() => {
    reschedule(plan, state, now).catch(() => undefined);
    // Re-run only when the plan, the day or today's tick count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, day, doneCount, state.phase]);

  // ...and rebuild them whenever the app returns to the foreground.
  const latest = useRef({ plan, state, now });
  useEffect(() => {
    latest.current = { plan, state, now };
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const l = latest.current;
      reschedule(l.plan, l.state, serverNow()).catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  const sparkValues = useMemo(() => state.overallSeries.map((p) => p.value), [state.overallSeries]);
  const sparkTarget = useMemo(() => state.targetSeries.map((p) => p.value), [state.targetSeries]);

  const onTick = (workId: string) => {
    if (finished) {
      haptics.warning();
      toast.show(t.today.lockedEnded);
      return;
    }
    if (!today || today.isRest) {
      haptics.warning();
      toast.show(today?.isRest ? t.today.lockedRest : t.errors.OUTSIDE_PLAN);
      return;
    }
    if (today.status !== 'open') {
      haptics.warning();
      toast.show(
        state.nextOpen
          ? t.today.lockedToast(dayAndTime(state.nextOpen, plan.timezone))
          : t.errors.WINDOW_CLOSED,
      );
      return;
    }
    if (offline) {
      haptics.warning();
      toast.show(t.errors.offlineTick, 'caution');
      return;
    }
    const checked = !today.doneWorkIds.has(workId);
    const completesDay = checked && today.doneCount + 1 === today.totalWorks;
    if (completesDay) haptics.success();
    else haptics.selection();
    toggle.mutate(
      { workId, planDay: today.day, checked },
      {
        onError: (e) => {
          haptics.warning();
          toast.show(errorMessage(e, plan.timezone), 'decline');
        },
      },
    );
  };

  const eyebrow = today
    ? t.today.dayOf(today.index, plan.durationDays)
    : finished
      ? t.today.planFinished
      : t.wizard.startsOn(mediumDate(plan.startDate));
  const dateTitle = longDate(today?.day ?? displayDayAt(now, plan));
  const perWork = new Map(stats.perWork.map((w) => [w.workId, w]));

  return (
    <Screen banner={banner} refreshControl={refresh}>
      <Header eyebrow={eyebrow} title={dateTitle} right={settingsButton} />
      {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
      {finished ? <FinishedCard planId={plan.id} /> : null}

      <Card
        size="lg"
        accessibilityLabel={t.a11y.scoreHero(
          score(stats.currentScore),
          signedPct(stats.lastDelta ?? 0),
        )}
      >
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text variant="subhead" tone="secondary">
              {t.today.consistency}
            </Text>
            <View style={styles.scoreRow}>
              <Text variant="display" numeric>
                {score(stats.currentScore)}
              </Text>
              <DeltaBadge delta={stats.lastDelta} />
            </View>
            <Text variant="callout" tone="secondary" numeric>
              {t.today.perfectPath(score(stats.perfectScore), signedPct(stats.gapPct))}
            </Text>
          </View>
          {today && !today.isRest ? (
            <ProgressRing
              progress={today.totalWorks ? today.doneCount / today.totalWorks : 0}
              color={allTicked ? c.growth : c.accent}
              size={52}
              stroke={5}
              accessibilityLabel={t.today.progressOf(today.doneCount, today.totalWorks)}
            >
              <Text variant="caption" numeric tone="secondary">
                {`${today.doneCount}/${today.totalWorks}`}
              </Text>
            </ProgressRing>
          ) : null}
        </View>
        {sparkValues.length > 1 ? (
          <View style={styles.spark}>
            <Sparkline values={sparkValues} target={sparkTarget} height={36} />
          </View>
        ) : null}
        {allTicked && today?.status === 'open' ? (
          <Animated.View
            entering={reduce ? undefined : FadeIn.duration(240)}
            style={[styles.complete, { backgroundColor: c.growthSoft }]}
          >
            <Text variant="headline" tone="growth">
              {t.today.dayComplete}
            </Text>
            <Text variant="callout" tone="secondary">
              {t.today.dayCompleteBody}
            </Text>
          </Animated.View>
        ) : null}
      </Card>

      {today?.stakes ? (
        <View style={styles.stakes} accessibilityRole="summary">
          <View style={[styles.stake, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text variant="caption" tone="secondary">
              {t.today.stakesIfAll}
            </Text>
            <Text variant="headline" tone="growth" numeric>
              {t.today.stakesAll(today.totalWorks, score(today.stakes.ifAllDone))}
            </Text>
          </View>
          <View style={[styles.stake, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text variant="caption" tone="secondary">
              {t.today.stakesIfMissed}
            </Text>
            <Text variant="headline" tone="decline" numeric>
              {t.today.stakesAny(score(today.stakes.ifAnyMissed))}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: space.xs }}>
        <SectionLabel
          right={
            today && !today.isRest ? (
              <Text variant="caption" tone="tertiary" numeric>
                {t.today.progressOf(today.doneCount, today.totalWorks)}
              </Text>
            ) : undefined
          }
        >
          {t.today.worksHeader}
        </SectionLabel>
        <Card padded={false} style={styles.worksCard}>
          {works.map((w, i) => {
            const ws = perWork.get(w.id);
            const checked = !!today?.doneWorkIds.has(w.id);
            return (
              <WorkCheckRow
                key={w.id}
                title={w.title}
                criteria={w.doneCriteria}
                colorIndex={w.colorIndex}
                score={ws?.score ?? 100}
                lastDelta={ws?.lastDelta ?? null}
                checked={checked}
                locked={!today || today.status !== 'open' || finished}
                pending={toggle.isPending && toggle.variables?.workId === w.id}
                onPress={() => onTick(w.id)}
                isLast={i === works.length - 1}
              />
            );
          })}
        </Card>
        {today?.isRest ? (
          <Text variant="callout" tone="secondary">
            {t.today.restBody}
          </Text>
        ) : null}
      </View>

      <Card
        onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
        accessibilityLabel={t.plan.detailsTitle}
      >
        <View style={styles.rowCenter}>
          <Text variant="body" style={styles.flex}>
            {t.plan.detailsTitle}
          </Text>
          <Text variant="callout" tone="secondary" numeric>
            {`${Math.round(plan.rate * 100)}% ${DOT} ${t.common.days(plan.durationDays)}`}
          </Text>
          <ChevronRight size={18} color={c.text3} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
  spark: { marginTop: space.md },
  complete: { marginTop: space.md, borderRadius: radius.card, padding: space.sm, gap: 2 },
  stakes: { flexDirection: 'row', gap: space.sm },
  stake: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.sm,
    gap: 2,
  },
  worksCard: { paddingHorizontal: space.md },
});
