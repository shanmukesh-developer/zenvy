"use client";
import { useState } from 'react';
import { Store, VENDOR_TYPES, formatWhatsapp, uploadImage } from './catalogue';

export const FIELD = 'w-full rounded-lg border border-white/10 bg-[#111318] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/50 disabled:opacity-50';
export const LABEL = 'block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400';

export interface StorePayload {
  name: string;
  vendorType: string;
  location: string;
  imageUrl: string | null;
  operatingHours: { start: string; end: string };
  deliveryTime: number | null;
  whatsappNumber: string | null;
  commissionRate: number;
  commissionType: 'percentage' | 'flat';
  tags: string[];
  campus: string | null;
  stallDescription: string | null;
  isOffline: boolean;
  password?: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Create / edit a store: identity, type, hours, delivery time, WhatsApp, commission. */
export function StoreForm({ initial, onCancel, onSave }: {
  initial: Store | null;
  onCancel: () => void;
  onSave: (payload: StorePayload) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    vendorType: (initial?.vendorType || 'RESTAURANT').toUpperCase(),
    location: initial?.location || 'Main Campus',
    imageUrl: initial?.imageUrl || '',
    start: initial?.operatingHours?.start || '09:00',
    end: initial?.operatingHours?.end || '22:00',
    deliveryTime: initial?.deliveryTime != null ? String(initial.deliveryTime) : '',
    whatsappNumber: formatWhatsapp(initial?.whatsappNumber).replace(/\s/g, ''),
    commissionRate: String(initial?.commissionRate ?? 10),
    commissionType: initial?.commissionType === 'flat' ? 'flat' : 'percentage',
    tags: (initial?.tags || []).join(', '),
    campus: initial?.campus || '',
    stallDescription: initial?.stallDescription || '',
    isOffline: !!initial?.isOffline,
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  const typeOptions = VENDOR_TYPES.some(v => v.value === form.vendorType)
    ? VENDOR_TYPES
    : [...VENDOR_TYPES, { value: form.vendorType, label: `${form.vendorType} (current)` }];
  const isLocalVendor = form.vendorType === 'LOCAL_VENDOR';

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
    if (!name) return setError('Store name is required.');
    if (!HHMM.test(form.start) || !HHMM.test(form.end)) return setError('Opening and closing times are required.');
    const delivery = form.deliveryTime.trim();
    const deliveryTime = delivery === '' ? null : Number(delivery);
    if (deliveryTime !== null && (!Number.isInteger(deliveryTime) || deliveryTime < 5 || deliveryTime > 240)) {
      return setError('Delivery time must be a whole number of minutes between 5 and 240, or empty.');
    }
    const phone = form.whatsappNumber.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return setError('WhatsApp number must be a 10-digit Indian mobile number.');
    if (isLocalVendor && !phone) return setError('Local vendors are contacted on WhatsApp, so a WhatsApp number is required.');
    const rate = Number(form.commissionRate);
    const maxRate = form.commissionType === 'flat' ? 1000 : 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > maxRate) return setError(`Commission must be between 0 and ${maxRate}.`);
    if (form.password && form.password.trim().length < 6) return setError('The partner portal password must be at least 6 characters.');

    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
        vendorType: form.vendorType,
        location: form.location.trim() || 'Main Campus',
        imageUrl: form.imageUrl.trim() || null,
        operatingHours: { start: form.start, end: form.end },
        deliveryTime,
        whatsappNumber: phone || null,
        commissionRate: rate,
        commissionType: form.commissionType as 'percentage' | 'flat',
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        campus: form.campus.trim() || null,
        stallDescription: form.stallDescription.trim() || null,
        isOffline: form.isOffline,
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the store.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="store-form-title">
      <form onSubmit={submit} className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0d0f14] p-6 text-white shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="store-form-title" className="text-xl font-bold">{initial ? `Edit ${initial.name}` : 'Add store'}</h2>
            <p className="mt-1 text-sm text-gray-400">Changes go live in the customer app within a minute.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:text-white">Close</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={LABEL}>Store name
            <input className={FIELD} value={form.name} maxLength={120} onChange={e => set({ name: e.target.value })} required />
          </label>
          <label className={LABEL}>Store type
            <select className={FIELD} value={form.vendorType} onChange={e => set({ vendorType: e.target.value })}>
              {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className={LABEL}>Location
            <input className={FIELD} value={form.location} onChange={e => set({ location: e.target.value })} placeholder="e.g. Food court, Block A" />
          </label>
          <label className={LABEL}>Campus
            <input className={FIELD} value={form.campus} onChange={e => set({ campus: e.target.value })} placeholder="e.g. SRM (optional)" />
          </label>

          <div className="md:col-span-2 grid gap-4 sm:grid-cols-3">
            <label className={LABEL}>Opens at
              <input type="time" className={FIELD} value={form.start} onChange={e => set({ start: e.target.value })} required />
            </label>
            <label className={LABEL}>Closes at
              <input type="time" className={FIELD} value={form.end} onChange={e => set({ end: e.target.value })} required />
            </label>
            <label className={LABEL}>Delivery time (min)
              <input inputMode="numeric" className={FIELD} value={form.deliveryTime} onChange={e => set({ deliveryTime: e.target.value })} placeholder="Not shown if empty" />
            </label>
          </div>
          <p className="md:col-span-2 -mt-2 text-xs text-gray-500">Times are IST. A closing time earlier than the opening time means the store is open overnight. Same opening and closing time means open 24 hours.</p>

          <label className={LABEL}>WhatsApp number
            <input inputMode="tel" className={FIELD} value={form.whatsappNumber} onChange={e => set({ whatsappNumber: e.target.value })} placeholder="10-digit mobile" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={LABEL}>Commission
              <input inputMode="decimal" className={FIELD} value={form.commissionRate} onChange={e => set({ commissionRate: e.target.value })} />
            </label>
            <label className={LABEL}>Type
              <select className={FIELD} value={form.commissionType} onChange={e => set({ commissionType: e.target.value as 'percentage' | 'flat' })}>
                <option value="percentage">% of order</option>
                <option value="flat">₹ per order</option>
              </select>
            </label>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Store image</span>
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
            <input className={FIELD} value={form.tags} onChange={e => set({ tags: e.target.value })} placeholder="e.g. biryani, north indian" />
          </label>

          {isLocalVendor && (
            <>
              <div className="md:col-span-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">
                Local vendors are display-only listings: customers see the stall and its prices and contact the vendor on WhatsApp or by phone. Zenvy takes no order, payment or rider for them.
              </div>
              <label className={`${LABEL} md:col-span-2`}>Stall description
                <textarea className={`${FIELD} h-20 resize-none`} value={form.stallDescription} onChange={e => set({ stallDescription: e.target.value })} maxLength={500} />
              </label>
            </>
          )}

          <label className="flex items-center gap-3 text-sm text-gray-300 md:col-span-2">
            <input type="checkbox" checked={form.isOffline} onChange={e => set({ isOffline: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Offline store (no partner app: orders are handled by the Zenvy team / rider)
          </label>

          <label className={`${LABEL} md:col-span-2`}>{initial ? 'New partner portal password' : 'Partner portal password'}
            <input type="password" autoComplete="new-password" className={FIELD} value={form.password} onChange={e => set({ password: e.target.value })} placeholder={initial ? 'Leave empty to keep the current password' : 'Optional, at least 6 characters'} />
          </label>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
          <button type="submit" disabled={saving || uploading} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create store'}
          </button>
        </div>
      </form>
    </div>
  );
}
