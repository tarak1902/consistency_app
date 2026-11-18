import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { t } from '@/copy/en';
import { haptics } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

interface Props {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'accent' | 'destructive';
}

const TICKS = 6;

/**
 * Fills over `durationMs` (1.5 s) while held, with rigid haptic ticks.
 * Releasing early cancels and drains the fill. Screen readers get a plain
 * double-tap action instead, since holding is not practical there.
 */
export function HoldToConfirmButton({
  label,
  holdingLabel = t.wizard.holding,
  onConfirm,
  durationMs = 1500,
  disabled,
  loading,
  tone = 'accent',
}: Props) {
  const { c } = useTheme();
  const fill = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const [width, setWidth] = useState(0);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  const color = tone === 'destructive' ? c.decline : c.accent;

  const stopTicks = useCallback(() => {
    if (ticks.current) clearInterval(ticks.current);
    ticks.current = null;
  }, []);

  useEffect(() => stopTicks, [stopTicks]);

  const complete = useCallback(() => {
    stopTicks();
    setHolding(false);
    // The caller plays the success haptic once the action actually succeeds.
    haptics.rigid();
    onConfirm();
    fill.set(withDelay(600, withTiming(0, { duration: 300 })));
  }, [onConfirm, stopTicks, fill]);

  const start = () => {
    if (disabled || loading) return;
    setHolding(true);
    haptics.rigid();
    let n = 0;
    ticks.current = setInterval(() => {
      n += 1;
      if (n < TICKS) haptics.rigid();
    }, durationMs / TICKS);
    fill.set(
      withTiming(1, { duration: durationMs, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(complete)();
      }),
    );
  };

  const cancel = () => {
    if (!holding) return;
    stopTicks();
    setHolding(false);
    cancelAnimation(fill);
    fill.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
  };

  const fillStyle = useAnimatedStyle(() => ({ width: fill.get() * width }));
  const inactive = !!disabled || !!loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.a11y.holdToConfirm}
      accessibilityState={{ disabled: inactive, busy: !!loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !inactive) complete();
      }}
      onPressIn={start}
      onPressOut={cancel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.base,
        { borderColor: color, backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      <View style={styles.row} pointerEvents="none">
        <Lock size={18} color={holding ? c.onAccent : color} />
        <Text variant="headline" color={holding ? c.onAccent : color}>
          {loading ? t.common.loading : holding ? holdingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
});
