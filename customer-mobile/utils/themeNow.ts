import { StyleSheet } from 'react-native';

/**
 * The app's current light/dark choice, readable outside React (owner, 4 Nov 2026: "dark theme errors").
 * ThemeContext writes it on every render, so it is always the value the screens are drawing with.
 *
 * The PG stays and Co-Ride sections were built light-only: their colour tokens (PG2, CR) and their
 * module-level StyleSheets were fixed at import time, so in dark mode they stayed white. Now their tokens
 * read the palette for the current theme, and their sheets are made with themedSheet() below, which
 * builds one sheet per theme on first use and returns the one that matches the theme right now.
 */
let darkNow = false;

export function setThemeNow(isDark: boolean) {
  darkNow = isDark;
}

export function isDarkNow(): boolean {
  return darkNow;
}

/**
 * The Veg / Non-veg choice made on Home, readable outside React (owner, 10 Nov 2026: every Services section wears the
 * app's one diet look - light red band for Non-veg, light green for Veg, white cards, one accent).
 * DietaryContext writes it on every render, the same way ThemeContext writes darkNow.
 */
let vegNow = false;

export function setDietNow(veg: boolean) {
  vegNow = veg;
}

export function isVegNow(): boolean {
  return vegNow;
}

/** The diet tokens (the same values as components/local/dietLightTheme.ts useDietLight(), plus two derived accent
 * shades), so module-level palettes can follow the diet without a hook. Keep the two in step. */
export interface DietTokens {
  top: string; sel: string; un: string; acc: string; soft: string; page: string; pageDeep: string; dk: string;
  line: string; card: string; edge: string; track: string; mute: string; muteInk: string; onAcc: string;
  /** Pressed / deeper accent. */
  accDeep: string;
  /** A second band tone, a step deeper than `top` (gradients that used to run between two brand shades). */
  topDeep: string;
}

/** '#RRGGBB' mixed toward '#RRGGBB' by t (0..1). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const LIGHT_SURF = { card: '#FFFFFF', edge: 'rgba(17,17,26,0.10)', track: '#ECEEF3', mute: '#F2F3F6', muteInk: '#4B5160', onAcc: '#FFFFFF' };
const DARK_SURF = { card: '#1A1316', edge: 'rgba(255,255,255,0.08)', track: 'rgba(255,255,255,0.12)', mute: 'rgba(255,255,255,0.08)', muteInk: '#B4B4BC', line: 'rgba(255,255,255,0.08)' };
const withShades = (t: Omit<DietTokens, 'accDeep' | 'topDeep'>, dark: boolean): DietTokens => ({
  ...t,
  accDeep: mixHex(t.acc, dark ? '#FFFFFF' : '#000000', dark ? 0.12 : 0.16),
  topDeep: mixHex(t.top, t.un, 0.55),
});
// Owner, 26 Nov 2026: outside Home the app wears one brand look (logo yellow #FAE04B, navy #0F3960 accent) whatever
// the diet, so both diet slots hold it. Same values as components/local/dietLightTheme.ts.
const BRAND_LIGHT = withShades({ top: '#FAE04B', sel: '#FFF8D6', un: '#F2D43C', acc: '#0F3960', soft: '#FEF6CC', page: '#FFFCEB', dk: '#0F3960', line: '#F3E7B0', pageDeep: '#FDF5CF', ...LIGHT_SURF }, false);
const BRAND_DARK = withShades({ top: '#2A250A', sel: '#3A3312', un: '#1C1906', acc: '#FAE04B', soft: 'rgba(250,224,75,0.14)', dk: '#FFF6C7', page: '#0E0D08', pageDeep: '#0E0D08', onAcc: '#1A1A1A', ...DARK_SURF, card: '#1A1810' }, true);
const DIET: Record<'light' | 'dark', Record<'nonveg' | 'veg', DietTokens>> = {
  light: { nonveg: BRAND_LIGHT, veg: BRAND_LIGHT },
  dark: { nonveg: BRAND_DARK, veg: BRAND_DARK },
};

/** The diet tokens for the theme and diet in use right now. */
export function dietNow(): DietTokens {
  return DIET[darkNow ? 'dark' : 'light'][vegNow ? 'veg' : 'nonveg'];
}

/** The diet tokens of one fixed theme (a section always drawn light, or always dark), for the diet in use now. */
export function dietFor(dark: boolean): DietTokens {
  return DIET[dark ? 'dark' : 'light'][vegNow ? 'veg' : 'nonveg'];
}

/**
 * Like dietTokens, for a section drawn in one fixed theme whatever the app theme (Campus is always light, Friends
 * always dark): `make(d)` runs once per diet and every key answers for the diet in use right now.
 */
export function fixedDietTokens<T extends object>(dark: boolean, make: (d: DietTokens) => T): T {
  const cache: (T | undefined)[] = [];
  const current = (): T => {
    const i = vegNow ? 1 : 0;
    return (cache[i] ??= make(dietFor(dark)));
  };
  const first = current();
  return new Proxy(first, {
    get(_t, key) {
      return current()[key as keyof T];
    },
    has(_t, key) {
      return key in current();
    },
    ownKeys() {
      return Reflect.ownKeys(current());
    },
    getOwnPropertyDescriptor(_t, key) {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** '#RRGGBB' + alpha -> rgba(). */
export function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/** Which of the four looks (light/dark x Non-veg/Veg) is current: a cache slot. */
const lookSlot = () => (darkNow ? 2 : 0) + (vegNow ? 1 : 0);

/**
 * A token object built from the current diet: `make(d, dark)` runs once per look (light/dark x Non-veg/Veg) and
 * every key answers from the look in use right now. Same keys and types as `make` returns.
 */
export function dietTokens<T extends object>(make: (d: DietTokens, dark: boolean) => T): T {
  const cache: (T | undefined)[] = [];
  const current = (): T => {
    const i = lookSlot();
    return (cache[i] ??= make(dietNow(), darkNow));
  };
  const first = current();
  return new Proxy(first, {
    get(_t, key) {
      return current()[key as keyof T];
    },
    has(_t, key) {
      return key in current();
    },
    ownKeys() {
      return Reflect.ownKeys(current());
    },
    getOwnPropertyDescriptor(_t, key) {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** A palette's shape with its literal colours widened to string (gradient tuples keep their length), so a dark
 * palette can give its own values for the same keys. */
export type Palette<T> = {
  [K in keyof T]: T[K] extends readonly [unknown, unknown, unknown] ? readonly [string, string, string]
    : T[K] extends readonly [unknown, unknown] ? readonly [string, string]
      : T[K] extends string ? string
        : T[K] extends object ? Palette<T[K]> : T[K];
};

/** A token object that answers with the dark or the light palette, whichever is current. Same keys, same types. */
export function themedTokens<T extends object>(light: T, dark: T): T {
  return new Proxy(light, {
    get(_target, key) {
      return (darkNow ? dark : light)[key as keyof T];
    },
    has(_target, key) {
      return key in light;
    },
    ownKeys() {
      return Reflect.ownKeys(light);
    },
    getOwnPropertyDescriptor(_target, key) {
      const src = darkNow ? dark : light;
      const d = Reflect.getOwnPropertyDescriptor(src, key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/**
 * Drop-in for `StyleSheet.create({...})` in a themed section: `themedSheet(() => ({...}))`.
 * `make` runs once per look (light/dark x Non-veg/Veg; the tokens it reads answer for that look), and every
 * style lookup (`s.card`) returns the sheet for the look in use at render time.
 */
export function themedSheet<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(make: () => T): T {
  // One sheet per look (light/dark x Non-veg/Veg): diet-following sections read the diet tokens in `make`.
  const sheets: (T | undefined)[] = [];
  const current = (): T => {
    const i = lookSlot();
    return (sheets[i] ??= StyleSheet.create(make()));
  };
  return new Proxy({} as T, {
    get(_t, key) {
      return current()[key as keyof T];
    },
    has(_t, key) {
      return key in current();
    },
    ownKeys() {
      return Reflect.ownKeys(current());
    },
    getOwnPropertyDescriptor(_t, key) {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}
