import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../api/tasksApi';
import { taskBus, taskCache } from './tasksShared';

export interface TaskPage<X = undefined> {
  items: Task[];
  nextCursor: string | null;
  extra?: X;
}

/**
 * Cursor-paged task list: cached first page (instant re-open, offline fallback), pull-to-refresh,
 * de-duplicated load-more, stale-response protection when the key changes, and live merging of
 * tasks changed elsewhere (task bus) or by the server (`friends:task_updated` → refetch).
 */
export function useTaskPaged<X = undefined>(
  key: string | null,
  fetchPage: (cursor: string | null) => Promise<TaskPage<X>>,
  opts: { onError?: (e: any) => void; keep?: (t: Task) => boolean } = {}
) {
  const cached = key ? taskCache.get<TaskPage<X>>(key) : undefined;
  const [items, setItems] = useState<Task[]>(cached?.items || []);
  const [extra, setExtra] = useState<X | undefined>(cached?.extra);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<any>(null);
  const [softError, setSoftError] = useState<any>(null);
  const gen = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const keepRef = useRef(opts.keep);
  keepRef.current = opts.keep;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pageRef = useRef({ nextCursor, extra });
  pageRef.current = { nextCursor, extra };

  const save = useCallback(
    (snap: TaskPage<X>) => {
      if (key) taskCache.set(key, snap);
    },
    [key]
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!key) return;
      const my = ++gen.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial' && !itemsRef.current.length) setLoading(true);
      if (mode !== 'silent') setSoftError(null);
      try {
        const r = await fetchRef.current(null);
        if (my !== gen.current) return;
        const seen = new Set<string>();
        const list = r.items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
        setItems(list);
        setExtra(r.extra);
        setNextCursor(r.nextCursor);
        setError(null);
        setSoftError(null);
        save({ items: list, nextCursor: r.nextCursor, extra: r.extra });
      } catch (e: any) {
        if (my !== gen.current) return;
        onErrorRef.current?.(e);
        if (itemsRef.current.length) {
          if (mode !== 'silent') setSoftError(e);
        } else setError(e);
      } finally {
        if (my === gen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key, save]
  );

  useEffect(() => {
    if (!key) return;
    const snap = taskCache.get<TaskPage<X>>(key);
    setItems(snap?.items || []);
    itemsRef.current = snap?.items || [];
    setExtra(snap?.extra);
    setNextCursor(snap?.nextCursor ?? null);
    setError(null);
    setSoftError(null);
    setLoading(!snap);
    load('initial');
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!key || !nextCursor || loadingMore || loading || refreshing) return;
    const my = gen.current;
    setLoadingMore(true);
    try {
      const r = await fetchRef.current(nextCursor);
      if (my !== gen.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev, ...r.items.filter((x) => !seen.has(x.id))];
        save({ items: merged, nextCursor: r.nextCursor, extra: pageRef.current.extra });
        return merged;
      });
      setNextCursor(r.nextCursor);
      setSoftError(null);
    } catch (e: any) {
      if (my !== gen.current) return;
      onErrorRef.current?.(e);
      setSoftError(e);
    } finally {
      if (my === gen.current) setLoadingMore(false);
    }
  }, [key, nextCursor, loadingMore, loading, refreshing, save]);

  const update = useCallback(
    (fn: (prev: Task[]) => Task[]) => {
      setItems((prev) => {
        const next = fn(prev);
        if (next === prev) return prev;
        save({ items: next, nextCursor: pageRef.current.nextCursor, extra: pageRef.current.extra });
        return next;
      });
    },
    [save]
  );

  // Fresh copies from detail / sheets: merge in place, or drop when the list no longer wants it.
  useEffect(
    () =>
      taskBus.onTask((task) => {
        update((prev) => {
          if (!prev.some((x) => x.id === task.id)) return prev;
          const keep = keepRef.current;
          if (keep && !keep(task)) return prev.filter((x) => x.id !== task.id);
          return prev.map((x) => (x.id === task.id ? task : x));
        });
      }),
    [update]
  );

  // Something changed on the server: refetch quietly (keeps the list on screen).
  useEffect(
    () =>
      taskBus.onStale((taskId) => {
        if (taskId && !itemsRef.current.some((x) => x.id === taskId) && keepRef.current === undefined) return;
        load('silent');
      }),
    [load]
  );

  useEffect(
    () =>
      taskBus.onBlocked((userId) => {
        update((prev) => prev.filter((x) => !(x.poster && !(x.poster as any).anonymous && (x.poster as any).userId === userId && x.myRole !== 'helper')));
      }),
    [update]
  );

  return {
    items,
    extra,
    update,
    loading: loading && !items.length,
    refreshing,
    loadingMore,
    error: items.length ? null : error,
    softError,
    hasMore: !!nextCursor,
    refresh: () => load('refresh'),
    reload: () => load('initial'),
    loadMore,
  };
}
