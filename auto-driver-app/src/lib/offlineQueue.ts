// Offline queue (adapted from delivery-boy-app/src/services/offlineQueue.ts): ONLY actions that are safe
// to replay later and give the same result however many times they land:
//   GO_OFFLINE   POST /online { online: false }
//   MARK_READ    POST /notifications/read
// Trip state changes (confirm departure, boarding, start, complete, cancel, delay), check-ins, publish and
// full-auto answers are never queued: they need a live answer from the server (another passenger may have
// booked, the trip may have changed), so the screens ask the driver to retry and re-check the trip first.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, NetworkError } from './http';
import { driverApi } from '../api/driverApi';
import { STORAGE } from '../config';

export type QueueType = 'GO_OFFLINE' | 'MARK_READ';
export interface QueuedAction { id: QueueType; type: QueueType; createdAt: number; attempts: number }
export interface FlushResult { done: QueueType[]; dropped: { type: QueueType; message: string }[]; remaining: number }

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
let cache: QueuedAction[] | null = null;
let flushing: Promise<FlushResult> | null = null;
const listeners = new Set<(q: QueuedAction[]) => void>();

export function subscribeQueue(listener: (q: QueuedAction[]) => void): () => void {
  listeners.add(listener);
  if (cache) listener(cache);
  return () => { listeners.delete(listener); };
}

async function load(): Promise<QueuedAction[]> {
  if (cache) return cache;
  let list: QueuedAction[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE.queue);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      list = parsed.filter((a) => a && (a.type === 'GO_OFFLINE' || a.type === 'MARK_READ') && Number.isFinite(Number(a.createdAt)))
        .map((a) => ({ id: a.type, type: a.type, createdAt: Number(a.createdAt), attempts: Number(a.attempts) || 0 }));
    }
  } catch { list = []; }
  cache = list.filter((a) => Date.now() - a.createdAt < MAX_AGE_MS);
  return cache;
}

async function save(list: QueuedAction[]): Promise<void> {
  cache = list;
  listeners.forEach((l) => { try { l(list); } catch { /* ignore */ } });
  try { await AsyncStorage.setItem(STORAGE.queue, JSON.stringify(list)); } catch { /* keep in memory */ }
}

export async function enqueue(type: QueueType): Promise<void> {
  const list = [...(await load())];
  if (list.some((a) => a.type === type)) return; // one of each is enough (idempotent)
  list.push({ id: type, type, createdAt: Date.now(), attempts: 0 });
  await save(list);
}

/** Going online cancels a queued "go offline" (the live call that follows wins). */
export async function remove(type: QueueType): Promise<void> {
  const list = await load();
  if (list.some((a) => a.type === type)) await save(list.filter((a) => a.type !== type));
}

export async function clearQueue(): Promise<void> { await save([]); }
export async function queuedTypes(): Promise<QueueType[]> { return (await load()).map((a) => a.type); }

async function send(type: QueueType) {
  if (type === 'GO_OFFLINE') await driverApi.setOnline(false);
  else await driverApi.markRead();
}

/** Single-flight: sends oldest first; network errors keep the item for the next try. */
export function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { done: [], dropped: [], remaining: 0 };
    const list = [...(await load())];
    const keep: QueuedAction[] = [];
    let stop = false;
    for (const a of list) {
      if (stop) { keep.push(a); continue; }
      try {
        await send(a.type);
        result.done.push(a.type);
      } catch (e) {
        if (e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429))) {
          keep.push({ ...a, attempts: a.attempts + 1 });
          if (e instanceof NetworkError) stop = true;
        } else {
          result.dropped.push({ type: a.type, message: e instanceof Error ? e.message : 'Not sent' });
          if (e instanceof ApiError && e.status === 401) stop = true;
        }
      }
    }
    const current = await load();
    const handled = new Set<QueueType>([...result.done, ...result.dropped.map((d) => d.type)]);
    const keepTypes = new Set(keep.map((k) => k.type));
    const next = [...keep.filter((k) => current.some((c) => c.type === k.type)), ...current.filter((c) => !handled.has(c.type) && !keepTypes.has(c.type))];
    await save(next);
    result.remaining = next.length;
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}
