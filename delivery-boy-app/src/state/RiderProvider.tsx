// App-wide rider state: session, duty, orders, earnings, network, offline queue, socket, GPS, push.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ApiError, NetworkError, configureApiClient, errorMessage, isUnapprovedError } from '../services/apiClient';
import * as api from '../services/deliveryApi';
import * as session from '../services/session';
import * as queue from '../services/offlineQueue';
import * as sock from '../services/socket';
import * as gps from '../services/location';
import * as push from '../services/notifications';
import { statusRank } from '../services/orderModel';
import { istDayKey, lastNDayKeys, rupees } from '../services/format';
import { POLL_INTERVAL_MS, STATS_POLL_INTERVAL_MS } from '../constants/api';
import { useAppActive, useDismissedOrders, useInterval, useNetwork } from './hooks';
import type { RiderOrder, RiderProfile, TodayStats, WeekStats } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type Phase = 'splash' | 'splash-error' | 'login' | 'pending' | 'main';
export type Tab = 'home' | 'orders' | 'earnings' | 'profile';
export type Overlay = { kind: 'available' } | { kind: 'support'; prefill?: string } | null;
export type ToastKind = 'info' | 'success' | 'error';

export type DeliverResult =
  | { ok: true; earning: number | null; cash: number | null }
  | { ok: false; kind: 'invalid'; attemptsLeft: number | null; message: string }
  | { ok: false; kind: 'locked'; message: string }
  | { ok: false; kind: 'offline' | 'error'; message: string };

export interface CancelNotice {
  orderId: string;
  shortId: string;
  restaurantName: string | null;
  reason?: string;
}

interface Loadable<T> {
  data: T;
  loaded: boolean;
  error: string | null;
  updatedAt: number | null;
}

interface RiderContextValue {
  phase: Phase;
  profile: RiderProfile | null;
  isOnline: boolean;
  dutyBusy: boolean;
  today: Loadable<TodayStats | null>;
  active: Loadable<RiderOrder[]>;
  pending: Loadable<RiderOrder[]>;
  history: Loadable<RiderOrder[] | null>;
  week: WeekStats | null;
  connected: boolean;
  serverReachable: boolean;
  queueCount: number;
  syncPendingIds: Set<string>;
  fix: gps.Fix | null;
  locationDenied: boolean;
  dismissedIds: Record<string, number>;
  cancelNotice: CancelNotice | null;
  toast: { id: number; text: string; kind: ToastKind } | null;
  // navigation
  tab: Tab;
  setTab: (t: Tab) => void;
  deliveryId: string | null;
  openDelivery: (id: string) => void;
  closeDelivery: () => void;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  // actions
  retryBoot: () => void;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recheckApproval: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDuty: (next: boolean) => Promise<boolean>;
  refreshOrders: () => Promise<void>;
  refreshToday: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshEarnings: () => Promise<void>;
  accept: (order: RiderOrder) => Promise<boolean>;
  dismissOrder: (id: string) => void;
  advance: (order: RiderOrder) => Promise<boolean>;
  deliver: (order: RiderOrder, pin: string) => Promise<DeliverResult>;
  unassign: (order: RiderOrder) => Promise<boolean>;
  flushNow: () => Promise<void>;
  showToast: (text: string, kind?: ToastKind) => void;
  clearCancelNotice: () => void;
  saveProfileEdits: (p: { name?: string; vehicleType?: string; vehicleNumber?: string; emergencyContact?: string }) => Promise<void>;
}

const Ctx = createContext<RiderContextValue | null>(null);

export function useRider(): RiderContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRider outside RiderProvider');
  return v;
}

const empty = <T,>(data: T): Loadable<T> => ({ data, loaded: false, error: null, updatedAt: null });

export function RiderProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('splash');
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);
  const [today, setToday] = useState<Loadable<TodayStats | null>>(empty(null));
  const [serverActive, setServerActive] = useState<Loadable<RiderOrder[]>>(empty([]));
  const [pending, setPending] = useState<Loadable<RiderOrder[]>>(empty([]));
  const [history, setHistory] = useState<Loadable<RiderOrder[] | null>>(empty(null));
  const [weekServer, setWeekServer] = useState<WeekStats | null>(null);
  const [serverReachable, setServerReachable] = useState(true);
  const [queued, setQueued] = useState<queue.QueuedAction[]>([]);
  const [fix, setFix] = useState<gps.Fix | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<CancelNotice | null>(null);
  const [toast, setToast] = useState<RiderContextValue['toast']>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [bootNonce, setBootNonce] = useState(0);

  const connected = useNetwork();
  const appActive = useAppActive();
  const { dismiss, dismissed } = useDismissedOrders();

  const tokenRef = useRef<string | null>(null);
  const profileRef = useRef<RiderProfile | null>(null);
  const activeRef = useRef<RiderOrder[]>([]);
  const finishedIds = useRef<Set<string>>(new Set()); // delivered / released by us
  const autoOpened = useRef(false);
  const lastEmit = useRef(0);
  const phaseRef = useRef<Phase>('splash');
  phaseRef.current = phase;
  profileRef.current = profile;

  const showToast = useCallback((text: string, kind: ToastKind = 'info') => {
    setToast({ id: Date.now(), text, kind });
  }, []);

  // ── Session ────────────────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setProfile(null);
    setIsOnline(false);
    setToday(empty(null));
    setServerActive(empty([]));
    setPending(empty([]));
    setHistory(empty(null));
    setWeekServer(null);
    setDeliveryId(null);
    setOverlay(null);
    setTab('home');
    setCancelNotice(null);
    activeRef.current = [];
    finishedIds.current = new Set();
    autoOpened.current = false;
  }, []);

  const hardLogout = useCallback(async () => {
    tokenRef.current = null;
    sock.disconnectSocket();
    gps.stopTracking();
    await queue.clearQueue();
    await push.forgetPushRegistration();
    await session.clearSession();
    resetState();
    setPhase('login');
  }, [resetState]);

  const hardLogoutRef = useRef(hardLogout);
  hardLogoutRef.current = hardLogout;

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        if (tokenRef.current) {
          hardLogoutRef.current();
          setToast({ id: Date.now(), text: 'Your session expired. Please log in again.', kind: 'error' });
        }
      },
      onUnapproved: () => {
        if (phaseRef.current === 'main') setPhase('pending');
      },
      onReachability: setServerReachable,
    });
  }, []);

  const applyProfile = useCallback((p: RiderProfile) => {
    setProfile(p);
    setIsOnline(p.isOnline);
    session.saveProfile(p);
  }, []);

  // Boot: token → profile → phase.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('splash');
      const { token, profile: cached } = await session.loadSession();
      if (cancelled) return;
      if (!token) {
        setPhase('login');
        return;
      }
      tokenRef.current = token;
      const [cachedHistory, cachedToday] = await Promise.all([
        session.readCache<any[]>('history'),
        session.readCache<TodayStats>('today'),
      ]);
      if (cachedHistory) {
        setHistory({ data: cachedHistory.data as RiderOrder[], loaded: true, error: null, updatedAt: cachedHistory.savedAt });
      }
      if (cachedToday && istDayKey(cachedToday.savedAt) === istDayKey(Date.now())) {
        setToday({ data: cachedToday.data, loaded: true, error: null, updatedAt: cachedToday.savedAt });
      }
      try {
        const p = await api.fetchProfile(cached);
        if (cancelled) return;
        applyProfile(p);
        setPhase(p.isApproved ? 'main' : 'pending');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) return; // onUnauthorized already moved to login
        if (cached) {
          // Offline start: use the cached profile, banner shows the network state.
          setProfile(cached);
          setIsOnline(cached.isOnline);
          setPhase(cached.isApproved ? 'main' : 'pending');
        } else {
          setPhase('splash-error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootNonce, applyProfile]);

  const retryBoot = useCallback(() => setBootNonce((n) => n + 1), []);

  const login = useCallback(
    async (phone: string, password: string) => {
      const { token, profile: fromLogin } = await api.login(phone, password);
      tokenRef.current = token;
      await session.saveToken(token);
      let p = fromLogin;
      try {
        p = await api.fetchProfile(fromLogin);
      } catch {
        // keep the login payload
      }
      resetState();
      applyProfile(p);
      setPhase(p.isApproved ? 'main' : 'pending');
    },
    [applyProfile, resetState],
  );

  const logout = useCallback(async () => {
    if (tokenRef.current) {
      try {
        await api.setOnline(false);
      } catch {
        // best effort
      }
    }
    await hardLogout();
  }, [hardLogout]);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.fetchProfile(profileRef.current);
      applyProfile(p);
      if (!p.isApproved && phaseRef.current === 'main') setPhase('pending');
    } catch {
      // keep what we have
    }
  }, [applyProfile]);

  const recheckApproval = useCallback(async () => {
    const p = await api.fetchProfile(profileRef.current);
    applyProfile(p);
    setPhase(p.isApproved ? 'main' : 'pending');
    if (!p.isApproved) showToast('Still waiting for approval.', 'info');
  }, [applyProfile, showToast]);

  // ── Offline queue (optimistic overlay) ─────────────────────────────────
  useEffect(() => queue.subscribeQueue(setQueued), []);
  useEffect(() => {
    queue.getQueue().then(setQueued);
  }, []);

  const active = useMemo<Loadable<RiderOrder[]>>(() => {
    if (!queued.length) return serverActive;
    const data = serverActive.data.map((o) => {
      let status = o.status;
      for (const a of queued) {
        if (a.orderId !== o.id) continue;
        const s = queue.QUEUE_STATUS[a.type];
        if (statusRank(s) > statusRank(status)) status = s;
      }
      return status === o.status ? o : { ...o, status };
    });
    return { ...serverActive, data };
  }, [serverActive, queued]);
  activeRef.current = active.data;

  const syncPendingIds = useMemo(() => new Set(queued.map((q) => q.orderId)), [queued]);

  // ── Fetchers ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (): Promise<RiderOrder[] | null> => {
    try {
      const list = await api.fetchHistory();
      setHistory({ data: list, loaded: true, error: null, updatedAt: Date.now() });
      session.writeCache('history', list);
      return list;
    } catch (e) {
      setHistory((h) => ({ ...h, loaded: true, error: errorMessage(e) }));
      return null;
    }
  }, []);

  const refreshActive = useCallback(async () => {
    try {
      const list = await api.fetchActive();
      const prev = activeRef.current;
      const nextIds = new Set(list.map((o) => o.id));
      const vanished = prev.filter((o) => !nextIds.has(o.id) && !finishedIds.current.has(o.id));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setServerActive({ data: list, loaded: true, error: null, updatedAt: Date.now() });
      if (vanished.length) {
        // Gone without us finishing it: delivered by support, or cancelled.
        const hist = await loadHistory();
        for (const o of vanished) {
          await queue.removeForOrder(o.id);
          if (hist?.some((h) => h.id === o.id)) {
            showToast(`Order #${o.shortId} was marked delivered by Zenvy support.`, 'success');
          } else {
            setCancelNotice({ orderId: o.id, shortId: o.shortId, restaurantName: o.restaurantName });
          }
        }
        setDeliveryId((cur) => (cur && vanished.some((v) => v.id === cur) ? null : cur));
      }
      if (!autoOpened.current) {
        autoOpened.current = true;
        if (list.length === 1) setDeliveryId(list[0].id);
      }
    } catch (e) {
      if (isUnapprovedError(e)) return;
      setServerActive((a) => ({ ...a, loaded: true, error: errorMessage(e) }));
    }
  }, [loadHistory, showToast]);

  const refreshPending = useCallback(async () => {
    try {
      const list = await api.fetchPending();
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPending({ data: list, loaded: true, error: null, updatedAt: Date.now() });
    } catch (e) {
      if (isUnapprovedError(e)) return;
      setPending((p) => ({ ...p, loaded: true, error: errorMessage(e) }));
    }
  }, []);

  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const refreshOrders = useCallback(async () => {
    await Promise.all([refreshActive(), isOnlineRef.current ? refreshPending() : Promise.resolve()]);
  }, [refreshActive, refreshPending]);

  const refreshToday = useCallback(async () => {
    try {
      const t = await api.fetchToday();
      setToday({ data: t, loaded: true, error: null, updatedAt: Date.now() });
      session.writeCache('today', t);
    } catch (e) {
      setToday((s) => ({ ...s, loaded: true, error: errorMessage(e) }));
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  const refreshEarnings = useCallback(async () => {
    const [, , w] = await Promise.all([
      refreshToday(),
      loadHistory(),
      api.fetchWeek().catch(() => null),
      refreshProfile(),
    ]);
    setWeekServer(w);
  }, [refreshToday, loadHistory, refreshProfile]);

  // Week: server buckets when available, else computed from the last 100 deliveries.
  const week = useMemo<WeekStats | null>(() => {
    if (weekServer) return weekServer;
    if (!history.data) return null;
    const keys = lastNDayKeys(7);
    const days = keys.map((date) => ({ date, earnings: 0, orders: 0 }));
    const byKey = Object.fromEntries(days.map((d) => [d.date, d]));
    for (const o of history.data) {
      if (!o.deliveredAt) continue;
      const d = byKey[istDayKey(o.deliveredAt)];
      if (!d) continue;
      d.orders += 1;
      d.earnings += o.earning ?? 0;
    }
    return {
      days,
      totalEarnings: days.reduce((s, d) => s + d.earnings, 0),
      totalOrders: days.reduce((s, d) => s + d.orders, 0),
      source: 'history',
    };
  }, [weekServer, history.data]);

  // ── First load + polling (foreground only) ─────────────────────────────
  const inMain = phase === 'main';
  useEffect(() => {
    if (!inMain) return;
    refreshActive();
    refreshToday();
    loadHistory();
    if (isOnline) refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMain]);

  useEffect(() => {
    if (inMain && isOnline) refreshPending();
    if (!isOnline) setPending(empty([]));
  }, [inMain, isOnline, refreshPending]);

  useEffect(() => {
    if (inMain && appActive) {
      refreshOrders();
      refreshToday();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActive]);

  const pollOrders = inMain && appActive && (isOnline || active.data.length > 0);
  useInterval(() => {
    if (!connected) return;
    refreshOrders();
    if (queued.length) runFlush(false);
  }, pollOrders ? POLL_INTERVAL_MS : null);
  useInterval(() => {
    if (connected) refreshToday();
  }, inMain && appActive ? STATS_POLL_INTERVAL_MS : null);

  // ── Flush queue when the network returns ───────────────────────────────
  const runFlush = useCallback(
    async (force: boolean) => {
      const r = await queue.flushQueue({ force });
      if (r.authFailed) {
        hardLogoutRef.current();
        return;
      }
      for (const d of r.dropped) showToast(`Couldn't sync: ${d.message}`, 'error');
      if (r.done.length || r.dropped.length) await refreshActive();
    },
    [refreshActive, showToast],
  );

  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current && inMain) {
      (async () => {
        await runFlush(true);
        await Promise.all([refreshOrders(), refreshToday(), loadHistory()]);
      })();
    }
    wasConnected.current = connected;
  }, [connected, inMain, runFlush, refreshOrders, refreshToday, loadHistory]);

  const flushNow = useCallback(async () => {
    await runFlush(true);
  }, [runFlush]);

  // ── Socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inMain || !tokenRef.current) return;
    sock.setSocketHandlers({
      onOrderCancelled: ({ orderId, reason }) => {
        const o = activeRef.current.find((x) => x.id === orderId);
        if (!o) return;
        finishedIds.current.add(orderId);
        queue.removeForOrder(orderId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setCancelNotice({ orderId, shortId: o.shortId, restaurantName: o.restaurantName, reason });
        setDeliveryId((cur) => (cur === orderId ? null : cur));
        refreshActive();
      },
      onOrderReady: ({ orderId }) => {
        const o = activeRef.current.find((x) => x.id === orderId);
        showToast(o?.restaurantName ? `Order ready at ${o.restaurantName}` : 'Order ready at store', 'success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        refreshActive();
      },
      onTip: ({ amount, from }) => {
        showToast(`${from ? from + ' sent' : 'You got'} a ${rupees(amount)} tip`, 'success');
        refreshProfile();
      },
      onTicketUpdated: () => showToast('Zenvy support updated your ticket.', 'info'),
    });
    sock.connectSocket(tokenRef.current);
    return () => sock.disconnectSocket();
  }, [inMain, refreshActive, refreshProfile, showToast]);

  useEffect(() => {
    sock.syncOrderRooms(active.data.map((o) => o.id));
  }, [active.data]);

  // ── GPS: only on duty or while holding an order ────────────────────────
  const needGps = inMain && (isOnline || active.data.length > 0);
  useEffect(() => {
    if (!needGps) {
      gps.stopTracking();
      return;
    }
    let stopped = false;
    gps
      .startTracking((f) => {
        if (stopped) return;
        setFix(f);
        const now = Date.now();
        if (now - lastEmit.current < 10000) return;
        lastEmit.current = now;
        const orders = activeRef.current;
        if (orders.length) {
          orders.forEach((o) => sock.emitLocation({ lat: f.lat, lng: f.lng, heading: f.heading, speed: f.speed, orderId: o.id }));
        } else if (isOnlineRef.current) {
          sock.emitLocation({ lat: f.lat, lng: f.lng, heading: f.heading, speed: f.speed });
        }
      })
      .then((r) => setLocationDenied(r === 'denied'));
    return () => {
      stopped = true;
      gps.stopTracking();
    };
  }, [needGps]);

  // ── Push ───────────────────────────────────────────────────────────────
  const riderId = profile?.id;
  useEffect(() => {
    if (!inMain || !riderId) return;
    push.registerForPush(riderId);
    const offToken = push.onPushTokenChange(riderId);
    const offRecv = push.onPushReceived((data) => {
      if (data?.type === 'NEW_ORDER' || data?.orderId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (data?.type === 'NEW_ORDER') Vibration.vibrate(400);
        refreshOrders();
      }
    });
    const offTap = push.onPushTapped((data) => {
      const id = data?.orderId ? String(data.orderId) : null;
      setOverlay(null);
      if (id && activeRef.current.some((o) => o.id === id)) setDeliveryId(id);
      else {
        setDeliveryId(null);
        setTab('home');
      }
      refreshOrders();
    });
    return () => {
      offToken();
      offRecv();
      offTap();
    };
  }, [inMain, riderId, refreshOrders]);

  // ── Duty ───────────────────────────────────────────────────────────────
  const setDuty = useCallback(
    async (next: boolean) => {
      if (!connected) {
        showToast('Needs internet to change your duty status.', 'error');
        return false;
      }
      setDutyBusy(true);
      try {
        const v = await api.setOnline(next);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setIsOnline(v);
        if (profileRef.current) {
          const p = { ...profileRef.current, isOnline: v };
          setProfile(p);
          session.saveProfile(p);
        }
        if (v) refreshPending();
        return true;
      } catch (e) {
        if (!isUnapprovedError(e)) showToast(errorMessage(e), 'error');
        return false;
      } finally {
        setDutyBusy(false);
      }
    },
    [connected, refreshPending, showToast],
  );

  // ── Order actions ──────────────────────────────────────────────────────
  const accept = useCallback(
    async (order: RiderOrder) => {
      if (!connected) {
        showToast('Accepting needs internet.', 'error');
        return false;
      }
      try {
        await api.acceptOrder(order.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPending((p) => ({ ...p, data: p.data.filter((o) => o.id !== order.id) }));
        await refreshActive();
        setOverlay(null);
        setDeliveryId(order.id);
        return true;
      } catch (e) {
        if (!isUnapprovedError(e)) showToast(errorMessage(e), 'error');
        if (e instanceof ApiError) {
          dismiss(order.id);
          setPending((p) => ({ ...p, data: p.data.filter((o) => o.id !== order.id) }));
        }
        refreshPending();
        return false;
      }
    },
    [connected, dismiss, refreshActive, refreshPending, showToast],
  );

  const advance = useCallback(
    async (order: RiderOrder) => {
      const type: queue.QueueType | null =
        order.status === 'Picking'
          ? 'STATUS_PICKED_UP'
          : order.status === 'PickedUp'
            ? 'ARRIVE'
            : ['Accepted', 'Preparing', 'ReadyForPickup', 'Pending'].includes(order.status)
              ? 'STATUS_PICKING'
              : null;
      if (!type) return false;
      const queueIt = async () => {
        await queue.enqueue(type, order.id);
        showToast('Saved on your phone. It will sync when you are back online.', 'info');
        return true;
      };
      if (!connected) return queueIt();
      try {
        if (type === 'STATUS_PICKING') await api.markAtStore(order.id);
        else if (type === 'STATUS_PICKED_UP') await api.markPickedUp(order.id);
        else await api.markArrived(order.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await refreshActive();
        return true;
      } catch (e) {
        if (e instanceof NetworkError) return queueIt();
        showToast(errorMessage(e), 'error');
        await refreshActive();
        return false;
      }
    },
    [connected, refreshActive, showToast],
  );

  const afterDelivered = useCallback(
    async (orderId: string) => {
      finishedIds.current.add(orderId);
      await Promise.all([refreshActive(), refreshToday(), loadHistory(), refreshProfile()]);
    },
    [refreshActive, refreshToday, loadHistory, refreshProfile],
  );

  const deliver = useCallback(
    async (order: RiderOrder, pin: string): Promise<DeliverResult> => {
      if (!connected) return { ok: false, kind: 'offline', message: 'Connect to the internet to verify the PIN.' };
      const cash = order.paymentMethod === 'COD' ? order.amountToCollect : null;
      try {
        const r = await api.markDelivered(order.id, pin);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        finishedIds.current.add(order.id);
        afterDelivered(order.id);
        return { ok: true, earning: r.earning ?? order.earning, cash };
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === 'INVALID_PIN') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            const left = typeof e.data?.attemptsLeft === 'number' ? e.data.attemptsLeft : null;
            if (left === 0) return { ok: false, kind: 'locked', message: e.message };
            return { ok: false, kind: 'invalid', attemptsLeft: left, message: e.message };
          }
          if (e.status === 429 && e.code === 'PIN_LOCKED') return { ok: false, kind: 'locked', message: e.message };
          if (e.status === 409 && e.code !== 'ORDER_CHANGED') {
            // Already delivered (double tap / support completed it): treat as done.
            finishedIds.current.add(order.id);
            afterDelivered(order.id);
            return { ok: true, earning: order.earning, cash };
          }
        }
        if (e instanceof ApiError && (e.status === 409 || e.status === 400 || e.status === 404)) refreshActive();
        return { ok: false, kind: e instanceof NetworkError ? 'offline' : 'error', message: errorMessage(e) };
      }
    },
    [connected, afterDelivered, refreshActive],
  );

  const unassign = useCallback(
    async (order: RiderOrder) => {
      if (!connected) {
        showToast('Needs internet.', 'error');
        return false;
      }
      try {
        const msg = await api.unassignOrder(order.id);
        finishedIds.current.add(order.id);
        await queue.removeForOrder(order.id);
        showToast(msg || 'Order released. Another rider will pick it up.', 'info');
        setDeliveryId(null);
        await refreshActive();
        return true;
      } catch (e) {
        showToast(errorMessage(e), 'error');
        await refreshActive();
        return false;
      }
    },
    [connected, refreshActive, showToast],
  );

  const saveProfileEdits = useCallback(
    async (p: { name?: string; vehicleType?: string; vehicleNumber?: string; emergencyContact?: string }) => {
      const raw = await api.updateProfile(p);
      applyProfile(api.toProfile({ ...raw, isOnline: isOnlineRef.current }, profileRef.current));
      showToast('Profile saved.', 'success');
    },
    [applyProfile, showToast],
  );

  const value: RiderContextValue = {
    phase,
    profile,
    isOnline,
    dutyBusy,
    today,
    active,
    pending,
    history,
    week,
    connected,
    serverReachable,
    queueCount: queued.length,
    syncPendingIds,
    fix,
    locationDenied,
    dismissedIds: dismissed,
    cancelNotice,
    toast,
    tab,
    setTab,
    deliveryId,
    openDelivery: setDeliveryId,
    closeDelivery: () => setDeliveryId(null),
    overlay,
    setOverlay,
    retryBoot,
    login,
    logout,
    recheckApproval,
    refreshProfile,
    setDuty,
    refreshOrders,
    refreshToday,
    refreshHistory,
    refreshEarnings,
    accept,
    dismissOrder: dismiss,
    advance,
    deliver,
    unassign,
    flushNow,
    showToast,
    clearCancelNotice: () => setCancelNotice(null),
    saveProfileEdits,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
