"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useLiveSync, useFreshIds, FRESH_ROW_CLASS } from '@/lib/useLiveSync';
import {
  Product, STATUS_META, Store, StoreStatus, adminRequest, formatINR, isLocalVendorType, storeId, storeStatus, vendorLabel,
} from './catalogue';
import {
  Button, Callout, Chip, ConfirmModal, EmptyState, Field, INPUT, MenuButton, Modal, Skeleton, Thumb, Toggle,
  ToastProvider, TypedConfirmModal, cx, FOCUS_RING, useSlashFocus, useToast,
} from '@/components/restaurants/ui';
import { StoreWizard, StepKey } from '@/components/restaurants/StoreWizard';
import { StoreDrawer, DrawerTab } from '@/components/restaurants/StoreDrawer';
import { useStoreStats } from '@/components/restaurants/useStoreStats';
import { duplicateItemPayload, duplicatePayload, patchStore, removeStoreBanner } from '@/components/restaurants/storeActions';
import { summarizeWeekly, weeklyFromStore } from '@/components/restaurants/helpers';

const FILTERS_KEY = 'zenvy.admin.storeFilters.v1';
const DRAFT_KEY = 'zenvy.admin.storeWizard.v1';
type StatusFilter = 'all' | StoreStatus;
type SortKey = 'name' | 'newest' | 'orders' | 'sales' | 'rating' | 'items' | 'attention';
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'orders', label: 'Most orders today' },
  { value: 'sales', label: 'Highest sales today' },
  { value: 'rating', label: 'Best rated' },
  { value: 'items', label: 'Largest menu' },
  { value: 'newest', label: 'Newest first' },
  { value: 'attention', label: 'Needs attention first' },
];
const STATUS_TONE = { live: 'green', closed: 'amber', draft: 'slate', inactive: 'red' } as const;

interface Filters { search: string; type: string; campus: string; status: StatusFilter; sort: SortKey }
const DEFAULT_FILTERS: Filters = { search: '', type: 'ALL', campus: 'ALL', status: 'all', sort: 'name' };

export default function StoresPage() {
  return (
    <ToastProvider>
      <StoresScreen />
    </ToastProvider>
  );
}

function StoresScreen() {
  const { isAuthed } = useAdminAuth();
  const toast = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [wizard, setWizard] = useState<{ mode: 'create' | 'edit'; id?: string; step?: StepKey } | null>(null);
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const [deleting, setDeleting] = useState<Store | null>(null);
  const [duplicating, setDuplicating] = useState<Store | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: React.ReactNode; action: string; danger?: boolean; run: () => Promise<void> } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useSlashFocus(searchRef);
  const stats = useStoreStats(isAuthed);
  const { mark: markFresh, isFresh } = useFreshIds();

  // ── persisted filters + deep link ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (raw) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw), search: '' });
      setHasDraft(!!localStorage.getItem(DRAFT_KEY));
    } catch { /* storage unavailable */ }
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('store');
    if (sid) setDrawer({ id: sid, tab: (params.get('tab') as DrawerTab) || 'overview' });
  }, []);
  useEffect(() => {
    try { const { search: _s, ...rest } = filters; void _s; localStorage.setItem(FILTERS_KEY, JSON.stringify(rest)); } catch { /* ignore */ }
  }, [filters]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (drawer) { url.searchParams.set('store', drawer.id); url.searchParams.set('tab', drawer.tab); }
    else { url.searchParams.delete('store'); url.searchParams.delete('tab'); }
    window.history.replaceState(window.history.state, '', url.toString());
  }, [drawer]);
  const setF = (patch: Partial<Filters>) => setFilters(prev => ({ ...prev, ...patch }));

  const loadStores = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setLoadError(''); }
    try {
      const data = await adminRequest<Store[]>('/api/admin/restaurants');
      setStores(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch (e) {
      if (!quiet) setLoadError(e instanceof Error ? e.message : 'Could not load stores.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => { if (isAuthed) loadStores(); }, [isAuthed, loadStores]);

  // ── realtime: other admins, the partner app and the auto-restock job ──
  const drawerIdRef = useRef<string | null>(null);
  drawerIdRef.current = drawer?.id || null;
  useLiveSync(['store', 'product'], (events, { reconnect }) => {
    loadStores(true);
    if (reconnect) return;
    const storeEvents = events.filter(e => e.type === 'store');
    markFresh(storeEvents.filter(e => e.action !== 'deleted').map(e => e.id));
    const removed = storeEvents.filter(e => e.action === 'deleted').map(e => String(e.id));
    if (drawerIdRef.current && removed.includes(drawerIdRef.current)) {
      setDrawer(null);
      toast.error('The store you were viewing was deleted in another session.');
    }
    const created = storeEvents.filter(e => e.action === 'created').length;
    if (created) toast.info(created > 1 ? `${created} new stores were added.` : 'A new store was added.');
  }, { enabled: isAuthed });

  const merge = useCallback((saved: Store) => {
    const id = storeId(saved);
    setStores(prev => prev.some(s => storeId(s) === id) ? prev.map(s => (storeId(s) === id ? { ...s, ...saved } : s)) : [...prev, { itemCount: 0, ...saved }]);
    loadStores(true); // refresh computed open/closed state and counts
  }, [loadStores]);

  // ── derived ──
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    stores.forEach(s => { const t = (s.vendorType || 'RESTAURANT').toUpperCase(); counts.set(t, (counts.get(t) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stores]);
  const campusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    stores.forEach(s => { const c = (s.campus || '').trim(); if (c) counts.set(c, (counts.get(c) || 0) + 1); });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [stores]);
  const statusCounts = useMemo(() => {
    const c: Record<StoreStatus, number> = { live: 0, closed: 0, draft: 0, inactive: 0 };
    stores.forEach(s => { c[storeStatus(s)]++; });
    return c;
  }, [stores]);

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const list = stores.filter(s => {
      const type = (s.vendorType || 'RESTAURANT').toUpperCase();
      if (filters.type !== 'ALL' && type !== filters.type) return false;
      if (filters.campus !== 'ALL' && (s.campus || '').trim() !== filters.campus) return false;
      if (filters.status !== 'all' && storeStatus(s) !== filters.status) return false;
      return !q || [s.name, s.location, s.campus, vendorLabel(type), ...(s.tags || [])].some(v => String(v || '').toLowerCase().includes(q));
    });
    const attention = (s: Store) => (storeStatus(s) === 'draft' ? 0 : !s.imageUrl || (s.itemCount ?? 0) === 0 ? 1 : storeStatus(s) === 'inactive' ? 2 : 3);
    const by: Record<SortKey, (a: Store, b: Store) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      newest: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      orders: (a, b) => stats.statsFor(storeId(b)).todayOrders - stats.statsFor(storeId(a)).todayOrders,
      sales: (a, b) => stats.statsFor(storeId(b)).todayRevenue - stats.statsFor(storeId(a)).todayRevenue,
      rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
      items: (a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0),
      attention: (a, b) => attention(a) - attention(b),
    };
    return [...list].sort((a, b) => by[filters.sort](a, b) || a.name.localeCompare(b.name));
  }, [stores, filters, stats]);

  const filtered = filters.search.trim() !== '' || filters.type !== 'ALL' || filters.campus !== 'ALL' || filters.status !== 'all';
  const visibleIds = visible.map(storeId);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const drawerStore = drawer ? stores.find(s => storeId(s) === drawer.id) || null : null;
  const wizardStore = wizard?.id ? stores.find(s => storeId(s) === wizard.id) || null : null;

  // ── actions ──
  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (busy[id]) return;
    setBusy(b => ({ ...b, [id]: true }));
    try { await fn(); } finally { setBusy(b => ({ ...b, [id]: false })); }
  };
  const quickPatch = (store: Store, patch: Record<string, unknown>, text: string, undo?: Record<string, unknown>) =>
    withBusy(storeId(store), async () => {
      try {
        const saved = await patchStore(storeId(store), patch);
        merge(saved);
        toast.success(text, undo ? { label: 'Undo', onClick: () => quickPatch({ ...store, ...saved }, undo, 'Change undone.') } : undefined);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update the store.');
      }
    });

  const toggleActive = (store: Store) => {
    const local = isLocalVendorType(store.vendorType);
    if (store.isActive) {
      setConfirm({
        title: `Hide ${store.name}?`,
        body: <p>It disappears from the customer app and stops taking orders until you publish it again.{store.isFeatured ? ' Its Home banner is removed too.' : ''}</p>,
        action: 'Hide store',
        danger: true,
        run: async () => {
          const saved = await patchStore(storeId(store), { isActive: false });
          merge(saved);
          setConfirm(null);
          const err = await removeStoreBanner(storeId(store));
          if (err) toast.error(`${store.name} is hidden, but its Home banner was not removed: ${err}`);
          else toast.success(`${store.name} is hidden.`, { label: 'Undo', onClick: () => quickPatch({ ...store, ...saved }, { isActive: true }, `${store.name} is live again.`) });
        },
      });
    } else if ((store.itemCount ?? 0) === 0) {
      setConfirm({
        title: `Publish ${store.name} without a menu?`,
        body: <p>Customers will see an empty store{local ? '' : ' and cannot order'}. Add items first for a better first impression.</p>,
        action: 'Publish anyway',
        run: async () => { const saved = await patchStore(storeId(store), { isActive: true }); merge(saved); setConfirm(null); toast.success(`${store.name} is live.`); },
      });
    } else {
      quickPatch(store, { isActive: true }, `${store.name} is live${local ? ' as a display-only stall' : ''}.`, { isActive: false });
    }
  };
  const toggleOpen = (store: Store) => {
    const paused = store.isOpenNow === false;
    quickPatch(store, { isOpenNow: paused }, paused ? `${store.name} is taking orders again.` : `${store.name} is paused. Customers see it as closed.`, { isOpenNow: !paused });
  };
  const toggleFeatured = (store: Store) => withBusy(storeId(store), async () => {
    try {
      if (store.isFeatured) {
        const saved = await patchStore(storeId(store), { isFeatured: false });
        merge(saved);
        const err = await removeStoreBanner(storeId(store));
        if (err) toast.error(`Promotion ended, but the Home banner was not removed: ${err}`);
        else toast.success(`${store.name} is no longer featured.`);
      } else {
        const saved = await patchStore(storeId(store), { isFeatured: true, featuredBadge: store.featuredBadge || 'Featured' });
        merge(saved);
        toast.success(`${store.name} is featured.`, { label: 'Customise', onClick: () => setDrawer({ id: storeId(store), tab: 'promote' }) });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the promotion.');
    }
  });

  const bulkSetActive = (active: boolean) => {
    const targets = stores.filter(s => selected.has(storeId(s)) && s.isActive !== active);
    if (!targets.length) { toast.info(`All selected stores are already ${active ? 'live' : 'hidden'}.`); return; }
    const empty = active ? targets.filter(s => (s.itemCount ?? 0) === 0).length : 0;
    setConfirm({
      title: `${active ? 'Publish' : 'Hide'} ${targets.length} store${targets.length === 1 ? '' : 's'}?`,
      body: (
        <div className="space-y-2">
          <p>{active ? 'They become visible to customers right away.' : 'They disappear from the customer app and stop taking orders. Their Home banners are removed.'}</p>
          {empty > 0 && <Callout tone="amber">{empty} of them have no menu items yet.</Callout>}
          <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-gray-400">{targets.map(s => <li key={storeId(s)}>{s.name}</li>)}</ul>
        </div>
      ),
      action: active ? 'Publish all' : 'Hide all',
      danger: !active,
      run: async () => {
        let ok = 0;
        for (let i = 0; i < targets.length; i += 4) {
          await Promise.all(targets.slice(i, i + 4).map(async s => {
            try {
              await patchStore(storeId(s), { isActive: active });
              if (!active) await removeStoreBanner(storeId(s));
              ok++;
            } catch { /* counted */ }
          }));
        }
        setConfirm(null);
        setSelected(new Set());
        await loadStores(true);
        if (ok === targets.length) toast.success(`${ok} store${ok === 1 ? '' : 's'} ${active ? 'published' : 'hidden'}.`);
        else toast.error(`${ok} of ${targets.length} updated. Try the rest again.`);
      },
    });
  };

  const deleteStore = async (store: Store) => {
    const id = storeId(store);
    await adminRequest(`/api/admin/restaurants/${id}`, { method: 'DELETE' });
    setStores(prev => prev.filter(s => storeId(s) !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (drawer?.id === id) setDrawer(null);
    setDeleting(null);
    const err = await removeStoreBanner(id);
    if (err) toast.error(`${store.name} deleted, but its Home banner was not removed: ${err}`);
    else toast.success(`${store.name} deleted.`);
  };

  const openWizard = (mode: 'create' | 'edit', id?: string, step?: StepKey) => setWizard({ mode, id, step });

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  const kpis: { key: StatusFilter; label: string; value: number; tone: string; help: string }[] = [
    { key: 'all', label: 'All stores', value: stores.length, tone: 'text-white', help: 'Every store, stall and service partner.' },
    { key: 'live', label: 'Live now', value: statusCounts.live, tone: 'text-emerald-300', help: STATUS_META.live.help },
    { key: 'closed', label: 'Closed now', value: statusCounts.closed, tone: 'text-amber-300', help: STATUS_META.closed.help },
    { key: 'draft', label: 'Drafts', value: statusCounts.draft, tone: 'text-gray-300', help: STATUS_META.draft.help },
    { key: 'inactive', label: 'Inactive', value: statusCounts.inactive, tone: 'text-red-300', help: STATUS_META.inactive.help },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 text-white sm:p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Partners</p>
          <h1 className="mt-1 text-2xl font-black">Stores &amp; menus</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Onboard restaurants, shops and campus stalls, manage their menus, hours and partner logins, and switch them on or off. Changes reach the customer app live.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { loadStores(); stats.reload(); }} disabled={loading} aria-label="Refresh stores">{loading ? 'Loading…' : '↻ Refresh'}</Button>
          <Button variant="primary" onClick={() => openWizard('create')}>
            + Add store{hasDraft && <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold">draft saved</span>}
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {kpis.map(k => (
          <button
            key={k.key}
            type="button"
            title={k.help}
            aria-pressed={filters.status === k.key}
            onClick={() => setF({ status: k.key })}
            className={cx('rounded-xl border p-3 text-left transition-colors', filters.status === k.key ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.02] hover:border-white/20', FOCUS_RING)}
          >
            <p className="text-[11px] text-gray-500">{k.label}</p>
            <p className={cx('mt-0.5 text-2xl font-black', k.tone)}>{loading ? <Skeleton className="mt-1 h-6 w-10" /> : k.value}</p>
          </button>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3" title="Non-cancelled orders placed today (IST)">
          <p className="text-[11px] text-gray-500">Orders today</p>
          <p className="mt-0.5 text-2xl font-black">{stats.loading ? <Skeleton className="mt-1 h-6 w-10" /> : stats.totals.todayOrders}{!stats.coverage.todayComplete && <span className="text-sm text-gray-500">+</span>}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3" title="Item subtotal of today's non-cancelled orders">
          <p className="text-[11px] text-gray-500">Sales today</p>
          <p className="mt-0.5 text-2xl font-black text-emerald-300">{stats.loading ? <Skeleton className="mt-1 h-6 w-16" /> : formatINR(stats.totals.todayRevenue)}</p>
        </div>
      </section>
      {stats.error && <Callout tone="amber">Order numbers are unavailable right now: {stats.error}</Callout>}

      {/* Toolbar */}
      <section aria-label="Find stores" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="relative min-w-[220px] flex-1">
          <input ref={searchRef} value={filters.search} onChange={e => setF({ search: e.target.value })} placeholder="Search name, area, campus or cuisine" aria-label="Search stores" className={cx(INPUT, 'py-2 pr-10')} />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/15 px-1.5 text-[10px] text-gray-500">/</kbd>
        </div>
        <select value={filters.type} onChange={e => setF({ type: e.target.value })} aria-label="Store type" className={cx(INPUT, 'w-auto py-2')}>
          <option value="ALL">All types</option>
          {typeOptions.map(([t, n]) => <option key={t} value={t}>{vendorLabel(t)} ({n})</option>)}
        </select>
        <select value={filters.campus} onChange={e => setF({ campus: e.target.value })} aria-label="Campus" className={cx(INPUT, 'w-auto py-2')}>
          <option value="ALL">All campuses</option>
          {campusOptions.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
        <select value={filters.sort} onChange={e => setF({ sort: e.target.value as SortKey })} aria-label="Sort by" className={cx(INPUT, 'w-auto py-2')}>
          {SORTS.map(s => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>
        {filtered && <Button size="sm" variant="ghost" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>Clear filters</Button>}
      </section>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#0f1f19]/95 px-4 py-2.5 text-sm shadow-xl backdrop-blur" role="region" aria-label="Bulk actions">
          <span className="font-semibold text-emerald-100">{selected.size} selected</span>
          <Button size="sm" onClick={() => bulkSetActive(true)}>Publish</Button>
          <Button size="sm" variant="danger" onClick={() => bulkSetActive(false)}>Hide</Button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold text-gray-400 hover:text-white">Clear selection</button>
        </div>
      )}

      {loadError && (
        <Callout tone="red"><span className="flex items-center justify-between gap-3">{loadError}<button type="button" onClick={() => loadStores()} className="font-bold underline">Retry</button></span></Callout>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2" role="status" aria-label="Loading stores">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-white/5 p-4">
              <Skeleton className="h-12 w-12" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
              <Skeleton className="hidden h-8 w-48 md:block" />
            </div>
          ))}
        </div>
      ) : !loadError && stores.length === 0 ? (
        <EmptyState
          icon="🏪"
          title="No partners yet"
          body="Add your first restaurant, shop or campus stall. The guided setup takes about 3 minutes; you can save a draft and finish later."
          action={<Button variant="primary" onClick={() => openWizard('create')}>+ Add your first store</Button>}
        />
      ) : !loadError && visible.length === 0 ? (
        <EmptyState title="No stores match" body="Try another type, campus, status or search." action={<Button onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>Clear filters</Button>} />
      ) : (
        <section aria-label="Stores" className="overflow-hidden rounded-xl border border-white/10">
          <div className="hidden items-center gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 lg:flex">
            <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={allSelected} onChange={e => setSelected(e.target.checked ? new Set(visibleIds) : new Set())} aria-label="Select all shown stores" />
            <span className="flex-1">{visible.length} store{visible.length === 1 ? '' : 's'}{filtered ? ` of ${stores.length}` : ''}</span>
            <span className="w-[260px] text-center">Today · Rating · Menu</span>
            <span className="w-[230px] text-center">Live · Open · Featured</span>
            <span className="w-[120px]" />
          </div>
          <ul className="divide-y divide-white/5">
            {visible.map(store => {
              const id = storeId(store);
              const status = storeStatus(store);
              const local = isLocalVendorType(store.vendorType);
              const st = stats.statsFor(id);
              const rating = Number(store.rating) || 0;
              const isBusy = !!busy[id];
              return (
                <li key={id} className={cx('group flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-white/[0.02]', selected.has(id) && 'bg-emerald-500/[0.04]', isFresh(id) && FRESH_ROW_CLASS)}>
                  <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={selected.has(id)} onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} aria-label={`Select ${store.name}`} />
                  <button type="button" onClick={() => setDrawer({ id, tab: 'overview' })} className={cx('flex min-w-[220px] flex-1 items-center gap-3 rounded-lg text-left', FOCUS_RING)}>
                    <Thumb src={store.imageUrl} alt={store.name} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-bold group-hover:text-emerald-200">{store.name}</span>
                        <Chip tone={STATUS_TONE[status]} dot title={status === 'closed' && store.closedReason ? store.closedReason : STATUS_META[status].help}>{status === 'closed' && store.isOpenNow === false ? 'Paused' : STATUS_META[status].label}</Chip>
                        {store.isFeatured && <Chip tone="amber">✨ {store.featuredBadge || 'Featured'}</Chip>}
                        {store.isOffline && <Chip title="No partner app; Zenvy handles orders">Managed</Chip>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">
                        {vendorLabel(store.vendorType)} · {[store.location, store.campus].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-500">{summarizeWeekly(weeklyFromStore(store.operatingHours))}{!local && store.deliveryTime ? ` · ${store.deliveryTime} min` : ''}</span>
                    </span>
                  </button>

                  <dl className="grid w-full grid-cols-4 gap-2 text-center sm:w-[260px]">
                    <div title={local ? 'Local stalls take orders directly' : 'Non-cancelled orders today (IST)'}><dt className="text-[10px] text-gray-500">Orders</dt><dd className="text-sm font-bold">{local ? '—' : stats.loading ? '…' : st.todayOrders}</dd></div>
                    <div title="Item subtotal today"><dt className="text-[10px] text-gray-500">Sales</dt><dd className="text-sm font-bold text-emerald-300">{local ? '—' : stats.loading ? '…' : formatINR(st.todayRevenue)}</dd></div>
                    <div><dt className="text-[10px] text-gray-500">Rating</dt><dd className="text-sm font-bold">{rating > 0 ? `${rating.toFixed(1)}★` : <span className="text-gray-500">New</span>}</dd></div>
                    <div><dt className="text-[10px] text-gray-500">Menu</dt><dd className={cx('text-sm font-bold', (store.itemCount ?? 0) === 0 && 'text-amber-300')}>{store.itemCount ?? 0}</dd></div>
                  </dl>

                  <div className="flex w-full items-center justify-around gap-3 sm:w-[230px]" onClick={e => e.stopPropagation()}>
                    <Toggle size="sm" srOnlyLabel label={`${store.name} visible to customers`} checked={store.isActive} disabled={isBusy} onChange={() => toggleActive(store)} />
                    {local ? <span className="w-9 text-center text-[10px] text-gray-600">—</span> : <Toggle size="sm" srOnlyLabel label={`${store.name} taking orders`} checked={store.isOpenNow !== false} disabled={isBusy || !store.isActive} onChange={() => toggleOpen(store)} />}
                    {local ? <span className="w-9 text-center text-[10px] text-gray-600">—</span> : <Toggle size="sm" tone="amber" srOnlyLabel label={`${store.name} featured`} checked={!!store.isFeatured} disabled={isBusy} onChange={() => toggleFeatured(store)} />}
                  </div>

                  <div className="flex w-full items-center justify-end gap-2 sm:w-[120px]">
                    <Button size="sm" onClick={() => setDrawer({ id, tab: 'overview' })}>Manage</Button>
                    <MenuButton ariaLabel={`More actions for ${store.name}`} label="•••" items={[
                      { label: 'Edit details', onSelect: () => openWizard('edit', id) },
                      { label: 'Menu', onSelect: () => setDrawer({ id, tab: 'menu' }) },
                      { label: 'Hours', onSelect: () => setDrawer({ id, tab: 'hours' }) },
                      ...(local ? [] : [{ label: 'Partner login', onSelect: () => setDrawer({ id, tab: 'login' as DrawerTab }) }, { label: 'Promote', onSelect: () => setDrawer({ id, tab: 'promote' as DrawerTab }) }]),
                      'divider',
                      { label: 'Duplicate store', onSelect: () => setDuplicating(store) },
                      { label: 'Delete…', onSelect: () => setDeleting(store), danger: true },
                    ]} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-white/5 px-4 py-2 text-[11px] text-gray-500">
            Toggles: <b>Live</b> = visible to customers · <b>Open</b> = taking orders (off pauses the store) · <b>Featured</b> = promoted on Home.
            {!stats.coverage.todayComplete && ` Today's numbers come from the latest ${stats.coverage.scanned} orders.`}
          </p>
        </section>
      )}

      {wizard && (wizard.mode === 'create' || wizardStore) && (
        <StoreWizard
          mode={wizard.mode}
          initial={wizard.mode === 'edit' ? wizardStore : null}
          startStep={wizard.step}
          stores={stores}
          onClose={() => { setWizard(null); try { setHasDraft(!!localStorage.getItem(DRAFT_KEY)); } catch { /* ignore */ } }}
          onSaved={({ store }) => {
            merge(store);
            markFresh([storeId(store)]);
            // Create shows its own success screen (with the one-time password).
            if (wizard.mode === 'edit') toast.success(`${store.name} saved.`);
            setHasDraft(false);
          }}
          onOpenStore={(id, tab) => { setWizard(null); setDrawer({ id, tab: (tab as DrawerTab) || 'overview' }); }}
        />
      )}

      {drawer && !drawerStore && !loading && (
        <Modal title="Store not found" size="sm" onClose={() => setDrawer(null)} footer={<Button onClick={() => setDrawer(null)}>Close</Button>}>
          <p className="text-sm text-gray-400">This store may have been deleted, or the list is still refreshing.</p>
        </Modal>
      )}
      {drawer && drawerStore && !wizard && (
        <StoreDrawer
          store={drawerStore}
          tab={drawer.tab}
          onTab={tab => setDrawer({ id: drawer.id, tab })}
          onClose={() => setDrawer(null)}
          onEdit={step => openWizard('edit', drawer.id, step)}
          onChanged={merge}
          onToggleActive={() => toggleActive(drawerStore)}
          onToggleOpen={() => toggleOpen(drawerStore)}
          onDuplicate={() => setDuplicating(drawerStore)}
          onDelete={() => setDeleting(drawerStore)}
          stats={stats.statsFor(drawer.id)}
          orders={stats.ordersFor(drawer.id)}
          coverage={stats.coverage}
          busy={!!busy[drawer.id]}
        />
      )}

      {deleting && (
        <TypedConfirmModal
          title={`Delete ${deleting.name}?`}
          confirmText={deleting.name}
          actionLabel="Delete permanently"
          onClose={() => setDeleting(null)}
          onConfirm={() => deleteStore(deleting)}
          body={
            <div className="space-y-2">
              <p>This permanently removes the store, its <b>{deleting.itemCount ?? 0} menu items</b> and its partner login. Past orders keep their history. It cannot be undone.</p>
              <p className="text-gray-400">Stores with orders still in progress cannot be deleted. To take it off the app for now, <button type="button" className="font-semibold text-emerald-300 underline" onClick={() => { const s = deleting; setDeleting(null); if (s.isActive) toggleActive(s); }}>hide it instead</button>.</p>
            </div>
          }
        />
      )}
      {duplicating && (
        <DuplicateModal
          store={duplicating}
          existingNames={stores.map(s => s.name.toLowerCase())}
          onClose={() => setDuplicating(null)}
          onDone={copy => { setDuplicating(null); merge(copy); markFresh([storeId(copy)]); setDrawer({ id: storeId(copy), tab: 'overview' }); }}
        />
      )}
      {confirm && (
        <ConfirmModal title={confirm.title} body={confirm.body} actionLabel={confirm.action} tone={confirm.danger ? 'danger' : 'primary'} onClose={() => setConfirm(null)} onConfirm={confirm.run} />
      )}
    </div>
  );
}

// ─── Duplicate store ─────────────────────────────────────────────────────────
function DuplicateModal({ store, existingNames, onClose, onDone }: { store: Store; existingNames: string[]; onClose: () => void; onDone: (copy: Store) => void }) {
  const toast = useToast();
  const [name, setName] = useState(`${store.name} (copy)`);
  const [copyMenu, setCopyMenu] = useState((store.itemCount ?? 0) > 0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const taken = existingNames.includes(name.trim().toLowerCase());

  const run = async () => {
    if (!name.trim() || running) return;
    setRunning(true);
    setError('');
    try {
      const copy = await adminRequest<Store>('/api/admin/restaurants', { method: 'POST', body: JSON.stringify(duplicatePayload(store, name.trim())) });
      let failed = 0;
      if (copyMenu) {
        const items = await adminRequest<Product[]>(`/api/admin/menu-items?restaurantId=${encodeURIComponent(storeId(store))}`);
        const list = Array.isArray(items) ? items : [];
        setProgress({ done: 0, total: list.length });
        let done = 0;
        for (let i = 0; i < list.length; i += 3) {
          await Promise.all(list.slice(i, i + 3).map(async p => {
            try { await adminRequest('/api/admin/menu-items/new', { method: 'POST', body: JSON.stringify(duplicateItemPayload(p, storeId(copy))) }); }
            catch { failed++; }
            done++;
            setProgress({ done, total: list.length });
          }));
        }
      }
      if (failed) toast.error(`${copy.name} created as a draft, but ${failed} menu item(s) could not be copied.`);
      else toast.success(`${copy.name} created as a draft. Set a partner password before publishing.`);
      onDone(copy);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not duplicate the store.');
      setRunning(false);
    }
  };

  return (
    <Modal title={`Duplicate ${store.name}`} description="Creates a hidden draft with the same details. Good for a second branch or a similar stall." size="md" onClose={running ? () => undefined : onClose} footer={<>
      <Button onClick={onClose} disabled={running}>Cancel</Button>
      <Button variant="primary" loading={running} disabled={!name.trim() || taken} onClick={run}>{progress ? `Copying menu ${progress.done}/${progress.total}…` : 'Duplicate'}</Button>
    </>}>
      <div className="space-y-4">
        <Field label="New store name" required help={taken ? undefined : 'Must be different, since partners can sign in with the store name.'} error={taken ? 'A store already has this name.' : null}>
          {({ id, msgId, invalid }) => <input id={id} data-autofocus aria-describedby={msgId} aria-invalid={invalid} className={INPUT} value={name} maxLength={120} onChange={e => setName(e.target.value)} />}
        </Field>
        <Toggle checked={copyMenu} onChange={setCopyMenu} disabled={(store.itemCount ?? 0) === 0} label={`Copy the menu (${store.itemCount ?? 0} items)`} description="Prices, photos, categories and stock are copied." />
        <p className="text-xs text-gray-500">Not copied: partner password, rating, promotion, orders and payouts.</p>
        {error && <Callout tone="red">{error}</Callout>}
      </div>
    </Modal>
  );
}

