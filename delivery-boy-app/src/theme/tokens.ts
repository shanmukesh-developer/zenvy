// Zenvy Rider design tokens: light-first, high contrast for outdoor use (Swiggy / Zomato partner-app style).
// The old dark theme in src/constants/theme.ts is no longer used by the app.
import type { TextStyle } from 'react-native';

export const color = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F3',
  border: '#D9DDE3',
  text: '#0B0D12',
  textSecondary: '#3F4654',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',
  online: '#0E9F5B',
  onlineDark: '#0A7A45',
  onlineTint: '#E3F6EC', // duty on, Accept, Delivered
  offline: '#4B5563',
  offlineTint: '#E5E7EB',
  primary: '#0B0D12', // step primary buttons (black, max contrast)
  brand: '#C9A84C',
  brandTint: '#FBF5E6', // Zenvy gold accents only
  cash: '#B45309',
  cashTint: '#FFF4E0',
  cashBorder: '#F5C77E', // COD "Collect ₹X"
  prepaid: '#0A7A45',
  prepaidTint: '#E3F6EC', // Wallet "Prepaid"
  danger: '#C81E1E',
  dangerTint: '#FDECEC',
  warning: '#B45309',
  warningTint: '#FFF7E6',
  info: '#1D4ED8',
  infoTint: '#E8EEFD',
};

export const type: Record<'money' | 'title1' | 'title2' | 'title3' | 'body' | 'bodySm' | 'label' | 'button', TextStyle> = {
  money: { fontSize: 40, lineHeight: 46, fontWeight: '800' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  bodySm: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: 0.3 },
  button: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
};

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
export const touch = { primary: 64, secondary: 52, icon: 48, minHit: 48 };
export const elevation = {
  card: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
};
export const motion = { fast: 150, base: 220 };
