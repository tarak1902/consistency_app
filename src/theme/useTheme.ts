import { useContext } from 'react';
import { ThemeContext, type Theme } from './ThemeProvider';

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
