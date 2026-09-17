// ── Zenvy Restaurant KDS Design Tokens ──────────────────────────────────────────
// Sourced canonically from /design-tokens.json

export const COLORS = {
  // Core Obsidian Canvas
  bgDark: '#09090B',
  bgSubtle: '#121215',
  bgCard: '#18181B',
  bgCardElevated: '#222226',
  bgCardHover: '#27272A',
  
  // Zenvy Signature Gold
  gold: '#D4AF7A',
  goldLight: '#F0D9A8',
  goldMuted: 'rgba(212, 175, 122, 0.15)',
  goldBorder: 'rgba(212, 175, 122, 0.4)',

  // Emerald KDS Status & Primary
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldDark: '#059669',
  emeraldMuted: 'rgba(16, 185, 129, 0.15)',
  emeraldBorder: 'rgba(16, 185, 129, 0.35)',

  // Alerts & Priority
  coral: '#EF4F5F',
  coralMuted: 'rgba(239, 79, 95, 0.15)',
  amber: '#F59E0B',
  amberMuted: 'rgba(245, 158, 11, 0.15)',
  blue: '#3B82F6',
  blueMuted: 'rgba(59, 130, 246, 0.15)',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#8B8B93',
  textDisabled: '#52525B',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  borderStandard: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(255, 255, 255, 0.16)',

  // Surface Inputs
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
} as const;

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
  card: 16,
  pill: 999,
} as const;
