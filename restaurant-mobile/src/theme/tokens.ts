// Zenvy Partner design tokens: light-first, high-contrast kitchen use (matches the rider app).
import type { TextStyle } from 'react-native';

export const color = {
  bg: '#F4F5F7', surface: '#FFFFFF', surfaceAlt: '#EEF0F3', border: '#D9DDE3',
  text: '#0B0D12', textSecondary: '#3F4654', textMuted: '#6B7280', textInverse: '#FFFFFF',
  open: '#0E9F5B', openDark: '#0A7A45', openTint: '#E3F6EC', // store open, Accept, Ready
  closed: '#4B5563', closedTint: '#E5E7EB',
  alert: '#D7263D', alertDark: '#A3172B', alertTint: '#FDECEE', // NEW order, Reject, offline banner
  primary: '#0B0D12', // Mark Ready (max contrast)
  brand: '#C9A84C', brandTint: '#FBF5E6', // Zenvy gold accents only
  cash: '#B45309', cashTint: '#FFF4E0', cashBorder: '#F5C77E', // COD
  prepaid: '#0A7A45', prepaidTint: '#E3F6EC', // Wallet
  warning: '#B45309', warningTint: '#FFF7E6', // reconnecting, instructions callout
  info: '#1D4ED8', infoTint: '#E8EEFD', // rider status
  veg: '#0E9F5B', nonVeg: '#B91C1C',
} as const;

export const type = {
  orderId: { fontSize: 20, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  money: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title1: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  title2: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  itemLine: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: 0.3 },
  button: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
} satisfies Record<string, TextStyle>;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const touch = { primary: 64, secondary: 52, icon: 48, minHit: 48 } as const;
export const elevation = {
  card: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
} as const;
export const motion = { fast: 150, base: 220 } as const;
export const mono = { fontFamily: 'monospace' } as const;
