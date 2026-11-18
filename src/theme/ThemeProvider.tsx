import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, workColor, type ColorScheme, type Palette } from './tokens';

export type ThemePreference = 'system' | 'dark' | 'light';

export interface Theme {
  scheme: ColorScheme;
  c: Palette;
  work: (colorIndex: number) => string;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'compound.theme';

export const ThemeContext = createContext<Theme | null>(null);

interface Props {
  children: ReactNode;
  /** Force a scheme (used by the /dev/ui gallery to render both themes). */
  forced?: ColorScheme;
}

export function ThemeProvider({ children, forced }: Props) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    if (forced) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light' || v === 'system') setPref(v);
      })
      .catch(() => undefined);
  }, [forced]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => undefined);
  }, []);

  // Dark is the default when the system doesn't say.
  const scheme: ColorScheme =
    forced ?? (preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      c: colors[scheme],
      work: (i: number) => workColor(scheme, i),
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
