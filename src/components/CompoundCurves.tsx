import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface Curve {
  values: readonly number[];
  color: string;
  dashed?: boolean;
  width?: number;
}

interface Props {
  curves: readonly Curve[];
  height?: number;
  /** Draw a faint baseline at this value (e.g. 100 or 1). */
  baseline?: number;
  animate?: boolean;
}

function pathFor(
  values: readonly number[],
  w: number,
  h: number,
  min: number,
  max: number,
): string {
  const n = values.length;
  const span = max - min || 1;
  let d = '';
  values.forEach((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = 4 + (1 - (v - min) / span) * (h - 8);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return d;
}

function lengthOf(
  values: readonly number[],
  w: number,
  h: number,
  min: number,
  max: number,
): number {
  const n = values.length;
  const span = max - min || 1;
  let len = 0;
  for (let i = 1; i < n; i += 1) {
    const dx = w / (n - 1);
    const dy = (((values[i] ?? 0) - (values[i - 1] ?? 0)) / span) * (h - 8);
    len += Math.hypot(dx, dy);
  }
  return len;
}

function DrawnPath({
  d,
  length,
  color,
  width,
  dashed,
  delay,
  animate,
}: {
  d: string;
  length: number;
  color: string;
  width: number;
  dashed?: boolean;
  delay: number;
  animate: boolean;
}) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(animate && !reduce ? 0 : 1);
  useEffect(() => {
    if (!animate || reduce) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );
  }, [animate, reduce, delay, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  if (dashed) {
    return <Path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray="4 4" />;
  }
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={props}
    />
  );
}

/** Lightweight animated SVG curves for onboarding and wizard previews. */
export const CompoundCurves = memo(function CompoundCurves({
  curves,
  height = 160,
  baseline,
  animate = true,
}: Props) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const geo = useMemo(() => {
    const all = curves.flatMap((x) => x.values);
    if (baseline !== undefined) all.push(baseline);
    const min = Math.min(...all);
    const max = Math.max(...all);
    return curves.map((cv) => ({
      d: pathFor(cv.values, w, height, min, max),
      len: lengthOf(cv.values, w, height, min, max),
      base:
        baseline !== undefined
          ? 4 + (1 - (baseline - min) / (max - min || 1)) * (height - 8)
          : null,
    }));
  }, [curves, w, height, baseline]);

  return (
    <View
      style={{ height }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 ? (
        <Svg width={w} height={height}>
          {geo[0]?.base != null ? (
            <Line
              x1={0}
              x2={w}
              y1={geo[0].base}
              y2={geo[0].base}
              stroke={c.border}
              strokeWidth={1}
            />
          ) : null}
          {curves.map((cv, i) => {
            const g = geo[i];
            if (!g) return null;
            return (
              <DrawnPath
                key={`${i}-${w}`}
                d={g.d}
                length={g.len}
                color={cv.color}
                width={cv.width ?? 2.5}
                dashed={cv.dashed}
                delay={i * 120}
                animate={animate}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
});
