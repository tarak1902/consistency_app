import { StyleSheet, View } from 'react-native';
import { t } from '@/copy/en';
import { DOWN, signedPct, UP } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  /** Fractional change, e.g. 0.02 for +2.0%. Null renders a neutral dash. */
  delta: number | null;
  size?: 'sm' | 'md';
  /** Plain text instead of a filled badge. */
  bare?: boolean;
}

/** Color is never the only signal: always a ▲/▼ glyph and a sign. */
export function DeltaBadge({ delta, size = 'md', bare = false }: Props) {
  const { c } = useTheme();
  const dir = delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const fg = dir === 'up' ? c.growthInk : dir === 'down' ? c.declineInk : c.textMuted;
  const bg = dir === 'up' ? c.growthSoft : dir === 'down' ? c.declineSoft : c.surface2;
  const value = delta === null ? '–' : signedPct(delta);
  const glyph = dir === 'up' ? UP : dir === 'down' ? DOWN : '';
  const label = `${glyph ? `${glyph} ` : ''}${value}`;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t.a11y.delta(dir, value)}
      style={[
        bare ? null : styles.badge,
        bare ? null : { backgroundColor: bg, paddingVertical: size === 'md' ? 3 : 1 },
      ]}
    >
      <Text variant={size === 'md' ? 'callout' : 'caption'} color={fg} numeric style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, paddingHorizontal: space.xs, alignSelf: 'flex-start' },
  text: { fontFamily: 'Inter_500Medium' },
});
