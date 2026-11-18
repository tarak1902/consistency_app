import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { radius, touchTarget, useTheme } from '@/theme';

interface Props {
  icon: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: 'plain' | 'filled';
  disabled?: boolean;
  style?: ViewStyle;
  size?: number;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'plain',
  disabled,
  style,
  size = touchTarget,
}: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={size < touchTarget ? (touchTarget - size) / 2 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor:
            variant === 'filled'
              ? pressed
                ? c.border
                : c.surface2
              : pressed
                ? c.surface2
                : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
