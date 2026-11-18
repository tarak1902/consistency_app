import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { radius, space, useTheme } from '@/theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [reduce, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: rounded, backgroundColor: c.surface2 }, s, style]}
    />
  );
}

/** Skeleton shaped like the Today screen. */
export function TodaySkeleton() {
  return (
    <View style={{ gap: space.lg }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <View style={{ gap: space.xs }}>
        <Skeleton width={110} height={14} />
        <Skeleton width={220} height={26} />
      </View>
      <Skeleton width={260} height={34} rounded={radius.full} />
      <Skeleton height={168} rounded={radius.large} />
      <Skeleton height={56} rounded={radius.card} />
      <View style={{ gap: space.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={52} rounded={radius.card} />
        ))}
      </View>
    </View>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <View style={{ gap: space.md }}>
      <Skeleton height={height} rounded={radius.large} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Skeleton height={84} style={{ flex: 1 }} rounded={radius.card} />
        <Skeleton height={84} style={{ flex: 1 }} rounded={radius.card} />
      </View>
    </View>
  );
}
