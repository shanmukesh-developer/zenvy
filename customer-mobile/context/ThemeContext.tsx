import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, getThemeColors, DARK_THEME, LIGHT_THEME } from '../constants/theme';
import { setThemeNow } from '../utils/themeNow';

type Theme = 'dark' | 'light';

export type ThemeColors = typeof DARK_THEME;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  activeColors: typeof COLORS;
  colors: ThemeColors;
  /** False until the saved theme preference has been read from storage. */
  isThemeReady: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  isDark: true,
  activeColors: COLORS,
  colors: DARK_THEME,
  isThemeReady: true,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Owner rule: light by default, whatever the phone's dark mode. Only the student's own toggle (saved) changes it.
  const [theme, setTheme] = useState<Theme>('light');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('zenvy_theme_mode');
        if (active && (saved === 'light' || saved === 'dark')) {
          setTheme(saved);
        }
      } catch (e) {
        // Storage unavailable: keep the default theme.
      } finally {
        if (active) setIsThemeReady(true);
      }
    };
    loadTheme();
    return () => {
      active = false;
    };
  }, []);

  // Stable identity: a fresh function (and value object) on every provider render re-rendered every
  // useTheme() screen in the app even when nothing about the theme changed.
  const toggleTheme = useCallback(() => {
    // Functional update so two quick taps never save a stale value.
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('zenvy_theme_mode', next).catch(() => {});
      return next;
    });
  }, []);

  const isDark = theme === 'dark';
  // Sections whose colours live outside React (PG stays, Co-Ride: utils/themeNow) read the theme from here.
  setThemeNow(isDark);
  const value = useMemo<ThemeContextType>(
    () => ({ theme, toggleTheme, isDark, activeColors: COLORS, colors: getThemeColors(isDark), isThemeReady }),
    [theme, toggleTheme, isDark, isThemeReady],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);


/**
 * Owner, 10 Nov 2026 ("dark mode colour grading for the entire application"): in dark mode the base surfaces take a
 * deep tint of the diet picked on Home - wine-black for Non-veg, forest-black for Veg. Mounted inside DietaryProvider
 * (app/_layout), it re-provides the theme so every useTheme() screen is graded; light mode is untouched.
 */
const DARK_GRADE = {
  nonveg: { bg: '#0F0A0B', bgSubtle: '#160E10', card: '#1C1315', cardSecondary: '#251A1D', cardHover: '#2E2024', tabBarBg: '#120B0D', glassBg: 'rgba(28,19,21,0.92)' },
  veg: { bg: '#080E0A', bgSubtle: '#0D1611', card: '#121C16', cardSecondary: '#18251D', cardHover: '#1F2E25', tabBarBg: '#0A120D', glassBg: 'rgba(18,28,22,0.92)' },  brand: { bg: '#0E0D08', bgSubtle: '#15130B', card: '#1A1810', cardSecondary: '#232013', cardHover: '#2C2817', tabBarBg: '#110F09', glassBg: 'rgba(26,24,16,0.92)' },
};
export function DietGradedTheme({ veg, children }: { veg: boolean; children: ReactNode }) {
  const base = useContext(ThemeContext);
  const value = useMemo<ThemeContextType>(
    // Owner, 26 Nov 2026: one brand grade (warm yellow-black) whatever the diet; only Home follows Veg / Non-veg.
    () => (base.isDark ? { ...base, colors: { ...base.colors, ...DARK_GRADE.brand } } : base),
    [base],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
