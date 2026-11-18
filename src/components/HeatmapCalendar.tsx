import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '@/copy/en';
import type { DayStatus } from '@/domain/scoring';
import { isoWeekday, type IsoDate } from '@/domain/time';
import { mediumDate } from '@/lib/format';
import { space, useTheme } from '@/theme';
import { Text } from './Text';

export interface HeatmapDay {
  day: IsoDate;
  index: number;
  status: DayStatus;
}

const GAP = 6;
const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type CellKind = 'complete' | 'partial' | 'missed' | 'rest' | 'future' | 'today';

function kindOf(status: DayStatus): CellKind {
  switch (status) {
    case 'complete':
    case 'partial':
    case 'missed':
    case 'rest':
      return status;
    case 'open':
    case 'pending':
      return 'today';
    default:
      return 'future';
  }
}

function Cell({ kind, size, label }: { kind: CellKind | null; size: number; label?: string }) {
  const { c } = useTheme();
  const r = Math.round(size * 0.22);
  if (kind === null) return <View style={{ width: size, height: size }} />;
  const base = { width: size, height: size, borderRadius: r };
  const a11y = { accessible: true, accessibilityLabel: label };
  switch (kind) {
    case 'complete':
      return <View {...a11y} style={[base, { backgroundColor: c.growth }]} />;
    case 'partial':
      return (
        <View {...a11y} style={[base, styles.clip, { borderWidth: 1.5, borderColor: c.caution }]}>
          <View style={[styles.half, { backgroundColor: c.caution }]} />
        </View>
      );
    case 'missed':
      return <View {...a11y} style={[base, { borderWidth: 1.5, borderColor: c.decline }]} />;
    case 'rest':
      return (
        <View {...a11y} style={[base, styles.center]}>
          <View style={[styles.dash, { backgroundColor: c.text3, width: size * 0.4 }]} />
        </View>
      );
    case 'today':
      return <View {...a11y} style={[base, { borderWidth: 1.5, borderColor: c.accent }]} />;
    case 'future':
      return (
        <View
          {...a11y}
          style={[base, { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}
        />
      );
  }
}

/** Monday-first calendar of every plan day. */
export const HeatmapCalendar = memo(function HeatmapCalendar({
  days,
}: {
  days: readonly HeatmapDay[];
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const size = w > 0 ? Math.min(36, Math.floor((w - GAP * 6) / 7)) : 0;

  const weeks = useMemo(() => {
    const first = days[0];
    if (!first) return [];
    const lead = isoWeekday(first.day) - 1;
    const cells: (HeatmapDay | null)[] = [...Array<null>(lead).fill(null), ...days];
    while (cells.length % 7 !== 0) cells.push(null);
    const out: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [days]);

  return (
    <View style={{ gap: space.md }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ gap: GAP }}>
        {size > 0 ? (
          <>
            <View style={[styles.row, { gap: GAP }]}>
              {HEAD.map((h, i) => (
                <Text
                  key={i}
                  variant="caption"
                  tone="tertiary"
                  align="center"
                  style={{ width: size }}
                >
                  {h}
                </Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={[styles.row, { gap: GAP }]}>
                {week.map((d, di) => (
                  <Cell
                    key={di}
                    kind={d ? kindOf(d.status) : null}
                    size={size}
                    label={
                      d
                        ? t.a11y.heatmapCell(
                            d.index,
                            mediumDate(d.day),
                            t.progress.status[d.status] ?? d.status,
                          )
                        : undefined
                    }
                  />
                ))}
              </View>
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.legend} accessibilityRole="summary">
        {(['complete', 'partial', 'missed', 'rest', 'future'] as const).map((k) => (
          <View key={k} style={styles.legendItem}>
            <Cell kind={k} size={12} />
            <Text variant="caption" tone="secondary">
              {t.progress.legend[k]}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, opacity: 0 }} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  clip: { overflow: 'hidden', justifyContent: 'flex-end' },
  half: { height: '50%', width: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  dash: { height: 2, borderRadius: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xxs + 2 },
});
