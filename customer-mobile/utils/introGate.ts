import { useEffect, useState } from 'react';

// The launch intro and the first screen behind it used to compete for the UI thread: measured on a Vivo V2439,
// Home's first render (lists, cards, image decodes) froze the intro for up to 0.6 s at a time. Heavy screens read
// useIntroDone() and draw their full content only after the intro has finished; their data still loads meanwhile.

let done = false;
const listeners = new Set<() => void>();

/** Called by IntroOverlay when it has fully left the screen (also on skip and on reduce motion). */
export function markIntroDone() {
  if (done) return;
  done = true;
  listeners.forEach((fn) => { try { fn(); } catch { /* listener gone */ } });
  listeners.clear();
}

export function isIntroDone() {
  return done;
}

/** True once the launch intro has finished (always true after the first launch of this JS session). */
export function useIntroDone(): boolean {
  const [isDone, setIsDone] = useState(done);
  useEffect(() => {
    if (done) { setIsDone(true); return; }
    const fn = () => setIsDone(true);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return isDone;
}

// Launch settled (owner, 27 Nov 2026: the first-order feedback box appeared while the app was still starting): the
// intro has finished AND the full-screen store ad after it has closed or was not shown (AdSplashHost calls
// markLaunchSettled when it is gone). Popups that should wait for the app to be fully on screen read
// useLaunchSettled(). Safety net: settled 20 s after the intro even if the ad host never reports.
let settled = false;
const settledListeners = new Set<() => void>();

export function markLaunchSettled() {
  if (settled) return;
  settled = true;
  settledListeners.forEach((fn) => { try { fn(); } catch { /* listener gone */ } });
  settledListeners.clear();
}

export function useLaunchSettled(): boolean {
  const introDone = useIntroDone();
  const [isSettled, setIsSettled] = useState(settled);
  useEffect(() => {
    if (settled) { setIsSettled(true); return; }
    const fn = () => setIsSettled(true);
    settledListeners.add(fn);
    return () => { settledListeners.delete(fn); };
  }, []);
  useEffect(() => {
    if (!introDone || settled) return;
    const t = setTimeout(markLaunchSettled, 20_000);
    return () => clearTimeout(t);
  }, [introDone]);
  return isSettled;
}
