// App-wide rider state: session, duty, orders, earnings, network, offline queue, socket, GPS, push, voice.
// Screens read from useRider() and call its actions; they never call the API for order state directly.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ApiError, NetworkError, configureApiClient, errorMessage, isUnapprovedError } from '../services/apiClient';
import * as api from '../services/deliveryApi';
import * as session from '../services/session';
import * as queue from '../services/offlineQueue';
import * as sock from '../services/socket';
import * as gps from '../services/location';
import * as push from '../services/notifications';
import { statusRank } from '../services/orderModel';
import { istDayKey, lastNDayKeys } from '../services/format';
import { POLL_ORDERS_MS, POLL_STATS_MS } from '../config';
import { announce, checkVoices, getVoiceState, initVoice, stopSpeaking } from '../voice/announcer';
import { useAppActive, useDismissedOrders, useInterval, useNetwork } from './hooks';
import type { Loadable, RiderOrder, RiderProfile, TodayStats, WeekStats } from '../types';
import type { ToastKind, ToastMsg } from '../ui/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type Phase = 'splash' | 'splash-error' | 'login' | 'pending' | 'main';
export type Tab = 'home' | 'earnings' | 'history' | 'profile';
export type Overlay = { kind: 'support'; prefill?: string } | { kind: 'voice' } | null;

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

export interface ProfileEdits {
  name?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  emergencyContact?: string;
}

interface RiderContextValue {
  phase: Phase;
  profile: RiderProfile | null;
  isOnline: boolean;
  dutyBusy: boolean;
  today: Loadable<TodayStats | null>;
  active: Loadable<RiderOrder[]>;
  pending: Loadable<RiderOrder[]>;
  /** Pool orders the rider has not skipped, newest first. */
  offers: RiderOrder[];
  history: Loadable<RiderOrder[] | null>;
  week: WeekStats | null;
  connected: boolean;
  serverReachable: boolean;
  queueCount: number;
  syncPendingIds: Set<string>;
  fix: gps.Fix | null;
  locationDenied: boolean;
  cancelNotice: CancelNotice | null;
  toast: ToastMsg | null;
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
  skipOffer: (id: string) => void;
  advance: (order: RiderOrder) => Promise<boolean>;
  deliver: (order: RiderOrder, pin: string) => Promise<DeliverResult>;
  unassign: (order: RiderOrder) => Promise<boolean>;
  flushNow: () => Promise<void>;
  showToast: (text: string, kind?: ToastKind) => void;
  clearCancelNotice: () => void;
  saveProfileEdits: (p: ProfileEdits) => Promise<void>;
}

const Ctx = createContext<RiderContextValue | null>(null);

export function useRider(): RiderContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRider outside RiderProvider');
  return v;
}

const empty = <T,>(data: T): Loadable<T> => ({ data, loaded: false, error: null, updatedAt: null });

const PRE_PICKUP = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup'];

function cashOf(o: RiderOrder): number {
  return o.paymentMethod === 'COD' && o.amountToCollect && o.amountToCollect > 0 ? o.amountToCollect : 0;
}

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
  const [toast, setToast] = useState<ToastMsg | null>(null);
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
  const inFlightIds = useRef<Set<string>>(new Set()); // deliver / release request still running
  const activeSeq = useRef(0); // drops out-of-order /orders/active responses
  const seenOffers = useRef<Set<string>>(new Set());
  const autoOpened = useRef(false);
  const lastEmit = useRef(0);
  const phaseRef = useRef<Phase>('splash');
  const isOnlineRef = useRef(isOnline);
  const dismissedRef = useRef(dismissed);
  phaseRef.current = phase;
  profileRef.current = profile;
  isOnlineRef.current = isOnline;
  dismissedRef.current = dismissed;

  const showToast = useCallback((text: string, kind: ToastKind = 'info') => {
    setToast({ id: Date.now(), text, kind });
  }, []);

  // Voice: load settings + check the phone's voices once.
  useEffect(() => {
    initVoice();
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
    inFlightIds.current = new Set();
    seenOffers.current = new Set();
    autoOpened.current = false;
  }, []);

  const hardLogout = useCallback(async () => {
    tokenRef.current = null;
    stopSpeaking();
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
        session.readCache<RiderOrder[]>('history'),
        session.readCache<TodayStats>('today'),
      ]);
      if (cachedHistory && Array.isArray(cachedHistory.data)) {
        setHistory({ data: cachedHistory.data, loaded: true, error: null, updatedAt: cachedHistory.savedAt });
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
          // Offline start: use the cached profile; the banner shows the network state.
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

  // ── Voice cues driven by order state ───────────────────────────────────
  const prevStatus = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const prev = prevStatus.current;
    const next = new Map<string, string>();
    for (const o of active.data) {
      next.set(o.id, o.status);
      const before = prev.get(o.id);
      if (o.status === 'ReadyForPickup' && before && before !== 'ReadyForPickup') {
        announce('ready', {}, { dedupeKey: `ready:${o.id}`, chime: 'info' });
      }
      if (o.status === 'ArrivedAtGate' && cashOf(o) > 0) {
        announce('cod', { amount: cashOf(o) }, { dedupeKey: `cod:${o.id}`, chime: 'alert' });
      }
    }
    prevStatus.current = next;
  }, [active.data]);

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

  const noteCancelled = useCallback((o: RiderOrder, reason?: string) => {
    finishedIds.current.add(o.id);
    queue.removeForOrder(o.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    announce('cancelled', {}, { dedupeKey: `cancel:${o.id}`, chime: 'alert' });
    setCancelNotice({ orderId: o.id, shortId: o.shortId, restaurantName: o.restaurantName, reason });
    setDeliveryId((cur) => (cur === o.id ? null : cur));
  }, []);

  const refreshActive = useCallback(async () => {
    const seq = ++activeSeq.current;
    try {
      const list = await api.fetchActive();
      // A newer request already answered (or we logged out): this response is stale.
      if (seq !== activeSeq.current || !tokenRef.current) return;
      const prev = activeRef.current;
      const nextIds = new Set(list.map((o) => o.id));
      const vanished = prev.filter(
        (o) => !nextIds.has(o.id) && !finishedIds.current.has(o.id) && !inFlightIds.current.has(o.id),
      );
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setServerActive({ data: list, loaded: true, error: null, updatedAt: Date.now() });
      if (vanished.length) {
        // Gone without us finishing it: delivered by support, or cancelled / reassigned.
        vanished.forEach((o) => finishedIds.current.add(o.id));
        const hist = await loadHistory();
        for (const o of vanished) {
          await queue.removeForOrder(o.id);
          if (hist?.some((h) => h.id === o.id)) {
            showToast(`Order #${o.shortId} was marked delivered by Zenvy support.`, 'success');
            setDeliveryId((cur) => (cur === o.id ? null : cur));
          } else if (hist === null) {
            // Could not check history (bad network): do not claim a cancellation we cannot prove.
            showToast(`Order #${o.shortId} is no longer assigned to you.`, 'info');
            setDeliveryId((cur) => (cur === o.id ? null : cur));
          } else {
            noteCancelled(o);
          }
        }
      }
      if (!autoOpened.current) {
        autoOpened.current = true;
        if (list.length === 1) setDeliveryId(list[0].id);
      }
    } catch (e) {
      if (isUnapprovedError(e) || seq !== activeSeq.current) return;
      setServerActive((a) => ({ ...a, loaded: true, error: errorMessage(e) }));
    }
  }, [loadHistory, noteCancelled, showToast]);

  const refreshPending = useCallback(async () => {
    try {
      const list = await api.fetchPending();
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPending({ data: list, loaded: true, error: null, updatedAt: Date.now() });
      if (!isOnlineRef.current) return;
      // Announce the newest order this rider has not heard about yet.
      const now = Date.now();
      const fresh = list.filter((o) => !seenOffers.current.has(o.id) && !((dismissedRef.current[o.id] ?? 0) > now));
      list.forEach((o) => seenOffers.current.add(o.id));
      if (fresh.length) {
        const o = fresh[0];
        announce('newOrder', { store: o.restaurantName, earning: o.earning }, { dedupeKey: `new:${o.id}`, chime: 'order' });
      }
    } catch (e) {
      if (isUnapprovedError(e)) return;
      setPending((p) => ({ ...p, loaded: true, error: errorMessage(e) }));
    }
  }, []);

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
    const [, , w] = await Promise.all([refreshToday(), loadHistory(), api.fetchWeek().catch(() => null), refreshProfile()]);
    if (w) setWeekServer(w);
  }, [refreshToday, loadHistory, refreshProfile]);

  // Week: server buckets when available, else computed from recent deliveries.
  const week = useMemo<WeekStats | null>(() => {
    if (weekServer) return weekServer;
    if (!history.data) return null;
    const days = lastNDayKeys(7).map((date) => ({ date, earnings: 0, orders: 0 }));
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

  const offers = useMemo(() => {
    const now = Date.now();
    return isOnline ? pending.data.filter((o) => !((dismissed[o.id] ?? 0) > now)) : [];
  }, [pending.data, dismissed, isOnline]);

  // ── Queue flush ────────────────────────────────────────────────────────
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

  const flushNow = useCallback(async () => {
    await runFlush(true);
    await refreshOrders();
  }, [runFlush, refreshOrders]);

  // ── First load + polling (foreground only) ─────────────────────────────
  const inMain = phase === 'main';
  useEffect(() => {
    if (!inMain) return;
    refreshActive();
    refreshToday();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMain]);

  useEffect(() => {
    if (!inMain) return;
    if (isOnline) refreshPending();
    else setPending(empty([]));
  }, [inMain, isOnline, refreshPending]);

  // Back in the foreground: refresh everything and re-check voices (the user may have installed one).
  const wasActive = useRef(appActive);
  useEffect(() => {
    if (appActive && !wasActive.current && inMain) {
      refreshOrders();
      refreshToday();
      if (queued.length) runFlush(true);
      if (getVoiceState().check !== 'ok') checkVoices();
    }
    wasActive.current = appActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appActive]);

  const pollOrders = inMain && appActive && (isOnline || active.data.length > 0);
  useInterval(() => {
    if (!connected) return;
    refreshOrders();
    if (queued.length) runFlush(false);
  }, pollOrders ? POLL_ORDERS_MS : null);
  useInterval(() => {
    if (connected) refreshToday();
  }, inMain && appActive ? POLL_STATS_MS : null);

  // Network came back: send queued steps first, then refetch.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current && inMain) {
      (async () => {
        await runFlush(true);
        await Promise.all([refreshOrders(), refreshToday(), loadHistory(), refreshProfile()]);
      })();
    }
    wasConnected.current = connected;
  }, [connected, inMain, runFlush, refreshOrders, refreshToday, loadHistory, refreshProfile]);

  // ── Socket ─────────────────────────────────────────────────────────────
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      refreshOrders();
    }, 700);
  }, [refreshOrders]);
  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!inMain || !tokenRef.current) return;
    let firstConnect = true;
    sock.setSocketHandlers({
      onOrderCancelled: ({ orderId, reason }) => {
        const o = activeRef.current.find((x) => x.id === orderId);
        if (!o || finishedIds.current.has(orderId)) return;
        noteCancelled(o, reason);
        refetchSoon();
      },
      onOrderReady: ({ orderId }) => {
        const o = activeRef.current.find((x) => x.id === orderId);
        if (!o) return;
        announce('ready', {}, { dedupeKey: `ready:${orderId}`, chime: 'info' });
        showToast(o.restaurantName ? `Order ready at ${o.restaurantName}` : 'Order ready at the store', 'success');
        refetchSoon();
      },
      onStatusUpdated: ({ orderId, status }) => {
        if (!activeRef.current.some((x) => x.id === orderId)) return;
        if (status === 'Cancelled') {
          const o = activeRef.current.find((x) => x.id === orderId);
          if (o && !finishedIds.current.has(orderId)) noteCancelled(o);
        }
        refetchSoon();
      },
      onTip: ({ amount, from, orderId }) => {
        announce('tip', { amount }, { dedupeKey: `tip:${orderId ?? 'x'}:${amount}`, chime: 'money' });
        showToast(`${from ? from + ' sent' : 'You got'} a ₹${Math.round(amount)} tip`, 'success');
        refreshProfile();
      },
      onTicketUpdated: () => showToast('Zenvy support replied to your ticket.', 'info'),
      // Live pool (riders_online room): refetch at once instead of waiting for the poll / push.
      onDeliveryRequest: () => {
        if (isOnlineRef.current) refreshPending();
      },
      onDeliveryRequestGone: ({ orderId }) => {
        setPending((p) => (p.data.some((o) => o.id === orderId) ? { ...p, data: p.data.filter((o) => o.id !== orderId) } : p));
      },
      onConnectionChange: (up) => {
        if (!up) return;
        if (firstConnect) {
          firstConnect = false;
          return;
        }
        refetchSoon(); // events sent while we were disconnected are not replayed
      },
    });
    sock.connectSocket(tokenRef.current);
    return () => sock.disconnectSocket();
  }, [inMain, noteCancelled, refetchSoon, refreshPending, refreshProfile, showToast]);

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
        const meta = { riderName: profileRef.current?.name || undefined, isOnline: isOnlineRef.current, activeOrderCount: orders.length };
        if (orders.length) {
          orders.forEach((o) => sock.emitLocation({ lat: f.lat, lng: f.lng, heading: f.heading, speed: f.speed, orderId: o.id, ...meta }));
        } else if (isOnlineRef.current) {
          sock.emitLocation({ lat: f.lat, lng: f.lng, heading: f.heading, speed: f.speed, ...meta });
        }
      })
      .then((r) => {
        if (!stopped) setLocationDenied(r === 'denied');
      });
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
      if (data?.type === 'NEW_ORDER' || data?.orderId) refetchSoon();
    });
    const offTap = push.onPushTapped((data) => {
      const id = data?.orderId ? String(data.orderId) : null;
      setOverlay(null);
      if (id && activeRef.current.some((o) => o.id === id)) setDeliveryId(id);
      else {
        setDeliveryId(null);
        setTab('home');
      }
      refetchSoon();
    });
    return () => {
      offToken();
      offRecv();
      offTap();
    };
  }, [inMain, riderId, refetchSoon]);

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setIsOnline(v);
        isOnlineRef.current = v;
        announce(v ? 'online' : 'offline', {}, { chime: 'info' });
        if (profileRef.current) {
          sock.emitDutyStatus(profileRef.current.id, profileRef.current.name, v);
          const p = { ...profileRef.current, isOnline: v };
          setProfile(p);
          session.saveProfile(p);
        }
        return true;
      } catch (e) {
        if (!isUnapprovedError(e)) showToast(errorMessage(e), 'error');
        return false;
      } finally {
        setDutyBusy(false);
      }
    },
    [connected, showToast],
  );

  // ── Order actions ──────────────────────────────────────────────────────
  const skipOffer = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      dismiss(id);
    },
    [dismiss],
  );

  const accept = useCallback(
    async (order: RiderOrder) => {
      if (!connected) {
        showToast('Accepting needs internet.', 'error');
        return false;
      }
      try {
        const claimed = await api.acceptOrder(order.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        announce('accepted', {}, { dedupeKey: `accepted:${order.id}`, chime: 'info' });
        setPending((p) => ({ ...p, data: p.data.filter((o) => o.id !== order.id) }));
        // It may already be ready at the counter: don't announce that as a "change".
        prevStatus.current.set(order.id, claimed?.status ?? order.status);
        // Show it right away (the accept response is the full order) even if the refetch below fails.
        const mine = claimed ?? order;
        activeSeq.current++; // an older in-flight refetch would not contain this order
        setServerActive((a) => ({
          ...a,
          loaded: true,
          data: a.data.some((o) => o.id === mine.id) ? a.data : [...a.data, mine],
        }));
        if (!activeRef.current.some((o) => o.id === mine.id)) activeRef.current = [...activeRef.current, mine];
        await refreshActive();
        setOverlay(null);
        setDeliveryId(order.id);
        return true;
      } catch (e) {
        if (!isUnapprovedError(e)) showToast(errorMessage(e), 'error');
        // Taken by another rider / no longer available: hide it. Server or network trouble: keep it.
        if (e instanceof ApiError && (e.status === 400 || e.status === 404 || e.status === 409)) {
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
            : PRE_PICKUP.includes(order.status)
              ? 'STATUS_PICKING'
              : null;
      if (!type) return false;
      const queueIt = async () => {
        await queue.enqueue(type, order.id);
        showToast('Saved on your phone. It will sync when you are back online.', 'info');
        return true;
      };
      if (!connected) return queueIt();
      // Earlier steps for this order still saved on the phone: send them first, in order.
      const waiting = (await queue.getQueue()).some((a) => a.orderId === order.id);
      if (waiting) {
        await runFlush(true);
        if ((await queue.getQueue()).some((a) => a.orderId === order.id)) return queueIt();
      }
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
    [connected, refreshActive, runFlush, showToast],
  );

  const afterDelivered = useCallback(async () => {
    await Promise.all([refreshActive(), refreshToday(), loadHistory(), refreshProfile()]);
    api.fetchWeek().then((w) => w && setWeekServer(w)).catch(() => {});
  }, [refreshActive, refreshToday, loadHistory, refreshProfile]);

  const deliver = useCallback(
    async (order: RiderOrder, pin: string): Promise<DeliverResult> => {
      if (!connected) return { ok: false, kind: 'offline', message: 'Connect to the internet to verify the PIN.' };
      const cash = cashOf(order) || null;
      const done = (earning: number | null): DeliverResult => {
        finishedIds.current.add(order.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        announce('delivered', { amount: earning }, { dedupeKey: `delivered:${order.id}`, chime: 'money' });
        afterDelivered();
        return { ok: true, earning, cash };
      };
      inFlightIds.current.add(order.id);
      try {
        const r = await api.markDelivered(order.id, pin);
        return done(r.earning ?? order.earning);
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === 'INVALID_PIN') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            const left = typeof e.data?.attemptsLeft === 'number' ? e.data.attemptsLeft : null;
            if (left === 0) return { ok: false, kind: 'locked', message: e.message };
            return { ok: false, kind: 'invalid', attemptsLeft: left, message: e.message };
          }
          if (e.status === 429 && e.code === 'PIN_LOCKED') return { ok: false, kind: 'locked', message: e.message };
          // Already delivered (double tap / support completed it): treat as done.
          if (e.status === 409 && e.code === 'ALREADY_DELIVERED') return done(order.earning);
          if (e.status === 409 || e.status === 400 || e.status === 404) refreshActive();
        }
        return { ok: false, kind: e instanceof NetworkError ? 'offline' : 'error', message: errorMessage(e) };
      } finally {
        inFlightIds.current.delete(order.id);
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
      inFlightIds.current.add(order.id);
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
        inFlightIds.current.delete(order.id);
        await refreshActive();
        return false;
      } finally {
        inFlightIds.current.delete(order.id);
      }
    },
    [connected, refreshActive, showToast],
  );

  const saveProfileEdits = useCallback(
    async (p: ProfileEdits) => {
      const raw = await api.updateProfile(p);
      applyProfile(api.toProfile({ ...raw, isOnline: isOnlineRef.current }, profileRef.current));
      showToast('Profile saved.', 'success');
    },
    [applyProfile, showToast],
  );

  const openDelivery = useCallback((id: string) => setDeliveryId(id), []);
  const closeDelivery = useCallback(() => setDeliveryId(null), []);
  const clearCancelNotice = useCallback(() => setCancelNotice(null), []);

  const value: RiderContextValue = {
    phase,
    profile,
    isOnline,
    dutyBusy,
    today,
    active,
    pending,
    offers,
    history,
    week,
    connected,
    serverReachable,
    queueCount: queued.length,
    syncPendingIds,
    fix,
    locationDenied,
    cancelNotice,
    toast,
    tab,
    setTab,
    deliveryId,
    openDelivery,
    closeDelivery,
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
    skipOffer,
    advance,
    deliver,
    unassign,
    flushNow,
    showToast,
    clearCancelNotice,
    saveProfileEdits,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
