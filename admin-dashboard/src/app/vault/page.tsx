"use client";
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { adminRequest as request } from '@/lib/api';

// Vault = limited daily deals. Claiming one (POST /api/vault/claim/:id in the app) creates a real coupon valid until
// midnight IST, one claim per deal per person per day, and takes one unit of stock.

interface VaultItem {
  _id: string;
  name: string;
  price: number;
  originalPrice: number;
  remainingCount: number;
  imageUrl?: string | null;
  isActive: boolean;
  streakRequirement?: number;
  updatedAt?: string;
}

interface DealForm {
  name: string;
  price: string;
  originalPrice: string;
  remainingCount: string;
  streakRequirement: string;
  imageUrl: string;
}

const EMPTY_FORM: DealForm = { name: '', price: '', originalPrice: '', remainingCount: '10', streakRequirement: '0', imageUrl: '' };
const FIELD = 'w-full rounded-lg border border-white/10 bg-[#111318] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-400/50';
const LABEL = 'block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400';


const toForm = (item: VaultItem): DealForm => ({
  name: item.name,
  price: String(item.price ?? ''),
  originalPrice: String(item.originalPrice ?? ''),
  remainingCount: String(item.remainingCount ?? 0),
  streakRequirement: String(item.streakRequirement ?? 0),
  imageUrl: item.imageUrl || '',
});

/** Returns a payload or an error message. */
function validate(form: DealForm): { payload?: Record<string, unknown>; error?: string } {
  const name = form.name.trim();
  const price = Number(form.price);
  const originalPrice = Number(form.originalPrice);
  const remainingCount = Number(form.remainingCount);
  const streakRequirement = Number(form.streakRequirement || 0);
  if (!name) return { error: 'Deal name is required.' };
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) return { error: 'Enter the deal price.' };
  if (form.originalPrice.trim() === '' || !Number.isFinite(originalPrice) || originalPrice <= 0) return { error: 'Enter the original price.' };
  if (originalPrice < price) return { error: 'The original price cannot be lower than the deal price.' };
  if (!Number.isInteger(remainingCount) || remainingCount < 0) return { error: 'Stock must be a whole number (0 or more).' };
  if (!Number.isInteger(streakRequirement) || streakRequirement < 0) return { error: 'Streak requirement must be a whole number (0 or more).' };
  return { payload: { name, price, originalPrice, remainingCount, streakRequirement, imageUrl: form.imageUrl.trim() || null } };
}

export default function VaultPage() {
  const { isAuthed } = useAdminAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<VaultItem | 'new' | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await request<VaultItem[]>('/api/admin/vault');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load vault deals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) load();
  }, [isAuthed, load]);

  const flash = (kind: 'ok' | 'error', text: string) => setNotice({ kind, text });

  const save = async (id: string, payload: Record<string, unknown>) => {
    const saved = await request<VaultItem>(`/api/admin/vault/${id}`, { method: 'POST', body: JSON.stringify(payload) });
    setItems(prev => (id === 'new' ? [saved, ...prev] : prev.map(i => (i._id === id ? { ...i, ...saved } : i))));
    return saved;
  };

  const toggleActive = async (item: VaultItem) => {
    if (busy[item._id]) return;
    if (item.isActive && !window.confirm(`Hide "${item.name}" from the Vault? Students can no longer claim it.`)) return;
    setBusy(prev => ({ ...prev, [item._id]: true }));
    try {
      await save(item._id, { isActive: !item.isActive });
      flash('ok', item.isActive ? `${item.name} hidden.` : `${item.name} is live in the Vault.`);
    } catch (e) {
      flash('error', e instanceof Error ? e.message : 'Could not update the deal.');
    } finally {
      setBusy(prev => ({ ...prev, [item._id]: false }));
    }
  };

  const remove = async (item: VaultItem) => {
    if (!window.confirm(`Delete "${item.name}" permanently? Coupons already claimed stay valid until midnight.`)) return;
    setBusy(prev => ({ ...prev, [item._id]: true }));
    try {
      await request(`/api/admin/vault/${item._id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i._id !== item._id));
      flash('ok', `${item.name} deleted.`);
    } catch (e) {
      flash('error', e instanceof Error ? e.message : 'Could not delete the deal.');
      setBusy(prev => ({ ...prev, [item._id]: false }));
    }
  };

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  const live = items.filter(i => i.isActive && i.remainingCount > 0).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Rewards</p>
          <h1 className="mt-1 text-2xl font-black">Vault deals</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Limited daily deals. A claim gives the student a coupon valid until midnight (one claim per deal per day) and uses one unit of stock.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{live} live of {items.length}</span>
          <button type="button" disabled={loading} onClick={load} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
          <button type="button" onClick={() => setEditing('new')} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400">Add deal</button>
        </div>
      </header>

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${notice.kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {loadError}
          <button type="button" onClick={load} className="font-bold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div role="status" className="rounded-lg border border-white/10 p-8 text-sm text-gray-400">Loading vault deals…</div>
      ) : !loadError && items.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-10 text-center">
          <h2 className="font-bold">No vault deals yet</h2>
          <p className="mt-2 text-sm text-gray-400">The Vault is empty in the app until you add a deal.</p>
        </div>
      ) : (
        <section className="divide-y divide-white/10 rounded-xl border border-white/10" aria-label="Vault deals">
          {items.map(item => {
            const off = item.originalPrice > item.price ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
            const status = !item.isActive ? 'Hidden' : item.remainingCount <= 0 ? 'Sold out' : 'Live';
            return (
              <article key={item._id} className="flex flex-wrap items-center gap-4 p-4">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
                ) : <div aria-hidden className="h-14 w-14 rounded-lg border border-white/10 bg-slate-900" />}
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{item.name}</h2>
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${status === 'Live' ? 'border-emerald-500/30 text-emerald-300' : status === 'Sold out' ? 'border-amber-500/30 text-amber-300' : 'border-white/10 text-gray-400'}`}>{status}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-300">
                    ₹{item.price} <span className="text-gray-500 line-through">₹{item.originalPrice}</span>{off ? <span className="ml-2 text-emerald-300">{off}% off</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.remainingCount} left · {item.streakRequirement ? `needs a ${item.streakRequirement}-day streak` : 'no streak needed'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={!!busy[item._id]} onClick={() => toggleActive(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-50">{item.isActive ? 'Hide' : 'Make live'}</button>
                  <button type="button" onClick={() => setEditing(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white">Edit</button>
                  <button type="button" disabled={!!busy[item._id]} onClick={() => remove(item)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-400/70 hover:text-red-300 disabled:opacity-50">Delete</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {editing && (
        <DealEditor
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async payload => {
            const id = editing === 'new' ? 'new' : editing._id;
            const saved = await save(id, editing === 'new' ? { ...payload, isActive: true } : payload);
            setEditing(null);
            flash('ok', editing === 'new' ? `${saved.name} is live in the Vault.` : `${saved.name} saved.`);
          }}
        />
      )}
    </div>
  );
}

function DealEditor({ initial, onCancel, onSave }: {
  initial: VaultItem | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<DealForm>(initial ? toForm(initial) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<DealForm>) => setForm(prev => ({ ...prev, ...patch }));

  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) return setError('Use a JPEG, PNG or WEBP image.');
    if (file.size > 2 * 1024 * 1024) return setError('The image must be 2 MB or smaller.');
    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      const data = await request<{ imageUrl?: string }>('/api/upload', { method: 'POST', body });
      if (!data?.imageUrl) throw new Error('The upload did not return an image.');
      set({ imageUrl: data.imageUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return;
    const { payload, error: invalid } = validate(form);
    if (!payload) return setError(invalid || 'Check the form.');
    setSaving(true);
    setError('');
    try {
      await onSave(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the deal.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="deal-title">
      <form onSubmit={submit} className="my-8 w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0f14] p-6 text-white shadow-2xl">
        <h2 id="deal-title" className="text-xl font-bold">{initial ? 'Edit deal' : 'Add vault deal'}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={`${LABEL} sm:col-span-2`}>Deal name
            <input className={FIELD} value={form.name} onChange={e => set({ name: e.target.value })} required maxLength={120} />
          </label>
          <label className={LABEL}>Deal price (₹)
            <input inputMode="decimal" className={FIELD} value={form.price} onChange={e => set({ price: e.target.value })} required />
          </label>
          <label className={LABEL}>Original price (₹)
            <input inputMode="decimal" className={FIELD} value={form.originalPrice} onChange={e => set({ originalPrice: e.target.value })} required />
          </label>
          <label className={LABEL}>Stock left
            <input inputMode="numeric" className={FIELD} value={form.remainingCount} onChange={e => set({ remainingCount: e.target.value })} required />
          </label>
          <label className={LABEL}>Streak needed (days)
            <input inputMode="numeric" className={FIELD} value={form.streakRequirement} onChange={e => set({ streakRequirement: e.target.value })} />
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Image</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
                {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <input className={`${FIELD} min-w-[200px] flex-1`} value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={e => set({ imageUrl: e.target.value })} placeholder={form.imageUrl.startsWith('data:') ? 'Uploaded image' : 'or paste an image URL'} />
              {form.imageUrl && <button type="button" onClick={() => set({ imageUrl: '' })} className="text-sm text-red-300 hover:underline">Remove</button>}
            </div>
          </div>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving || uploading} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">{saving ? 'Saving…' : initial ? 'Save deal' : 'Publish deal'}</button>
        </div>
      </form>
    </div>
  );
}
