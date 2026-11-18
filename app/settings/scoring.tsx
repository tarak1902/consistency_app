import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Screen, Text } from '@/components';
import { CompoundCurves } from '@/components/CompoundCurves';
import { ScreenHeader } from '@/components/ScreenHeader';
import { t } from '@/copy/en';
import { RATES } from '@/domain/time';
import { referenceMultipliers } from '@/domain/scoring';
import { multiplier, rateLabel } from '@/lib/format';
import { space, useTheme } from '@/theme';

export default function HowScoringWorks() {
  const { c } = useTheme();
  const curves = useMemo(
    () => [
      {
        values: Array.from({ length: 31 }, (_, i) => 100 * 1.02 ** i),
        color: c.target,
        dashed: true,
        width: 1.5,
      },
      {
        values: Array.from({ length: 31 }, (_, i) => {
          // An illustrative month: mostly complete days, a few misses.
          let v = 100;
          for (let d = 1; d <= i; d += 1) v *= d % 5 === 0 || d % 7 === 0 ? 0.98 : 1.02;
          return v;
        }),
        color: c.accent,
      },
    ],
    [c],
  );

  return (
    <Screen>
      <ScreenHeader title={t.scoring.title} />
      <Card size="lg">
        <CompoundCurves curves={curves} baseline={100} height={140} />
        <Text variant="caption" tone="tertiary" style={styles.caption}>
          Solid: your day score. Dashed: the perfect path. 2% rate, 30 days.
        </Text>
      </Card>
      {t.scoring.sections.map((s) => (
        <View key={s.h} style={styles.block}>
          <Text variant="headline" accessibilityRole="header">
            {s.h}
          </Text>
          <Text variant="body" tone="secondary">
            {s.p}
          </Text>
        </View>
      ))}
      <Card>
        <Text variant="subhead" tone="secondary">
          90 days, every day vs. no days
        </Text>
        {RATES.map((r) => {
          const m = referenceMultipliers(r, 90);
          return (
            <View key={r} style={styles.row}>
              <Text variant="headline" numeric style={styles.rate}>
                {rateLabel(r)}
              </Text>
              <Text variant="callout" tone="growth" numeric style={styles.flex}>
                {`${multiplier(m.perfect)} perfect`}
              </Text>
              <Text variant="callout" tone="decline" numeric>
                {`${multiplier(m.missed)} all missed`}
              </Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caption: { marginTop: space.xs },
  block: { gap: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  rate: { width: 44 },
});
