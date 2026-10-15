import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from 'expo-router/react-navigation';

/**
 * true while the app is in the foreground AND the navigator screen this component lives in is focused.
 * Outside a navigator screen only the app state counts. Use it to pause polling / timers.
 */
export function useScreenActive(): boolean {
  const navigation = useContext(NavigationContext) as any;
  const [appActive, setAppActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [focused, setFocused] = useState(() => {
    try { return navigation && typeof navigation.isFocused === 'function' ? !!navigation.isFocused() : true; } catch { return true; }
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    try { setFocused(!!navigation.isFocused()); } catch {}
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      try { offFocus?.(); offBlur?.(); } catch {}
    };
  }, [navigation]);

  return appActive && focused;
}
