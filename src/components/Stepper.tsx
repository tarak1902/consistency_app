import { Minus, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accessibilityLabel: string;
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  accessibilityLabel,
}: Props) {
  const { c } = useTheme();
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  };
  const label = format ? format(value) : String(value);
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') set(value + step);
        if (e.nativeEvent.actionName === 'decrement') set(value - step);
      }}
      style={[styles.row, { backgroundColor: c.surface2, borderColor: c.border }]}
    >
      <IconButton
        icon={<Minus size={18} color={c.text} />}
        accessibilityLabel="Decrease"
        disabled={value <= min}
        onPress={() => set(value - step)}
      />
      <Text variant="headline" numeric style={styles.value}>
        {label}
      </Text>
      <IconButton
        icon={<Plus size={18} color={c.text} />}
        accessibilityLabel="Increase"
        disabled={value >= max}
        onPress={() => set(value + step)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xxs,
    alignSelf: 'flex-start',
  },
  value: { minWidth: 72, textAlign: 'center' },
});
