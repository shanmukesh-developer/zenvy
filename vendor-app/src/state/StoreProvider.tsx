// Everything the logged-in stall sees and does: live shop state, orders, menu, connection, the
// new-order alert list, and the order actions. Each order has an in-flight lock (no double submits);
// order actions are never optimistic (the server decides), stock / menu update on success.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FALLBACK_POLL_MS, SAFETY_POLL_MS } from '../config';
import * as api from '../lib/api';
import { ApiError, NetworkError, errorMessage } from '../lib/http';
import { normalizeOrder, rupees, stageOf, TIMEOUT_REASON_TEXT, todayNumbers } from '../lib/model';
import { onOrderPush, onPushTokenChange, registerStorePush } from '../lib/push';
import { startKitchenService } from '../voice/kitchenService';
import { announce, cancelAnnouncements, detectVoices } from '../voice/voice';
import { useToast } from '../ui/Toast';
import { useSocket } from './SocketProvider';
import { useSession } from './SessionProvider';
import type { ConnStatus, ItemInput, MenuItem, OperatingHours, Order, StoreProfile, StoreState } from '../types';

export type BusyKind = 'accept' | 'reject' | 'out' | 'delivered' | 'cancel';
export type DeleteResult = { ok: true } | { ok: false; error: string };
export type Result = { ok: boolean; error?: string };

interface StoreCtx {
  restaurant: StoreProfile;
  store: StoreState | null;
  storeError: string | null;
  orders: Order[];
  ordersLoaded: boolean;
  ordersError: string | null;
  refreshing: boolean;
  lastSyncedAt: number | null;
  menu: MenuItem[] | null;
  menuError: string | null;
  menuLoading: boolean;
  menuPending: Record<string, boolean>;
  conn: ConnStatus;
  /** Pending orders not yet accepted / rejected, oldest first. */
  alertOrders: Order[];
  busy: Record<string, BusyKind>;
  /** Last failed action per order (shown inline: toasts sit behind the alert / sheet modals). */
  actionErrors: Record<string, string>;
  retryConnection: () => void;
  refreshOrders: (opts?: { pull?: boolean }) => Promise<void>;
  refreshStore: () => Promise<void>;
  refreshMenu: () => Promise<void>;
  accept: (o: Order) => Promise<boolean>;
  reject: (o: Order, reason: string) => Promise<boolean>;
  outForDelivery: (o: Order) => Promise<boolean>;
  delivered: (o: Order) => Promise<boolean>;
  cancel: (o: Order, reason: string) => Promise<boolean>;
  setOpen: (open: boolean) => Promise<Result>;
  setHours: (hours: OperatingHours) => Promise<Result>;
  setStock: (item: MenuItem, isAvailable: boolean) => Promise<boolean>;
  /** Add (editing = null) or edit an item. Throws with a friendly message; the form shows it inline. */
  saveItem: (input: ItemInput, editing: MenuItem | null) => Promise<MenuItem>;
  deleteItem: (item: MenuItem) => Promise<DeleteResult>;
}

const Ctx = createContext<StoreCtx | null>(null);

/** A socket stub that the list does not have yet is kept this long (replication / race). */
const STUB_KEEP_MS = 60000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { restaurant: maybeRestaurant, updateProfile } = useSession();
  // Only mounted with a stall; the fallback covers the logout render.
  const restaurant = (maybeRestaurant || { id: '', name: '' }) as StoreProfile;
  const rid = restaurant.id;
  const { socket, status: conn, connectCount, retry } = useSocket();
  const toast = useToast();

  const [store, setStore] = useState<StoreState | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuPending, setMenuPending] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, BusyKind>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // Status changes learned locally (our own action or a socket event). A list fetch that was already in
  // flight when they happened carries the older status, so they are re-applied on top of it; otherwise an
  // accepted order would briefly come back as Pending and ring again.
  const localPatches = useRef<Record<string, { at: number; patch: Partial<Order> }>>({});
  const patchOrderRef = useRef<(id: string, patch: Partial<Order>) => void>(() => {});
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;
  const busyRef = useRef<Record<string, BusyKind>>({});
  const menuPendingRef = useRef<Record<string, boolean>>({});
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // ── Fetchers (coalesced: a refresh asked for during one in flight runs once more afterwards) ──
  const ordersInFlight = useRef<Promise<void> | null>(null);
  const ordersAgain = useRef(false);
  const refreshOrdersRef = useRef<(opts?: { pull?: boolean }) => Promise<void>>(async () => {});
  const refreshOrders = useCallback(async (opts?: { pull?: boolean }) => {
    if (opts?.pull) setRefreshing(true);
    if (ordersInFlight.current) {
      ordersAgain.current = true;
      return ordersInFlight.current;
    }
    const run = (async () => {
      const startedAt = Date.now();
      try {
        const fetched = await api.getOrders(rid);
        if (!alive.current) return;
        const lp = localPatches.current;
        const fresh = fetched.map((o) => {
          const p = lp[o.id];
          if (!p) return o;
          if (p.at < startedAt) { delete lp[o.id]; return o; } // the server already had it
          const merged = { ...o, ...p.patch };
          return { ...merged, stage: stageOf(merged.status) };
        });
        const ids = new Set(fresh.map((o) => o.id));
        const now = Date.now();
        for (const k of Object.keys(lp)) if (now - lp[k].at > 5 * 60000) delete lp[k];
        const stubs = ordersRef.current.filter(
          (o) => o.partial && !ids.has(o.id) && now - new Date(o.createdAt || 0).getTime() < STUB_KEEP_MS,
        );
        setOrders([...stubs, ...fresh]);
        setOrdersError(null);
        setOrdersLoaded(true);
        setLastSyncedAt(now);
      } catch (e) {
        if (!alive.current) return;
        const msg = errorMessage(e, "Couldn't load orders.");
        setOrdersError(msg);
        if (opts?.pull) toast.show(msg, 'error');
      } finally {
        ordersInFlight.current = null;
        if (alive.current) setRefreshing(false);
        if (ordersAgain.current && alive.current) {
          ordersAgain.current = false;
          refreshOrdersRef.current();
        }
      }
    })();
    ordersInFlight.current = run;
    return run;
  }, [rid, toast]);
  refreshOrdersRef.current = refreshOrders;

  const storeInFlight = useRef(false);
  const refreshStore = useCallback(async () => {
    if (storeInFlight.current) return;
    storeInFlight.current = true;
    try {
      const { store: s, raw } = await api.getStore(rid);
      if (!alive.current) return;
      setStore(s);
      setStoreError(null);
      updateProfile({
        name: typeof raw?.name === 'string' && raw.name ? raw.name : undefined,
        location: s.location,
        campus: typeof raw?.campus === 'string' ? raw.campus : undefined,
        operatingHours: s.operatingHours,
        isOpenNow: s.isOpenNow,
      });
    } catch (e) {
      if (alive.current) setStoreError(errorMessage(e, "Couldn't load shop status."));
    } finally {
      storeInFlight.current = false;
    }
  }, [rid, updateProfile]);

  const menuInFlight = useRef(false);
  const refreshMenu = useCallback(async () => {
    if (menuInFlight.current) return;
    menuInFlight.current = true;
    setMenuLoading(true);
    try {
      const m = await api.getMenu(rid);
      if (!alive.current) return;
      setMenu(m);
      setMenuError(null);
    } catch (e) {
      if (alive.current) setMenuError(errorMessage(e, "Couldn't load your menu."));
    } finally {
      menuInFlight.current = false;
      if (alive.current) setMenuLoading(false);
    }
  }, [rid]);

  // Debounced refetches after socket events.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounce = useCallback((name: string, ms: number, fn: () => void) => {
    if (timers.current[name]) clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(() => {
      delete timers.current[name];
      if (alive.current) fn();
    }, ms);
  }, []);
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);
  const scheduleOrders = useCallback((ms = 800) => debounce('orders', ms, () => { refreshOrdersRef.current(); }), [debounce]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    refreshOrders();
    refreshStore();
    refreshMenu();
    startKitchenService();
    // Order pushes while the app is closed (FCM via the server). Best effort: never blocks the app.
    registerStorePush(rid);
    const offToken = onPushTokenChange(rid);
    const offPush = onOrderPush((d) => {
      if (d?.type === 'NEW_ORDER' || d?.type === 'ORDER_CANCELLED' || d?.orderId) scheduleOrders(300);
    });
    return () => { offToken(); offPush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After every (re)connect: refetch what may have been missed while offline (events are not replayed).
  useEffect(() => {
    if (connectCount > 0) {
      refreshOrders();
      refreshStore();
    }
  }, [connectCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: fast while the socket is down, slow safety net while it is up.
  useEffect(() => {
    const t = setInterval(() => { refreshOrdersRef.current(); }, conn === 'online' ? SAFETY_POLL_MS : FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [conn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refreshOrdersRef.current();
        refreshStore();
        detectVoices();
        // Android may have stopped the foreground service while we were away: start it again.
        startKitchenService();
      }
    });
    return () => sub.remove();
  }, [refreshStore]);

  // ── Socket events (room restaurant_<id>, contract §5) ─────────────────────
  useEffect(() => {
    if (!socket) return;
    const onNewOrder = (p: any) => {
      const o = normalizeOrder({ ...p, status: p?.status || 'Pending', createdAt: p?.createdAt || new Date().toISOString(), __partial: true });
      if (o) setOrders((prev) => (prev.some((x) => x.id === o.id) ? prev : [o, ...prev]));
      scheduleOrders(300);
    };
    const onStatus = (p: any) => {
      const id = p?.id || p?.orderId;
      const status = typeof p?.status === 'string' ? p.status : null;
      if (!id) return;
      if (status) {
        const patch: Partial<Order> = { status };
        if (status === 'Cancelled' && p?.reason === 'STORE_TIMEOUT') patch.cancellationReason = TIMEOUT_REASON_TEXT;
        else if (status === 'Cancelled' && typeof p?.reason === 'string' && p.reason && !/^[A-Z_]+$/.test(p.reason)) patch.cancellationReason = p.reason;
        patchOrderRef.current(id, patch);
      }
      scheduleOrders(800);
    };
    const onCancelled = (p: any) => {
      if (p?.orderId) onStatus({ id: p.orderId, status: 'Cancelled', reason: p.reason });
    };
    const onInventory = (p: any) => {
      const itemId = p?.itemId;
      if (!itemId || (p?.restaurantId && p.restaurantId !== rid)) return;
      setMenu((prev) => prev && prev.map((m) => (m.id === itemId ? { ...m, isAvailable: p.isAvailable !== false } : m)));
    };
    const onStoreStatus = (p: any) => {
      if (!p?.restaurantId || p.restaurantId === rid) debounce('store', 500, refreshStore);
    };
    const onDataChanged = (e: any) => {
      if (!e || typeof e !== 'object') return;
      if (e.type === 'product' && (e.storeId === rid || (e.bulk && !e.storeId))) debounce('menu', 600, refreshMenu);
      if (e.type === 'store' && (e.id === rid || e.id === null)) debounce('store', 600, refreshStore);
    };
    socket.on('restaurant_newOrder', onNewOrder);
    socket.on('statusUpdated', onStatus);
    socket.on('orderCancelled', onCancelled);
    socket.on('inventory_updated', onInventory);
    socket.on('store_status_changed', onStoreStatus);
    socket.on('data:changed', onDataChanged);
    return () => {
      socket.off('restaurant_newOrder', onNewOrder);
      socket.off('statusUpdated', onStatus);
      socket.off('orderCancelled', onCancelled);
      socket.off('inventory_updated', onInventory);
      socket.off('store_status_changed', onStoreStatus);
      socket.off('data:changed', onDataChanged);
    };
  }, [socket, rid, scheduleOrders, debounce, refreshStore, refreshMenu]);

  // ── New-order alert list (rings until accepted or rejected) ───────────────
  const alertOrders = useMemo(
    () => orders
      .filter((o) => o.stage === 'new')
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [orders],
  );

  // ── Order actions ─────────────────────────────────────────────────────────
  const patchOrder = useCallback((id: string, patch: Partial<Order>) => {
    const now = Date.now();
    const prevPatch = localPatches.current[id];
    const merged: Partial<Order> = { ...(prevPatch && now - prevPatch.at < 5 * 60000 ? prevPatch.patch : {}), ...patch };
    delete merged.stage;
    localPatches.current[id] = { at: now, patch: merged };
    setOrders((prev) => prev.map((o) => {
      if (o.id !== id) return o;
      const next = { ...o, ...merged };
      return { ...next, stage: stageOf(next.status) };
    }));
  }, []);
  patchOrderRef.current = patchOrder;

  const runAction = useCallback(async (o: Order, kind: BusyKind, fn: () => Promise<void>) => {
    if (busyRef.current[o.id]) return false; // double tap / two buttons for the same order
    busyRef.current = { ...busyRef.current, [o.id]: kind };
    setBusy(busyRef.current);
    const setErr = (msg: string | null) => setActionErrors((prev) => {
      if (!msg) {
        if (!prev[o.id]) return prev;
        const n = { ...prev };
        delete n[o.id];
        return n;
      }
      return { ...prev, [o.id]: msg };
    });
    setErr(null);
    try {
      await fn();
      scheduleOrders(500);
      return true;
    } catch (e) {
      let msg = 'Something went wrong. Please try again.';
      if (e instanceof NetworkError) {
        msg = e.message;
      } else if (e instanceof ApiError) {
        msg = e.message;
        scheduleOrders(100); // the order may have been cancelled meanwhile
      }
      if (alive.current && !(e instanceof ApiError && e.status === 401)) {
        setErr(msg);
        toast.show(msg, 'error');
      }
      return false;
    } finally {
      const next = { ...busyRef.current };
      delete next[o.id];
      busyRef.current = next;
      if (alive.current) setBusy(next);
    }
  }, [scheduleOrders, toast]);

  const accept = useCallback((o: Order) => runAction(o, 'accept', async () => {
    await api.setOrderStatus(o.id, 'Accepted');
    cancelAnnouncements(`new:${o.id}`);
    announce(`accept:${o.id}`, { kind: 'accepted' }, { urgent: true });
    patchOrder(o.id, { status: 'Accepted', acceptedAt: new Date().toISOString() });
    toast.show(`#${o.shortId} accepted. Prepare it and deliver.`, 'success');
  }), [runAction, patchOrder, toast]);

  const reject = useCallback((o: Order, reason: string) => runAction(o, 'reject', async () => {
    await api.setOrderStatus(o.id, 'Cancelled', reason);
    cancelAnnouncements(`new:${o.id}`);
    // Same key as the "cancelled" announcement, so the status change does not announce twice.
    announce(`cancel:${o.id}`, { kind: 'rejected' });
    patchOrder(o.id, { status: 'Cancelled', cancellationReason: reason });
    toast.show(`#${o.shortId} rejected`, 'info');
  }), [runAction, patchOrder, toast]);

  const outForDelivery = useCallback((o: Order) => runAction(o, 'out', async () => {
    await api.setOrderStatus(o.id, 'OutForDelivery');
    announce(`out:${o.id}`, { kind: 'outForDelivery', cash: o.collectAmount });
    patchOrder(o.id, { status: 'OutForDelivery', outForDeliveryAt: new Date().toISOString() });
    toast.show(o.collectAmount > 0 ? `#${o.shortId} on the way. Collect ${rupees(o.collectAmount)} cash.` : `#${o.shortId} on the way`, 'success');
  }), [runAction, patchOrder, toast]);

  const delivered = useCallback((o: Order) => runAction(o, 'delivered', async () => {
    await api.setOrderStatus(o.id, 'Delivered');
    announce(`delivered:${o.id}`, { kind: 'delivered', cash: o.collectAmount });
    patchOrder(o.id, { status: 'Delivered', deliveredAt: new Date().toISOString() });
    toast.show(o.collectAmount > 0 ? `#${o.shortId} delivered · ${rupees(o.collectAmount)} cash` : `#${o.shortId} delivered`, 'success');
  }), [runAction, patchOrder, toast]);

  const cancel = useCallback((o: Order, reason: string) => runAction(o, 'cancel', async () => {
    await api.setOrderStatus(o.id, 'Cancelled', reason);
    announce(`cancel:${o.id}`, { kind: 'rejected' });
    patchOrder(o.id, { status: 'Cancelled', cancellationReason: reason });
    toast.show(`#${o.shortId} cancelled`, 'info');
  }), [runAction, patchOrder, toast]);

  const openBusy = useRef(false);
  const setOpen = useCallback(async (open: boolean): Promise<Result> => {
    if (openBusy.current) return { ok: false };
    openBusy.current = true;
    try {
      const s = await api.setOpen(rid, open);
      if (!alive.current) return { ok: true };
      setStore((prev) => ({
        ...(prev || s),
        isOpenNow: s.isOpenNow,
        isOpen: s.isOpen,
        opensAt: s.opensAt,
        closedReason: s.closedReason,
        operatingHours: s.operatingHours || prev?.operatingHours || null,
      }));
      updateProfile({ isOpenNow: s.isOpenNow });
      if (s.isOpenNow) {
        announce('store:open', { kind: 'storeOpen' }, { dedupeMs: 2000 });
        toast.show(s.isOpen ? 'Shop open — taking orders' : 'Switched on — but outside your hours', s.isOpen ? 'success' : 'info');
      } else {
        const t = todayNumbers(ordersRef.current);
        announce('store:closed', { kind: 'storeClosed', orders: t.orders, cash: t.cashCollected }, { dedupeMs: 2000 });
        toast.show("Shop closed — customers can't order", 'info');
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return { ok: false };
      const msg = errorMessage(e, "Couldn't change shop status.");
      toast.show(msg, 'error');
      return { ok: false, error: msg };
    } finally {
      openBusy.current = false;
    }
  }, [rid, updateProfile, toast]);

  const setHours = useCallback(async (hours: OperatingHours): Promise<Result> => {
    try {
      const s = await api.setHours(rid, hours);
      if (!alive.current) return { ok: true };
      setStore((prev) => ({ ...(prev || s), ...s, operatingHours: s.operatingHours || hours }));
      updateProfile({ operatingHours: s.operatingHours || hours });
      toast.show('Shop hours saved', 'success');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorMessage(e, "Couldn't save the hours. Try again.") };
    }
  }, [rid, updateProfile, toast]);

  const setStock = useCallback(async (item: MenuItem, isAvailable: boolean) => {
    if (menuPendingRef.current[item.id]) return false;
    menuPendingRef.current = { ...menuPendingRef.current, [item.id]: true };
    setMenuPending(menuPendingRef.current);
    try {
      const res = await api.setAvailability(item.id, isAvailable);
      const now = typeof res?.isAvailable === 'boolean' ? res.isAvailable : isAvailable;
      setMenu((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, isAvailable: now } : m)));
      toast.show(`${item.name}: ${now ? 'available' : 'not available'}`, now ? 'success' : 'info');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.show('That item no longer exists. Refreshing your menu.', 'error');
        refreshMenu();
      } else if (!(e instanceof ApiError && e.status === 401)) {
        toast.show(errorMessage(e, "Couldn't update the item."), 'error');
      }
      return false;
    } finally {
      const next = { ...menuPendingRef.current };
      delete next[item.id];
      menuPendingRef.current = next;
      if (alive.current) setMenuPending(next);
    }
  }, [refreshMenu, toast]);

  const upsertLocal = useCallback((item: MenuItem) => {
    setMenu((prev) => {
      const list = prev || [];
      return list.some((m) => m.id === item.id) ? list.map((m) => (m.id === item.id ? item : m)) : [...list, item];
    });
  }, []);

  const saveItem = useCallback(async (input: ItemInput, editing: MenuItem | null): Promise<MenuItem> => {
    const body: api.MenuItemBody = {
      name: input.name,
      price: input.price,
      category: input.category || null,
      description: input.description || null,
      imageUrl: input.imageUrl,
      isVegetarian: input.isVegetarian,
      dietType: input.isVegetarian ? 'veg' : 'nonveg',
    };
    // Availability: always on create (same write: a "not available" item is never live for a moment);
    // on edit only when it changed.
    if (!editing || input.isAvailable !== editing.isAvailable) body.isAvailable = input.isAvailable;
    let saved: MenuItem;
    if (editing) {
      const res = await api.updateMenuItem(editing.id, body);
      saved = res || {
        ...editing, ...body, category: input.category || 'Other', description: input.description || null,
        isAvailable: body.isAvailable ?? editing.isAvailable,
      };
    } else {
      saved = await api.createMenuItem(body);
    }
    upsertLocal(saved);
    toast.show(editing ? `${saved.name} saved` : `${saved.name} added to your menu`, 'success');
    if (!editing) announce(`menu:add:${saved.id}`, { kind: 'itemAdded' }, { dedupeMs: 0 });
    return saved;
  }, [toast, upsertLocal]);

  const deleteItem = useCallback(async (item: MenuItem): Promise<DeleteResult> => {
    try {
      await api.deleteMenuItem(item.id);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) return { ok: false, error: errorMessage(e, "Couldn't delete the item. Try again.") };
      // 404 for the item itself: it is already gone, just drop it from the list.
    }
    setMenu((prev) => prev && prev.filter((m) => m.id !== item.id));
    toast.show(`${item.name} deleted`, 'success');
    return { ok: true };
  }, [toast]);

  const retryConnection = useCallback(() => { retry(); refreshOrdersRef.current({ pull: true }); }, [retry]);

  const value = useMemo<StoreCtx>(() => ({
    restaurant, store, storeError, orders, ordersLoaded, ordersError, refreshing, lastSyncedAt,
    menu, menuError, menuLoading, menuPending, conn, alertOrders, busy, actionErrors, retryConnection, refreshOrders, refreshStore,
    refreshMenu, accept, reject, outForDelivery, delivered, cancel, setOpen, setHours, setStock, saveItem, deleteItem,
  }), [
    restaurant, store, storeError, orders, ordersLoaded, ordersError, refreshing, lastSyncedAt,
    menu, menuError, menuLoading, menuPending, conn, alertOrders, busy, actionErrors, retryConnection, refreshOrders, refreshStore,
    refreshMenu, accept, reject, outForDelivery, delivered, cancel, setOpen, setHours, setStock, saveItem, deleteItem,
  ]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** One shared clock tick for elapsed times (instead of one interval per card). */
const NowCtx = createContext<number>(Date.now());
export function NowProvider({ children, everyMs = 15000 }: { children: React.ReactNode; everyMs?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(Date.now()); });
    return () => { clearInterval(t); sub.remove(); };
  }, [everyMs]);
  return <NowCtx.Provider value={now}>{children}</NowCtx.Provider>;
}
export const useNow = () => useContext(NowCtx);
