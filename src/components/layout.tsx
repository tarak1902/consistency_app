import { ChevronRight, WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fonts,
  maxFontScale,
  radius,
  screenPadding,
  space,
  touchTarget,
  type as typeScale,
  useTheme,
} from '@/theme';
import { Text } from './Text';

interface ScreenProps extends ScrollViewProps {
  children: ReactNode;
  /** Render without a ScrollView (for fixed layouts). */
  fixed?: boolean;
  /** Include the top safe-area inset (screens without a native header). */
  edgeTop?: boolean;
  footer?: ReactNode;
  banner?: ReactNode;
}

export function Screen({
  children,
  fixed,
  edgeTop = true,
  footer,
  banner,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: (edgeTop ? insets.top : 0) + space.xs,
    paddingHorizontal: screenPadding,
    paddingBottom: footer ? space.lg : insets.bottom + space.xxl,
    gap: space.lg,
  };
  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      {fixed ? (
        <View style={[styles.flex, pad]}>
          {banner}
          {children}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[pad, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...rest}
        >
          {banner}
          {children}
        </ScrollView>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + space.md,
              backgroundColor: c.bg,
              borderTopColor: c.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text variant="subhead" tone="secondary" accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  tone?: 'default' | 'destructive' | 'accent';
  chevron?: boolean;
  isLast?: boolean;
  accessibilityHint?: string;
  leading?: ReactNode;
}

export function ListRow({
  label,
  value,
  onPress,
  right,
  tone = 'default',
  chevron,
  isLast,
  accessibilityHint,
  leading,
}: ListRowProps) {
  const { c } = useTheme();
  const color = tone === 'destructive' ? c.decline : tone === 'accent' ? c.accent : c.text;
  const content = (
    <>
      {leading}
      <Text variant="body" color={color} style={styles.flex} numberOfLines={2}>
        {label}
      </Text>
      {value ? (
        <Text variant="callout" tone="secondary" numeric numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {right}
      {(chevron ?? !!onPress) ? <ChevronRight size={18} color={c.text3} /> : null}
    </>
  );
  const rowStyle = [
    styles.listRow,
    !isLast && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
  ];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={value ? `${label}: ${value}` : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  counter?: boolean;
}

export function TextField({ label, error, counter, maxLength, value, style, ...rest }: FieldProps) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.xxs + 2 }}>
      {label ? (
        <Text variant="subhead" tone="secondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        maxLength={maxLength}
        placeholderTextColor={c.text3}
        selectionColor={c.accent}
        maxFontSizeMultiplier={maxFontScale}
        accessibilityLabel={label ?? rest.placeholder}
        style={[
          styles.input,
          {
            color: c.text,
            backgroundColor: c.surface2,
            borderColor: error ? c.decline : c.border,
          },
          style,
        ]}
        {...rest}
      />
      {error || (counter && maxLength) ? (
        <View style={styles.sectionRow}>
          <Text variant="caption" tone="decline" accessibilityLiveRegion="polite">
            {error ?? ''}
          </Text>
          {counter && maxLength ? (
            <Text variant="caption" tone="tertiary" numeric>
              {`${value?.length ?? 0}/${maxLength}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: c.surface2, borderColor: c.border }]}
    >
      <WifiOff size={16} color={c.text2} />
      <Text variant="callout" tone="secondary" style={styles.flex}>
        {message}
      </Text>
    </View>
  );
}

export const inputTextStyle = { fontFamily: fonts.regular, fontSize: typeScale.body.fontSize };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  listRow: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  value: { maxWidth: '55%' },
  input: {
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.regular,
    fontSize: 17,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.sm,
  },
});
