/**
 * After-delivery spin pop-up (owner, 25 Nov 2026): every 5 delivered orders = 1 free spin. When the app learns an
 * order was delivered (the tracking screen sees Delivered, or Home gains focus after a delivery that happened while
 * the app was closed) it asks the server for the truth (GET /api/rewards/spin-progress) and shows ONE pop-up per
 * finished order: "You earned a free spin!" when that order completed a group of 5, else "N more orders to earn a
 * free spin". The last order shown is remembered per account in AsyncStorage, so it never shows twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';
import { apiFetch, readJson } from './auth';
import { ORDERS_PER_SPIN } from './spinRules';

export interface SpinProgress {
  ordersPerSpin: number;
  deliveredCount: number;
  /** Orders done towards the next spin, 0..ordersPerSpin-1. */
  progress: number;
  /** Orders still needed for the next spin, 1..ordersPerSpin. */
  toNext: number;
  spinsAvailable: number;
  /** The last finished order completed a group of ordersPerSpin. */
  justEarnedSpin: boolean;
  lastDeliveredAt: string | null;
  lastDeliveredOrderId: string | null;
  lastDeliveredKind: string | null;
}

const KEY = (uid: string) => `zw.spinPopup.v1.${uid}`;
type Seen = { ref: string | null; count: number };

/** GET /api/rewards/spin-progress, normalised; null when signed out / offline / older server. */
export async function fetchSpinProgress(): Promise<SpinProgress | null> {
  try {
    const res = await apiFetch(`${API_URL}/api/rewards/spin-progress`, { noWakeRetry: true });
    if (!res.ok) return null;
    const d = await readJson(res);
    if (!d || typeof d !== 'object') return null;
    const per = Number(d.ordersPerSpin) > 0 ? Number(d.ordersPerSpin) : ORDERS_PER_SPIN;
    const count = Math.max(0, Number(d.deliveredCount) || 0);
    const progress = Number.isFinite(Number(d.progress)) ? Number(d.progress) : count % per;
    return {
      ordersPerSpin: per,
      deliveredCount: count,
      progress,
      toNext: Number(d.toNext) > 0 ? Number(d.toNext) : per - progress,
      spinsAvailable: Math.max(0, Number(d.spinsAvailable) || 0),
      justEarnedSpin: !!d.justEarnedSpin,
      lastDeliveredAt: d.lastDeliveredAt || null,
      lastDeliveredOrderId: d.lastDeliveredOrderId != null ? String(d.lastDeliveredOrderId) : null,
      lastDeliveredKind: d.lastDeliveredKind || null,
    };
  } catch {
    return null;
  }
}

const refOf = (p: SpinProgress) => (p.lastDeliveredOrderId ? `${p.lastDeliveredKind || 'order'}:${p.lastDeliveredOrderId}` : null);

async function readSeen(uid: string): Promise<Seen | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY(uid));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? { ref: v.ref || null, count: Number(v.count) || 0 } : null;
  } catch {
    return null;
  }
}
async function writeSeen(uid: string, p: SpinProgress) {
  try { await AsyncStorage.setItem(KEY(uid), JSON.stringify({ ref: refOf(p), count: p.deliveredCount, at: Date.now() })); } catch { /* best effort */ }
}

// One check at a time (Home focus and the tracking screen can fire together), and refs shown in this app run.
let running = false;
const shownThisRun = new Set<string>();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Decides whether a pop-up is due. `orderId` (tracking screen): that order was just delivered; the server's last
 * counted order must be it (one retry, the credit lands a moment after the status). Without it (Home focus): a
 * finished order the device has not shown yet. The first check on a device only records where the account is,
 * so older deliveries never pop up after an update. Returns the progress to show, or null.
 */
export async function spinPopupDue(uid: string, orderId?: string | null): Promise<SpinProgress | null> {
  if (!uid || running) return null;
  running = true;
  try {
    let p = await fetchSpinProgress();
    if (orderId && p && p.lastDeliveredOrderId !== String(orderId)) {
      await wait(2500);
      p = await fetchSpinProgress();
    }
    if (!p) return null;
    const ref = refOf(p);
    const seen = await readSeen(uid);
    if (!ref || shownThisRun.has(ref)) return null;
    const isThisOrder = !!orderId && p.lastDeliveredOrderId === String(orderId);
    if (!seen) {
      await writeSeen(uid, p);
      return isThisOrder ? (shownThisRun.add(ref), p) : null;
    }
    if (seen.ref === ref || p.deliveredCount <= seen.count) {
      if (seen.ref !== ref || p.deliveredCount !== seen.count) await writeSeen(uid, p);
      return null;
    }
    // Home focus: only a delivery of the last 3 days (an old one seen on another device stays quiet).
    if (!orderId && p.lastDeliveredAt && Date.now() - new Date(p.lastDeliveredAt).getTime() > 3 * 86400000) {
      await writeSeen(uid, p);
      return null;
    }
    await writeSeen(uid, p);
    shownThisRun.add(ref);
    return p;
  } finally {
    running = false;
  }
}
