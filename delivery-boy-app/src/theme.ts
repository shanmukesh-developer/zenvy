// Zenvy Rider design tokens: light, high contrast for outdoor use, big touch targets.
import { Platform, StatusBar, TextStyle } from 'react-native';

export const C = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  cardAlt: '#EEF0F3',
  line: '#D6DAE0',
  ink: '#0B0D12',
  ink2: '#374151',
  muted: '#6B7280',
  white: '#FFFFFF',
  green: '#0E9F5B',
  greenDark: '#08703F',
  greenTint: '#E2F5EA',
  grey: '#4B5563',
  greyTint: '#E5E7EB',
  gold: '#C9A84C',
  goldTint: '#FBF5E6',
  cash: '#A64B00',
  cashTint: '#FFF1DC',
  cashLine: '#F5BE73',
  red: '#C81E1E',
  redTint: '#FDECEC',
  amber: '#B45309',
  amberTint: '#FFF6E5',
  blue: '#1D4ED8',
  blueTint: '#E8EEFD',
  disabled: '#9CA3AF',
  scrim: 'rgba(11,13,18,0.55)',
};

export const T: Record<'money' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'button', TextStyle> = {
  money: { fontSize: 44, lineHeight: 50, fontWeight: '900' },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  small: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '800', letterSpacing: 0.4 },
  button: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const HIT = { big: 64, mid: 54, icon: 48 };

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

// react-native-safe-area-context is not installed: conservative fixed insets.
export const TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 47;
export const BOTTOM_INSET = Platform.OS === 'ios' ? 28 : 12;
