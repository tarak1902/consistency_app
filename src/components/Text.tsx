import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { maxFontScale, type, type TypeVariant, useTheme } from '@/theme';

export type TextTone =
  'primary' | 'secondary' | 'tertiary' | 'accent' | 'growth' | 'decline' | 'caution' | 'onAccent';

interface Props extends TextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Tabular numerals; on by default for numeric variants. */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
  color?: string;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  numeric,
  align,
  color,
  style,
  maxFontSizeMultiplier,
  ...rest
}: Props) {
  const { c } = useTheme();
  const toneColor: Record<TextTone, string> = {
    primary: c.text,
    secondary: c.text2,
    tertiary: c.text3,
    accent: c.accent,
    growth: c.growth,
    decline: c.decline,
    caution: c.caution,
    onAccent: c.onAccent,
  };
  const t = type[variant];
  const useTabular = numeric ?? variant === 'display';
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (variant === 'display' ? 1.15 : maxFontScale)}
      style={[
        t,
        { color: color ?? toneColor[tone] },
        useTabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
