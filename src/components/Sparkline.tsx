import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '@/theme';

interface Props {
  values: readonly number[];
  target?: readonly number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
}

function toPoints(
  values: readonly number[],
  w: number,
  h: number,
  min: number,
  max: number,
  pad: number,
): string {
  const n = values.length;
  if (n < 2) return '';
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Tiny decorative trend line. Hidden from screen readers; parents describe the trend. */
export const Sparkline = memo(function Sparkline({
  values,
  target,
  height = 32,
  color,
  strokeWidth = 1.75,
}: Props) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const { line, dash } = useMemo(() => {
    const all = [...values, ...(target ?? [])];
    const min = Math.min(...all);
    const max = Math.max(...all);
    return {
      line: toPoints(values, w, height, min, max, strokeWidth),
      dash: target ? toPoints(target, w, height, min, max, strokeWidth) : '',
    };
  }, [values, target, w, height, strokeWidth]);

  return (
    <View
      style={{ height }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w > 0 && values.length > 1 ? (
        <Svg width={w} height={height}>
          {dash ? (
            <Polyline
              points={dash}
              fill="none"
              stroke={c.target}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          <Polyline
            points={line}
            fill="none"
            stroke={color ?? c.accent}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
});
