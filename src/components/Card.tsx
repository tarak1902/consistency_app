import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '@/theme';

interface Props {
  children: ReactNode;
  size?: 'md' | 'lg';
  padded?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tone?: 'default' | 'sunken';
}

export function Card({
  children,
  size = 'md',
  padded = true,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  tone = 'default',
}: Props) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: tone === 'sunken' ? c.surface2 : c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: size === 'lg' ? radius.large : radius.card,
    padding: padded ? (size === 'lg' ? space.lg : space.md) : 0,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [base, pressed ? { backgroundColor: c.surface2 } : null, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}
