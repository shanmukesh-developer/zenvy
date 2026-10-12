"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { useLiveSync } from '@/lib/useLiveSync';

export interface StoreOrder {
  _id: string;
  id?: string;
  restaurantId: string;
  status: string;
  totalPrice: number;
  finalPrice: number;
  paymentMethod?: string | null;
  fulfilment?: string | null;
  createdAt: string;
  user?: { name?: string } | null;
}

export interface StoreStats {
  todayOrders: number;
  todayRevenue: number;
  weekOrders: number;
  weekRevenue: number;
  cancelledToday: number;
  lastOrderAt: string | null;
}

/** One row of GET /api/admin/restaurants/stats. */
interface StatsRow { restaurantId: string; orders: number; cancelled: number; gmv: number; lastOrderAt: string | null }

const EMPTY: StoreStats = { todayOrders: 0, todayRevenue: 0, weekOrders: 0, weekRevenue: 0, cancelledToday: 0, lastOrderAt: null };

/** Start of today in IST, as a Date. */
const istMidnight = (now = new Date()) => {
  const IST = 5.5 * 3600 * 1000;
  const ist = new Date(now.getTime() + IST);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST);
};

/**
 * Per-store order numbers from the server (GET /api/admin/restaurants/stats): today (IST) and the last 7 days.
 * `orders` excludes cancelled orders; revenue is the item subtotal (GMV) of non-cancelled orders.
 * Refreshes on live order events.
 */
export function useStoreStats(enabled: boolean) {
  const [today, setToday] = useState<StatsRow[]>([]);
  const [week, setWeek] = useState<StatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const start = istMidnight();
      const end = new Date(start.getTime() + 86400 * 1000);
      const weekStart = new Date(end.getTime() - 7 * 86400 * 1000);
      const q = (from: Date, to: Date) => `/api/admin/restaurants/stats?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      const [t, w] = await Promise.all([adminRequest<StatsRow[]>(q(start, end)), adminRequest<StatsRow[]>(q(weekStart, end))]);
      setToday(Array.isArray(t) ? t : []);
      setWeek(Array.isArray(w) ? w : []);
      setError('');
      loadedOnce.current = true;
    } catch (e) {
      if (!loadedOnce.current) setError(e instanceof Error ? e.message : 'Could not load order numbers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useLiveSync(['order'], () => { load(); }, { enabled, debounceMs: 1500 });

  const byStore = useMemo(() => {
    const map = new Map<string, StoreStats>();
    const get = (id: string) => map.get(id) || { ...EMPTY };
    for (const r of week) {
      const s = get(String(r.restaurantId));
      s.weekOrders = Number(r.orders) || 0;
      s.weekRevenue = Number(r.gmv) || 0;
      s.lastOrderAt = r.lastOrderAt || null;
      map.set(String(r.restaurantId), s);
    }
    for (const r of today) {
      const s = get(String(r.restaurantId));
      s.todayOrders = Number(r.orders) || 0;
      s.todayRevenue = Number(r.gmv) || 0;
      s.cancelledToday = Number(r.cancelled) || 0;
      if (!s.lastOrderAt || (r.lastOrderAt && r.lastOrderAt > s.lastOrderAt)) s.lastOrderAt = r.lastOrderAt || s.lastOrderAt;
      map.set(String(r.restaurantId), s);
    }
    return map;
  }, [today, week]);

  const statsFor = useCallback((id: string) => byStore.get(id) || EMPTY, [byStore]);

  const totals = useMemo(() => {
    let todayOrders = 0; let todayRevenue = 0;
    byStore.forEach(s => { todayOrders += s.todayOrders; todayRevenue += s.todayRevenue; });
    return { todayOrders, todayRevenue };
  }, [byStore]);

  return { loading, error, reload: load, statsFor, totals };
}

/** Latest orders of one store (GET /api/admin/orders?restaurantId=…), live. */
export function useStoreOrders(id: string, limit = 30) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const load = useCallback(async () => {
    try {
      const data = await adminRequest<{ orders?: StoreOrder[] }>(`/api/admin/orders?restaurantId=${encodeURIComponent(id)}&limit=${limit}&page=1`);
      setOrders(Array.isArray(data?.orders) ? data!.orders! : []);
      setState('ok');
    } catch {
      setState(prev => (prev === 'ok' ? 'ok' : 'error'));
    }
  }, [id, limit]);
  useEffect(() => { setState('loading'); load(); }, [load]);
  useLiveSync(['order'], () => { load(); }, { debounceMs: 1500 });
  return { orders, state, reload: load };
}

export interface PayoutRow { restaurantId: string; totalOrders: number; totalGMV: number; totalCommission: number; netPayout: number }

/** Unsettled payout for one store (GET /api/admin/finance/payouts: delivered, not yet settled orders). */
export function useStorePayout(id: string, enabled = true) {
  const [row, setRow] = useState<PayoutRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await adminRequest<PayoutRow[]>('/api/admin/finance/payouts');
      setRow((Array.isArray(rows) ? rows : []).find(r => String(r.restaurantId) === id) || null);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [id, enabled]);
  useEffect(() => { load(); }, [load]);
  useLiveSync(['order'], () => { load(); }, { debounceMs: 2000, enabled });
  return { row, state };
}
