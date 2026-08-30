import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DietMode = 'all' | 'veg' | 'egg' | 'eggarian' | 'non-veg' | 'nonveg';

export interface DietPrefs {
  mode: DietMode;
  nuts: boolean;
  dairy: boolean;
  gluten: boolean;
  custom?: string[];
}

interface DietaryContextType {
  dietMode: DietMode;
  dietPrefs: DietPrefs;
  setDietMode: (mode: DietMode) => void;
  updateDietPrefs: (prefs: DietPrefs) => void;
  isItemAllowed: (item: any) => boolean;
  reload: () => Promise<void>;
}

const DEFAULT_PREFS: DietPrefs = { mode: 'all', nuts: false, dairy: false, gluten: false, custom: [] };

const DietaryContext = createContext<DietaryContextType>({
  dietMode: 'all',
  dietPrefs: DEFAULT_PREFS,
  setDietMode: () => {},
  updateDietPrefs: () => {},
  isItemAllowed: () => true,
  reload: async () => {},
});

export function DietaryProvider({ children }: { children: React.ReactNode }) {
  const [dietPrefs, setDietPrefs] = useState<DietPrefs>(DEFAULT_PREFS);

  const loadPrefs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('zenvy_diet_prefs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.mode) {
          setDietPrefs(parsed);
        }
      }
    } catch (e) {
      console.log('DietaryContext: Error loading preferences', e);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const setDietMode = useCallback(async (mode: DietMode) => {
    const updated = { ...dietPrefs, mode };
    setDietPrefs(updated);
    await AsyncStorage.setItem('zenvy_diet_prefs', JSON.stringify(updated));
  }, [dietPrefs]);

  const updateDietPrefs = useCallback(async (prefs: DietPrefs) => {
    setDietPrefs(prefs);
    await AsyncStorage.setItem('zenvy_diet_prefs', JSON.stringify(prefs));
  }, []);

  /**
   * Determines if a food item should be shown based on the active dietary mode.
   * 
   * Logic:
   * - 'all': Show everything
   * - 'veg': Only show items where isVegetarian === true (strictly no meat, no egg)
   * - 'eggarian': Show veg items + egg items (items with egg tag/category but not meat)
   * - 'nonveg': Show only non-veg items (meat, chicken, fish, etc.)
   */
  const isItemAllowed = useCallback((item: any): boolean => {
    const mode = dietPrefs.mode;
    if (!mode || mode === 'all') return true;

    const isVeg = item.isVegetarian === true || 
                  String(item.isVegetarian).toLowerCase() === 'true' || 
                  Number(item.isVegetarian) === 1 || 
                  (item.tags || []).includes('veg') || 
                  (item.tags || []).includes('fruits');

    const tags = (item.tags || []).map((t: string) => t.toLowerCase());
    const name = (item.name || '').toLowerCase();
    const category = (item.category || '').toLowerCase();

    const isEgg = tags.includes('egg') || tags.includes('eggarian') || 
                  name.includes('egg') || category.includes('egg');

    if (mode === 'veg') {
      return isVeg && !isEgg; // Strict veg: no egg, no meat
    }

    if (mode === 'egg' || mode === 'eggarian') {
      return isVeg || isEgg; // Veg + egg items allowed, no meat
    }

    if (mode === 'nonveg' || mode === 'non-veg') {
      return !isVeg; // Only non-veg items
    }

    return true;
  }, [dietPrefs.mode]);

  return (
    <DietaryContext.Provider value={{
      dietMode: dietPrefs.mode,
      dietPrefs,
      setDietMode,
      updateDietPrefs,
      isItemAllowed,
      reload: loadPrefs,
    }}>
      {children}
    </DietaryContext.Provider>
  );
}

export const useDietary = () => useContext(DietaryContext);
export default DietaryContext;
