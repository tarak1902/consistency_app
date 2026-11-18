import { Pressable, StyleSheet, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: c.surface2, borderColor: c.border }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(o.value);
              }
            }}
            style={[
              styles.segment,
              selected && {
                backgroundColor: c.surface,
                borderColor: c.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text variant="callout" tone={selected ? 'primary' : 'secondary'} style={styles.label}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.card,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.card - 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  label: { fontFamily: 'Inter_500Medium' },
});
