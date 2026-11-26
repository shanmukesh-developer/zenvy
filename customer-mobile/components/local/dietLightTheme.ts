/**
 * The app's shared light look for every screen outside Home (Local, Groceries, Orders, Services, Profile, In-Campus
 * Booking, ...). Since 26 Nov 2026 it is the ZenWe brand look (logo yellow + navy) whatever the Veg / Non-veg choice;
 * only Home changes red / green with the diet.
 */
import { useDietary } from '../../context/DietaryContext';
import { useTheme } from '../../context/ThemeContext';

export interface DietLight {
  veg: boolean;
  isDark: boolean;
  /** Header band. */
  top: string;
  /** Selected folder tab + the panel under it. */
  sel: string;
  /** Unselected folder tab. */
  un: string;
  /** The one accent (buttons, selected chip, links). */
  acc: string;
  /** Soft tint (pickup line, steppers, icon wells). */
  soft: string;
  /** Page background. */
  page: string;
  /** Dark text on the light bands. */
  dk: string;
  /** Hairlines. */
  line: string;
  /** A slightly deeper page tint so white / glass cards stand out (Orders, Profile). */
  pageDeep: string;
  /** Card surface, its edge, progress-bar track, neutral pill and its ink, text on the accent. */
  card: string;
  edge: string;
  track: string;
  mute: string;
  muteInk: string;
  onAcc: string;
}

// Owner, 26 Nov 2026: "the colour changing from red to green fixed in the food section only, like in the Home page
// only, and the entire app the yellow of my logo". Every screen outside Home now wears ONE brand look whatever the diet:
// the logo yellow (#FAE04B) for bands and page tints, the logo navy (#0F3960) as the accent (buttons, links, selected
// chips; yellow text on white would be unreadable). Home keeps its own Veg / Non-veg theme (components/home).
// Keep in step with utils/themeNow.ts BRAND.
const LIGHT_SURF = { card: '#FFFFFF', edge: 'rgba(17,17,26,0.10)', track: '#ECEEF3', mute: '#F2F3F6', muteInk: '#4B5160', onAcc: '#FFFFFF' };
const BRAND_LIGHT = { top: '#FAE04B', sel: '#FFF8D6', un: '#F2D43C', acc: '#0F3960', soft: '#FEF6CC', page: '#FFFCEB', dk: '#0F3960', line: '#F3E7B0', pageDeep: '#FDF5CF', ...LIGHT_SURF };
const DARK_SURF = { card: '#1A1316', edge: 'rgba(255,255,255,0.08)', track: 'rgba(255,255,255,0.12)', mute: 'rgba(255,255,255,0.08)', muteInk: '#B4B4BC', line: 'rgba(255,255,255,0.08)' };
const BRAND_DARK = { top: '#2A250A', sel: '#3A3312', un: '#1C1906', acc: '#FAE04B', soft: 'rgba(250,224,75,0.14)', dk: '#FFF6C7', page: '#0E0D08', pageDeep: '#0E0D08', onAcc: '#1A1A1A', ...DARK_SURF, card: '#1A1810' };

export const isVegDiet = (mode: string) => mode === 'veg' || mode === 'eggarian';

export function useDietLight(): DietLight {
  const { dietMode } = useDietary();
  const { isDark } = useTheme();
  // `veg` still reports the diet (for food filtering); the colours are the brand look either way.
  return { veg: isVegDiet(dietMode), isDark, ...(isDark ? BRAND_DARK : BRAND_LIGHT) };
}

/**
 * The bottom bar and the basket button accent: the logo navy (light) / logo yellow (dark), the same whatever the diet
 * (owner, 26 Nov 2026; it used to follow Veg / Non-veg).
 */
export const NAV_ACCENT = { light: '#0F3960', dark: '#FAE04B' } as const;
export function useNavAccent(): string {
  const { isDark } = useTheme();
  return isDark ? NAV_ACCENT.dark : NAV_ACCENT.light;
}
