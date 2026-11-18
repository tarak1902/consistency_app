import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, space, touchTarget, useTheme } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'lg',
  style,
  accessibilityHint,
  testID,
}: Props) {
  const { c } = useTheme();
  const inactive = disabled || loading;
  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border?: string; pressed: string }
  > = {
    primary: { bg: c.accent, fg: c.onAccent, pressed: c.accent },
    secondary: { bg: c.surface2, fg: c.text, border: c.border, pressed: c.border },
    ghost: { bg: 'transparent', fg: c.accent, pressed: c.surface2 },
    destructive: { bg: c.decline, fg: c.onAccent, pressed: c.decline },
  };
  const p = palette[variant];
  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 52 : touchTarget,
          backgroundColor: pressed && !inactive ? p.pressed : p.bg,
          borderColor: p.border ?? 'transparent',
          borderWidth: p.border ? StyleSheet.hairlineWidth : 0,
          opacity: disabled
            ? 0.4
            : pressed && (variant === 'primary' || variant === 'destructive')
              ? 0.85
              : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="headline" color={p.fg} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
