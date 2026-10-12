"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { useLiveSync } from '@/lib/useLiveSync';
import { istDay } from './helpers';

/** Orders scanned for the per-store numbers. GET /api/admin/orders has no store / date filter yet. */
export const ORDER_SCAN_LIMIT = 500;

export interface StoreOrder {
  _id: string;
  id?: string;
  restaurantId: string;
  status: string;
  totalPrice: number;
  finalPrice: number;
  paymentMethod?: string | null;
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

export interface StatsCoverage {
  /** Every order placed today (IST) was in the scan. */
  todayComplete: boolean;
  /** Every order of the last 7 days was in the scan. */
  weekComplete: boolean;
  scanned: number;
  total: number;
}

const EMPTY: StoreStats = { todayOrders: 0, todayRevenue: 0, weekOrders: 0, weekRevenue: 0, cancelledToday: 0, lastOrderAt: null };

/**
 * Per-store order numbers computed from the latest orders (real data only).
 * Revenue = item subtotal (`totalPrice`) of orders that were not cancelled, which is the store's GMV
 * (finalPrice also contains the rider fee). Refreshes on live order events.
 */
export function useStoreStats(enabled: boolean) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    try {
      const data = await adminRequest<{ orders?: StoreOrder[]; total?: number }>(`/api/admin/orders?limit=${ORDER_SCAN_LIMIT}&page=1`);
      const list = Array.isArray(data?.orders) ? data!.orders! : [];
      setOrders(list);
      setTotal(Number(data?.total) || list.length);
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

  const { byStore, coverage } = useMemo(() => {
    const now = new Date();
    const today = istDay(now);
    const weekStart = now.getTime() - 7 * 86400 * 1000;
    const map = new Map<string, StoreStats>();
    for (const o of orders) {
      const id = String(o.restaurantId || '');
      if (!id) continue;
      const created = new Date(o.createdAt);
      const t = created.getTime();
      if (!Number.isFinite(t)) continue;
      const s = map.get(id) || { ...EMPTY };
      if (!s.lastOrderAt || t > new Date(s.lastOrderAt).getTime()) s.lastOrderAt = o.createdAt;
      const cancelled = o.status === 'Cancelled';
      const amount = Number(o.totalPrice) || 0;
      if (t >= weekStart && !cancelled) { s.weekOrders++; s.weekRevenue += amount; }
      if (istDay(created) === today) {
        if (cancelled) s.cancelledToday++;
        else { s.todayOrders++; s.todayRevenue += amount; }
      }
      map.set(id, s);
    }
    const oldest = orders.length ? new Date(orders[orders.length - 1].createdAt) : null;
    const complete = orders.length >= total;
    return {
      byStore: map,
      coverage: {
        todayComplete: complete || (!!oldest && istDay(oldest) < today),
        weekComplete: complete || (!!oldest && oldest.getTime() < weekStart),
        scanned: orders.length,
        total,
      } as StatsCoverage,
    };
  }, [orders, total]);

  const statsFor = useCallback((id: string) => byStore.get(id) || EMPTY, [byStore]);
  const ordersFor = useCallback((id: string) => orders.filter(o => String(o.restaurantId) === id), [orders]);

  const totals = useMemo(() => {
    let todayOrders = 0; let todayRevenue = 0;
    byStore.forEach(s => { todayOrders += s.todayOrders; todayRevenue += s.todayRevenue; });
    return { todayOrders, todayRevenue };
  }, [byStore]);

  return { loading, error, reload: load, statsFor, ordersFor, coverage, totals };
}

export interface PayoutRow { restaurantId: string; totalOrders: number; totalGMV: number; totalCommission: number; netPayout: number }

/** Unsettled payout for one store (GET /api/admin/finance/payouts: delivered, not yet settled orders). */
export function useStorePayout(id: string) {
  const [row, setRow] = useState<PayoutRow | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const load = useCallback(async () => {
    try {
      const rows = await adminRequest<PayoutRow[]>('/api/admin/finance/payouts');
      setRow((Array.isArray(rows) ? rows : []).find(r => String(r.restaurantId) === id) || null);
      setState('ok');
    } catch {
      setState('error');
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useLiveSync(['order'], () => { load(); }, { debounceMs: 2000 });
  return { row, state };
}
