"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useAdminSocket } from '@/components/AdminSocketProvider';
import { useLiveSync, useFreshIds, FRESH_ROW_CLASS, LiveEvent } from '@/lib/useLiveSync';
import {
  Product, Store, adminRequest, formatTime, formatWhatsapp, readSpecs, storeId, vendorLabel,
} from './catalogue';
import { StoreForm, StorePayload, FIELD } from './StoreForm';
import { ProductForm, ProductPayload } from './ProductForm';
import { PromoteModal, PromotionInput } from './PromoteModal';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((kind: 'ok' | 'error', text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ kind, text });
    timer.current = setTimeout(() => setNotice(null), kind === 'ok' ? 3500 : 8000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { notice, show, clear: () => setNotice(null) };
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  return (
    <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${notice.kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
      <span>{notice.text}</span>
      <button type="button" onClick={onClose} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
    </div>
  );
}

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-slate-900 object-cover" />
  ) : (
    <div aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-sm font-bold text-gray-600">{alt.slice(0, 1).toUpperCase()}</div>
  );
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export default function StoresPage() {
  const { isAuthed } = useAdminAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [formStore, setFormStore] = useState<Store | 'new' | null>(null);
  const [promoting, setPromoting] = useState<Store | null>(null);
  const [selected, setSelected] = useState<Store | null>(null);
  const { notice, show, clear } = useNotice();

  const loadStores = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const data = await adminRequest<Store[]>('/api/admin/restaurants');
      const list = Array.isArray(data) ? data : [];
      setStores(list);
      setLoadError('');
      // Keep the open products view showing the latest store row (name, active flag, image…).
      setSelected(prev => (prev ? list.find(s => storeId(s) === storeId(prev)) || prev : prev));
    } catch (e) {
      // A background (live) refresh keeps the last good list.
      if (!quiet) setLoadError(e instanceof Error ? e.message : 'Could not load stores.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) loadStores();
  }, [isAuthed, loadStores]);

  // Realtime sync: stores / products changed in another admin tab, the restaurant partner app or the
  // auto-restock job. Product events also change the per-store product count, so both refetch the list.
  const { notifyLive } = useAdminSocket();
  const { mark: markFresh, isFresh } = useFreshIds();
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected ? storeId(selected) : null;
  const formStoreIdRef = useRef<string | null>(null);
  formStoreIdRef.current = formStore && formStore !== 'new' ? storeId(formStore) : null;

  useLiveSync(['store', 'product'], (events, { reconnect }) => {
    loadStores(true);
    if (reconnect) return;
    const storeEvents = events.filter(e => e.type === 'store');
    markFresh(storeEvents.filter(e => e.action !== 'deleted').map(e => e.id));
    const removed = storeEvents.filter(e => e.action === 'deleted').map(e => String(e.id));
    const openId = selectedIdRef.current;
    if (openId && removed.includes(openId)) {
      setSelected(null);
      show('error', 'The store you were viewing was deleted in another session.');
    }
    const editingId = formStoreIdRef.current;
    if (editingId && storeEvents.some(e => String(e.id) === editingId && e.action === 'updated' && e.scope !== 'status')) {
      show('error', 'This store was just changed somewhere else. Saving now overwrites those changes; close and reopen the form to see them.');
    }
    const created = storeEvents.filter(e => e.action === 'created').length;
    if (created) notifyLive(created > 1 ? `${created} new stores` : 'New store added');
  }, { enabled: isAuthed });

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stores) {
      const t = (s.vendorType || 'RESTAURANT').toUpperCase();
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [stores]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter(s => {
      const type = (s.vendorType || 'RESTAURANT').toUpperCase();
      if (typeFilter !== 'ALL' && type !== typeFilter) return false;
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      return !q || [s.name, s.location, s.campus, type].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [stores, typeFilter, statusFilter, search]);

  const updateStore = async (store: Store, patch: Record<string, unknown>, successText: string) => {
    const id = storeId(store);
    if (busy[id]) return;
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const saved = await adminRequest<Store>(`/api/admin/restaurants/${id}`, { method: 'POST', body: JSON.stringify(patch) });
      setStores(prev => prev.map(s => (storeId(s) === id ? { ...s, ...saved } : s)));
      setSelected(prev => (prev && storeId(prev) === id ? { ...prev, ...saved } : prev));
      show('ok', successText);
      loadStores(true); // refresh the computed open/closed state
    } catch (e) {
      show('error', e instanceof Error ? e.message : 'Could not update the store.');
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleActive = (store: Store) => {
    if (store.isActive && !window.confirm(`Deactivate "${store.name}"?\n\nIt disappears from the customer app and stops taking orders until you activate it again.`)) return;
    if (!store.isActive && !window.confirm(`Activate "${store.name}"?\n\nIt becomes visible in the customer app${(store.vendorType || '').toUpperCase() === 'LOCAL_VENDOR' ? ' as a display-only listing' : ' and can take orders during its operating hours'}.`)) return;
    updateStore(store, { isActive: !store.isActive }, store.isActive ? `${store.name} deactivated.` : `${store.name} activated.`);
  };

  const togglePaused = (store: Store) => {
    const paused = store.isOpenNow === false;
    if (!paused && !window.confirm(`Pause "${store.name}"? Customers see it as closed until you resume it.`)) return;
    updateStore(store, { isOpenNow: paused }, paused ? `${store.name} resumed.` : `${store.name} paused.`);
  };

  const saveStore = async (payload: StorePayload) => {
    const editing = formStore && formStore !== 'new' ? formStore : null;
    const path = editing ? `/api/admin/restaurants/${storeId(editing)}` : '/api/admin/restaurants';
    // New stores start inactive so the catalogue can be filled before customers see them.
    const body = editing ? payload : { ...payload, isActive: false };
    await adminRequest<Store>(path, { method: 'POST', body: JSON.stringify(body) });
    setFormStore(null);
    show('ok', editing ? `${payload.name} saved.` : `${payload.name} created as inactive. Add products, then activate it.`);
    await loadStores(true);
  };

  const deleteStore = async (store: Store) => {
    const id = storeId(store);
    const typed = window.prompt(`Delete "${store.name}" and all ${store.itemCount ?? 'its'} products permanently?\n\nPast orders keep their history, but this cannot be undone. Consider deactivating instead.\n\nType the store name to confirm:`);
    if (typed === null) return;
    if (typed.trim() !== store.name.trim()) {
      show('error', 'The name did not match, so nothing was deleted.');
      return;
    }
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      await adminRequest(`/api/admin/restaurants/${id}`, { method: 'DELETE' });
      setStores(prev => prev.filter(s => storeId(s) !== id));
      show('ok', `${store.name} deleted.`);
    } catch (e) {
      show('error', e instanceof Error ? e.message : 'Could not delete the store.');
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  };

  const savePromotion = async (store: Store, input: PromotionInput) => {
    const id = storeId(store);
    if (input.addToCarousel && !store.imageUrl) throw new Error('Add a store image before adding a Home banner.');
    const saved = await adminRequest<Store>(`/api/admin/restaurants/${id}`, {
      method: 'POST',
      body: JSON.stringify({ isFeatured: input.isFeatured, featuredBadge: input.featuredBadge || null, promoOffer: input.promoOffer || null }),
    });
    setStores(prev => prev.map(s => (storeId(s) === id ? { ...s, ...saved } : s)));

    if (input.addToCarousel) {
      try {
        const cfg = await adminRequest<{ config?: { banners?: Record<string, unknown>[] } }>('/api/config');
        const banners = Array.isArray(cfg?.config?.banners) ? cfg.config!.banners! : [];
        const redirectUrl = `/restaurant/${id}`;
        const banner = {
          imageUrl: store.imageUrl,
          tagline: input.featuredBadge || 'Featured',
          title1: store.name.toUpperCase(),
          title2: input.promoOffer || vendorLabel(store.vendorType),
          description: `Order from ${store.name} on Zenvy.`,
          buttonText: 'ORDER NOW',
          redirectUrl,
          isActive: true,
        };
        const index = banners.findIndex(b => b.redirectUrl === redirectUrl);
        const next = index >= 0 ? banners.map((b, i) => (i === index ? { ...b, ...banner } : b)) : [banner, ...banners];
        await adminRequest('/api/config', { method: 'PUT', body: JSON.stringify({ banners: next }) });
      } catch (e) {
        setPromoting(null);
        show('error', `Promotion saved, but the Home banner was not updated: ${e instanceof Error ? e.message : 'unknown error'}`);
        return;
      }
    }
    setPromoting(null);
    show('ok', input.isFeatured ? `${store.name} is promoted.` : `Promotion for ${store.name} ended.`);
  };

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  if (selected) {
    return (
      <ProductsPanel
        store={selected}
        onBack={() => { setSelected(null); loadStores(true); }}
        onToggleActive={() => toggleActive(selected)}
        storeBusy={!!busy[storeId(selected)]}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Catalogue</p>
          <h1 className="mt-1 text-2xl font-black">Stores &amp; products</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Restaurants, campus stores and CampusBites stalls. Set hours, delivery time and contact details, switch stores on or off, and manage their products.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={loading} onClick={() => loadStores()} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
          <button type="button" onClick={() => setFormStore('new')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Add store</button>
        </div>
      </header>

      <NoticeBar notice={notice} onClose={clear} />

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4" aria-label="Store filters">
        <div className="flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, location or campus" className={`${FIELD} min-w-[220px] flex-1`} aria-label="Search stores" />
          <div className="flex overflow-hidden rounded-lg border border-white/10" role="group" aria-label="Status">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)} aria-pressed={statusFilter === f.value} className={`px-4 py-2 text-sm font-semibold ${statusFilter === f.value ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Store type">
          <button type="button" onClick={() => setTypeFilter('ALL')} aria-pressed={typeFilter === 'ALL'} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${typeFilter === 'ALL' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-gray-400 hover:text-white'}`}>All types · {stores.length}</button>
          {typeCounts.map(([type, count]) => (
            <button key={type} type="button" onClick={() => setTypeFilter(type)} aria-pressed={typeFilter === type} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${typeFilter === type ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-gray-400 hover:text-white'}`}>{vendorLabel(type)} · {count}</button>
          ))}
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {loadError}
          <button type="button" onClick={() => loadStores()} className="font-bold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div role="status" className="rounded-lg border border-white/10 p-8 text-sm text-gray-400">Loading stores…</div>
      ) : !loadError && visible.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-10 text-center">
          <h2 className="font-bold">{stores.length === 0 ? 'No stores yet' : 'No stores match these filters'}</h2>
          <p className="mt-2 text-sm text-gray-400">{stores.length === 0 ? 'Add the first store to start building the catalogue.' : 'Try another type, status or search.'}</p>
          {stores.length > 0 && <button type="button" onClick={() => { setSearch(''); setTypeFilter('ALL'); setStatusFilter('all'); }} className="mt-4 text-sm font-semibold text-emerald-300 hover:underline">Clear filters</button>}
        </div>
      ) : (
        <section className="divide-y divide-white/10 rounded-xl border border-white/10" aria-label="Stores">
          {visible.map(store => {
            const id = storeId(store);
            const isLocal = (store.vendorType || '').toUpperCase() === 'LOCAL_VENDOR';
            const hours = store.operatingHours?.start && store.operatingHours?.end ? `${formatTime(store.operatingHours.start)} – ${formatTime(store.operatingHours.end)}` : 'No hours set';
            return (
              <article key={id} className={`flex flex-wrap items-center gap-4 p-4 ${store.isActive ? '' : 'bg-white/[0.015]'} ${isFresh(id) ? FRESH_ROW_CLASS : ''}`}>
                <Thumb src={store.imageUrl} alt={store.name} />
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{store.name}</h2>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-gray-300">{vendorLabel(store.vendorType)}</span>
                    {!store.isActive ? (
                      <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-red-300">Inactive</span>
                    ) : store.isOpen === false ? (
                      <span title={store.closedReason || ''} className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">{store.isOpenNow === false ? 'Paused' : 'Closed now'}</span>
                    ) : (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">Open</span>
                    )}
                    {store.isFeatured && <span className="rounded border border-amber-400/30 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">{store.featuredBadge || 'Featured'}</span>}
                    {store.isOffline && <span className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-gray-400">Offline store</span>}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {[store.location, store.campus].filter(Boolean).join(' · ')} · {hours} · {store.deliveryTime ? `${store.deliveryTime} min delivery` : 'No delivery time'} · {store.itemCount ?? 0} products
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    WhatsApp: {store.whatsappNumber ? formatWhatsapp(store.whatsappNumber) : <span className={isLocal ? 'text-amber-300' : ''}>not set{isLocal ? ' (needed for local vendors)' : ''}</span>}
                    {' · '}Commission: {store.commissionRate ?? 0}{store.commissionType === 'flat' ? ' ₹/order' : '%'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={!!busy[id]} onClick={() => toggleActive(store)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${store.isActive ? 'border-white/10 text-gray-300 hover:border-red-500/40 hover:text-red-300' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'}`}>{store.isActive ? 'Deactivate' : 'Activate'}</button>
                  {store.isActive && !isLocal && (
                    <button type="button" disabled={!!busy[id]} onClick={() => togglePaused(store)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50">{store.isOpenNow === false ? 'Resume' : 'Pause'}</button>
                  )}
                  <button type="button" onClick={() => setFormStore(store)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white">Edit</button>
                  {!isLocal && <button type="button" onClick={() => setPromoting(store)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-amber-300">Promote</button>}
                  <button type="button" onClick={() => setSelected(store)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15">Products</button>
                  <button type="button" disabled={!!busy[id]} onClick={() => deleteStore(store)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-400/70 hover:text-red-300 disabled:opacity-50" aria-label={`Delete ${store.name}`}>Delete</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {formStore && (
        <StoreForm initial={formStore === 'new' ? null : formStore} onCancel={() => setFormStore(null)} onSave={saveStore} />
      )}
      {promoting && (
        <PromoteModal store={promoting} onClose={() => setPromoting(null)} onSave={input => savePromotion(promoting, input)} />
      )}
    </div>
  );
}

// ─── Products of one store ───────────────────────────────────

function ProductsPanel({ store, onBack, onToggleActive, storeBusy }: {
  store: Store;
  onBack: () => void;
  onToggleActive: () => void;
  storeBusy: boolean;
}) {
  const id = storeId(store);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [stock, setStock] = useState<'all' | 'in' | 'out'>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const { notice, show, clear } = useNotice();
  const isLocal = (store.vendorType || '').toUpperCase() === 'LOCAL_VENDOR';

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const data = await adminRequest<Product[]>(`/api/admin/menu-items?restaurantId=${encodeURIComponent(id)}`);
      setProducts(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch (e) {
      if (!quiet) setLoadError(e instanceof Error ? e.message : 'Could not load products.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime sync: products of THIS store changed elsewhere (another admin tab, partner app, auto-restock).
  const { mark: markFresh, isFresh } = useFreshIds();
  const editingIdRef = useRef<string | null>(null);
  editingIdRef.current = editing && editing !== 'new' ? editing._id : null;
  const forThisStore = (e: LiveEvent) =>
    e.type === 'product' && (e.storeId !== undefined ? String(e.storeId) === id : e.id === null);

  useLiveSync(['product', 'store'], (events, { reconnect }) => {
    const mine = events.filter(forThisStore);
    const storeWide = events.some(e => e.type === 'store' && (e.id === null || String(e.id) === id));
    if (!reconnect && !mine.length && !storeWide) return;
    load(true);
    if (reconnect) return;
    markFresh(mine.filter(e => e.action !== 'deleted').map(e => e.id));
    const editingId = editingIdRef.current;
    if (editingId && mine.some(e => String(e.id) === editingId && e.scope !== 'stock')) {
      show('error', mine.some(e => String(e.id) === editingId && e.action === 'deleted')
        ? 'This product was deleted somewhere else. Saving will fail; close the form.'
        : 'This product was just changed somewhere else. Saving now overwrites those changes.');
    }
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter((c): c is string => !!c))).sort(),
    [products]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'All' && (p.category || '') !== category) return false;
      if (stock === 'in' && !p.isAvailable) return false;
      if (stock === 'out' && p.isAvailable) return false;
      return !q || [p.name, p.category, p.description].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [products, search, category, stock]);

  const outOfStock = products.filter(p => !p.isAvailable).length;

  const toggleAvailability = async (product: Product) => {
    if (busy[product._id]) return;
    setBusy(prev => ({ ...prev, [product._id]: true }));
    try {
      const saved = await adminRequest<Product>(`/api/admin/menu-items/${product._id}`, { method: 'POST', body: JSON.stringify({ isAvailable: !product.isAvailable }) });
      setProducts(prev => prev.map(p => (p._id === product._id ? { ...p, ...saved } : p)));
    } catch (e) {
      show('error', e instanceof Error ? e.message : 'Could not update the product.');
    } finally {
      setBusy(prev => ({ ...prev, [product._id]: false }));
    }
  };

  const saveProduct = async (payload: ProductPayload) => {
    const existing = editing && editing !== 'new' ? editing : null;
    const saved = await adminRequest<Product>(`/api/admin/menu-items/${existing ? existing._id : 'new'}`, {
      method: 'POST',
      body: JSON.stringify(existing ? payload : { ...payload, restaurantId: id }),
    });
    setProducts(prev => (existing ? prev.map(p => (p._id === existing._id ? { ...p, ...saved } : p)) : [...prev, saved]));
    setEditing(null);
    show('ok', existing ? `${payload.name} saved.` : `${payload.name} added.`);
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}" permanently?\n\nTo hide it for now, mark it out of stock instead.`)) return;
    setBusy(prev => ({ ...prev, [product._id]: true }));
    try {
      await adminRequest(`/api/admin/menu-items/${product._id}/delete`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p._id !== product._id));
      show('ok', `${product.name} deleted.`);
    } catch (e) {
      show('error', e instanceof Error ? e.message : 'Could not delete the product.');
      setBusy(prev => ({ ...prev, [product._id]: false }));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-4">
          <Thumb src={store.imageUrl} alt={store.name} />
          <div>
            <button type="button" onClick={onBack} className="text-xs font-semibold text-gray-400 hover:text-white">← All stores</button>
            <h1 className="mt-1 text-2xl font-black">{store.name}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {vendorLabel(store.vendorType)} · {products.length} products{outOfStock ? ` · ${outOfStock} out of stock` : ''} · {store.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" disabled={storeBusy} onClick={onToggleActive} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-50">{store.isActive ? 'Deactivate store' : 'Activate store'}</button>
          <button type="button" onClick={() => setEditing('new')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Add product</button>
        </div>
      </header>

      {isLocal && (
        <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">Display-only stall: these prices are shown to customers, who order directly from the vendor on WhatsApp or by phone.</p>
      )}

      <NoticeBar notice={notice} onClose={clear} />

      <section className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4" aria-label="Product filters">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products" className={`${FIELD} min-w-[200px] flex-1`} aria-label="Search products" />
        <select value={category} onChange={e => setCategory(e.target.value)} className={`${FIELD} w-auto`} aria-label="Category">
          <option value="All">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stock} onChange={e => setStock(e.target.value as 'all' | 'in' | 'out')} className={`${FIELD} w-auto`} aria-label="Stock">
          <option value="all">Any stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
      </section>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {loadError}
          <button type="button" onClick={() => load()} className="font-bold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div role="status" className="rounded-lg border border-white/10 p-8 text-sm text-gray-400">Loading products…</div>
      ) : !loadError && visible.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-10 text-center">
          <h2 className="font-bold">{products.length === 0 ? 'No products yet' : 'No products match these filters'}</h2>
          <p className="mt-2 text-sm text-gray-400">{products.length === 0 ? 'Add the first product for this store.' : 'Try another search, category or stock filter.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">MRP</th>
                <th className="p-3">Stock</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map(p => {
                const specs = readSpecs(p.specs);
                const mrp = Number(specs.originalPrice);
                return (
                  <tr key={p._id} className={`${p.isAvailable ? '' : 'text-gray-500'} ${isFresh(p._id) ? FRESH_ROW_CLASS : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Thumb src={p.imageUrl || p.image} alt={p.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {[typeof specs.weight === 'string' ? specs.weight : null, p.isVegetarian ? 'Veg' : 'Non-veg', p.isEliteOnly ? 'Elite only' : null, specs.bookingOnly ? 'Booking only' : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300">{p.category || '—'}</td>
                    <td className="p-3 text-right font-semibold text-white">₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-gray-400">{Number.isFinite(mrp) && mrp > Number(p.price) ? `₹${mrp.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="p-3">
                      <button type="button" disabled={!!busy[p._id]} onClick={() => toggleAvailability(p)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${p.isAvailable ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10' : 'border-red-500/30 text-red-300 hover:bg-red-500/10'}`} title="Click to switch">
                        {p.isAvailable ? 'In stock' : 'Out of stock'}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => setEditing(p)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white">Edit</button>
                      <button type="button" disabled={!!busy[p._id]} onClick={() => deleteProduct(p)} className="ml-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-400/70 hover:text-red-300 disabled:opacity-50">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing === 'new' ? null : editing}
          storeName={store.name}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSave={saveProduct}
        />
      )}
    </div>
  );
}
