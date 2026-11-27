/**
 * Add-to-cart effect channel (owner, 27 Nov 2026: "the add to cart should pop up like this video"). CartContext emits
 * `cartAdded` whenever a new item goes into the basket; components/CartDropFx plays the motion: the item's photo pops
 * up from the exact spot that was tapped, tumbles back down into the button, then an "Added to basket" card slides in.
 *
 * The tap point comes from the app root (app/_layout records every touch start, see recordTouch), so no add button
 * has to pass its position. An add with no recent tap (reorder, a sheet confirming after a delay) still gets the card.
 */
export type CartAddedEvent = { image: string; name: string; at: number; x: number | null; y: number | null };

type Listener = (e: CartAddedEvent) => void;
const listeners = new Set<Listener>();
let lastTouch = { x: 0, y: 0, t: 0 };

/** Called by the app root on every touch start (capture phase, never claims the touch). */
export function recordTouch(x: number, y: number) {
  lastTouch = { x, y, t: Date.now() };
}

/** CartContext: a new line (or more of one) went into the basket. */
export function emitCartAdded(image: string, name: string) {
  const now = Date.now();
  const recent = now - lastTouch.t < 1200; // the tap that caused it; older = no flight, card only
  const e: CartAddedEvent = { image: image || '', name: name || 'Item', at: now, x: recent ? lastTouch.x : null, y: recent ? lastTouch.y : null };
  listeners.forEach((fn) => { try { fn(e); } catch { /* listener gone */ } });
}

export function onCartAdded(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── Landing spots ───────────────────────────────────────────────────────────────────────────────────
// The basket bars / basket button on screen register here (components/CartDropTarget). The flying photo lands in
// the best one that is on screen right now: highest priority (a "View basket" bar beats the round button), then
// the most recently registered. measure() answers null when the target is not on screen.
export type DropTarget = { id: number; priority: number; measure: () => Promise<{ x: number; y: number } | null>; land: () => void };
const targets: DropTarget[] = [];
let nextTargetId = 1;

export function registerDropTarget(t: Omit<DropTarget, 'id'>): () => void {
  const entry = { ...t, id: nextTargetId++ };
  targets.push(entry);
  return () => { const i = targets.indexOf(entry); if (i >= 0) targets.splice(i, 1); };
}

/** The landing spot for a drop right now (null: none on screen, the photo falls back into the tapped button). */
export async function findDropTarget(): Promise<{ x: number; y: number; land: () => void } | null> {
  const ordered = [...targets].sort((a, b) => b.priority - a.priority || b.id - a.id);
  for (const t of ordered) {
    try {
      const p = await t.measure();
      if (p) return { ...p, land: t.land };
    } catch { /* gone */ }
  }
  return null;
}
