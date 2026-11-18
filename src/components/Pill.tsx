import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

export type PillTone = 'neutral' | 'accent' | 'growth' | 'decline' | 'caution';

interface Props {
  label: string;
  tone?: PillTone;
  icon?: ReactNode;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

export function Pill({ label, tone = 'neutral', icon, style, size = 'sm' }: Props) {
  const { c } = useTheme();
  const map: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: c.surface2, fg: c.text2 },
    accent: { bg: c.accentSoft, fg: c.accent },
    growth: { bg: c.growthSoft, fg: c.growth },
    decline: { bg: c.declineSoft, fg: c.decline },
    caution: { bg: c.cautionSoft, fg: c.caution },
  };
  const p = map[tone];
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: p.bg,
          paddingVertical: size === 'md' ? space.xs : space.xxs,
          paddingHorizontal: size === 'md' ? space.sm : space.xs,
        },
        style,
      ]}
    >
      {icon}
      <Text
        variant={size === 'md' ? 'callout' : 'caption'}
        color={p.fg}
        numeric
        style={styles.label}
      >
        {label}
      </Text>
    </View>
  );
}

/** Live status line for Today. A small leading dot pulses in color only; text carries meaning. */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const { c } = useTheme();
  const dot: Record<PillTone, string> = {
    neutral: c.text3,
    accent: c.accent,
    growth: c.growth,
    decline: c.decline,
    caution: c.caution,
  };
  return (
    <View accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Pill
        size="md"
        tone={tone}
        label={label}
        icon={<View style={[styles.dot, { backgroundColor: dot[tone] }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    gap: space.xs,
  },
  label: { fontFamily: 'Inter_500Medium' },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
