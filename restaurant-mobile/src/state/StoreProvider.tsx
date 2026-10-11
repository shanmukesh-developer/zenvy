// Everything the logged-in store sees: live store state, orders, menu, connection, new-order ringing
// and the kitchen actions (each order has an in-flight lock; accept/reject/ready are never optimistic).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FALLBACK_POLL_MS } from '../constants/api';
import { ApiError, NetworkError, errorMessage } from '../services/apiClient';
import * as api from '../services/restaurantApi';
import { normalizeOrder, rupees, stageOf } from '../services/orderModel';
import { startRinging, stopRinging } from '../services/alertLoop';
import { startKitchenForegroundService } from '../services/voiceAlert';
import { loadSoundOn, saveSoundOn } from '../services/session';
import { useSocket } from '../services/socket';
import { useSession } from './SessionProvider';
import { useToast } from '../components/Toast';
import type { ConnStatus, MenuItem, Order, StoreProfile, StoreState } from '../types';

export type StockChange = { isAvailable: true } | { isAvailable: false } | { outOfStockUntil: string };

interface StoreCtx {
  restaurant: StoreProfile;
  store: StoreState | null;
  storeError: string | null;
  openToggleSupported: boolean;
  orders: Order[];
  ordersLoaded: boolean;
  ordersError: string | null;
  refreshing: boolean;
  lastSyncedAt: number | null;
  menu: MenuItem[] | null;
  menuError: string | null;
  menuPending: Record<string, boolean>;
  conn: ConnStatus;
  retryConnection: () => void;
  /** Pending orders not yet accepted / rejected / silenced, newest first. */
  alertOrders: Order[];
  busy: Record<string, 'accept' | 'reject' | 'ready'>;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  refreshOrders: (opts?: { pull?: boolean }) => Promise<void>;
  refreshStore: () => Promise<void>;
  refreshMenu: () => Promise<void>;
  silenceAlerts: () => void;
  accept: (o: Order, estDuration: number) => Promise<boolean>;
  reject: (o: Order, reason: string) => Promise<boolean>;
  markReady: (o: Order) => Promise<boolean>;
  setOpen: (open: boolean) => Promise<boolean>;
  setStock: (item: MenuItem, change: StockChange) => Promise<boolean>;
  setPrice: (item: MenuItem, price: number) => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

const STUB_KEEP_MS = 60000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { restaurant: maybeRestaurant, updateProfile } = useSession();
  // App only mounts this provider with a restaurant; the fallback covers the logout render.
  const restaurant = (maybeRestaurant || { id: '', name: '' }) as StoreProfile;
  const rid = restaurant.id;
  const { socket, status: conn, connectCount, retry } = useSocket();
  const toast = useToast();

  const [store, setStore] = useState<StoreState | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [openToggleSupported, setOpenToggleSupported] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuPending, setMenuPending] = useState<Record<string, boolean>>({});
  const [acked, setAcked] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<Record<string, 'accept' | 'reject' | 'ready'>>({});
  const [soundOn, setSoundOnState] = useState(true);

  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;
  const menuRef = useRef<MenuItem[] | null>(null);
  menuRef.current = menu;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const ordersInFlight = useRef<Promise<void> | null>(null);
  // A refresh asked for while one is in flight (e.g. a new-order socket event) runs again afterwards,
  // so a fetch that started before the order existed never leaves it as a bare socket stub.
  const ordersAgain = useRef(false);
  const refreshSelf = useRef<() => Promise<void>>(async () => {});
  const refreshOrders = useCallback(async (opts?: { pull?: boolean }) => {
    if (ordersInFlight.current) {
      ordersAgain.current = true;
      return ordersInFlight.current;
    }
    if (opts?.pull) setRefreshing(true);
    const run = (async () => {
      try {
        const fresh = await api.getOrders(rid);
        if (!alive.current) return;
        const ids = new Set(fresh.map((o) => o.id));
        const now = Date.now();
        // Keep a socket stub briefly if the list does not have it yet (replication / race).
        const stubs = ordersRef.current.filter((o) => o.partial && !ids.has(o.id) && now - new Date(o.createdAt || 0).getTime() < STUB_KEEP_MS);
        setOrders([...stubs, ...fresh]);
        setOrdersError(null);
        setOrdersLoaded(true);
        setLastSyncedAt(now);
      } catch (e) {
        if (!alive.current) return;
        setOrdersError(errorMessage(e, "Couldn't load orders."));
        if (opts?.pull) toast.show(errorMessage(e, "Couldn't load orders."), 'error');
      } finally {
        if (alive.current && opts?.pull) setRefreshing(false);
        ordersInFlight.current = null;
        if (ordersAgain.current && alive.current) {
          ordersAgain.current = false;
          refreshSelf.current();
        }
      }
    })();
    ordersInFlight.current = run;
    return run;
  }, [rid, toast]);
  refreshSelf.current = () => refreshOrders();

  const refreshStore = useCallback(async () => {
    try {
      const { store: s, raw } = await api.getStore(rid);
      if (!alive.current) return;
      setStore(s);
      setStoreError(null);
      updateProfile({
        name: raw?.name || restaurant.name,
        location: raw?.location,
        operatingHours: s.operatingHours,
        isOpenNow: s.isOpenNow,
        isOffline: s.isOffline,
        deliveryTime: s.deliveryTime ?? undefined,
      });
    } catch (e) {
      if (alive.current) setStoreError(errorMessage(e, "Couldn't load store status."));
    }
  }, [rid, updateProfile, restaurant.name]);

  const refreshMenu = useCallback(async () => {
    try {
      const m = await api.getMenu(rid);
      if (!alive.current) return;
      setMenu(m);
      setMenuError(null);
    } catch (e) {
      if (alive.current) setMenuError(errorMessage(e, "Couldn't load your menu."));
    }
  }, [rid]);

  // Debounced refetch after socket events (rider name, unassignment, full order for a stub).
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback((ms = 800) => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => { refreshOrders(); }, ms);
  }, [refreshOrders]);
  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleStore = useCallback(() => {
    if (storeTimer.current) clearTimeout(storeTimer.current);
    storeTimer.current = setTimeout(() => { refreshStore(); }, 500);
  }, [refreshStore]);
  useEffect(() => () => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    if (storeTimer.current) clearTimeout(storeTimer.current);
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    refreshOrders();
    refreshStore();
    refreshMenu();
    startKitchenForegroundService();
    loadSoundOn().then((on) => { if (alive.current) setSoundOnState(on); });
    return () => stopRinging();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After every (re)connect: refetch what may have been missed.
  useEffect(() => {
    if (connectCount > 0) {
      refreshOrders();
      refreshStore();
    }
  }, [connectCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback polling while the socket is down.
  useEffect(() => {
    if (conn === 'online') return;
    const t = setInterval(() => { refreshOrders(); }, FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [conn, refreshOrders]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refreshOrders();
        refreshStore();
      }
    });
    return () => sub.remove();
  }, [refreshOrders, refreshStore]);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onNewOrder = (p: any) => {
      const o = normalizeOrder({ ...p, status: p?.status || 'Pending', createdAt: p?.createdAt || new Date().toISOString(), __partial: true });
      if (o) setOrders((prev) => (prev.some((x) => x.id === o.id) ? prev : [o, ...prev]));
      scheduleRefetch(300);
    };
    const onStatus = (p: any) => {
      const id = p?.id || p?.orderId;
      const status = typeof p?.status === 'string' ? p.status : null;
      if (!id || !status) return;
      const known = ordersRef.current.find((o) => o.id === id);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status, stage: stageOf(status) } : o)));
      if (status === 'Cancelled' && p?.reason === 'STORE_TIMEOUT' && known) {
        toast.show(`Order #${known.shortId} was cancelled — not accepted in time`, 'error');
      } else if (status === 'Cancelled' && p?.reason !== 'STORE_DECLINED' && known && known.stage !== 'past') {
        toast.show(`Order #${known.shortId} was cancelled`, 'error');
      }
      scheduleRefetch(800);
    };
    const onInventory = (p: any) => {
      const itemId = p?.itemId;
      if (!itemId) return;
      if (p?.restaurantId ? p.restaurantId !== rid : !menuRef.current?.some((m) => m.id === itemId)) return;
      setMenu((prev) => prev && prev.map((m) => (m.id === itemId
        ? { ...m, isAvailable: p.isAvailable !== false, outOfStockUntil: p.isAvailable !== false ? null : m.outOfStockUntil }
        : m)));
    };
    const onStoreStatus = (p: any) => {
      if (p?.restaurantId === rid) scheduleStore();
    };
    socket.on('restaurant_newOrder', onNewOrder);
    socket.on('statusUpdated', onStatus);
    socket.on('inventory_updated', onInventory);
    socket.on('store_status_changed', onStoreStatus);
    return () => {
      socket.off('restaurant_newOrder', onNewOrder);
      socket.off('statusUpdated', onStatus);
      socket.off('inventory_updated', onInventory);
      socket.off('store_status_changed', onStoreStatus);
    };
  }, [socket, rid, scheduleRefetch, scheduleStore, toast]);

  // ── New-order alert ───────────────────────────────────────────────────────
  const alertOrders = useMemo(
    () => orders
      .filter((o) => o.stage === 'new' && !acked[o.id])
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [orders, acked],
  );
  const alertRef = useRef(alertOrders);
  alertRef.current = alertOrders;
  const alertKey = alertOrders.map((o) => o.id).join(',');

  useEffect(() => {
    if (soundOn && alertKey) startRinging(() => alertRef.current[0] || null);
    else stopRinging();
  }, [alertKey, soundOn]);

  const ack = useCallback((ids: string[]) => {
    setAcked((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = true; });
      return next;
    });
  }, []);
  const silenceAlerts = useCallback(() => {
    ack(alertRef.current.map((o) => o.id));
    stopRinging();
  }, [ack]);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on);
    saveSoundOn(on);
  }, []);

  // ── Kitchen actions ───────────────────────────────────────────────────────
  const patchOrder = (id: string, patch: Partial<Order>) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const runAction = useCallback(async (o: Order, kind: 'accept' | 'reject' | 'ready', fn: () => Promise<void>) => {
    if (busyRef.current[o.id]) return false;
    setBusy((b) => ({ ...b, [o.id]: kind }));
    try {
      await fn();
      scheduleRefetch(400);
      return true;
    } catch (e) {
      if (e instanceof NetworkError) {
        toast.show("Couldn't reach Zenvy — try again", 'error');
      } else if (e instanceof ApiError) {
        if (e.status !== 401) toast.show(e.message, 'error');
        scheduleRefetch(100); // the order may have been cancelled meanwhile
      } else {
        toast.show('Something went wrong. Please try again.', 'error');
      }
      return false;
    } finally {
      if (alive.current) setBusy((b) => { const n = { ...b }; delete n[o.id]; return n; });
    }
  }, [scheduleRefetch, toast]);

  const accept = useCallback((o: Order, est: number) => runAction(o, 'accept', async () => {
    await api.acceptOrder(o.id, est);
    ack([o.id]);
    patchOrder(o.id, { status: 'Accepted', stage: 'preparing', estDuration: est, acceptedAt: new Date().toISOString() });
    toast.show(`Order #${o.shortId} accepted · ${est} min`, 'success');
  }), [runAction, ack, toast]);

  const reject = useCallback((o: Order, reason: string) => runAction(o, 'reject', async () => {
    const res = await api.rejectOrder(o.id, reason);
    ack([o.id]);
    patchOrder(o.id, { status: 'Cancelled', stage: 'past', cancellationReason: reason });
    const refund = Number(res?.refundedToWallet) || 0;
    toast.show(refund > 0 ? `Order #${o.shortId} rejected · ${rupees(refund)} refunded to the customer` : `Order #${o.shortId} rejected`, 'info');
  }), [runAction, ack, toast]);

  const markReady = useCallback((o: Order) => runAction(o, 'ready', async () => {
    const res = await api.markReady(o.id);
    const now = new Date().toISOString();
    if (res?.status === 'Picking') {
      patchOrder(o.id, { readyAt: now });
      toast.show(`Rider told that #${o.shortId} is packed`, 'success');
    } else {
      patchOrder(o.id, { status: 'ReadyForPickup', stage: 'ready', readyAt: now });
      toast.show(`#${o.shortId} marked ready`, 'success');
    }
  }), [runAction, toast]);

  const setOpen = useCallback(async (open: boolean) => {
    try {
      const s = await api.setOpen(rid, open);
      setStore((prev) => ({
        ...(prev || s),
        isOpenNow: s.isOpenNow,
        isOpen: s.isOpen,
        opensAt: s.opensAt,
        closedReason: s.closedReason,
        operatingHours: s.operatingHours || prev?.operatingHours || null,
      }));
      updateProfile({ isOpenNow: s.isOpenNow });
      toast.show(s.isOpenNow ? (s.isOpen ? "You're online — accepting orders" : 'Switched on — outside your hours') : "You're offline — customers can't order", s.isOpenNow ? 'success' : 'info');
      return true;
    } catch (e) {
      if (e instanceof api.OpenToggleUnsupported) {
        setOpenToggleSupported(false);
        toast.show('Ask Zenvy support to change your store status for now.', 'info');
      } else if (!(e instanceof ApiError && e.status === 401)) {
        toast.show(errorMessage(e, "Couldn't change store status."), 'error');
      }
      return false;
    }
  }, [rid, updateProfile, toast]);

  const setStock = useCallback(async (item: MenuItem, change: StockChange) => {
    if (menuPending[item.id]) return false;
    setMenuPending((p) => ({ ...p, [item.id]: true }));
    try {
      const res = await api.setAvailability(item.id, change);
      const isAvailable = res?.isAvailable !== undefined ? !!res.isAvailable : ('isAvailable' in change ? change.isAvailable : false);
      const until = 'outOfStockUntil' in change ? (res?.outOfStockUntil || change.outOfStockUntil) : null;
      setMenu((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, isAvailable, outOfStockUntil: isAvailable ? null : until } : m)));
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
        toast.show('That item no longer exists. Refreshing your menu.', 'error');
        refreshMenu();
      } else {
        toast.show(errorMessage(e, "Couldn't update the item."), 'error');
      }
      return false;
    } finally {
      if (alive.current) setMenuPending((p) => { const n = { ...p }; delete n[item.id]; return n; });
    }
  }, [menuPending, refreshMenu, toast]);

  const setPrice = useCallback(async (item: MenuItem, price: number) => {
    await api.setPrice(item.id, price); // throws: the sheet shows the server message inline
    setMenu((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, price } : m)));
    toast.show(`${item.name} is now ${rupees(price)}`, 'success');
  }, [toast]);

  const value: StoreCtx = {
    restaurant, store, storeError, openToggleSupported, orders, ordersLoaded, ordersError, refreshing, lastSyncedAt,
    menu, menuError, menuPending, conn, retryConnection: () => { retry(); refreshOrders(); }, alertOrders, busy,
    soundOn, setSoundOn, refreshOrders, refreshStore, refreshMenu, silenceAlerts, accept, reject, markReady,
    setOpen, setStock, setPrice,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** One shared clock tick for elapsed times / countdowns (instead of one interval per card). */
const NowCtx = createContext<number>(Date.now());
export function NowProvider({ children, everyMs = 15000 }: { children: React.ReactNode; everyMs?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return <NowCtx.Provider value={now}>{children}</NowCtx.Provider>;
}
export const useNow = () => useContext(NowCtx);
