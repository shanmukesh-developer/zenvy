// Everything the logged-in store sees and does: live store state, orders, menu, connection, the
// new-order alert list, and the kitchen actions. Each order has an in-flight lock (no double submits);
// accept / reject / ready are never optimistic (the server decides), stock / price update on success.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FALLBACK_POLL_MS, SAFETY_POLL_MS } from '../config';
import * as api from '../lib/api';
import { ApiError, NetworkError, errorMessage } from '../lib/http';
import { isEggTag, normalizeOrder, rupees, stageFor, TIMEOUT_REASON_TEXT, todayNumbers } from '../lib/model';
import { onOrderPush, onPushTokenChange, registerStorePush, type PushState } from '../lib/push';
import { startKitchenService } from '../voice/kitchenService';
import { announce, cancelAnnouncements, detectVoices } from '../voice/voice';
import { useToast } from '../ui/Toast';
import { useSocket } from './SocketProvider';
import { useSession } from './SessionProvider';
import type { ConnStatus, ItemInput, MenuItem, Order, StoreProfile, StoreState } from '../types';

export type StockChange = { isAvailable: true } | { isAvailable: false } | { outOfStockUntil: string };
export type BusyKind = 'accept' | 'reject' | 'ready';
export type DeleteResult = { ok: true } | { ok: false; error: string };

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
  menuLoading: boolean;
  menuPending: Record<string, boolean>;
  conn: ConnStatus;
  /** Closed-app order alerts: 'blocked' / 'unavailable' = new orders ring only while the app is open. */
  pushState: PushState;
  /** Pending orders not yet accepted / rejected / silenced, oldest first. */
  alertOrders: Order[];
  busy: Record<string, BusyKind>;
  /** Last failed kitchen action per order (shown inline: toasts sit behind the alert / sheet modals). */
  actionErrors: Record<string, string>;
  retryConnection: () => void;
  refreshOrders: (opts?: { pull?: boolean }) => Promise<void>;
  refreshStore: () => Promise<void>;
  refreshMenu: () => Promise<void>;
  silence: (ids: string[]) => void;
  accept: (o: Order, estDuration: number) => Promise<boolean>;
  reject: (o: Order, reason: string) => Promise<boolean>;
  markReady: (o: Order) => Promise<boolean>;
  setOpen: (open: boolean) => Promise<{ ok: boolean; error?: string }>;
  setStock: (item: MenuItem, change: StockChange) => Promise<boolean>;
  setPrice: (item: MenuItem, price: number) => Promise<void>;
  /** Add (editing = null) or edit an item. Throws with a friendly message; the form shows it inline. */
  saveItem: (input: ItemInput, editing: MenuItem | null) => Promise<MenuItem>;
  deleteItem: (item: MenuItem) => Promise<DeleteResult>;
}

const Ctx = createContext<StoreCtx | null>(null);

/** A socket stub that the list does not have yet is kept this long (replication / race). */
const STUB_KEEP_MS = 60000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { restaurant: maybeRestaurant, updateProfile } = useSession();
  // Only mounted with a restaurant; the fallback covers the logout render.
  const restaurant = (maybeRestaurant || { id: '', name: '' }) as StoreProfile;
  const rid = restaurant.id;
  const { socket, status: conn, connectCount, retry } = useSocket();
  const toast = useToast();

  const [store, setStore] = useState<StoreState | null>(null);
  const [pushState, setPushState] = useState<PushState>('unknown');
  const [storeError, setStoreError] = useState<string | null>(null);
  const [openToggleSupported, setOpenToggleSupported] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuPending, setMenuPending] = useState<Record<string, boolean>>({});
  const [silenced, setSilenced] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<Record<string, BusyKind>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // Status changes learned locally (our own action or a socket event). A list fetch that was already in
  // flight when they happened carries the older status, so they are re-applied on top of it; otherwise an
  // accepted order would briefly come back as Pending and ring again.
  const localPatches = useRef<Record<string, { at: number; patch: Partial<Order> }>>({});
  const patchOrderRef = useRef<(id: string, patch: Partial<Order>) => void>(() => {});
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;
  const menuRef = useRef<MenuItem[] | null>(null);
  menuRef.current = menu;
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
          return { ...merged, stage: stageFor(merged.status, merged.readyAt) };
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
        isOffline: s.isOffline,
        deliveryTime: s.deliveryTime ?? undefined,
      });
    } catch (e) {
      if (alive.current) setStoreError(errorMessage(e, "Couldn't load store status."));
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
    // Order pushes while the app is closed (FCM via the server). Best effort: never blocks the app, but
    // a phone that cannot get them shows a banner so the store knows to keep the app open.
    registerStorePush(rid).then((st) => { if (alive.current) setPushState(st); });
    const offToken = onPushTokenChange(rid);
    const offPush = onOrderPush((d) => {
      if (d?.type === 'NEW_ORDER' || d?.type === 'ORDER_CANCELLED' || d?.orderId) scheduleOrders(300);
    });
    return () => { offToken(); offPush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the phone's settings (or any resume): retry closed-app alerts if they were off.
  useEffect(() => {
    if (pushState === 'ok' || pushState === 'unknown') return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') registerStorePush(rid).then((r) => { if (alive.current) setPushState(r); });
    });
    return () => sub.remove();
  }, [pushState, rid]);

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
        // Android may have stopped the kitchen service while we were away (dataSync time limit, or
        // a start that was not allowed): start it again now that the app is in the foreground.
        startKitchenService();
      }
    });
    return () => sub.remove();
  }, [refreshStore]);

  // ── Socket events ─────────────────────────────────────────────────────────
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
        patchOrderRef.current(id, patch);
      }
      scheduleOrders(800); // rider name / assignment / reasons come with the full row
    };
    const onCancelled = (p: any) => {
      if (p?.orderId) onStatus({ id: p.orderId, status: 'Cancelled', reason: p.reason });
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

  // ── New-order alert list ──────────────────────────────────────────────────
  const alertOrders = useMemo(
    () => orders
      .filter((o) => o.stage === 'new' && !silenced[o.id])
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()),
    [orders, silenced],
  );

  const silence = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setSilenced((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = true; });
      return next;
    });
    ids.forEach((id) => cancelAnnouncements(`new:${id}`));
  }, []);

  // ── Kitchen actions ───────────────────────────────────────────────────────
  const patchOrder = useCallback((id: string, patch: Partial<Order>) => {
    const now = Date.now();
    const prevPatch = localPatches.current[id];
    const merged: Partial<Order> = { ...(prevPatch && now - prevPatch.at < 5 * 60000 ? prevPatch.patch : {}), ...patch };
    delete merged.stage;
    localPatches.current[id] = { at: now, patch: merged };
    setOrders((prev) => prev.map((o) => {
      if (o.id !== id) return o;
      const next = { ...o, ...merged };
      return { ...next, stage: stageFor(next.status, next.readyAt) };
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
        scheduleOrders(100); // the order may have been cancelled / taken meanwhile
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

  const accept = useCallback((o: Order, est: number) => runAction(o, 'accept', async () => {
    await api.acceptOrder(o.id, est);
    cancelAnnouncements(`new:${o.id}`);
    announce(`accept:${o.id}`, { kind: 'accepted', mins: est }, { urgent: true });
    patchOrder(o.id, { status: 'Accepted', estDuration: est, acceptedAt: new Date().toISOString() });
    toast.show(`#${o.shortId} accepted · ready in ${est} min`, 'success');
  }), [runAction, patchOrder, toast]);

  const reject = useCallback((o: Order, reason: string) => runAction(o, 'reject', async () => {
    const res = await api.rejectOrder(o.id, reason);
    cancelAnnouncements(`new:${o.id}`);
    // Same key as the "cancelled" announcement, so the status change does not announce twice.
    announce(`cancel:${o.id}`, { kind: 'rejected' });
    patchOrder(o.id, { status: 'Cancelled', cancellationReason: reason });
    const refund = Number(res?.refundedToWallet) || 0;
    toast.show(refund > 0 ? `#${o.shortId} rejected · ${rupees(refund)} refunded to the customer` : `#${o.shortId} rejected`, 'info');
  }), [runAction, patchOrder, toast]);

  const markReady = useCallback((o: Order) => runAction(o, 'ready', async () => {
    const res = await api.markReady(o.id);
    const now = new Date().toISOString();
    if (res?.status === 'Picking') {
      patchOrder(o.id, { status: 'Picking', readyAt: now });
      toast.show(`Rider told #${o.shortId} is packed`, 'success');
    } else {
      patchOrder(o.id, { status: 'ReadyForPickup', readyAt: now });
      toast.show(`#${o.shortId} is ready for pickup`, 'success');
    }
  }), [runAction, patchOrder, toast]);

  const openBusy = useRef(false);
  const setOpen = useCallback(async (open: boolean): Promise<{ ok: boolean; error?: string }> => {
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
        toast.show(s.isOpen ? 'Store open — accepting orders' : 'Switched on — but outside your hours', s.isOpen ? 'success' : 'info');
      } else {
        const t = todayNumbers(ordersRef.current);
        announce('store:closed', { kind: 'storeClosed', orders: t.orders, sales: t.sales }, { dedupeMs: 2000 });
        toast.show("Store closed — customers can't order", 'info');
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof api.OpenToggleUnsupported) {
        setOpenToggleSupported(false);
        const msg = 'Opening and closing from the app is not available yet. Call Zenvy support to change it.';
        toast.show(msg, 'info');
        return { ok: false, error: msg };
      }
      if (e instanceof ApiError && e.status === 401) return { ok: false };
      const msg = errorMessage(e, "Couldn't change store status.");
      toast.show(msg, 'error');
      return { ok: false, error: msg };
    } finally {
      openBusy.current = false;
    }
  }, [rid, updateProfile, toast]);

  const setStock = useCallback(async (item: MenuItem, change: StockChange) => {
    if (menuPendingRef.current[item.id]) return false;
    menuPendingRef.current = { ...menuPendingRef.current, [item.id]: true };
    setMenuPending(menuPendingRef.current);
    try {
      const res = await api.setAvailability(item.id, change);
      const isAvailable = typeof res?.isAvailable === 'boolean' ? res.isAvailable : ('isAvailable' in change ? change.isAvailable : false);
      const until = 'outOfStockUntil' in change ? (res?.outOfStockUntil || change.outOfStockUntil) : null;
      setMenu((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, isAvailable, outOfStockUntil: isAvailable ? null : until } : m)));
      toast.show(`${item.name}: ${isAvailable ? 'in stock' : 'out of stock'}`, isAvailable ? 'success' : 'info');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Expired / revoked session: the http layer already logged out with a message.
      } else if (e instanceof ApiError && e.status === 404) {
        toast.show('That item no longer exists. Refreshing your menu.', 'error');
        refreshMenu();
      } else {
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

  const setPrice = useCallback(async (item: MenuItem, price: number) => {
    await api.setPrice(item.id, price); // throws: the sheet shows the message inline
    setMenu((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, price } : m)));
    toast.show(`${item.name} is now ${rupees(price)}`, 'success');
  }, [toast]);

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
      isVegetarian: input.diet === 'veg',
      dietType: input.diet,
      originalPrice: input.originalPrice,
    };
    // Stock: always on create; on edit only when it changed (keeps an "out of stock until" timer intact).
    if (!editing || input.isAvailable !== editing.isAvailable) body.isAvailable = input.isAvailable;
    // Older egg dishes carry an "egg" tag: drop it when the dish is no longer egg (dietType is the truth now).
    if (editing && input.diet !== 'egg' && editing.tags.some(isEggTag)) body.tags = editing.tags.filter((t) => !isEggTag(t));
    // One write: name, price, MRP, food type and stock are saved together (never half-saved).
    let saved: MenuItem;
    if (editing) {
      const res = await api.updateMenuItem(editing.id, body);
      saved = res || {
        ...editing, ...body, category: input.category || 'Other', description: input.description || null,
        tags: body.tags ?? editing.tags, isAvailable: body.isAvailable ?? editing.isAvailable,
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
    restaurant, store, storeError, openToggleSupported, orders, ordersLoaded, ordersError, refreshing, lastSyncedAt,
    menu, menuError, menuLoading, menuPending, conn, pushState, alertOrders, busy, actionErrors, retryConnection, refreshOrders, refreshStore,
    refreshMenu, silence, accept, reject, markReady, setOpen, setStock, setPrice, saveItem, deleteItem,
  }), [
    restaurant, store, storeError, openToggleSupported, orders, ordersLoaded, ordersError, refreshing, lastSyncedAt,
    menu, menuError, menuLoading, menuPending, conn, pushState, alertOrders, busy, actionErrors, retryConnection, refreshOrders, refreshStore,
    refreshMenu, silence, accept, reject, markReady, setOpen, setStock, setPrice, saveItem, deleteItem,
  ]);
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
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(Date.now()); });
    return () => { clearInterval(t); sub.remove(); };
  }, [everyMs]);
  return <NowCtx.Provider value={now}>{children}</NowCtx.Provider>;
}
export const useNow = () => useContext(NowCtx);
