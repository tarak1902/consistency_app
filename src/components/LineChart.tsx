import {
  Circle,
  DashPathEffect,
  Line as SkLine,
  useFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { memo, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { haptics } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';

const INTER = require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf');

export interface ChartSeries {
  key: string;
  color: string;
  /** One value per x index (0..length-1). */
  values: readonly number[];
  dashed?: boolean;
  hidden?: boolean;
  width?: number;
  /** Indices that get a small marker dot (e.g. days that weren't complete). */
  markIndices?: readonly number[];
  markColor?: string;
}

interface Props {
  series: readonly ChartSeries[];
  height?: number;
  /** Series whose value the scrub indicator follows. Defaults to the first. */
  scrubKey?: string;
  /** Tooltip content for a scrubbed x index. */
  renderTooltip?: (index: number) => ReactNode;
  formatX?: (index: number) => string;
  accessibilityLabel: string;
  /** Skip axes (used for small previews). */
  minimal?: boolean;
}

type Row = Record<string, number>;

function niceDomain(series: readonly ChartSeries[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    if (s.hidden) continue;
    for (const v of s.values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) return [90, 110];
  const span = Math.max(max - min, 4);
  return [Math.floor((min - span * 0.08) / 2) * 2, Math.ceil((max + span * 0.08) / 2) * 2];
}

/**
 * Linear-axis line chart with an optional dashed series and a scrub gesture.
 * Plans are capped at 90 days, so a linear y-axis stays readable.
 */
export const LineChart = memo(function LineChart({
  series,
  height = 220,
  scrubKey,
  renderTooltip,
  formatX,
  accessibilityLabel,
  minimal = false,
}: Props) {
  const { c } = useTheme();
  const font = useFont(INTER, 11);
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const length = series[0]?.values.length ?? 0;
  const followKey = scrubKey ?? keys[0] ?? 'y0';

  const data = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (let i = 0; i < length; i += 1) {
      const row: Row = { x: i };
      for (const s of series) row[s.key] = s.values[i] ?? s.values[s.values.length - 1] ?? 100;
      rows.push(row);
    }
    return rows;
  }, [series, length]);

  const domain = useMemo(() => niceDomain(series), [series]);

  const init = useMemo(() => {
    const y: Record<string, number> = {};
    for (const k of keys) y[k] = 0;
    return { x: 0, y };
    // The key set is stable for the life of a chart (callers key the chart by plan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { state, isActive } = useChartPressState(init);
  const [active, setActive] = useState(-1);

  useAnimatedReaction(
    () => (state.isActive.value ? state.matchedIndex.value : -1),
    (v, prev) => {
      if (v !== prev) runOnJS(setActive)(v);
    },
  );

  const onIndexChange = (i: number) => {
    if (i >= 0) haptics.selection();
  };
  useAnimatedReaction(
    () => state.matchedIndex.value,
    (v, prev) => {
      if (state.isActive.value && v !== prev) runOnJS(onIndexChange)(v);
    },
  );

  if (length < 2) {
    return <View style={{ height }} accessibilityLabel={accessibilityLabel} accessible />;
  }

  const follow = state.y[followKey];

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={{ height }}>
        <CartesianChart<Row, 'x', string>
          data={data}
          xKey="x"
          yKeys={keys}
          domain={{ y: domain }}
          domainPadding={{ left: 2, right: 6, top: 8, bottom: 4 }}
          chartPressState={state}
          xAxis={
            minimal
              ? { lineWidth: 0, tickCount: 0, font: null }
              : {
                  font: font as SkFont | null,
                  tickCount: Math.min(5, length - 1),
                  labelColor: c.textMuted,
                  lineColor: c.border,
                  lineWidth: 0,
                  formatXLabel: (v) => (formatX ? formatX(Number(v)) : `${Math.round(Number(v))}`),
                }
          }
          yAxis={[
            minimal
              ? { lineWidth: 0, tickCount: 0, font: null }
              : {
                  font: font as SkFont | null,
                  tickCount: 4,
                  labelColor: c.textMuted,
                  lineColor: c.border,
                  formatYLabel: (v) => `${Math.round(Number(v))}`,
                },
          ]}
          frame={{ lineWidth: 0 }}
        >
          {({ points, chartBounds }) => (
            <>
              {series.map((s) => {
                const pts = points[s.key];
                if (s.hidden || !pts) return null;
                return (
                  <Line
                    key={s.key}
                    points={pts}
                    color={s.color}
                    strokeWidth={s.width ?? (s.dashed ? 1.5 : 2.25)}
                    curveType="linear"
                    strokeCap="round"
                    strokeJoin="round"
                  >
                    {s.dashed ? <DashPathEffect intervals={[5, 5]} /> : null}
                  </Line>
                );
              })}
              {series.map((s) => {
                const pts = points[s.key];
                if (s.hidden || !pts || !s.markIndices?.length) return null;
                return s.markIndices.map((i) => {
                  const p = pts[i];
                  if (!p || p.y === null || p.y === undefined) return null;
                  return (
                    <Circle
                      key={`${s.key}-m${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={2.75}
                      color={s.markColor ?? c.decline}
                    />
                  );
                });
              })}
              {isActive && follow ? (
                <ScrubIndicator
                  x={state.x.position}
                  y={follow.position}
                  top={chartBounds.top}
                  bottom={chartBounds.bottom}
                  color={c.text2}
                  dot={series.find((s) => s.key === followKey)?.color ?? c.accent}
                  ring={c.bg}
                />
              ) : null}
            </>
          )}
        </CartesianChart>
      </View>
      {renderTooltip && active >= 0 ? (
        <View
          pointerEvents="none"
          style={[styles.tooltip, { backgroundColor: c.surface2, borderColor: c.border }]}
        >
          {renderTooltip(active)}
        </View>
      ) : null}
    </View>
  );
});

function ScrubIndicator({
  x,
  y,
  top,
  bottom,
  color,
  dot,
  ring,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  top: number;
  bottom: number;
  color: string;
  dot: string;
  ring: string;
}) {
  const p1 = useDerivedValue(() => vec(x.value, top));
  const p2 = useDerivedValue(() => vec(x.value, bottom));
  return (
    <>
      <SkLine p1={p1} p2={p2} color={color} strokeWidth={1} opacity={0.5} />
      <Circle cx={x} cy={y} r={6} color={ring} />
      <Circle cx={x} cy={y} r={4.5} color={dot} />
    </>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: 0,
    left: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
