// Offline queue v2: only the three step updates that are safe to replay later.
// Accept (first-claim race) and Delivered (server PIN check) always need a live connection.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, NetworkError, apiFetch } from './apiClient';
import type { OrderStatus } from '../types';
import { KEYS } from '../config';

export type QueueType = 'STATUS_PICKING' | 'STATUS_PICKED_UP' | 'ARRIVE';

export interface QueuedAction {
  id: string;
  type: QueueType;
  orderId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
}

export interface DroppedAction {
  action: QueuedAction;
  message: string;
}

export interface FlushResult {
  done: QueuedAction[];
  dropped: DroppedAction[];
  remaining: number;
  authFailed: boolean;
}

const KEY = KEYS.queue;
const LEGACY_KEY = KEYS.legacyQueue;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const QUEUE_STATUS: Record<QueueType, OrderStatus> = {
  STATUS_PICKING: 'Picking',
  STATUS_PICKED_UP: 'PickedUp',
  ARRIVE: 'ArrivedAtGate',
};

let cache: QueuedAction[] | null = null;
let flushing: Promise<FlushResult> | null = null;
const listeners = new Set<(q: QueuedAction[]) => void>();

function notify(q: QueuedAction[]) {
  listeners.forEach((l) => {
    try {
      l(q);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeQueue(listener: (q: QueuedAction[]) => void): () => void {
  listeners.add(listener);
  if (cache) listener(cache);
  return () => {
    listeners.delete(listener);
  };
}

async function migrateLegacy(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(LEGACY_KEY);
    const old = JSON.parse(raw);
    if (!Array.isArray(old)) return [];
    const out: QueuedAction[] = [];
    for (const a of old) {
      let type: QueueType | null = null;
      if (a?.type === 'ARRIVE_GATE') type = 'ARRIVE';
      else if (a?.type === 'UPDATE_STATUS' && a?.payload?.status === 'Picking') type = 'STATUS_PICKING';
      else if (a?.type === 'UPDATE_STATUS' && a?.payload?.status === 'PickedUp') type = 'STATUS_PICKED_UP';
      // ACCEPT_ORDER and Delivered (with PIN) are not replayable: dropped.
      if (type && a?.orderId) {
        const ts = Number(a.timestamp) || Date.now();
        out.push({ id: `${a.orderId}:${type}`, type, orderId: String(a.orderId), createdAt: ts, attempts: 0, nextAttemptAt: 0 });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function load(): Promise<QueuedAction[]> {
  if (cache) return cache;
  let list: QueuedAction[] = [];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  const legacy = await migrateLegacy();
  for (const l of legacy) if (!list.some((x) => x.id === l.id)) list.push(l);
  cache = prune(list);
  if (legacy.length) await save(cache);
  return cache;
}

function prune(list: QueuedAction[]): QueuedAction[] {
  const now = Date.now();
  return list.filter((a) => now - a.createdAt < MAX_AGE_MS).sort((a, b) => a.createdAt - b.createdAt);
}

async function save(list: QueuedAction[]): Promise<void> {
  cache = list;
  notify(list);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // keep in memory
  }
}

export async function getQueue(): Promise<QueuedAction[]> {
  return load();
}

export async function enqueue(type: QueueType, orderId: string): Promise<void> {
  const list = [...(await load())];
  const id = `${orderId}:${type}`;
  if (list.some((a) => a.id === id)) return; // dedupe: orderId + type
  list.push({ id, type, orderId, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
  await save(prune(list));
}

export async function removeForOrder(orderId: string): Promise<void> {
  const list = await load();
  await save(list.filter((a) => a.orderId !== orderId));
}

export async function clearQueue(): Promise<void> {
  await save([]);
}

async function send(a: QueuedAction): Promise<void> {
  if (a.type === 'ARRIVE') {
    await apiFetch(`/delivery/arrive/${a.orderId}`, { method: 'PUT' });
  } else {
    await apiFetch(`/delivery/status/${a.orderId}`, { method: 'PUT', body: { status: QUEUE_STATUS[a.type] } });
  }
}

/** Single-flight: concurrent callers share the same flush. Sends oldest first. */
export function flushQueue(opts: { force?: boolean } = {}): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { done: [], dropped: [], remaining: 0, authFailed: false };
    let list = prune([...(await load())]);
    const now = Date.now();
    const keep: QueuedAction[] = [];
    let stop = false;
    for (const a of list) {
      if (stop || (!opts.force && a.nextAttemptAt > now)) {
        keep.push(a);
        continue;
      }
      try {
        await send(a);
        result.done.push(a);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          result.authFailed = true;
          keep.push(a);
          stop = true;
        } else if (e instanceof ApiError && (e.status === 400 || e.status === 403 || e.status === 404 || e.status === 409)) {
          // The server rejected it (order cancelled / changed): drop and let the UI roll back.
          result.dropped.push({ action: a, message: e.message });
        } else {
          // NetworkError, 5xx, 429: retry later with backoff.
          const attempts = a.attempts + 1;
          keep.push({ ...a, attempts, nextAttemptAt: Date.now() + Math.min(60000, 2000 * 2 ** attempts) });
          if (e instanceof NetworkError) stop = true; // no point trying the rest right now
        }
      }
    }
    // Keep anything enqueued while we were flushing.
    const current = await load();
    const handled = new Set([...result.done, ...result.dropped.map((d) => d.action)].map((a) => a.id));
    const currentIds = new Set(current.map((c) => c.id));
    // Items removed meanwhile (removeForOrder / logout clear) must not come back.
    const kept = keep.filter((k) => currentIds.has(k.id));
    const keepIds = new Set(kept.map((k) => k.id));
    list = [...kept, ...current.filter((c) => !handled.has(c.id) && !keepIds.has(c.id))];
    await save(prune(list));
    result.remaining = list.length;
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
