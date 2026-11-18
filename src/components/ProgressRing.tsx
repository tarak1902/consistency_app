import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { motion, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  accessibilityLabel?: string;
}

export function ProgressRing({
  progress,
  size = 44,
  stroke = 4,
  color,
  trackColor,
  children,
  accessibilityLabel,
}: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(Math.max(0, Math.min(1, progress)));

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    p.value = reduce
      ? target
      : withTiming(target, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [progress, reduce, p]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value),
  }));

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor ?? c.border}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
