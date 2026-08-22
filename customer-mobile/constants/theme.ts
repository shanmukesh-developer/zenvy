// ── Zenvy Design System ──────────────────────────────────────────────────────
// High-performance, luxury campus dining & services design tokens.

export const COLORS = {
  // Core Backgrounds
  bgDark: '#09090B',
  bgCard: '#18181B',
  bgCardHover: '#27272A',
  bgLight: '#F8F9FA',
  bgLightCard: '#FFFFFF',

  // Primary Accents
  gold: '#D4AF7A',
  goldLight: '#F0D9A8',
  goldMuted: 'rgba(201, 168, 76, 0.15)',
  goldBorder: 'rgba(201, 168, 76, 0.4)',
  red: '#EF4F5F',
  redDark: '#D43F4F',

  // Status Colors
  greenRating: '#24963F',
  blueOffer: '#256FEF',
  emerald: '#10B981',
  amber: '#F59E0B',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textDark: '#111827',
  textDarkSecondary: '#4B5563',

  // Borders
  borderDark: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.08)',
  borderGold: 'rgba(201, 168, 76, 0.3)',

  // Overlays
  overlayDark: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(255, 255, 255, 0.95)',

  // Architect Redesign System Tokens
  bg: '#FFFFFF',
  ink: '#14131F',
  inkMuted: '#7A7887',
  primary: '#6C2BD9',
  primaryDark: '#4C1D9E',
  primarySoft: '#F1E9FE',
  accent: '#FF6B2C',
  accentSoft: '#FFEDE2',
  trust: '#1DA870',
  trustSoft: '#E4F7EE',
} as const;

export const LIGHT_THEME = {
  bg: '#F8F9FA',
  bgSubtle: '#F1F3F5',
  card: '#FFFFFF',
  cardSecondary: '#F8F9FB',
  cardBorder: 'rgba(0, 0, 0, 0.07)',
  cardHover: '#F1F3F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: 'rgba(0, 0, 0, 0.08)',
  borderSubtle: 'rgba(0, 0, 0, 0.04)',
  borderGold: 'rgba(201, 151, 46, 0.45)',
  gold: '#B8860B',
  goldMuted: 'rgba(184, 134, 11, 0.12)',
  red: '#EF4F5F',
  redMuted: 'rgba(239, 79, 95, 0.1)',
  inputBg: '#F1F4F8',
  inputBorder: 'rgba(0, 0, 0, 0.1)',
  tabBarBg: '#FFFFFF',
  tabBarBorder: 'rgba(0, 0, 0, 0.06)',
  glassBg: 'rgba(255, 255, 255, 0.92)',
  shadowColor: '#000000',
  isDark: false,
};

export const DARK_THEME = {
  bg: '#09090B',
  bgSubtle: '#121215',
  card: '#18181B',
  cardSecondary: '#222226',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardHover: '#27272A',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderGold: 'rgba(201, 168, 76, 0.4)',
  gold: '#D4AF7A',
  goldMuted: 'rgba(201, 168, 76, 0.15)',
  red: '#EF4F5F',
  redMuted: 'rgba(239, 79, 95, 0.15)',
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  tabBarBg: '#0D0D10',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  glassBg: 'rgba(24, 24, 27, 0.92)',
  shadowColor: '#000000',
  isDark: true,
};

export const getThemeColors = (isDark: boolean) => (isDark ? DARK_THEME : LIGHT_THEME);

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
  card: 20,
  hero: 30,
} as const;

export const FONTS = {
  thin: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  goldGlow: {
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  redGlow: {
    shadowColor: COLORS.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardElevated: {
    shadowColor: '#14131F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
};
