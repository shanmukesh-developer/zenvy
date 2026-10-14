"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { adminRequest as apiRequest } from '@/lib/api';
import { useLiveSync } from '@/lib/useLiveSync';

type EditableKey = 'maintenanceMode' | 'campusOpen' | 'banners' | 'categories';
const EDITABLE_KEYS: EditableKey[] = ['maintenanceMode', 'campusOpen', 'banners', 'categories'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface Banner {
  imageUrl: string;
  tagline: string;
  title1: string;
  title2: string;
  description: string;
  buttonText: string;
  redirectUrl?: string;
  isActive: boolean;
}

interface Category {
  name: string;
  img: string;
  order: number;
  isActive: boolean;
}

interface AppConfig {
  maintenanceMode: boolean;
  campusOpen: boolean;
  banners: Banner[];
  categories: Category[];
  updatedAt?: string;
}

/** fetch against the one backend; throws an Error carrying the server's friendly `message`. */
const normalizeConfig = (raw: Partial<AppConfig> | null | undefined): AppConfig => ({
  maintenanceMode: !!raw?.maintenanceMode,
  campusOpen: raw?.campusOpen !== false,
  banners: Array.isArray(raw?.banners) ? raw!.banners : [],
  categories: Array.isArray(raw?.categories) ? raw!.categories : [],
  updatedAt: raw?.updatedAt,
});

export default function CMSPage() {
  const { isAuthed } = useAdminAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The config as last loaded from the server: only fields that differ from it are saved. */
  const baseline = useRef<AppConfig | null>(null);
  /** Set when another tab / page (e.g. a store banner) changed the config while this one had edits. */
  const [staleRemote, setStaleRemote] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ config: AppConfig }>('/api/config');
      const next = normalizeConfig(data?.config);
      baseline.current = next;
      setConfig(next);
      setDirty(false);
      setStaleRemote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) fetchConfig();
  }, [isAuthed, fetchConfig]);

  // Config changed elsewhere (another admin tab, a store's Home banner added or removed): reload when
  // there are no local edits, otherwise warn so a save cannot silently undo that change.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useLiveSync(['config'], () => {
    if (dirtyRef.current) setStaleRemote(true);
    else fetchConfig();
  }, { enabled: isAuthed });

  const edit = (next: AppConfig) => {
    setConfig(next);
    setDirty(true);
    setNotice(null);
  };

  const handleSave = async () => {
    if (!config || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const base = baseline.current;
      const changed = EDITABLE_KEYS.filter(k => !base || !same(config[k], base[k]));
      if (!changed.length) {
        setDirty(false);
        setNotice('Nothing to save.');
        return;
      }
      // Re-read the server copy: if a field this page is about to overwrite was changed elsewhere
      // since it loaded, ask before replacing it (the server itself has no version check).
      // cache: 'reload' skips the few-second read cache, so the conflict check sees the server copy.
      const latest = normalizeConfig((await apiRequest<{ config: AppConfig }>('/api/config', { cache: 'reload' }))?.config);
      const conflicts = base ? changed.filter(k => !same(latest[k], base[k])) : [];
      if (conflicts.length && !confirm(`Someone else changed ${conflicts.join(', ')} since this page loaded. Saving replaces their change with yours.

Press Cancel, then Discard, to load their version first.`)) {
        setStaleRemote(true);
        return;
      }
      const body: Partial<Record<EditableKey, unknown>> = {};
      changed.forEach(k => { body[k] = config[k]; });
      const data = await apiRequest<{ config: AppConfig }>('/api/config', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const saved = normalizeConfig(data?.config);
      baseline.current = saved;
      setConfig(saved);
      setStaleRemote(false);
      setDirty(false);
      setNotice('Configuration saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the configuration.');
    } finally {
      setSaving(false);
    }
  };

  const updateBanner = <K extends keyof Banner>(index: number, field: K, value: Banner[K]) => {
    if (!config) return;
    const banners = [...config.banners];
    banners[index] = { ...banners[index], [field]: value };
    edit({ ...config, banners });
  };

  const updateCategory = <K extends keyof Category>(index: number, field: K, value: Category[K]) => {
    if (!config) return;
    const categories = [...config.categories];
    categories[index] = { ...categories[index], [field]: value };
    edit({ ...config, categories });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-xl mx-auto mt-16 glass-card p-8 text-center space-y-4">
        <p className="text-sm font-bold text-red-400">{error || 'Could not load the configuration.'}</p>
        <button onClick={fetchConfig} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <div className="flex justify-between items-start gap-6 mb-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-widest text-emerald-400">App Content (CMS)</h1>
          <p className="text-gray-400 text-sm mt-1">Home banners, category shortcuts and status flags stored in the app config (<code className="text-gray-300">/api/config</code>).</p>
          {config.updatedAt && (
            <p className="text-gray-600 text-xs mt-1">Last saved {new Date(config.updatedAt).toLocaleString()}</p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {dirty && <span className="text-[11px] font-bold text-amber-400">Unsaved changes</span>}
          <button
            onClick={fetchConfig}
            disabled={saving}
            className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50"
          >
            {dirty ? 'Discard' : 'Reload'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/20"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-200 leading-relaxed">
        Heads-up: the current customer app does not read this config yet, so these banners, categories and flags are saved
        but not shown to students. Ordering hours and the delivery fee are controlled elsewhere (Config page and backend env).
      </div>

      {staleRemote && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
          The app config was changed elsewhere while you were editing. Only the fields you edited will be saved, but use Discard to load the latest version if you are unsure.
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-bold text-red-400">{error}</div>
      )}
      {notice && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-bold text-emerald-400">{notice}</div>
      )}

      {/* Global flags */}
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-white">Status Flags</h2>
        <div className="flex gap-8 flex-wrap">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.maintenanceMode}
              onChange={(e) => edit({ ...config, maintenanceMode: e.target.checked })}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="font-bold">Maintenance mode</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.campusOpen}
              onChange={(e) => edit({ ...config, campusOpen: e.target.checked })}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="font-bold">Campus open</span>
          </label>
        </div>
      </div>

      {/* Banners */}
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Promotional Banners</h2>
          <button
            onClick={() => edit({
              ...config,
              banners: [...config.banners, { imageUrl: '', tagline: '', title1: '', title2: '', description: '', buttonText: '', redirectUrl: '', isActive: false }],
            })}
            className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-4 py-2 rounded-lg"
          >
            + Add Banner
          </button>
        </div>

        {config.banners.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-6 text-center">No banners yet.</p>
        ) : (
          <div className="space-y-4">
            {config.banners.map((banner, idx) => (
              <div key={idx} className={`p-4 border rounded-xl flex flex-col gap-3 ${banner.isActive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 opacity-60'}`}>
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-400">Banner #{idx + 1}</span>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!banner.isActive} onChange={(e) => updateBanner(idx, 'isActive', e.target.checked)} />
                    <span className="text-xs">Active</span>
                  </label>
                </div>
                <input placeholder="Image URL" value={banner.imageUrl || ''} onChange={e => updateBanner(idx, 'imageUrl', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Tagline" value={banner.tagline || ''} onChange={e => updateBanner(idx, 'tagline', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                  <input placeholder="Redirect path (e.g. /mega-basket)" value={banner.redirectUrl || ''} onChange={e => updateBanner(idx, 'redirectUrl', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                  <input placeholder="Title line 1" value={banner.title1 || ''} onChange={e => updateBanner(idx, 'title1', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                  <input placeholder="Title line 2" value={banner.title2 || ''} onChange={e => updateBanner(idx, 'title2', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                  <input placeholder="Button text" value={banner.buttonText || ''} onChange={e => updateBanner(idx, 'buttonText', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm col-span-2" />
                </div>
                <textarea placeholder="Description" value={banner.description || ''} onChange={e => updateBanner(idx, 'description', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm w-full h-16" />
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!confirm(`Remove banner #${idx + 1}? It is deleted when you save.`)) return;
                      edit({ ...config, banners: config.banners.filter((_, i) => i !== idx) });
                    }}
                    className="text-red-400 text-xs font-bold hover:underline"
                  >
                    Remove Banner
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="bg-[#141416] border border-white/10 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Category Shortcuts</h2>
          <button
            onClick={() => edit({
              ...config,
              categories: [...config.categories, { name: '', img: '', order: config.categories.length + 1, isActive: false }],
            })}
            className="text-blue-400 text-sm font-bold bg-blue-500/10 px-4 py-2 rounded-lg"
          >
            + Add Category
          </button>
        </div>

        {config.categories.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-6 text-center">No categories yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {config.categories.map((cat, idx) => (
              <div key={idx} className={`p-4 border rounded-xl flex flex-col gap-2 ${cat.isActive ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5 opacity-60'}`}>
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!cat.isActive} onChange={(e) => updateCategory(idx, 'isActive', e.target.checked)} />
                    <span className="text-xs">Active</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500">
                    Order
                    <input
                      type="number"
                      value={Number.isFinite(cat.order) ? cat.order : 0}
                      onChange={e => updateCategory(idx, 'order', parseInt(e.target.value, 10) || 0)}
                      className="w-12 bg-black/50 border border-white/10 p-1 rounded text-xs text-center text-white"
                    />
                  </label>
                </div>
                <input placeholder="Name" value={cat.name || ''} onChange={e => updateCategory(idx, 'name', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                <input placeholder="Image URL or path" value={cat.img || ''} onChange={e => updateCategory(idx, 'img', e.target.value)} className="bg-black/50 border border-white/10 p-2 rounded text-sm" />
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => {
                      if (!confirm(`Remove "${cat.name || 'this category'}"? It is deleted when you save.`)) return;
                      edit({ ...config, categories: config.categories.filter((_, i) => i !== idx) });
                    }}
                    className="text-red-400 text-[10px] font-bold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
