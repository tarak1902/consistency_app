import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  OfflineBanner,
  Pill,
  Screen,
  Skeleton,
  Sparkline,
  Text,
} from '@/components';
import { t } from '@/copy/en';
import { useIsOffline } from '@/data/QueryProvider';
import { usePlans, type PlanBundle } from '@/data/queries';
import type { PlanState } from '@/domain/scoring';
import { useManyPlanStates } from '@/features/plan/usePlanComputed';
import { DOT, dateRange, pct, score } from '@/lib/format';
import { radius, space } from '@/theme';

export default function HistoryScreen() {
  const offline = useIsOffline();
  const plans = usePlans();
  const all = useMemo(() => plans.data ?? [], [plans.data]);
  const { states, isLoading } = useManyPlanStates(all);
  // A plan is history once it is (effectively) no longer active.
  const past = all.filter((b) => {
    const s = states.get(b.plan.id);
    return b.plan.status !== 'active' || s?.effectiveStatus !== 'active';
  });
  const hasActive = all.some((b) => states.get(b.plan.id)?.effectiveStatus === 'active');
  const latestPast = past[0];

  return (
    <Screen banner={offline ? <OfflineBanner message={t.offline} /> : null}>
      <Text variant="title1" accessibilityRole="header">
        {t.history.title}
      </Text>
      {plans.isLoading || (isLoading && past.length === 0 && all.length > 0) ? (
        <View style={{ gap: space.sm }}>
          <Skeleton height={132} rounded={radius.card} />
          <Skeleton height={132} rounded={radius.card} />
        </View>
      ) : plans.isError && !plans.data ? (
        <ErrorState
          message={t.errors.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => void plans.refetch()}
        />
      ) : past.length === 0 ? (
        <EmptyState title={t.history.title} body={t.history.empty} tone="plain" />
      ) : (
        <View style={{ gap: space.sm }}>
          {past.map((b) => (
            <HistoryCard key={b.plan.id} bundle={b} state={states.get(b.plan.id) ?? null} />
          ))}
        </View>
      )}
      {!hasActive && latestPast ? (
        <Button
          label={t.history.startNew}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/plan/new', params: { from: latestPast.plan.id } })
          }
        />
      ) : null}
    </Screen>
  );
}

function HistoryCard({ bundle, state }: { bundle: PlanBundle; state: PlanState | null }) {
  const { plan } = bundle;
  const ended = (state?.effectiveStatus ?? plan.status) === 'ended_early';
  const values = useMemo(() => state?.overallSeries.map((p) => p.value) ?? [], [state]);
  const target = useMemo(() => state?.targetSeries.map((p) => p.value) ?? [], [state]);
  const s = state?.stats;
  return (
    <Card
      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
      accessibilityLabel={`${dateRange(plan.startDate, plan.endDate)}. ${ended ? t.history.endedEarly : t.history.completed}.${
        s
          ? ` ${t.history.finalVsPerfect(score(s.currentScore), score(s.perfectScore))}. ${t.history.completion(pct(s.completionRate))}.`
          : ''
      }`}
    >
      <View style={styles.top}>
        <Text variant="headline" numeric style={styles.flex}>
          {dateRange(plan.startDate, plan.endDate)}
        </Text>
        <Pill
          label={ended ? t.history.endedEarly : t.history.completed}
          tone={ended ? 'decline' : 'growth'}
        />
      </View>
      {s ? (
        <>
          <Text variant="callout" tone="secondary" numeric style={styles.line}>
            {`${t.history.finalVsPerfect(score(s.currentScore), score(s.perfectScore))} ${DOT} ${t.history.completion(pct(s.completionRate))}`}
          </Text>
          {values.length > 1 ? (
            <View style={styles.spark}>
              <Sparkline values={values} target={target} height={28} />
            </View>
          ) : null}
        </>
      ) : (
        <Skeleton width={200} height={14} style={styles.line} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line: { marginTop: space.xs },
  spark: { marginTop: space.sm },
});
