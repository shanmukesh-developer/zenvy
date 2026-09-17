// ── Zenvy Fleet Design System ──────────────────────────────────────────────────
// High-performance, luxury rider dispatch & fulfillment design tokens,
// directly matching the Zenvy Customer Mobile aesthetic.

export const COLORS = {
  // Core Obsidian Canvas
  bgDark: '#08090C',
  bgSubtle: '#0E1015',
  bgCard: '#13151D',
  bgCardElevated: '#1A1D28',
  bgCardHover: '#222634',
  
  // Luxury Metallic Gold (Zenvy Signature)
  gold: '#D4AF7A',
  goldLight: '#F3DFC1',
  goldMuted: 'rgba(212, 175, 122, 0.15)',
  goldBorder: 'rgba(212, 175, 122, 0.35)',

  // Emerald Fleet Status & Trust
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldDark: '#059669',
  emeraldMuted: 'rgba(16, 185, 129, 0.15)',
  emeraldBorder: 'rgba(16, 185, 129, 0.35)',

  // Alerts & Priority
  coral: '#EF4F5F',
  coralMuted: 'rgba(239, 79, 95, 0.15)',
  coralBorder: 'rgba(239, 79, 95, 0.4)',
  amber: '#F59E0B',
  amberMuted: 'rgba(245, 158, 11, 0.15)',
  blue: '#3B82F6',
  blueMuted: 'rgba(59, 130, 246, 0.15)',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#8B8B93',
  textDisabled: '#475569',
  textGold: '#D4AF7A',
  textEmerald: '#34D399',

  // Borders & Dividers
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderMedium: 'rgba(255, 255, 255, 0.12)',
  borderActive: 'rgba(212, 175, 122, 0.5)',

  // Overlays & Glass
  glassBg: 'rgba(19, 21, 29, 0.88)',
  overlayDark: 'rgba(0, 0, 0, 0.75)',
} as const;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  card: 20,
  hero: 26,
  pill: 999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  cardElevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  goldGlow: {
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  emeraldGlow: {
    shadowColor: COLORS.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
