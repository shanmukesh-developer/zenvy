import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSpaces, Space, SpaceListStatus } from '../api/spacesApi';
import { spaceBus, spaceCache } from './spacesShared';

interface Page {
  items: Space[];
  nextCursor: string | null;
}

/** Does this Space still belong in this list after a change? */
const fits = (list: SpaceListStatus, s: Space) => (list === 'mine' ? s.isHost : s.status === list);

/**
 * One Spaces list (live / scheduled / mine): cached first page (instant re-open, offline fallback),
 * pull-to-refresh, de-duplicated load-more, stale-response protection, and live merging of Spaces
 * changed elsewhere (reminder, start, end) through the Spaces bus.
 */
export function useSpacesPaged(list: SpaceListStatus, opts: { enabled: boolean; onError?: (e: any) => void }) {
  const key = `list:${list}`;
  const cached = spaceCache.get<Page>(key);
  const [items, setItems] = useState<Space[]>(cached?.items || []);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<any>(null);
  const [softError, setSoftError] = useState<any>(null);
  const [loaded, setLoaded] = useState(!!cached);
  const gen = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;
  const more = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      const my = ++gen.current;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial' && !itemsRef.current.length) setLoading(true);
      try {
        const r = await fetchSpaces(list, null);
        if (my !== gen.current) return;
        const seen = new Set<string>();
        const clean = r.items.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
        setItems(clean);
        setNextCursor(r.nextCursor);
        setError(null);
        setSoftError(null);
        setLoaded(true);
        spaceCache.set(key, { items: clean, nextCursor: r.nextCursor });
        clean.forEach((s) => spaceCache.set(`space:${s.id}`, s));
      } catch (e: any) {
        if (my !== gen.current) return;
        onErrorRef.current?.(e);
        if (itemsRef.current.length || loaded) {
          if (mode !== 'silent') setSoftError(e);
        } else setError(e);
      } finally {
        if (my === gen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [list, key, loaded]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || more.current || loading) return;
    more.current = true;
    setLoadingMore(true);
    const my = gen.current;
    try {
      const r = await fetchSpaces(list, nextCursor);
      if (my !== gen.current) return;
      setItems((prev) => {
        const ids = new Set(prev.map((s) => s.id));
        return [...prev, ...r.items.filter((s) => !ids.has(s.id))];
      });
      setNextCursor(r.nextCursor);
    } catch (e: any) {
      onErrorRef.current?.(e);
      setSoftError(e);
    } finally {
      more.current = false;
      setLoadingMore(false);
    }
  }, [list, nextCursor, loading]);

  useEffect(() => {
    if (opts.enabled) load('initial');
  }, [opts.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // A Space changed here: update it in place, or drop it when it no longer fits this list.
  useEffect(
    () =>
      spaceBus.on((s) =>
        setItems((prev) => {
          const i = prev.findIndex((x) => x.id === s.id);
          if (i < 0) return prev;
          if (!fits(list, s)) return prev.filter((x) => x.id !== s.id);
          const next = prev.slice();
          next[i] = s;
          return next;
        })
      ),
    [list]
  );
  useEffect(() => spaceBus.onStale(() => opts.enabled && load('silent')), [load, opts.enabled]);

  return {
    items,
    loading: loading && !items.length,
    refreshing,
    loadingMore,
    error: items.length ? null : error,
    softError,
    hasMore: !!nextCursor,
    refresh: () => load('refresh'),
    reload: () => load('initial'),
    silent: () => load('silent'),
    loadMore,
    setItems,
  };
}
