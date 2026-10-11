"use client";
import { useState } from 'react';
import { DAYS, Day, FIELD, LABEL, MealMenu, PGHostel, normalizeGender, uploadImage } from './pgApi';

const AMENITIES = ['WiFi ⚡', 'Food/Mess 🍽️', 'AC ❄️', 'Gym 💪', 'Laundry 🧺', '24/7 Security 🛡️', 'Power Backup 🔌', 'Hot Water 🚿'];
const MEALS: (keyof MealMenu)[] = ['breakfast', 'lunch', 'dinner'];

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const slotText = (slot: unknown) => {
  if (typeof slot === 'string') return slot;
  if (slot && typeof slot === 'object') {
    const s = slot as { start?: string; end?: string };
    return s.start && s.end ? `${s.start} - ${s.end}` : str(s.start || s.end);
  }
  return '';
};

const emptyMenu = () => Object.fromEntries(DAYS.map(d => [d, { breakfast: '', lunch: '', dinner: '' }])) as Record<Day, MealMenu>;

const toForm = (pg: PGHostel | null) => {
  const ci = (pg?.contactInfo || {}) as Record<string, unknown>;
  const tt = (pg?.foodTimetable || {}) as Record<string, unknown>;
  const menu = emptyMenu();
  for (const d of DAYS) {
    const m = pg?.messMenu?.[d];
    if (m) menu[d] = { breakfast: str(m.breakfast), lunch: str(m.lunch), dinner: str(m.dinner) };
  }
  return {
    name: pg?.name || '',
    address: pg?.address || '',
    distanceFromCollege: pg ? str(pg.distanceFromCollege) : '',
    genderType: normalizeGender(pg?.genderType),
    baseRent: pg ? str(pg.baseRent) : '',
    securityDeposit: pg ? str(pg.securityDeposit ?? 0) : '0',
    description: pg?.description || '',
    isActive: pg?.isActive ?? true,
    amenities: pg?.amenities || [],
    images: pg?.images || [],
    rules: pg?.rules || [],
    contact: {
      ownerName: str(ci.ownerName), phone: str(ci.phone), email: str(ci.email),
      wardenName: str(ci.wardenName ?? ci.warden), emergencyContact: str(ci.emergencyContact),
      lat: str(ci.lat), lng: str(ci.lng),
    },
    timetable: { breakfast: slotText(tt.breakfast), lunch: slotText(tt.lunch), dinner: slotText(tt.dinner) },
    messMenu: menu,
  };
};

type FormState = ReturnType<typeof toForm>;

/** Builds the PG payload (POST /api/pg, PUT /api/pg/:id) or returns a validation message. */
function buildPayload(f: FormState): { payload?: Record<string, unknown>; error?: string } {
  const distance = Number(f.distanceFromCollege);
  const rent = Number(f.baseRent);
  const deposit = Number(f.securityDeposit || 0);
  if (!f.name.trim()) return { error: 'Hostel name is required.' };
  if (!f.address.trim()) return { error: 'Address is required.' };
  if (!Number.isFinite(distance) || distance < 0 || distance > 100) return { error: 'Distance must be between 0 and 100 km.' };
  if (!Number.isFinite(rent) || rent <= 0) return { error: 'Enter the base rent per month.' };
  if (!Number.isFinite(deposit) || deposit < 0) return { error: 'Deposit cannot be negative.' };
  const coord = (v: string, max: number) => {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) <= max ? n : NaN;
  };
  const lat = coord(f.contact.lat, 90);
  const lng = coord(f.contact.lng, 180);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { error: 'Latitude must be between -90 and 90 and longitude between -180 and 180.' };
  if ((lat === null) !== (lng === null)) return { error: 'Enter both latitude and longitude, or neither.' };
  return {
    payload: {
      name: f.name.trim(),
      address: f.address.trim(),
      distanceFromCollege: distance,
      genderType: f.genderType,
      baseRent: rent,
      securityDeposit: deposit,
      description: f.description.trim(),
      isActive: f.isActive,
      amenities: f.amenities,
      images: f.images.filter(u => u.trim()),
      rules: f.rules,
      contactInfo: {
        ownerName: f.contact.ownerName.trim(), phone: f.contact.phone.trim(), email: f.contact.email.trim(),
        wardenName: f.contact.wardenName.trim(), emergencyContact: f.contact.emergencyContact.trim(), lat, lng,
      },
      foodTimetable: { breakfast: f.timetable.breakfast.trim(), lunch: f.timetable.lunch.trim(), dinner: f.timetable.dinner.trim() },
      messMenu: f.messMenu,
    },
  };
}

export function PgForm({ initial, onCancel, onSave }: {
  initial: PGHostel | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [newRule, setNewRule] = useState('');
  const [newImage, setNewImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));
  const setContact = (patch: Partial<FormState['contact']>) => setForm(prev => ({ ...prev, contact: { ...prev.contact, ...patch } }));

  const addRule = () => {
    if (!newRule.trim()) return;
    set({ rules: [...form.rules, newRule.trim()] });
    setNewRule('');
  };
  const addImage = (url: string) => {
    if (!url.trim()) return;
    setForm(prev => ({ ...prev, images: [...prev.images, url.trim()] }));
    setNewImage('');
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      addImage(await uploadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || uploading) return;
    const { payload, error: invalid } = buildPayload(form);
    if (!payload) return setError(invalid || 'Check the form.');
    if (initial?.isActive && !form.isActive && !window.confirm('Deactivate this PG? Students can no longer see or book it.')) return;
    setSaving(true);
    setError('');
    try {
      await onSave(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the PG.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={LABEL}>Hostel name<input className={FIELD} required value={form.name} onChange={e => set({ name: e.target.value })} /></label>
        <label className={LABEL}>Address<input className={FIELD} required value={form.address} onChange={e => set({ address: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
          <label className={LABEL}>Distance (km)<input inputMode="decimal" className={FIELD} required value={form.distanceFromCollege} onChange={e => set({ distanceFromCollege: e.target.value })} /></label>
          <label className={LABEL}>For
            <select className={FIELD} value={form.genderType} onChange={e => set({ genderType: e.target.value })}>
              <option value="Boys">Boys</option><option value="Girls">Girls</option><option value="Co-ed">Co-ed</option>
            </select>
          </label>
          <label className={LABEL}>Base rent (₹/month)<input inputMode="numeric" className={FIELD} required value={form.baseRent} onChange={e => set({ baseRent: e.target.value })} /></label>
          <label className={LABEL}>Deposit (₹)<input inputMode="numeric" className={FIELD} value={form.securityDeposit} onChange={e => set({ securityDeposit: e.target.value })} /></label>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-blue-300">Contact & location</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className={LABEL}>Owner<input className={FIELD} value={form.contact.ownerName} onChange={e => setContact({ ownerName: e.target.value })} /></label>
          <label className={LABEL}>Phone<input inputMode="tel" className={FIELD} value={form.contact.phone} onChange={e => setContact({ phone: e.target.value })} /></label>
          <label className={LABEL}>Email<input type="email" className={FIELD} value={form.contact.email} onChange={e => setContact({ email: e.target.value })} /></label>
          <label className={LABEL}>Warden<input className={FIELD} value={form.contact.wardenName} onChange={e => setContact({ wardenName: e.target.value })} /></label>
          <label className={LABEL}>Emergency contact<input inputMode="tel" className={FIELD} value={form.contact.emergencyContact} onChange={e => setContact({ emergencyContact: e.target.value })} /></label>
          <label className={LABEL}>Latitude<input inputMode="decimal" className={FIELD} value={form.contact.lat} onChange={e => setContact({ lat: e.target.value })} placeholder="e.g. 16.4632" /></label>
          <label className={LABEL}>Longitude<input inputMode="decimal" className={FIELD} value={form.contact.lng} onChange={e => setContact({ lng: e.target.value })} placeholder="e.g. 80.5064" /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-blue-300">Photos</legend>
        {form.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {form.images.map((url, i) => (
              <div key={`${i}-${url.slice(-12)}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-20 w-28 rounded-lg border border-white/10 object-cover" />
                <button type="button" onClick={() => set({ images: form.images.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-red-300" aria-label={`Remove photo ${i + 1}`}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
            {uploading ? 'Uploading…' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <input className={`${FIELD} min-w-[200px] flex-1`} value={newImage} onChange={e => setNewImage(e.target.value)} placeholder="or paste an image URL" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addImage(newImage); } }} />
          <button type="button" onClick={() => addImage(newImage)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">Add URL</button>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-blue-300">Meal timings</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {MEALS.map(meal => (
            <label key={meal} className={LABEL}>{meal}
              <input className={FIELD} value={form.timetable[meal]} onChange={e => set({ timetable: { ...form.timetable, [meal]: e.target.value } })} placeholder="e.g. 8:00 AM - 9:30 AM" />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-blue-300">Weekly mess menu</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {DAYS.map(day => (
            <div key={day} className="space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <span className="text-xs font-semibold text-gray-400">{day}</span>
              <div className="grid grid-cols-3 gap-2">
                {MEALS.map(meal => (
                  <input key={meal} aria-label={`${day} ${meal}`} placeholder={meal[0].toUpperCase() + meal.slice(1)} className={FIELD} value={form.messMenu[day][meal]} onChange={e => set({ messMenu: { ...form.messMenu, [day]: { ...form.messMenu[day], [meal]: e.target.value } } })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-bold text-blue-300">House rules</legend>
        {form.rules.length > 0 && (
          <ol className="space-y-1.5">
            {form.rules.map((rule, i) => (
              <li key={`${i}-${rule}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm">
                <span>{i + 1}. {rule}</span>
                <button type="button" onClick={() => set({ rules: form.rules.filter((_, j) => j !== i) })} className="text-xs text-red-300 hover:underline">Remove</button>
              </li>
            ))}
          </ol>
        )}
        <div className="flex gap-2">
          <input className={`${FIELD} flex-1`} value={newRule} onChange={e => setNewRule(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }} placeholder="e.g. Gate closes at 10:00 PM" />
          <button type="button" onClick={addRule} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">Add rule</button>
        </div>
      </fieldset>

      <label className={LABEL}>Description<textarea className={`${FIELD} h-20 resize-none`} value={form.description} onChange={e => set({ description: e.target.value })} /></label>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-blue-300">Amenities</legend>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set([...AMENITIES, ...form.amenities])).map(a => {
            const on = form.amenities.includes(a);
            return (
              <button key={a} type="button" aria-pressed={on} onClick={() => set({ amenities: on ? form.amenities.filter(x => x !== a) : [...form.amenities, a] })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-white/10 text-gray-400 hover:text-white'}`}>{a}</button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm text-gray-300">
        <input type="checkbox" checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
        Listed in the app (students can see and book it)
      </label>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
        <button type="submit" disabled={saving || uploading} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : initial ? 'Save PG' : 'Create PG'}</button>
      </div>
    </form>
  );
}
