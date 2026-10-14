import { useCallback, useEffect, useRef, useState } from 'react';
import { pulseCache } from './pulseShared';

export interface PulsePageResult<T, X = undefined> {
  items: T[];
  nextCursor: string | null;
  /** First-page extras (trends, hashtag info). */
  extra?: X;
}

interface Snapshot<T, X> {
  items: T[];
  nextCursor: string | null;
  extra?: X;
  at: number;
}

/**
 * Cursor-paged list for Pulse: cached first page (instant re-open, shown while offline), pull to
 * refresh, de-duplicated load-more (by `keyOf`), stale-response protection when the key changes,
 * and `refreshIfStale` for refetch-on-focus.
 */
export function usePulsePaged<T, X = undefined>(
  key: string | null,
  fetchPage: (cursor: string | null) => Promise<PulsePageResult<T, X>>,
  keyOf: (item: T) => string,
  opts: { onError?: (e: any) => void } = {}
) {
  const cached = key ? pulseCache.get<Snapshot<T, X>>(key) : undefined;
  const [items, setItems] = useState<T[]>(cached?.items || []);
  const [extra, setExtra] = useState<X | undefined>(cached?.extra);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<any>(null);
  const [softError, setSoftError] = useState<any>(null);
  const gen = useRef(0);
  const loadedAt = useRef(cached?.at || 0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const keyOfRef = useRef(keyOf);
  keyOfRef.current = keyOf;
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const cursorRef = useRef(nextCursor);
  cursorRef.current = nextCursor;

  const save = useCallback(
    (snap: Omit<Snapshot<T, X>, 'at'>) => {
      if (key) pulseCache.set(key, { ...snap, at: loadedAt.current });
    },
    [key]
  );

  const dedupe = (list: T[]) => {
    const seen = new Set<string>();
    return list.filter((x) => {
      const k = keyOfRef.current(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (!key) return;
      const my = ++gen.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial' && !itemsRef.current.length) setLoading(true);
      setSoftError(null);
      try {
        const r = await fetchRef.current(null);
        if (my !== gen.current) return;
        const list = dedupe(r.items);
        loadedAt.current = Date.now();
        setItems(list);
        setExtra(r.extra);
        setNextCursor(r.nextCursor);
        setError(null);
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
    [key, save] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!key) return;
    const snap = pulseCache.get<Snapshot<T, X>>(key);
    setItems(snap?.items || []);
    itemsRef.current = snap?.items || [];
    setExtra(snap?.extra);
    setNextCursor(snap?.nextCursor ?? null);
    loadedAt.current = snap?.at || 0;
    setError(null);
    setSoftError(null);
    setLoading(!snap);
    load('initial');
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!key || !cursorRef.current || loadingMore || loading || refreshing) return;
    const my = gen.current;
    setLoadingMore(true);
    try {
      const r = await fetchRef.current(cursorRef.current);
      if (my !== gen.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((x) => keyOfRef.current(x)));
        const merged = [...prev, ...r.items.filter((x) => !seen.has(keyOfRef.current(x)))];
        save({ items: merged, nextCursor: r.nextCursor, extra: extraRef.current });
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
  }, [key, loadingMore, loading, refreshing, save]);

  /** Local change (like, edit, removal) that should also update the cached page. */
  const update = useCallback(
    (fn: (prev: T[]) => T[]) => {
      setItems((prev) => {
        const next = fn(prev);
        if (next === prev) return prev;
        save({ items: next, nextCursor: cursorRef.current, extra: extraRef.current });
        return next;
      });
    },
    [save]
  );

  /** Refetch quietly when the data is older than `maxAgeMs` (tab focus, app resume). */
  const refreshIfStale = useCallback(
    (maxAgeMs = 60000) => {
      if (!key || loading || refreshing) return;
      if (Date.now() - loadedAt.current > maxAgeMs) load('silent');
    },
    [key, loading, refreshing, load]
  );

  return {
    items,
    extra,
    setExtra,
    update,
    loading: loading && !items.length,
    refreshing,
    loadingMore,
    error: items.length ? null : error,
    softError,
    hasMore: !!nextCursor,
    refresh: () => load('refresh'),
    reload: () => load('initial'),
    refreshIfStale,
    loadMore,
  };
}

export type PulsePaged<T, X = undefined> = ReturnType<typeof usePulsePaged<T, X>>;
