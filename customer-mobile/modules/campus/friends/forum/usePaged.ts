import { useCallback, useEffect, useRef, useState } from 'react';
import { forumCache } from './forumShared';

export interface PageResult<T, X = undefined> {
  items: T[];
  nextCursor: string | null;
  /** First-page extras (pinned posts, target summary, …). */
  extra?: X;
}

interface Snapshot<T, X> {
  items: T[];
  nextCursor: string | null;
  extra?: X;
}

/**
 * Cursor-paged list with: cached first page (instant re-open, offline fallback), pull-to-refresh,
 * de-duplicated load-more, and stale-response protection when the key (sort / filter) changes.
 */
export function usePaged<T extends { id: string }, X = undefined>(
  key: string | null,
  fetchPage: (cursor: string | null) => Promise<PageResult<T, X>>,
  opts: { onError?: (e: any) => void } = {}
) {
  const cached = key ? forumCache.get<Snapshot<T, X>>(key) : undefined;
  const [items, setItems] = useState<T[]>(cached?.items || []);
  const [extra, setExtra] = useState<X | undefined>(cached?.extra);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<any>(null);
  /** Error while loading more / refreshing with data on screen (shown inline, list kept). */
  const [softError, setSoftError] = useState<any>(null);
  const gen = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const save = useCallback(
    (snap: Snapshot<T, X>) => {
      if (key) forumCache.set(key, snap);
    },
    [key]
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!key) return;
      const my = ++gen.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (!itemsRef.current.length) setLoading(true);
      setSoftError(null);
      try {
        const r = await fetchRef.current(null);
        if (my !== gen.current) return;
        const seen = new Set<string>();
        const list = r.items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
        setItems(list);
        setExtra(r.extra);
        setNextCursor(r.nextCursor);
        setError(null);
        save({ items: list, nextCursor: r.nextCursor, extra: r.extra });
      } catch (e: any) {
        if (my !== gen.current) return;
        onErrorRef.current?.(e);
        if (itemsRef.current.length) setSoftError(e);
        else setError(e);
      } finally {
        if (my === gen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key, save]
  );

  // New key (sort / filter / community): show its cache (if any) and fetch.
  useEffect(() => {
    if (!key) return;
    const snap = forumCache.get<Snapshot<T, X>>(key);
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
        save({ items: merged, nextCursor: r.nextCursor, extra });
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
  }, [key, nextCursor, loadingMore, loading, refreshing, extra, save]);

  /** Local edit (vote, bookmark, removal) that should also update the cached page. */
  const update = useCallback(
    (fn: (prev: T[]) => T[]) => {
      setItems((prev) => {
        const next = fn(prev);
        save({ items: next, nextCursor, extra });
        return next;
      });
    },
    [save, nextCursor, extra]
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
    loadMore,
  };
}
