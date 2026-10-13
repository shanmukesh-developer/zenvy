"use client";
import { useEffect, useRef } from 'react';

/**
 * setInterval that pauses while the tab is hidden (no background requests to Render from an
 * idle tab) and catches up once when the tab becomes visible again if a tick was missed.
 * `ms <= 0` or `enabled === false` turns it off. The latest `fn` is always used.
 */
export function useVisibleInterval(fn: () => void, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || ms <= 0) return;
    let last = Date.now();
    const tick = () => {
      if (document.hidden) return;
      last = Date.now();
      fnRef.current();
    };
    const timer = setInterval(tick, ms);
    const onVisible = () => {
      if (!document.hidden && Date.now() - last >= ms) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ms, enabled]);
}
