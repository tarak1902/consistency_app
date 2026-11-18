import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  ChartSkeleton,
  ColorDot,
  DeltaBadge,
  ErrorState,
  LineChart,
  Screen,
  SectionLabel,
  StatTile,
  Text,
  type ChartSeries,
} from '@/components';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { overallTrendLabel, rankWorks, summarySentence } from '@/features/plan/summary';
import { usePlanComputed } from '@/features/plan/usePlanComputed';
import { useCurrentPlan } from '@/data/queries';
import { dateRange, pct, score, signedPct } from '@/lib/format';
import { space, useTheme } from '@/theme';

export default function Results() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, work } = useTheme();
  const { bundle, state, isLoading, isError, refetch } = usePlanComputed(id);
  const current = useCurrentPlan();

  const series = useMemo<ChartSeries[]>(
    () =>
      state
        ? [
            {
              key: 'target',
              color: c.target,
              values: state.targetSeries.map((p) => p.value),
              dashed: true,
            },
            { key: 'overall', color: c.accent, values: state.overallSeries.map((p) => p.value) },
          ]
        : [],
    [state, c],
  );

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t.results.title} />
        <ChartSkeleton />
      </Screen>
    );
  }
  if (isError || !bundle || !state) {
    return (
      <Screen>
        <ScreenHeader title={t.results.title} />
        <ErrorState message={t.errors.loadFailed} retryLabel={t.common.retry} onRetry={refetch} />
      </Screen>
    );
  }

  const { plan, works } = bundle;
  const s = state.stats;
  const ranked = rankWorks(works, state);
  const otherActive = current.bundle && current.bundle.plan.id !== plan.id;

  return (
    <Screen
      footer={
        otherActive ? undefined : (
          <Button
            label={t.results.startNext}
            onPress={() => router.push({ pathname: '/plan/new', params: { from: plan.id } })}
          />
        )
      }
    >
      <ScreenHeader eyebrow={dateRange(plan.startDate, plan.endDate)} title={t.results.title} />

      <Card size="lg">
        <Text variant="subhead" tone="secondary">
          {t.results.finalScore}
        </Text>
        <View style={styles.scoreRow}>
          <Text variant="display" numeric>
            {score(s.currentScore)}
          </Text>
          <DeltaBadge delta={s.currentScore / 100 - 1} />
        </View>
        <Text variant="callout" tone="secondary" numeric>
          {`${t.results.vsPerfect(score(s.perfectScore))} · ${signedPct(s.gapPct)}`}
        </Text>
        {state.overallSeries.length > 1 ? (
          <View style={styles.chart}>
            <LineChart series={series} height={160} accessibilityLabel={overallTrendLabel(state)} />
          </View>
        ) : null}
      </Card>

      <Text variant="body">{summarySentence(works, state)}</Text>

      <View style={styles.row}>
        <StatTile
          label={t.results.completion}
          value={pct(s.completionRate)}
          sub={t.progress.daysCount(s.completeDays, s.closedNonRestDays)}
        />
        <StatTile label={t.results.bestStreak} value={t.common.days(s.bestStreak)} />
      </View>

      <View style={styles.section}>
        <SectionLabel>{t.results.ranking}</SectionLabel>
        <Card>
          {ranked.map(({ work: w, stats }, i) => (
            <View
              key={w.id}
              accessible
              accessibilityLabel={`${i + 1}. ${w.title}, ${score(stats.score)}, ${t.progress.daysCount(stats.doneCount, s.closedNonRestDays)}`}
              style={[
                styles.rank,
                i < ranked.length - 1 && {
                  borderBottomColor: c.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text variant="callout" tone="tertiary" numeric style={styles.pos}>
                {i + 1}
              </Text>
              <ColorDot color={work(w.colorIndex)} />
              <View style={styles.flex}>
                <Text variant="headline">{w.title}</Text>
                <Text variant="caption" tone="tertiary" numeric>
                  {t.progress.daysCount(stats.doneCount, s.closedNonRestDays)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text variant="headline" numeric>
                  {score(stats.score)}
                </Text>
                <DeltaBadge delta={stats.deltaSinceStart} size="sm" bare />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
  chart: { marginTop: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  section: { gap: space.xs },
  rank: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  pos: { width: 18 },
  right: { alignItems: 'flex-end', gap: 2 },
});
