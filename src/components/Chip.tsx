import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { haptics } from '@/lib/haptics';
import { radius, space, touchTarget, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
  /** Accent color for the selected state (defaults to accent). */
  color?: string;
}

export function Chip({
  label,
  selected,
  onPress,
  leading,
  accessibilityLabel,
  disabled,
  style,
  color,
}: Props) {
  const { c } = useTheme();
  const tint = color ?? c.accent;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? tint : c.border,
          backgroundColor: selected ? c.accentSoft : pressed ? c.surface2 : c.surface,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {leading}
      <Text variant="callout" color={selected ? tint : c.text} numeric style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: { fontFamily: 'Inter_500Medium' },
});
