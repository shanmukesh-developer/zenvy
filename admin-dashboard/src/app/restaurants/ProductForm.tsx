"use client";
import { useState } from 'react';
import { Product, readSpecs, uploadImage } from './catalogue';
import { FIELD, LABEL } from './StoreForm';

export interface ProductPayload {
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  isEliteOnly: boolean;
  tags: string[];
  /** Merged into the stored specs by the server; originalPrice: null removes the MRP. */
  specs: { originalPrice: number | null; weight: string | null };
}

/** Create / edit a product: price, MRP (specs.originalPrice), image, availability. */
export function ProductForm({ initial, storeName, categories, onCancel, onSave }: {
  initial: Product | null;
  storeName: string;
  categories: string[];
  onCancel: () => void;
  onSave: (payload: ProductPayload) => Promise<void>;
}) {
  const specs = readSpecs(initial?.specs);
  const [form, setForm] = useState({
    name: initial?.name || '',
    price: initial ? String(initial.price ?? '') : '',
    mrp: specs.originalPrice != null ? String(specs.originalPrice) : '',
    weight: typeof specs.weight === 'string' ? specs.weight : '',
    category: initial?.category || '',
    description: initial?.description || '',
    imageUrl: initial?.imageUrl || initial?.image || '',
    isAvailable: initial?.isAvailable ?? true,
    isVegetarian: initial?.isVegetarian ?? true,
    isEliteOnly: !!initial?.isEliteOnly,
    tags: (initial?.tags || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));
  const bookingOnly = !!specs.bookingOnly;

  const handleImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      set({ imageUrl: await uploadImage(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return;
    const name = form.name.trim();
    const price = Number(form.price);
    const mrp = form.mrp.trim() === '' ? null : Number(form.mrp);
    if (!name) return setError('Product name is required.');
    if (form.price.trim() === '' || !Number.isFinite(price) || price < 0 || price > 100000) return setError('Enter a price between ₹0 and ₹1,00,000.');
    if (mrp !== null && (!Number.isFinite(mrp) || mrp <= 0)) return setError('MRP must be a positive amount, or empty.');
    if (mrp !== null && mrp < price) return setError('MRP cannot be lower than the selling price.');

    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
        price: Math.round(price * 100) / 100,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        isAvailable: form.isAvailable,
        isVegetarian: form.isVegetarian,
        isEliteOnly: form.isEliteOnly,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        specs: { originalPrice: mrp, weight: form.weight.trim() || null },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the product.');
      setSaving(false);
    }
  };

  const discount = (() => {
    const p = Number(form.price);
    const m = Number(form.mrp);
    return form.mrp && Number.isFinite(p) && Number.isFinite(m) && m > p && p >= 0 ? Math.round((1 - p / m) * 100) : null;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
      <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d0f14] p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="product-form-title" className="text-xl font-bold">{initial ? 'Edit product' : 'Add product'}</h2>
            <p className="mt-1 text-sm text-gray-400">{storeName}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:text-white">Close</button>
        </div>

        {bookingOnly && (
          <p className="mb-4 rounded-lg border border-sky-400/20 bg-sky-400/5 p-3 text-sm text-sky-200">
            Booking-only service: this price is what service bookings are charged (print jobs use the per-page and binding rows of this store).
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className={`${LABEL} md:col-span-2`}>Name
            <input className={FIELD} value={form.name} maxLength={200} onChange={e => set({ name: e.target.value })} required />
          </label>
          <label className={LABEL}>Selling price (₹)
            <input inputMode="decimal" className={FIELD} value={form.price} onChange={e => set({ price: e.target.value })} required />
          </label>
          <label className={LABEL}>MRP (₹) {discount ? <span className="normal-case text-emerald-300">· shows {discount}% off</span> : null}
            <input inputMode="decimal" className={FIELD} value={form.mrp} onChange={e => set({ mrp: e.target.value })} placeholder="Optional, crossed-out price" />
          </label>
          <label className={LABEL}>Category
            <input className={FIELD} value={form.category} list="product-categories" onChange={e => set({ category: e.target.value })} placeholder="e.g. Snacks" />
            <datalist id="product-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className={LABEL}>Pack size / weight
            <input className={FIELD} value={form.weight} onChange={e => set({ weight: e.target.value })} placeholder="e.g. 500 g (optional)" />
          </label>
          <label className={`${LABEL} md:col-span-2`}>Description
            <textarea className={`${FIELD} h-20 resize-none`} value={form.description} onChange={e => set({ description: e.target.value })} maxLength={1000} />
          </label>

          <div className="md:col-span-2 space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Image</span>
            <div className="flex flex-wrap items-center gap-3">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="" className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
              ) : <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-gray-600">None</div>}
              <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
                {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => { handleImage(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <input className={`${FIELD} min-w-[200px] flex-1`} value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl} onChange={e => set({ imageUrl: e.target.value })} placeholder={form.imageUrl.startsWith('data:') ? 'Uploaded image' : 'or paste an image URL'} />
              {form.imageUrl && <button type="button" onClick={() => set({ imageUrl: '' })} className="text-sm text-red-300 hover:underline">Remove</button>}
            </div>
          </div>

          <label className={`${LABEL} md:col-span-2`}>Tags (comma separated)
            <input className={FIELD} value={form.tags} onChange={e => set({ tags: e.target.value })} />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isAvailable} onChange={e => set({ isAvailable: e.target.checked })} className="h-4 w-4 accent-emerald-500" /> In stock</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isVegetarian} onChange={e => set({ isVegetarian: e.target.checked })} className="h-4 w-4 accent-emerald-500" /> Vegetarian</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isEliteOnly} onChange={e => set({ isEliteOnly: e.target.checked })} className="h-4 w-4 accent-amber-500" /> Elite members only</label>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving || uploading} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save product' : 'Add product'}
          </button>
        </div>
      </form>
    </div>
  );
}
