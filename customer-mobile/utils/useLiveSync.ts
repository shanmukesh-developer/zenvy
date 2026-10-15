import { useContext, useEffect, useRef } from 'react';
import { NavigationContext } from 'expo-router/react-navigation';
import { connectSocket } from './socket';

/**
 * Realtime "admin changed something" sync (backend `data:changed`, see backend/utils/realtime.js).
 *
 * The server sends IDs only — never row data — so every screen refetches through REST.
 * Events are coalesced on the client (default 500 ms) and handed over as one batch, so a burst of
 * admin edits costs one refetch. After a reconnect the handler gets a synthetic `reconnect` event
 * (events sent while offline are not replayed), which every `affects*` helper treats as "refetch".
 * A reconnect refetches at once only when the screen is focused (or the hook lives outside any screen,
 * e.g. a provider) or its data is older than RECONNECT_STALE_MS; a hidden screen with fresh data
 * refetches when it is next focused instead, so a flaky network does not make every mounted tab reload.
 *
 * Callers must refetch silently: keep the current data on screen, no skeletons/spinners.
 */

export type LiveSyncType =
  | 'store' | 'product' | 'config' | 'announcement' | 'coupon' | 'pg' | 'wall' | 'campus';

export interface LiveSyncEvent {
  type: LiveSyncType | 'reconnect';
  action: 'created' | 'updated' | 'deleted';
  /** Changed row id, or null = "refetch the whole list". */
  id: string | number | null;
  storeId?: string | number | null;
  scope?: string;
  bulk?: boolean;
  count?: number;
  at?: string;
}

interface Options {
  /** Event types this screen cares about. */
  types: LiveSyncType[];
  /** Called once per coalesced batch (only events of `types`, plus `reconnect`). */
  onChange: (events: LiveSyncEvent[]) => void;
  /** Extra per-event filter (e.g. only this store). `reconnect` events skip it. */
  filter?: (e: LiveSyncEvent) => boolean;
  debounceMs?: number;
  /** Refetch after the socket reconnects (default true). */
  refetchOnReconnect?: boolean;
  enabled?: boolean;
}

const RECONNECT_EVENT: LiveSyncEvent = { type: 'reconnect', action: 'updated', id: null };
/** Extra random delay per batch so all clients do not hit the API in the same instant. */
const JITTER_MS = 1500;
/** A hidden screen whose last load is older than this still refetches straight away on reconnect. */
const RECONNECT_STALE_MS = 2 * 60 * 1000;

export function useLiveSync({
  types,
  onChange,
  filter,
  debounceMs = 500,
  refetchOnReconnect = true,
  enabled = true,
}: Options) {
  // Latest callbacks in refs: screens can pass inline functions without re-subscribing every render
  const onChangeRef = useRef(onChange);
  const filterRef = useRef(filter);
  onChangeRef.current = onChange;
  filterRef.current = filter;
  const typesKey = types.slice().sort().join(',');
  // The screen this hook runs in (undefined outside a navigator screen, e.g. in a context provider).
  const navigation = useContext(NavigationContext) as any;

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(typesKey.split(',').filter(Boolean));
    let socket: ReturnType<typeof connectSocket>;
    try {
      socket = connectSocket();
    } catch {
      return;
    }

    let pending: LiveSyncEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    // The first 'connect' after mount is the initial connection: the screen's own load covers it
    let hadConnection = socket.connected;
    // When this screen's data was last (re)loaded: mount, then every delivered batch.
    let lastSyncAt = Date.now();
    // A reconnect skipped while hidden: delivered on the next focus.
    let deferredReconnect = false;
    const isFocused = () => {
      if (!navigation || typeof navigation.isFocused !== 'function') return true;
      try { return !!navigation.isFocused(); } catch { return true; }
    };

    const flush = () => {
      timer = null;
      if (disposed || pending.length === 0) return;
      const batch = pending;
      pending = [];
      lastSyncAt = Date.now();
      try {
        onChangeRef.current(batch);
      } catch (err) {
        console.warn('[LIVE_SYNC] handler failed:', err);
      }
    };

    // Fixed window (not reset per event, so a steady stream still flushes) plus a random spread:
    // every phone gets the same broadcast at once, and the jitter keeps them from refetching in lockstep.
    const queue = (e: LiveSyncEvent) => {
      if (pending.length < 200) pending.push(e);
      if (timer) return;
      timer = setTimeout(flush, debounceMs + Math.floor(Math.random() * JITTER_MS));
    };

    const onDataChanged = (raw: any) => {
      if (!raw || typeof raw !== 'object' || !wanted.has(raw.type)) return;
      const e = raw as LiveSyncEvent;
      if (filterRef.current && !filterRef.current(e)) return;
      queue(e);
    };

    const onConnect = () => {
      if (hadConnection && refetchOnReconnect) {
        if (isFocused() || Date.now() - lastSyncAt > RECONNECT_STALE_MS) queue(RECONNECT_EVENT);
        else deferredReconnect = true;
      }
      hadConnection = true;
    };

    let unsubscribeFocus: (() => void) | undefined;
    if (navigation && typeof navigation.addListener === 'function') {
      try {
        unsubscribeFocus = navigation.addListener('focus', () => {
          if (!deferredReconnect) return;
          deferredReconnect = false;
          queue(RECONNECT_EVENT);
        });
      } catch {
        unsubscribeFocus = undefined;
      }
    }

    socket.on('data:changed', onDataChanged);
    socket.on('connect', onConnect);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      socket.off('data:changed', onDataChanged);
      socket.off('connect', onConnect);
      try { unsubscribeFocus?.(); } catch {}
    };
  }, [typesKey, debounceMs, refetchOnReconnect, enabled, navigation]);
}

const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

/** Does the batch touch store `storeId` (its details or any of its menu items)? */
export const affectsStore = (events: LiveSyncEvent[], storeId: string | number | null | undefined) =>
  events.some((e) =>
    e.type === 'reconnect' ||
    (e.type === 'store' && (e.id == null || same(e.id, storeId))) ||
    (e.type === 'product' && (e.storeId == null ? true : same(e.storeId, storeId)))
  );

/** Does the batch touch product `productId` (or the store it belongs to)? */
export const affectsProduct = (
  events: LiveSyncEvent[],
  productId: string | number | null | undefined,
  storeId?: string | number | null
) =>
  events.some((e) =>
    e.type === 'reconnect' ||
    (e.type === 'product' && (e.id == null
      ? (e.storeId == null || storeId == null || same(e.storeId, storeId))
      : same(e.id, productId))) ||
    (e.type === 'store' && (e.id == null || (storeId != null && same(e.id, storeId))))
  );

/** Does the batch touch any of the given products / stores (e.g. the basket)? */
export const affectsAny = (
  events: LiveSyncEvent[],
  productIds: (string | number)[],
  storeIds: (string | number)[]
) => {
  const products = new Set(productIds.map(String));
  const stores = new Set(storeIds.map(String));
  return events.some((e) =>
    e.type === 'reconnect' ||
    (e.type === 'product' && (e.id == null ? (e.storeId == null || stores.has(String(e.storeId))) : products.has(String(e.id)))) ||
    (e.type === 'store' && (e.id == null || stores.has(String(e.id))))
  );
};

export const hasType = (events: LiveSyncEvent[], ...types: LiveSyncEvent['type'][]) =>
  events.some((e) => e.type === 'reconnect' || types.includes(e.type));
