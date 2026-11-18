import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '@/copy/en';
import { formatSleepTime } from '@/domain/time';
import { clockFromMinutes } from '@/lib/format';
import { space } from '@/theme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Sheet } from './Sheet';
import { Text } from './Text';

/** Hours in the allowed 20:00 → 04:00 range, in order. */
const HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4] as const;
const MINUTES = [0, 15, 30, 45] as const;

interface Props {
  visible: boolean;
  /** Minutes since midnight. */
  value: number;
  onChange: (minutes: number) => void;
  onClose: () => void;
  title?: string;
}

function hourLabel(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`;
}

export function TimePickerSheet({
  visible,
  value,
  onChange,
  onClose,
  title = t.wizard.sleepTitle,
}: Props) {
  const [hour, setHour] = useState(Math.floor(value / 60));
  const [minute, setMinute] = useState(value % 60);
  const [wasVisible, setWasVisible] = useState(visible);
  // Reset the draft each time the sheet opens (adjusting state during render).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setHour(Math.floor(value / 60));
      setMinute(value % 60);
    }
  }

  const minutesAllowed = (h: number) => (h === 4 ? [0] : MINUTES);
  const selectHour = (h: number) => {
    setHour(h);
    if (h === 4) setMinute(0);
  };
  const result = hour * 60 + minute;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text
        variant="display"
        align="center"
        accessibilityLabel={`Selected ${clockFromMinutes(result)}`}
      >
        {clockFromMinutes(result)}
      </Text>
      <Text variant="subhead" tone="secondary">
        Hour
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {HOURS.map((h) => (
          <Chip
            key={h}
            label={hourLabel(h)}
            selected={hour === h}
            onPress={() => selectHour(h)}
            style={styles.chip}
          />
        ))}
      </View>
      <Text variant="subhead" tone="secondary">
        Minute
      </Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {MINUTES.map((m) => (
          <Chip
            key={m}
            label={`:${String(m).padStart(2, '0')}`}
            selected={minute === m}
            disabled={!minutesAllowed(hour).includes(m)}
            onPress={() => setMinute(m)}
            style={styles.chip}
          />
        ))}
      </View>
      <Button
        label={t.common.done}
        onPress={() => {
          onChange(result);
          onClose();
        }}
        accessibilityHint={`Sets sleep time to ${formatSleepTime(result)}`}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { minWidth: 72 },
});
