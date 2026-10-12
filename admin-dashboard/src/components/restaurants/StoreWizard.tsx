"use client";
import { useEffect, useId, useMemo, useRef, useState, ReactNode } from 'react';
import {
  Store, VENDOR_TYPES, VendorGroup, adminRequest, formatINR, formatWhatsapp, isBookingOnlyStore, isLocalVendorType,
  isValidIndianMobile, readBrandTheme, storeId, tenDigits, vendorLabel,
} from '@/app/restaurants/catalogue';
import {
  Weekly, generatePassword, isOpenByHours, isUniform, mapsUrl, operatingHoursPayload, parseMapLink, passwordStrength,
  primaryWindow, round6, summarizeWeekly, timeAgo, validateWeekly, weeklyFromStore, uniformWeekly,
} from './helpers';
import { ImagePicker, TagInput, WeeklyHoursEditor } from './inputs';
import { StorePreviewCard } from './StorePreviewCard';
import {
  Button, Callout, Chip, ConfirmModal, CopyButton, Drawer, Field, INPUT, Segmented, Toggle, cx, FOCUS_RING, useToast,
} from './ui';

// ─── State ───────────────────────────────────────────────────────────────────
export interface WizardState {
  name: string;
  vendorType: string;
  campus: string;
  description: string;
  tags: string[];
  location: string;
  zone: string;
  lat: string;
  lon: string;
  whatsapp: string;
  imageUrl: string;
  brandOn: boolean;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  weekly: Weekly;
  isOpenNow: boolean;
  deliveryTime: string;
  managedByZenvy: boolean;
  password: string;
  commissionType: 'percentage' | 'flat';
  commissionRate: string;
}

export type StepKey = 'basics' | 'location' | 'branding' | 'hours' | 'login' | 'commission' | 'review';
const STEP_META: Record<StepKey, { title: string; sub: string }> = {
  basics: { title: 'Basics', sub: 'Name, type, campus' },
  location: { title: 'Location & contact', sub: 'Address, map pin, WhatsApp' },
  branding: { title: 'Branding', sub: 'Cover photo, logo, colours' },
  hours: { title: 'Hours & delivery', sub: 'Weekly hours, delivery time' },
  login: { title: 'Partner login', sub: 'Restaurant app access' },
  commission: { title: 'Commission & payouts', sub: 'What Zenvy keeps' },
  review: { title: 'Review & publish', sub: 'Preview and go live' },
};

const DRAFT_KEY = 'zenvy.admin.storeWizard.v1';

const emptyState = (): WizardState => ({
  name: '', vendorType: 'RESTAURANT', campus: '', description: '', tags: [],
  location: '', zone: '', lat: '', lon: '', whatsapp: '',
  imageUrl: '', brandOn: false, logoUrl: '', primaryColor: '#E23744', secondaryColor: '#111111', accentColor: '#FFC72C',
  weekly: uniformWeekly('09:00', '22:00'), isOpenNow: true, deliveryTime: '30',
  managedByZenvy: false, password: '', commissionType: 'percentage', commissionRate: '10',
});

export function stateFromStore(s: Store): WizardState {
  const brand = readBrandTheme(s.brandTheme);
  return {
    name: s.name || '',
    vendorType: (s.vendorType || 'RESTAURANT').toUpperCase(),
    campus: s.campus || '',
    description: s.stallDescription || '',
    tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
    location: s.location || '',
    zone: s.zone || '',
    lat: s.lat != null ? String(s.lat) : '',
    lon: s.lon != null ? String(s.lon) : '',
    whatsapp: tenDigits(s.whatsappNumber),
    imageUrl: s.imageUrl || '',
    brandOn: !!brand,
    logoUrl: typeof brand?.logoUrl === 'string' ? brand.logoUrl : '',
    primaryColor: brand?.primaryColor || '#E23744',
    secondaryColor: brand?.secondaryColor || '#111111',
    accentColor: brand?.accentColor || '#FFC72C',
    weekly: weeklyFromStore(s.operatingHours),
    isOpenNow: s.isOpenNow !== false,
    deliveryTime: s.deliveryTime != null ? String(s.deliveryTime) : '',
    managedByZenvy: !!s.isOffline,
    password: '',
    commissionType: s.commissionType === 'flat' ? 'flat' : 'percentage',
    commissionRate: String(s.commissionRate ?? 10),
  };
}

const HEX = /^#[0-9a-f]{6}$/i;
type Errors = Partial<Record<keyof WizardState | 'coords', string>>;

function validateStep(step: StepKey, s: WizardState, mode: 'create' | 'edit'): Errors {
  const e: Errors = {};
  const local = isLocalVendorType(s.vendorType);
  if (step === 'basics') {
    if (!s.name.trim()) e.name = 'Give the store a name customers will recognise.';
    else if (s.name.trim().length > 120) e.name = 'Keep the name under 120 characters.';
    if (!s.vendorType) e.vendorType = 'Pick what kind of store this is.';
    if (s.description.length > 500) e.description = 'Keep the description under 500 characters.';
  }
  if (step === 'location') {
    if (!s.location.trim()) e.location = 'Add where the store is, e.g. "Food court, Block A".';
    const hasLat = s.lat.trim() !== ''; const hasLon = s.lon.trim() !== '';
    if (hasLat !== hasLon) e.coords = 'Enter both latitude and longitude, or leave both empty.';
    else if (hasLat && (!Number.isFinite(Number(s.lat)) || Math.abs(Number(s.lat)) > 90 || !Number.isFinite(Number(s.lon)) || Math.abs(Number(s.lon)) > 180)) e.coords = 'Latitude must be −90…90 and longitude −180…180.';
    if (s.whatsapp.trim() && !isValidIndianMobile(s.whatsapp)) e.whatsapp = 'Use a 10-digit Indian mobile number starting with 6–9.';
    if (local && !s.whatsapp.trim()) e.whatsapp = 'Local stalls are contacted on WhatsApp / call, so this number is required.';
  }
  if (step === 'branding' && s.brandOn) {
    if (!HEX.test(s.primaryColor) || !HEX.test(s.secondaryColor) || !HEX.test(s.accentColor)) e.primaryColor = 'Colours must be hex values like #E23744.';
  }
  if (step === 'hours') {
    const w = validateWeekly(s.weekly);
    if (w) e.weekly = w;
    if (!local && s.deliveryTime.trim() !== '') {
      const n = Number(s.deliveryTime);
      if (!Number.isInteger(n) || n < 5 || n > 240) e.deliveryTime = 'Whole minutes between 5 and 240, or leave empty to hide it.';
    }
  }
  if (step === 'login' && !local) {
    const pw = s.password.trim();
    if (pw && pw.length < 6) e.password = 'At least 6 characters (12+ recommended).';
    if (mode === 'create' && !s.managedByZenvy && !pw) e.password = 'Generate a password so the partner can sign in, or switch on "Managed by Zenvy".';
  }
  if (step === 'commission' && !local) {
    const n = Number(s.commissionRate);
    const max = s.commissionType === 'flat' ? 1000 : 100;
    if (s.commissionRate.trim() === '' || !Number.isFinite(n) || n < 0 || n > max) e.commissionRate = s.commissionType === 'flat' ? 'Between ₹0 and ₹1,000 per order.' : 'Between 0% and 100%.';
  }
  return e;
}

export function buildPayload(s: WizardState, existing: Store | null): Record<string, unknown> {
  const local = isLocalVendorType(s.vendorType);
  const prevBrand = readBrandTheme(existing?.brandTheme) || {};
  const body: Record<string, unknown> = {
    name: s.name.trim(),
    vendorType: s.vendorType,
    location: s.location.trim(),
    campus: s.campus.trim() || null,
    stallDescription: s.description.trim() || null,
    tags: s.tags,
    lat: s.lat.trim() === '' ? null : round6(Number(s.lat)),
    lon: s.lon.trim() === '' ? null : round6(Number(s.lon)),
    whatsappNumber: s.whatsapp.trim() ? tenDigits(s.whatsapp) : null,
    imageUrl: s.imageUrl.trim() || null,
    brandTheme: s.brandOn ? { ...prevBrand, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor, accentColor: s.accentColor, fontColor: (prevBrand.fontColor as string) || '#FFFFFF', logoUrl: s.logoUrl || undefined } : null,
    operatingHours: operatingHoursPayload(s.weekly),
    isOpenNow: s.isOpenNow,
    deliveryTime: local || s.deliveryTime.trim() === '' ? null : Number(s.deliveryTime),
    isOffline: local ? false : s.managedByZenvy,
    commissionType: s.commissionType,
    commissionRate: local ? Number(existing?.commissionRate ?? 0) : Number(s.commissionRate),
  };
  if (s.zone.trim()) body.zone = s.zone.trim();
  if (!local && s.password.trim()) body.password = s.password.trim();
  return body;
}

// ─── Wizard ──────────────────────────────────────────────────────────────────
export interface WizardResult { store: Store; password: string | null; published: boolean }

export function StoreWizard({ mode, initial, startStep, stores, onClose, onSaved, onOpenStore }: {
  mode: 'create' | 'edit';
  initial: Store | null;
  startStep?: StepKey;
  stores: Store[];
  onClose: () => void;
  onSaved: (result: WizardResult) => void;
  onOpenStore: (id: string, tab?: string) => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const [state, setState] = useState<WizardState>(() => (initial ? stateFromStore(initial) : emptyState()));
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>(startStep || 'basics');
  const [visited, setVisited] = useState<Set<StepKey>>(() => new Set(mode === 'edit' ? (Object.keys(STEP_META) as StepKey[]) : ['basics']));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState<null | 'draft' | 'publish' | 'save'>(null);
  const [saveError, setSaveError] = useState('');
  const [done, setDone] = useState<WizardResult | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const initialJson = useRef(JSON.stringify(initial ? stateFromStore(initial) : emptyState()));
  const mainRef = useRef<HTMLDivElement | null>(null);

  const local = isLocalVendorType(state.vendorType);
  const steps = useMemo<StepKey[]>(() => (local
    ? ['basics', 'location', 'branding', 'hours', 'review']
    : ['basics', 'location', 'branding', 'hours', 'login', 'commission', 'review']), [local]);
  const index = Math.max(0, steps.indexOf(step));
  const set = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }));
  const dirty = JSON.stringify(state) !== initialJson.current;

  // Restore / autosave the create draft (never the password).
  useEffect(() => {
    if (mode !== 'create') return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { state?: Partial<WizardState>; step?: StepKey; savedAt?: string };
      if (saved?.state && saved.state.name !== undefined) {
        setState({ ...emptyState(), ...saved.state, password: '' });
        if (saved.step && saved.step !== 'review') setStep(saved.step);
        setVisited(new Set(Object.keys(STEP_META) as StepKey[]));
        setRestoredAt(saved.savedAt || null);
      }
    } catch { /* storage unavailable */ }
  }, [mode]);
  useEffect(() => {
    if (mode !== 'create' || done) return;
    const t = setTimeout(() => {
      try {
        if (!dirty) return;
        const { password: _pw, ...rest } = state;
        void _pw;
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: rest, step, savedAt: new Date().toISOString() }));
      } catch { /* storage unavailable */ }
    }, 500);
    return () => clearTimeout(t);
  }, [state, step, mode, done, dirty]);
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [step]);

  const stepErrors = (k: StepKey) => validateStep(k, state, mode);
  const goto = (k: StepKey) => {
    setErrors({});
    setStep(k);
    setVisited(prev => new Set(prev).add(k));
  };
  const next = () => {
    const e = stepErrors(step);
    if (Object.keys(e).length) {
      setErrors(e);
      setTimeout(() => mainRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')?.focus?.(), 0);
      return;
    }
    goto(steps[Math.min(index + 1, steps.length - 1)]);
  };
  const back = () => goto(steps[Math.max(index - 1, 0)]);

  const allIssues = useMemo(() => steps.filter(k => k !== 'review').map(k => ({ step: k, errors: validateStep(k, state, mode) })).filter(x => Object.keys(x.errors).length), [steps, state, mode]);

  const save = async (kind: 'draft' | 'publish' | 'save') => {
    if (saving) return;
    if (allIssues.length) {
      goto(allIssues[0].step);
      setErrors(allIssues[0].errors);
      return;
    }
    setSaving(kind);
    setSaveError('');
    try {
      const body = buildPayload(state, initial);
      if (kind !== 'save') body.isActive = kind === 'publish';
      const path = initial ? `/api/admin/restaurants/${storeId(initial)}` : '/api/admin/restaurants';
      const saved = await adminRequest<Store>(path, { method: 'POST', body: JSON.stringify(body) });
      const sentWeekly = !isUniform(state.weekly);
      if (sentWeekly && !(saved?.operatingHours && saved.operatingHours.weekly)) {
        const w = primaryWindow(state.weekly);
        toast.info(`Saved. The server keeps one daily window for now (${w.start}–${w.end}); per-day hours apply after the server update.`);
      }
      const result: WizardResult = { store: saved, password: body.password ? String(body.password) : null, published: kind === 'publish' || (kind === 'save' && !!initial?.isActive) };
      if (mode === 'create') clearDraft();
      onSaved(result);
      if (mode === 'create' || result.password) setDone(result);
      else onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the store.');
    } finally {
      setSaving(null);
    }
  };

  const requestClose = () => {
    if (done) return onClose();
    if (mode === 'edit' && dirty) return setConfirmClose(true);
    if (mode === 'create' && dirty) toast.info('Draft kept on this device. Click "Add store" to continue where you left off.');
    onClose();
  };

  const preview = (
    <StorePreviewCard data={{
      name: state.name, imageUrl: state.imageUrl, tags: state.tags, description: state.description,
      deliveryTime: !local && state.deliveryTime ? Number(state.deliveryTime) || null : null,
      isOpen: state.isOpenNow && isOpenByHours(state.weekly), opensAt: primaryWindow(state.weekly).start,
      rating: initial?.rating ?? null, isFeatured: initial?.isFeatured, featuredBadge: initial?.featuredBadge, promoOffer: initial?.promoOffer,
      isLocal: local, whatsappNumber: state.whatsapp,
      brand: state.brandOn ? { primaryColor: state.primaryColor, secondaryColor: state.secondaryColor, accentColor: state.accentColor, logoUrl: state.logoUrl } : null,
    }} />
  );

  return (
    <Drawer onClose={requestClose} labelledBy={titleId} width="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">{mode === 'create' ? 'New partner' : 'Edit partner'}</p>
          <h2 id={titleId} className="truncate text-lg font-black">{done ? 'All set' : mode === 'create' ? (state.name.trim() || 'Add a store') : `Edit ${initial?.name}`}</h2>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'create' && !done && dirty && <span className="hidden text-xs text-gray-500 sm:inline">Draft autosaved on this device</span>}
          <button type="button" onClick={requestClose} aria-label="Close" className={cx('rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white', FOCUS_RING)}>✕</button>
        </div>
      </div>

      {done ? (
        <SuccessPanel result={done} mode={mode} onOpenStore={onOpenStore} onClose={onClose} />
      ) : (
        <>
          {/* Mobile progress */}
          <div className="border-b border-white/5 px-5 py-3 lg:hidden">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Step {index + 1} of {steps.length} · <span className="font-semibold text-white">{STEP_META[step].title}</span></span>
              <span>{Math.round(((index + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label="Setup progress">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Step rail */}
            <nav aria-label="Setup steps" className="hidden w-60 shrink-0 overflow-y-auto border-r border-white/5 p-4 lg:block">
              <ol className="space-y-1">
                {steps.map((k, i) => {
                  const current = k === step;
                  const reachable = visited.has(k) || i <= index;
                  const hasIssue = visited.has(k) && k !== step && Object.keys(validateStep(k, state, mode)).length > 0;
                  const complete = visited.has(k) && !hasIssue && i < index;
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        disabled={!reachable}
                        aria-current={current ? 'step' : undefined}
                        onClick={() => goto(k)}
                        className={cx('flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40', current ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]', FOCUS_RING)}
                      >
                        <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                          current ? 'bg-emerald-500 text-black' : hasIssue ? 'bg-amber-500/20 text-amber-300' : complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-gray-400')}>
                          {hasIssue ? '!' : complete ? '✓' : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={cx('block text-sm font-semibold', current ? 'text-white' : 'text-gray-300')}>{STEP_META[k].title}</span>
                          <span className="block truncate text-[11px] text-gray-500">{STEP_META[k].sub}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {local && <p className="mt-4 px-2 text-[11px] leading-relaxed text-gray-500">Partner login and commission are skipped: local stalls take orders themselves.</p>}
            </nav>

            {/* Step body */}
            <div ref={mainRef} className="min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              {restoredAt && step !== 'review' && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-sm text-sky-100">
                  <span>Restored your unsaved draft from {timeAgo(restoredAt)}. Passwords are never stored, so generate it again.</span>
                  <button type="button" className="font-semibold underline" onClick={() => { clearDraft(); setState(emptyState()); setRestoredAt(null); goto('basics'); }}>Start over</button>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-black">{STEP_META[step].title}</h3>
                <p className="mt-1 text-sm text-gray-400">{STEP_HELP[step]}</p>
              </div>
              {step === 'basics' && <BasicsStep s={state} set={set} errors={errors} stores={stores} editingId={initial ? storeId(initial) : null} />}
              {step === 'location' && <LocationStep s={state} set={set} errors={errors} stores={stores} />}
              {step === 'branding' && <BrandingStep s={state} set={set} errors={errors} />}
              {step === 'hours' && <HoursStep s={state} set={set} errors={errors} />}
              {step === 'login' && <LoginStep s={state} set={set} errors={errors} mode={mode} initial={initial} />}
              {step === 'commission' && <CommissionStep s={state} set={set} errors={errors} />}
              {step === 'review' && <ReviewStep s={state} issues={allIssues} goto={goto} mode={mode} initial={initial} preview={preview} />}
              {saveError && <div className="mt-5"><Callout tone="red" title="Not saved">{saveError}</Callout></div>}
            </div>

            {/* Live preview */}
            {step !== 'review' && (
              <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-white/5 p-5 xl:block" aria-label="Live preview">
                {preview}
              </aside>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
            <Button variant="ghost" onClick={index === 0 ? requestClose : back}>{index === 0 ? 'Cancel' : '← Back'}</Button>
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'edit' && (
                <Button variant={step === 'review' ? 'primary' : 'secondary'} loading={saving === 'save'} disabled={!dirty || !!saving} onClick={() => save('save')}>
                  {dirty ? 'Save changes' : 'No changes'}
                </Button>
              )}
              {mode === 'create' && step === 'review' && (
                <>
                  <Button loading={saving === 'draft'} disabled={!!saving} onClick={() => save('draft')} title="Hidden from customers until you publish">Save as draft</Button>
                  <Button variant="primary" loading={saving === 'publish'} disabled={!!saving} onClick={() => save('publish')}>Publish now</Button>
                </>
              )}
              {step !== 'review' && <Button variant={mode === 'create' ? 'primary' : 'secondary'} onClick={next}>{index === steps.length - 2 ? 'Review →' : 'Next →'}</Button>}
            </div>
          </div>
        </>
      )}
      {confirmClose && (
        <ConfirmModal
          title="Discard your changes?"
          body={<p>You edited {initial?.name}. Closing now throws those edits away.</p>}
          actionLabel="Discard changes"
          tone="danger"
          onClose={() => setConfirmClose(false)}
          onConfirm={() => { setConfirmClose(false); onClose(); }}
        />
      )}
    </Drawer>
  );
}

const STEP_HELP: Record<StepKey, string> = {
  basics: 'Who is this partner? The type decides how customers buy from them.',
  location: 'Where riders pick up, and how customers or Zenvy reach the store.',
  branding: 'Photos sell. A clear cover photo is the single biggest boost to orders.',
  hours: 'When customers can order. Outside these hours the app shows "Closed — opens at …".',
  login: 'How the partner signs in to the Zenvy restaurant app to accept orders.',
  commission: 'What Zenvy keeps from each order. Payouts are settled from the Finance page.',
  review: 'Check everything once. Save as a draft to add the menu first, or publish straight away.',
};

type StepProps = { s: WizardState; set: (p: Partial<WizardState>) => void; errors: Errors };

// ─── Steps ───────────────────────────────────────────────────────────────────
function BasicsStep({ s, set, errors, stores, editingId }: StepProps & { stores: Store[]; editingId: string | null }) {
  const campuses = useMemo(() => uniq(stores.map(x => x.campus).filter(Boolean) as string[]), [stores]);
  const tagSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    stores.filter(x => (x.vendorType || 'RESTAURANT').toUpperCase() === s.vendorType).forEach(x => (x.tags || []).forEach(t => counts.set(String(t), (counts.get(String(t)) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [stores, s.vendorType]);
  const dupe = stores.find(x => storeId(x) !== editingId && x.name.trim().toLowerCase() === s.name.trim().toLowerCase() && s.name.trim());
  const groups: VendorGroup[] = ['Food', 'Campus', 'Shops', 'Services'];
  const known = VENDOR_TYPES.some(v => v.value === s.vendorType);
  return (
    <div className="space-y-6">
      <Field label="Store name" required error={errors.name} help={dupe ? undefined : 'Exactly as on the signboard. Customers search by this.'}>
        {({ id, msgId, invalid }) => (
          <input id={id} data-autofocus aria-describedby={msgId} aria-invalid={invalid} className={INPUT} maxLength={120} value={s.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Sri Sai Tiffins" />
        )}
      </Field>
      {dupe && <Callout tone="amber">Another store is already called “{dupe.name}”. Partners can sign in with the store name, so use a distinct name (e.g. add the block or campus).</Callout>}

      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Store type <span className="text-red-400" aria-hidden>*</span></legend>
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g}>
              <p className="mb-1.5 text-[11px] font-semibold text-gray-500">{g}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={`${g} store types`}>
                {VENDOR_TYPES.filter(v => v.group === g).map(v => {
                  const selected = s.vendorType === v.value;
                  return (
                    <button
                      key={v.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => set({ vendorType: v.value })}
                      className={cx('rounded-xl border p-3 text-left transition-colors', selected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.03]', FOCUS_RING)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">{v.label}</span>
                        <span aria-hidden className={cx('h-4 w-4 shrink-0 rounded-full border-2', selected ? 'border-emerald-400 bg-emerald-400 shadow-[inset_0_0_0_2px_#0b0d12]' : 'border-white/25')} />
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-gray-400">{v.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!known && <Callout tone="amber">This store uses the type “{s.vendorType}”, which is not in the standard list. Pick one above to fix it, or leave it as is.</Callout>}
        </div>
      </fieldset>

      {isLocalVendorType(s.vendorType) && (
        <Callout tone="amber" title="Display-only listing">Zenvy shows the stall and its prices. Customers order directly by WhatsApp or call and the stall delivers itself. Zenvy takes no order, payment or rider.</Callout>
      )}
      {isBookingOnlyStore(s.vendorType) && (
        <Callout tone="sky" title="Booking-only service">Customers book this service from the app; it is never added to the basket.</Callout>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Campus" optional help="Shown to students of this campus first. Pick an existing one to keep names consistent.">
          {({ id, msgId }) => (
            <>
              <input id={id} aria-describedby={msgId} list="wizard-campuses" className={INPUT} value={s.campus} onChange={e => set({ campus: e.target.value })} placeholder="e.g. SRM" />
              <datalist id="wizard-campuses">{campuses.map(c => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Cuisines / what it sells" optional help="Shown under the name on the store card (first 3). Press Enter after each.">
          {({ id, msgId }) => <TagInput id={id} describedBy={msgId} value={s.tags} onChange={tags => set({ tags })} suggestions={tagSuggestions} placeholder="e.g. Biryani, South Indian" />}
        </Field>
      </div>
      <Field label="Short description" optional error={errors.description} aside={<span className="text-[11px] text-gray-600">{s.description.length}/500</span>} help="One or two lines about the store. Shown on the store page.">
        {({ id, msgId, invalid }) => (
          <textarea id={id} aria-describedby={msgId} aria-invalid={invalid} className={cx(INPUT, 'h-20 resize-none')} maxLength={500} value={s.description} onChange={e => set({ description: e.target.value })} placeholder="e.g. Home-style Andhra meals and evening tiffins since 2012." />
        )}
      </Field>
    </div>
  );
}

function LocationStep({ s, set, errors, stores }: StepProps & { stores: Store[] }) {
  const [link, setLink] = useState('');
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const zones = useMemo(() => uniq(stores.map(x => x.zone).filter(Boolean) as string[]), [stores]);
  const locations = useMemo(() => uniq(stores.map(x => x.location).filter(Boolean)), [stores]);
  const readLink = () => {
    const r = parseMapLink(link);
    if ('error' in r) return setLinkMsg({ ok: false, text: r.error });
    set({ lat: String(r.lat), lon: String(r.lon) });
    setLinkMsg({ ok: true, text: `Pin set to ${r.lat}, ${r.lon}.` });
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) return setLinkMsg({ ok: false, text: 'This browser cannot share its location.' });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocating(false); set({ lat: String(round6(pos.coords.latitude)), lon: String(round6(pos.coords.longitude)) }); setLinkMsg({ ok: true, text: `Pin set to your current location (±${Math.round(pos.coords.accuracy)} m). Only use this while standing at the store.` }); },
      err => { setLocating(false); setLinkMsg({ ok: false, text: err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.' }); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const hasPin = s.lat.trim() !== '' && s.lon.trim() !== '' && !errors.coords;
  const wa = tenDigits(s.whatsapp);
  return (
    <div className="space-y-6">
      <Field label="Address / landmark" required error={errors.location} help="What a rider needs to find the counter, e.g. “Food court, Block A, ground floor”.">
        {({ id, msgId, invalid }) => (
          <>
            <input id={id} data-autofocus aria-describedby={msgId} aria-invalid={invalid} list="wizard-locations" className={INPUT} value={s.location} onChange={e => set({ location: e.target.value })} />
            <datalist id="wizard-locations">{locations.map(c => <option key={c} value={c} />)}</datalist>
          </>
        )}
      </Field>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Campus" optional help="Same as in Basics; change here if needed.">
          {({ id, msgId }) => <input id={id} aria-describedby={msgId} className={INPUT} value={s.campus} onChange={e => set({ campus: e.target.value })} />}
        </Field>
        <Field label="Delivery zone" optional help="Used for rider dispatch. Leave empty for the default zone.">
          {({ id, msgId }) => (
            <>
              <input id={id} aria-describedby={msgId} list="wizard-zones" className={INPUT} value={s.zone} onChange={e => set({ zone: e.target.value })} placeholder="Amaravathi_Central" />
              <datalist id="wizard-zones">{zones.map(z => <option key={z} value={z} />)}</datalist>
            </>
          )}
        </Field>
      </div>

      <section className="space-y-3 rounded-xl border border-white/10 p-4" aria-labelledby="pin-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 id="pin-title" className="text-sm font-bold">Map pin <span className="font-normal text-gray-500">(optional)</span></h4>
            <p className="text-xs text-gray-500">Gives riders exact pickup directions and distance.</p>
          </div>
          {hasPin && <a href={mapsUrl(Number(s.lat), Number(s.lon))} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-300 hover:underline">Check on Google Maps ↗</a>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Paste a Google Maps link or coordinates" className={cx(INPUT, 'min-w-[220px] flex-1')} value={link} onChange={e => { setLink(e.target.value); setLinkMsg(null); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); readLink(); } }} placeholder="Paste a Google Maps link, or 16.4632, 80.5064" />
          <Button onClick={readLink} disabled={!link.trim()}>Use map link</Button>
          <Button variant="ghost" onClick={useMyLocation} loading={locating}>Use my location</Button>
        </div>
        {linkMsg && <p role={linkMsg.ok ? 'status' : 'alert'} className={cx('text-xs', linkMsg.ok ? 'text-emerald-300' : 'text-red-300')}>{linkMsg.text}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude" error={errors.coords}>
            {({ id, msgId, invalid }) => <input id={id} aria-describedby={msgId} aria-invalid={invalid} inputMode="decimal" className={INPUT} value={s.lat} onChange={e => set({ lat: e.target.value })} placeholder="16.4632" />}
          </Field>
          <Field label="Longitude">
            {({ id }) => <input id={id} inputMode="decimal" className={INPUT} value={s.lon} onChange={e => set({ lon: e.target.value })} placeholder="80.5064" />}
          </Field>
        </div>
      </section>

      <Field
        label="WhatsApp / phone"
        required={isLocalVendorType(s.vendorType)}
        optional={!isLocalVendorType(s.vendorType)}
        error={errors.whatsapp}
        help={isLocalVendorType(s.vendorType) ? 'Customers tap WhatsApp or Call on this number to order.' : 'Zenvy support and riders use it to reach the store. Not shown to customers for regular stores.'}
        aside={wa.length === 10 && isValidIndianMobile(wa) ? <a className="text-[11px] font-semibold text-emerald-300 hover:underline" href={`https://wa.me/91${wa}`} target="_blank" rel="noreferrer">Test on WhatsApp ↗</a> : null}
      >
        {({ id, msgId, invalid }) => (
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-white/10 bg-white/5 px-3 text-sm text-gray-400">+91</span>
            <input id={id} aria-describedby={msgId} aria-invalid={invalid} inputMode="tel" autoComplete="off" className={cx(INPUT, 'rounded-l-none')} value={s.whatsapp} onChange={e => set({ whatsapp: e.target.value.replace(/[^\d+\s-]/g, '') })} placeholder="98765 43210" />
          </div>
        )}
      </Field>
    </div>
  );
}

function BrandingStep({ s, set, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Cover photo <span className="normal-case tracking-normal text-gray-600">recommended</span></p>
        <ImagePicker value={s.imageUrl} onChange={imageUrl => set({ imageUrl })} preset="cover" label="Cover photo" hint="Food or storefront, landscape, bright. JPEG / PNG / WEBP." />
        <p className="mt-2 text-xs text-gray-500">Used on the Home card, the store page header and Home banners. Avoid text-heavy menus or logos only.</p>
      </div>
      <section className="space-y-4 rounded-xl border border-white/10 p-4">
        <Toggle
          checked={s.brandOn}
          onChange={brandOn => set({ brandOn })}
          label="Use a brand kit (logo + colours)"
          description="For chains and well-known brands. The store page in the app switches to the brand's colours and shows the logo. Leave off for a standard Zenvy-styled page."
        />
        {s.brandOn && (
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Logo</p>
              <ImagePicker value={s.logoUrl} onChange={logoUrl => set({ logoUrl })} preset="logo" label="Logo" hint="Square, transparent PNG works best." aspect="aspect-square" />
            </div>
            <div className="space-y-4">
              {([['primaryColor', 'Primary'], ['secondaryColor', 'Secondary'], ['accentColor', 'Accent (buttons)']] as const).map(([key, label]) => (
                <Field key={key} label={label} error={key === 'primaryColor' ? errors.primaryColor : undefined}>
                  {({ id, msgId, invalid }) => (
                    <div className="flex items-center gap-2">
                      <input type="color" aria-label={`${label} colour picker`} value={HEX.test(s[key]) ? s[key] : '#000000'} onChange={e => set({ [key]: e.target.value } as Partial<WizardState>)} className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" />
                      <input id={id} aria-describedby={msgId} aria-invalid={invalid} className={cx(INPUT, 'max-w-[140px] font-mono uppercase')} value={s[key]} onChange={e => set({ [key]: e.target.value } as Partial<WizardState>)} />
                    </div>
                  )}
                </Field>
              ))}
              <div className="h-12 rounded-lg" style={{ background: `linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor})` }} aria-hidden />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function HoursStep({ s, set, errors }: StepProps) {
  const local = isLocalVendorType(s.vendorType);
  const openNow = isOpenByHours(s.weekly);
  return (
    <div className="space-y-6">
      <WeeklyHoursEditor value={s.weekly} onChange={weekly => set({ weekly })} error={errors.weekly} />
      <section className="space-y-4 rounded-xl border border-white/10 p-4">
        <Toggle
          checked={s.isOpenNow}
          onChange={isOpenNow => set({ isOpenNow })}
          label="Accepting orders"
          description={s.isOpenNow
            ? `On: the store follows its hours (by these hours it is ${openNow ? 'open' : 'closed'} right now). The partner can also pause from their app.`
            : 'Off: the store shows as closed even during its hours, until switched back on.'}
        />
      </section>
      {!local && (
        <Field label="Typical delivery time" optional error={errors.deliveryTime} help="Prep + ride, in minutes. Shown on the store card. Leave empty to hide (better than a wrong promise).">
          {({ id, msgId, invalid }) => (
            <div className="flex items-center gap-3">
              <input id={id} aria-describedby={msgId} aria-invalid={invalid} inputMode="numeric" className={cx(INPUT, 'max-w-[120px]')} value={s.deliveryTime} onChange={e => set({ deliveryTime: e.target.value.replace(/\D/g, '') })} />
              <span className="text-sm text-gray-400">minutes</span>
              <div className="flex gap-1.5">
                {['20', '30', '45'].map(m => (
                  <button key={m} type="button" onClick={() => set({ deliveryTime: m })} className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold', s.deliveryTime === m ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-gray-400 hover:text-white', FOCUS_RING)}>{m}</button>
                ))}
              </div>
            </div>
          )}
        </Field>
      )}
    </div>
  );
}

function LoginStep({ s, set, errors, mode, initial }: StepProps & { mode: 'create' | 'edit'; initial: Store | null }) {
  const [show, setShow] = useState(true);
  const strength = passwordStrength(s.password);
  const id = initial ? storeId(initial) : null;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 p-4">
        <Toggle
          checked={s.managedByZenvy}
          onChange={managedByZenvy => set({ managedByZenvy })}
          label="Managed by Zenvy (no partner app)"
          description="For shops without a smartphone. Orders skip the kitchen-accept step and the Zenvy team / rider handles them. You can still set a password later."
        />
      </section>

      {!s.managedByZenvy || s.password ? (
        <section className="space-y-4">
          <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Partner signs in with</p>
              <p className="mt-1 text-sm text-white">{id ? <>Store ID <code className="rounded bg-white/5 px-1 text-xs text-emerald-300">{id}</code></> : 'The Store ID (shown after you create the store)'}</p>
              <p className="mt-0.5 text-xs text-gray-500">or the exact store name: “{s.name.trim() || '…'}”</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Partner contact</p>
              <p className="mt-1 text-sm text-white">{s.whatsapp ? `+91 ${formatWhatsapp(s.whatsapp)}` : 'Not set (Location step)'}</p>
              <p className="mt-0.5 text-xs text-gray-500">Phone-number login is not available yet; share the ID + password with this number.</p>
            </div>
          </div>
          <Field
            label={mode === 'edit' ? 'Reset password' : 'Password'}
            required={mode === 'create' && !s.managedByZenvy}
            optional={mode === 'edit'}
            error={errors.password}
            help={mode === 'edit' ? 'Leave empty to keep the current password. A new one works immediately; the old one stops working. Apps already signed in stay signed in.' : 'Generate a strong one. It is shown once after saving so you can share it; Zenvy only stores a hash.'}
            aside={s.password ? <span className={cx('text-[11px] font-semibold', strength.score >= 3 ? 'text-emerald-300' : strength.score === 2 ? 'text-amber-300' : 'text-red-300')}>{strength.label}</span> : null}
          >
            {({ id: fid, msgId, invalid }) => (
              <div className="flex flex-wrap gap-2">
                <input id={fid} aria-describedby={msgId} aria-invalid={invalid} type={show ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} className={cx(INPUT, 'min-w-[200px] flex-1 font-mono')} value={s.password} onChange={e => set({ password: e.target.value })} />
                <Button onClick={() => set({ password: generatePassword(12) })}>Generate strong</Button>
                <Button variant="ghost" onClick={() => setShow(v => !v)} aria-pressed={!show}>{show ? 'Hide' : 'Show'}</Button>
                {s.password && <CopyButton text={s.password} size="md" />}
              </div>
            )}
          </Field>
        </section>
      ) : (
        <Callout tone="sky">No partner login will be created. Switch the toggle off (or edit the store later) to give the partner app access.</Callout>
      )}
    </div>
  );
}

function CommissionStep({ s, set, errors }: StepProps) {
  const [sample, setSample] = useState('400');
  const rate = Number(s.commissionRate) || 0;
  const order = Math.max(0, Number(sample) || 0);
  const commission = s.commissionType === 'flat' ? Math.min(rate, order) : order * rate / 100;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Commission model</p>
        <Segmented label="Commission model" value={s.commissionType} onChange={commissionType => set({ commissionType })} options={[
          { value: 'percentage', label: '% of order value' },
          { value: 'flat', label: '₹ fixed per order' },
        ]} />
      </div>
      <Field label={s.commissionType === 'flat' ? 'Amount per order (₹)' : 'Commission (%)'} required error={errors.commissionRate} help="Charged on the item subtotal only. The rider fee and Zenvy coupons never reduce the partner's share.">
        {({ id, msgId, invalid }) => (
          <div className="flex flex-wrap items-center gap-2">
            <input id={id} aria-describedby={msgId} aria-invalid={invalid} inputMode="decimal" className={cx(INPUT, 'max-w-[140px]')} value={s.commissionRate} onChange={e => set({ commissionRate: e.target.value })} />
            {(s.commissionType === 'flat' ? ['0', '10', '20'] : ['0', '10', '15', '20']).map(v => (
              <button key={v} type="button" onClick={() => set({ commissionRate: v })} className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold', s.commissionRate === v ? 'border-emerald-500/50 text-emerald-300' : 'border-white/10 text-gray-400 hover:text-white', FOCUS_RING)}>
                {s.commissionType === 'flat' ? `₹${v}` : `${v}%`}
              </button>
            ))}
          </div>
        )}
      </Field>
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4" aria-label="Payout example">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
          On an order of ₹
          <input aria-label="Example order value" inputMode="numeric" className={cx(INPUT, 'w-24 py-1.5')} value={sample} onChange={e => setSample(e.target.value.replace(/\D/g, ''))} />
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white/[0.03] p-3"><dt className="text-xs text-gray-500">Customer pays (items)</dt><dd className="mt-1 text-lg font-black">{formatINR(order)}</dd></div>
          <div className="rounded-lg bg-white/[0.03] p-3"><dt className="text-xs text-gray-500">Zenvy keeps</dt><dd className="mt-1 text-lg font-black text-amber-300">{formatINR(commission)}</dd></div>
          <div className="rounded-lg bg-emerald-500/10 p-3"><dt className="text-xs text-emerald-200/70">Partner receives</dt><dd className="mt-1 text-lg font-black text-emerald-300">{formatINR(order - commission)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">Payments are Cash on Delivery or Zenvy Wallet. Delivered orders are settled to the partner from Finance → Payouts.</p>
      </section>
    </div>
  );
}

function ReviewStep({ s, issues, goto, mode, initial, preview }: {
  s: WizardState; issues: { step: StepKey; errors: Errors }[]; goto: (k: StepKey) => void; mode: 'create' | 'edit'; initial: Store | null; preview: ReactNode;
}) {
  const local = isLocalVendorType(s.vendorType);
  const checks: { ok: boolean; text: string; step: StepKey; optional?: boolean }[] = [
    { ok: !!s.imageUrl, text: 'Cover photo added', step: 'branding', optional: true },
    { ok: s.tags.length > 0, text: 'Cuisines / categories tagged', step: 'basics', optional: true },
    { ok: !!s.whatsapp, text: 'Contact number', step: 'location', optional: !local },
    { ok: !!s.lat && !!s.lon, text: 'Map pin for riders', step: 'location', optional: true },
    ...(local ? [] : [{ ok: s.managedByZenvy || !!s.password || mode === 'edit', text: 'Partner can sign in (or managed by Zenvy)', step: 'login' as StepKey }]),
  ];
  const rows: { step: StepKey; items: [string, ReactNode][] }[] = [
    { step: 'basics', items: [['Name', s.name || '—'], ['Type', vendorLabel(s.vendorType)], ['Campus', s.campus || '—'], ['Tags', s.tags.join(', ') || '—']] },
    { step: 'location', items: [['Address', s.location || '—'], ['Zone', s.zone || 'Default'], ['Map pin', s.lat && s.lon ? `${s.lat}, ${s.lon}` : 'Not set'], ['WhatsApp', s.whatsapp ? `+91 ${formatWhatsapp(s.whatsapp)}` : '—']] },
    { step: 'branding', items: [['Cover photo', s.imageUrl ? 'Added' : 'Missing'], ['Brand kit', s.brandOn ? `On${s.logoUrl ? ' with logo' : ''}` : 'Off']] },
    { step: 'hours', items: [['Hours', summarizeWeekly(s.weekly)], ['Accepting orders', s.isOpenNow ? 'Yes' : 'Paused'], ...(local ? [] : [['Delivery time', s.deliveryTime ? `${s.deliveryTime} min` : 'Hidden'] as [string, ReactNode]])] },
    ...(local ? [] : [
      { step: 'login' as StepKey, items: [['Mode', s.managedByZenvy ? 'Managed by Zenvy' : 'Partner app'], ['Password', s.password ? 'Will be set (shown once after saving)' : mode === 'edit' ? 'Unchanged' : 'Not set']] as [string, ReactNode][] },
      { step: 'commission' as StepKey, items: [['Commission', s.commissionType === 'flat' ? `₹${s.commissionRate} per order` : `${s.commissionRate}% of order`]] as [string, ReactNode][] },
    ]),
  ];
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        {issues.length > 0 && (
          <Callout tone="red" title="Fix these before saving">
            <ul className="mt-1 space-y-1">
              {issues.map(i => Object.values(i.errors).map((msg, n) => (
                <li key={`${i.step}${n}`}><button type="button" className="text-left underline underline-offset-2" onClick={() => goto(i.step)}>{STEP_META[i.step].title}: {msg}</button></li>
              )))}
            </ul>
          </Callout>
        )}
        <section aria-label="Readiness" className="rounded-xl border border-white/10 p-4">
          <h4 className="mb-3 text-sm font-bold">Readiness</h4>
          <ul className="space-y-2">
            {checks.map(c => (
              <li key={c.text} className="flex items-center gap-3 text-sm">
                <span aria-hidden className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black', c.ok ? 'bg-emerald-500/20 text-emerald-300' : c.optional ? 'bg-white/10 text-gray-400' : 'bg-amber-500/20 text-amber-300')}>{c.ok ? '✓' : c.optional ? '–' : '!'}</span>
                <span className={c.ok ? 'text-gray-200' : 'text-gray-400'}>{c.text}{!c.ok && c.optional ? ' (optional)' : ''}</span>
                {!c.ok && <button type="button" onClick={() => goto(c.step)} className="ml-auto text-xs font-semibold text-emerald-300 hover:underline">Add</button>}
              </li>
            ))}
            {mode === 'create' && (
              <li className="flex items-center gap-3 text-sm">
                <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-gray-400">→</span>
                <span className="text-gray-400">Menu: add products right after saving (one by one or paste a CSV).</span>
              </li>
            )}
          </ul>
        </section>
        {rows.map(r => (
          <section key={r.step} className="rounded-xl border border-white/10">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
              <h4 className="text-sm font-bold">{STEP_META[r.step].title}</h4>
              <button type="button" onClick={() => goto(r.step)} className={cx('rounded-md px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10', FOCUS_RING)}>Edit</button>
            </div>
            <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
              {r.items.map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-xs text-gray-500">{k}</dt><dd className="truncate text-gray-200">{v}</dd></div>
              ))}
            </dl>
          </section>
        ))}
        {mode === 'create' ? (
          <Callout tone="sky"><b>Save as draft</b> keeps the store hidden while you add the menu. <b>Publish now</b> makes it visible to customers immediately{local ? ' as a display-only stall' : ' and it starts taking orders during its hours'}.</Callout>
        ) : (
          <p className="text-xs text-gray-500">Saving keeps the store {initial?.isActive ? 'live' : 'hidden'}; switch it on or off from the store list or the store page.</p>
        )}
      </div>
      <div className="lg:sticky lg:top-0">{preview}</div>
    </div>
  );
}

function SuccessPanel({ result, mode, onOpenStore, onClose }: { result: WizardResult; mode: 'create' | 'edit'; onOpenStore: (id: string, tab?: string) => void; onClose: () => void }) {
  const id = storeId(result.store);
  const [ack, setAck] = useState(!result.password);
  const loginText = `Zenvy partner app login\nStore: ${result.store.name}\nStore ID: ${id}${result.password ? `\nPassword: ${result.password}` : ''}\nOpen the Zenvy Restaurant app and sign in with the Store ID and password.`;
  return (
    <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div aria-hidden className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">✓</div>
          <h3 className="text-2xl font-black">{mode === 'create' ? `${result.store.name} is ${result.published ? 'live' : 'saved as a draft'}` : 'Changes saved'}</h3>
          <p className="mt-2 text-sm text-gray-400">
            {mode === 'create'
              ? result.published ? 'Customers can see it now. Add the menu so they can order.' : 'It is hidden from customers. Add the menu, then publish from the store page.'
              : 'The new password is active now.'}
          </p>
        </div>
        {(result.password || mode === 'create') && !isLocalVendorType(result.store.vendorType) && (
          <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4" aria-labelledby="creds-title">
            <div className="flex items-center justify-between gap-2">
              <h4 id="creds-title" className="font-bold text-amber-100">Partner login details</h4>
              <Chip tone="amber">{result.password ? 'Shown once' : 'No password set'}</Chip>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2"><dt className="w-24 text-gray-400">Store ID</dt><dd className="flex-1"><code className="select-all break-all text-emerald-300">{id}</code></dd><CopyButton text={id} /></div>
              {result.password && <div className="flex flex-wrap items-center gap-2"><dt className="w-24 text-gray-400">Password</dt><dd className="flex-1"><code className="select-all font-mono text-white">{result.password}</code></dd><CopyButton text={result.password} /></div>}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
              <CopyButton text={loginText} label="Copy message for the partner" variant="amber" size="md" />
              {result.store.whatsappNumber && <a className="text-xs font-semibold text-emerald-300 hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/${result.store.whatsappNumber}?text=${encodeURIComponent(loginText)}`}>Send on WhatsApp ↗</a>}
            </div>
            {result.password && (
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
                I have saved or shared the password. It cannot be shown again (only reset).
              </label>
            )}
          </section>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {mode === 'create' && <Button variant="primary" disabled={!ack} onClick={() => onOpenStore(id, 'menu')}>Add menu items →</Button>}
          <Button disabled={!ack} onClick={() => (mode === 'create' ? onOpenStore(id, 'overview') : onClose())}>{mode === 'create' ? 'Open store page' : 'Done'}</Button>
          {mode === 'create' && <Button variant="ghost" disabled={!ack} onClick={onClose}>Back to all stores</Button>}
        </div>
      </div>
    </div>
  );
}

const uniq = (list: string[]) => Array.from(new Set(list.map(s => s.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
