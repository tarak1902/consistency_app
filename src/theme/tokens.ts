/**
 * Design tokens. Dark is designed first; light mirrors it.
 * Every color used in the app must come from here.
 */
export type ColorScheme = 'dark' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  /** Text/icon color drawn on top of `accent` fills. */
  onAccent: string;
  growth: string;
  decline: string;
  caution: string;
  target: string;
  /** Low-alpha tints for pills and soft fills. */
  accentSoft: string;
  growthSoft: string;
  declineSoft: string;
  cautionSoft: string;
  scrim: string;
}

export const colors: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0B0D10',
    surface: '#14171C',
    surface2: '#1B1F26',
    border: '#262B33',
    text: '#F2F4F7',
    text2: '#A3ACB9',
    text3: '#6B7380',
    accent: '#8B97FF',
    onAccent: '#0B0D10',
    growth: '#3DD68C',
    decline: '#FF6B57',
    caution: '#F5B544',
    target: '#6B7380',
    accentSoft: 'rgba(139,151,255,0.14)',
    growthSoft: 'rgba(61,214,140,0.14)',
    declineSoft: 'rgba(255,107,87,0.14)',
    cautionSoft: 'rgba(245,181,68,0.14)',
    scrim: 'rgba(0,0,0,0.6)',
  },
  light: {
    bg: '#FAFAF7',
    surface: '#FFFFFF',
    surface2: '#F2F3F0',
    border: '#E4E6E1',
    text: '#0E1116',
    text2: '#5A6270',
    text3: '#8A919C',
    accent: '#4F5BD5',
    onAccent: '#FFFFFF',
    growth: '#12A150',
    decline: '#D93F2B',
    caution: '#B7791F',
    target: '#8A919C',
    accentSoft: 'rgba(79,91,213,0.10)',
    growthSoft: 'rgba(18,161,80,0.10)',
    declineSoft: 'rgba(217,63,43,0.10)',
    cautionSoft: 'rgba(183,121,31,0.12)',
    scrim: 'rgba(14,17,22,0.4)',
  },
};

/** Work palette by color_index. Light variants are deeper for contrast on #FFFFFF. */
export const workColors: Record<ColorScheme, readonly string[]> = {
  dark: ['#8B97FF', '#3DC2D6', '#F5B544', '#E57AD9', '#8BD45E', '#FF8A65', '#B49CFF', '#5EC8A0'],
  light: ['#4F5BD5', '#0E8FA3', '#B7791F', '#B83FAD', '#4D8F22', '#D4572E', '#7A5BE0', '#1F8F68'],
};

export function workColor(scheme: ColorScheme, index: number): string {
  const list = workColors[scheme];
  return list[((index % list.length) + list.length) % list.length] ?? list[0] ?? '#888888';
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
  title1: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title2: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  callout: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  subhead: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

/** 4-pt grid. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const screenPadding = space.lg;

export const radius = {
  sm: 8,
  card: 12,
  large: 16,
  sheet: 24,
  full: 999,
} as const;

export const touchTarget = 44;

export const motion = {
  fast: 180,
  base: 220,
  slow: 280,
  spring: { damping: 20, stiffness: 220, mass: 1 },
} as const;

/** Upper bound for Dynamic Type scaling. Layouts are checked at this size. */
export const maxFontScale = 1.3;
