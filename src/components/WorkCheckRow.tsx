import { Check, Lock } from 'lucide-react-native';
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { t } from '@/copy/en';
import { score as fmtScore } from '@/lib/format';
import { motion, space, touchTarget, useTheme } from '@/theme';
import { DeltaBadge } from './DeltaBadge';
import { Text } from './Text';

export interface WorkCheckRowProps {
  title: string;
  criteria: string | null;
  colorIndex: number;
  score: number;
  lastDelta: number | null;
  checked: boolean;
  locked: boolean;
  pending?: boolean;
  onPress: () => void;
  isLast?: boolean;
}

const SIZE = 28;

export const WorkCheckRow = memo(function WorkCheckRow({
  title,
  criteria,
  colorIndex,
  score,
  lastDelta,
  checked,
  locked,
  pending,
  onPress,
  isLast,
}: WorkCheckRowProps) {
  const { c, work } = useTheme();
  const reduce = useReducedMotion();
  const color = work(colorIndex);
  const scale = useSharedValue(1);
  const fill = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    fill.value = reduce
      ? checked
        ? 1
        : 0
      : withTiming(checked ? 1 : 0, { duration: motion.fast });
    if (checked && !reduce) {
      scale.value = withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, motion.spring));
    }
  }, [checked, reduce, fill, scale]);

  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${title}. Score ${fmtScore(score)}`}
      accessibilityHint={locked ? t.a11y.checkboxLockedHint : (criteria ?? undefined)}
      accessibilityState={{ checked, disabled: locked, busy: !!pending }}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={2}>
          {title}
        </Text>
        {criteria ? (
          <Text variant="callout" tone="secondary" numberOfLines={2}>
            {criteria}
          </Text>
        ) : null}
      </View>
      <View style={styles.scoreCol}>
        <Text variant="callout" numeric style={styles.score}>
          {fmtScore(score)}
        </Text>
        <DeltaBadge delta={lastDelta} size="sm" bare />
      </View>
      <View style={styles.hit}>
        <Animated.View
          style={[
            styles.box,
            {
              borderColor: checked ? color : locked ? c.border : c.text3,
              backgroundColor: locked && !checked ? c.surface2 : 'transparent',
            },
            boxStyle,
          ]}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.boxFill, { backgroundColor: color }, fillStyle]}
          >
            <Check size={16} strokeWidth={3} color={c.bg} />
          </Animated.View>
          {locked && !checked ? <Lock size={13} color={c.text3} /> : null}
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    gap: space.sm,
    minHeight: 64,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1, gap: 2 },
  scoreCol: { alignItems: 'flex-end', gap: 2 },
  score: { fontFamily: 'Inter_500Medium' },
  hit: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxFill: { alignItems: 'center', justifyContent: 'center', borderRadius: SIZE / 2 },
});
