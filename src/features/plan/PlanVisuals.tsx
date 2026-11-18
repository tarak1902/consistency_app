import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Chip,
  ColorDot,
  DeltaBadge,
  HeatmapCalendar,
  LineChart,
  SectionLabel,
  SegmentedControl,
  StatTile,
  Text,
  type ChartSeries,
} from '@/components';
import { t } from '@/copy/en';
import type { PlanState, Work } from '@/domain/scoring';
import { DOT, mediumDate, pct, score, signedPct } from '@/lib/format';
import { space, useTheme } from '@/theme';
import { overallTrendLabel, rankWorks } from './summary';

type Mode = 'overall' | 'works';

interface Props {
  planId: string;
  works: readonly Work[];
  state: PlanState;
}

/** Charts, stats and calendar for a plan. Used by Progress, plan detail and Results. */
export const PlanVisuals = memo(function PlanVisuals({ planId, works, state }: Props) {
  const [mode, setMode] = useState<Mode>('overall');
  return (
    <View style={styles.gap}>
      <SegmentedControl
        options={[
          { value: 'overall', label: t.progress.overall },
          { value: 'works', label: t.progress.eachWork },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel={t.progress.title}
      />
      {mode === 'overall' ? (
        <OverallView key={`o-${planId}`} state={state} />
      ) : (
        <WorksView key={`w-${planId}`} works={works} state={state} />
      )}
      <View style={styles.sectionGap}>
        <SectionLabel>{t.progress.heatmap}</SectionLabel>
        <Card size="lg">
          <HeatmapCalendar days={state.days} />
        </Card>
      </View>
    </View>
  );
});

function OverallView({ state }: { state: PlanState }) {
  const { c } = useTheme();
  const s = state.stats;
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'target',
        color: c.target,
        values: state.targetSeries.map((p) => p.value),
        dashed: true,
      },
      {
        key: 'overall',
        color: c.accent,
        values: state.overallSeries.map((p) => p.value),
        markIndices: state.overallSeries
          .filter((p) => p.status === 'partial' || p.status === 'missed')
          .map((p) => p.index),
        markColor: c.decline,
      },
    ],
    [state.overallSeries, state.targetSeries, c],
  );

  const tooltip = (i: number) => {
    const p = state.overallSeries[i];
    if (!p) return null;
    return (
      <View>
        <Text variant="caption" tone="secondary" numeric>
          {p.day ? t.progress.tooltip(p.index, mediumDate(p.day)) : t.progress.status.start}
        </Text>
        <Text variant="callout" numeric>
          {`${score(p.value)} ${DOT} ${t.progress.status[p.status] ?? ''}`}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.gap}>
      <Card size="lg">
        {state.overallSeries.length > 1 ? (
          <LineChart
            series={series}
            scrubKey="overall"
            renderTooltip={tooltip}
            accessibilityLabel={overallTrendLabel(state)}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text variant="callout" tone="secondary" align="center">
              {t.progress.noData}
            </Text>
          </View>
        )}
      </Card>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <StatTile
            label={t.progress.stats.current}
            value={score(s.currentScore)}
            sub={<DeltaBadge delta={s.lastDelta} size="sm" bare />}
          />
          <StatTile label={t.progress.stats.perfect} value={score(s.perfectScore)} />
        </View>
        <View style={styles.gridRow}>
          <StatTile
            label={t.progress.stats.gap}
            value={signedPct(s.gapPct)}
            valueColor={s.gapPct < -1e-9 ? c.decline : undefined}
          />
          <StatTile
            label={t.progress.stats.completion}
            value={pct(s.completionRate)}
            sub={t.progress.daysCount(s.completeDays, s.closedNonRestDays)}
          />
        </View>
        <View style={styles.gridRow}>
          <StatTile label={t.progress.stats.streak} value={t.common.days(s.currentStreak)} />
          <StatTile label={t.progress.stats.best} value={t.common.days(s.bestStreak)} />
        </View>
      </View>
    </View>
  );
}

function WorksView({ works, state }: { works: readonly Work[]; state: PlanState }) {
  const { c, work } = useTheme();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const series = useMemo<ChartSeries[]>(
    () =>
      works.map((w) => ({
        key: w.id,
        color: work(w.colorIndex),
        values: (state.perWorkSeries[w.id] ?? []).map((p) => p.value),
        hidden: hidden.has(w.id),
      })),
    [works, state.perWorkSeries, hidden, work],
  );
  const ranked = useMemo(() => rankWorks(works, state), [works, state]);
  const a11y = t.progress.workChartA11y(
    ranked.map((r) => `${r.work.title} ${score(r.stats.score)}`).join(', '),
  );

  return (
    <View style={styles.gap}>
      <Card size="lg">
        {state.overallSeries.length > 1 ? (
          <LineChart series={series} accessibilityLabel={a11y} height={220} />
        ) : (
          <View style={styles.emptyChart}>
            <Text variant="callout" tone="secondary" align="center">
              {t.progress.noData}
            </Text>
          </View>
        )}
        <View style={styles.chips}>
          {works.map((w) => (
            <Chip
              key={w.id}
              label={w.title}
              selected={!hidden.has(w.id)}
              color={work(w.colorIndex)}
              leading={<ColorDot color={work(w.colorIndex)} size={8} />}
              onPress={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(w.id)) next.delete(w.id);
                  else if (works.length - next.size > 1) next.add(w.id);
                  return next;
                })
              }
            />
          ))}
        </View>
      </Card>
      <Card>
        {ranked.map(({ work: w, stats }, i) => (
          <View
            key={w.id}
            accessible
            accessibilityLabel={`${i + 1}. ${w.title}, score ${score(stats.score)}, ${signedPct(stats.deltaSinceStart)} since start, ${t.progress.daysCount(stats.doneCount, state.stats.closedNonRestDays)}`}
            style={[
              styles.rankRow,
              i < ranked.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              },
            ]}
          >
            <ColorDot color={work(w.colorIndex)} />
            <View style={styles.flex}>
              <Text variant="headline" numberOfLines={1}>
                {w.title}
              </Text>
              <Text variant="caption" tone="tertiary" numeric>
                {t.progress.daysCount(stats.doneCount, state.stats.closedNonRestDays)}
              </Text>
            </View>
            <View style={styles.rankRight}>
              <Text variant="headline" numeric>
                {score(stats.score)}
              </Text>
              <DeltaBadge delta={stats.deltaSinceStart} size="sm" bare />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  sectionGap: { gap: space.xs, marginTop: space.xs },
  grid: { gap: space.sm },
  gridRow: { flexDirection: 'row', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md },
  emptyChart: { height: 160, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rankRight: { alignItems: 'flex-end', gap: 2 },
});
