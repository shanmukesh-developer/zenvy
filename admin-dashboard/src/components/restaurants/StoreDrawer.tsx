"use client";
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Product, STATUS_META, Store, adminRequest, formatINR, formatTime, formatWhatsapp, isLocalVendorType, readBrandTheme,
  storeId, storeStatus, vendorLabel,
} from '@/app/restaurants/catalogue';
import { useLiveSync } from '@/lib/useLiveSync';
import {
  Weekly, generatePassword, isUniform, mapsUrl, operatingHoursPayload, passwordStrength, primaryWindow, summarizeWeekly,
  timeAgo, validateWeekly, weeklyFromStore,
} from './helpers';
import { WeeklyHoursEditor } from './inputs';
import { MenuManager } from './MenuManager';
import { StorePreviewCard } from './StorePreviewCard';
import { StepKey } from './StoreWizard';
import { hasStoreBanner, patchStore, removeStoreBanner, upsertStoreBanner } from './storeActions';
import { StatsCoverage, StoreOrder, StoreStats, useStorePayout } from './useStoreStats';
import {
  Button, Callout, Chip, ConfirmModal, CopyButton, Drawer, EmptyState, Field, INPUT, MenuButton, Skeleton, Tabs, Thumb, Toggle,
  cx, useToast,
} from './ui';

export type DrawerTab = 'overview' | 'menu' | 'hours' | 'login' | 'promote' | 'activity';

const STATUS_TONE = { live: 'green', closed: 'amber', draft: 'slate', inactive: 'red' } as const;

export function StoreDrawer({ store, tab, onTab, onClose, onEdit, onChanged, onToggleActive, onToggleOpen, onDuplicate, onDelete, stats, orders, coverage, busy }: {
  store: Store;
  tab: DrawerTab;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
  onEdit: (step?: StepKey) => void;
  onChanged: (s: Store) => void;
  onToggleActive: () => void;
  onToggleOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  stats: StoreStats;
  orders: StoreOrder[];
  coverage: StatsCoverage;
  busy: boolean;
}) {
  const titleId = useId();
  const status = storeStatus(store);
  const local = isLocalVendorType(store.vendorType);
  const tabs: { value: DrawerTab; label: string; badge?: React.ReactNode }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'menu', label: 'Menu', badge: <span className="rounded bg-white/10 px-1.5 text-[10px] text-gray-300">{store.itemCount ?? 0}</span> },
    { value: 'hours', label: 'Hours' },
    ...(local ? [] : [{ value: 'login' as DrawerTab, label: 'Partner login' }, { value: 'promote' as DrawerTab, label: 'Promote' }]),
    { value: 'activity', label: 'Activity' },
  ];
  const current = tabs.some(t => t.value === tab) ? tab : 'overview';

  return (
    <Drawer onClose={onClose} labelledBy={titleId}>
      <header className="border-b border-white/10 px-5 pt-4">
        <div className="flex flex-wrap items-start gap-4">
          <Thumb src={store.imageUrl} alt={store.name} size="lg" rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="truncate text-xl font-black">{store.name}</h2>
              <Chip tone={STATUS_TONE[status]} dot title={STATUS_META[status].help}>{STATUS_META[status].label}</Chip>
              {store.isFeatured && <Chip tone="amber">✨ {store.featuredBadge || 'Featured'}</Chip>}
              {store.isOffline && <Chip>Managed by Zenvy</Chip>}
            </div>
            <p className="mt-1 truncate text-sm text-gray-400">{vendorLabel(store.vendorType)} · {[store.location, store.campus].filter(Boolean).join(' · ')}</p>
            {status === 'closed' && store.closedReason && <p className="mt-0.5 text-xs text-amber-300/80">{store.closedReason}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onEdit()}>Edit details</Button>
            <MenuButton ariaLabel="More store actions" label="•••" items={[
              { label: 'Duplicate store', onSelect: onDuplicate },
              { label: store.isActive ? 'Deactivate (hide)' : 'Publish (make live)', onSelect: onToggleActive, disabled: busy },
              'divider',
              { label: 'Delete store…', onSelect: onDelete, danger: true },
            ]} />
            <button type="button" onClick={onClose} aria-label="Close store panel" className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white">✕</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Toggle size="sm" checked={store.isActive} disabled={busy} onChange={onToggleActive} label={store.isActive ? 'Visible to customers' : 'Hidden from customers'} />
          {!local && <Toggle size="sm" checked={store.isOpenNow !== false} disabled={busy || !store.isActive} onChange={onToggleOpen} label={store.isOpenNow === false ? 'Paused (not taking orders)' : 'Taking orders'} />}
        </div>
        <div className="mt-3">
          <Tabs label="Store sections" tabs={tabs} value={current} onChange={onTab} />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-5" role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`}>
        {current === 'overview' && <OverviewTab store={store} stats={stats} orders={orders} coverage={coverage} onTab={onTab} onEdit={onEdit} onPublish={onToggleActive} />}
        {current === 'menu' && <MenuManager store={store} />}
        {current === 'hours' && <HoursTab store={store} onChanged={onChanged} />}
        {current === 'login' && <LoginTab store={store} onChanged={onChanged} />}
        {current === 'promote' && <PromoteTab store={store} onChanged={onChanged} onEdit={onEdit} />}
        {current === 'activity' && <ActivityTab store={store} orders={orders} />}
      </div>
    </Drawer>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'green' | 'amber' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-black', tone === 'green' && 'text-emerald-300', tone === 'amber' && 'text-amber-300')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'sky' | 'slate'> = {
  Delivered: 'green', Cancelled: 'red', Pending: 'amber', Accepted: 'sky', Preparing: 'sky', ReadyForPickup: 'sky', Picking: 'sky', PickedUp: 'sky', ArrivedAtGate: 'sky',
};

function OverviewTab({ store, stats, orders, coverage, onTab, onEdit, onPublish }: {
  store: Store; stats: StoreStats; orders: StoreOrder[]; coverage: StatsCoverage; onTab: (t: DrawerTab) => void; onEdit: (s?: StepKey) => void; onPublish: () => void;
}) {
  const local = isLocalVendorType(store.vendorType);
  const payout = useStorePayout(storeId(store));
  const weekly = weeklyFromStore(store.operatingHours);
  const rating = Number(store.rating) || 0;
  const checks: { ok: boolean; text: string; fix: () => void; fixLabel: string }[] = [
    { ok: (store.itemCount ?? 0) > 0, text: `Menu has ${store.itemCount ?? 0} item${store.itemCount === 1 ? '' : 's'}`, fix: () => onTab('menu'), fixLabel: 'Add items' },
    { ok: !!store.imageUrl, text: 'Cover photo', fix: () => onEdit('branding'), fixLabel: 'Add photo' },
    { ok: !!store.whatsappNumber || !local, text: local ? 'WhatsApp number for orders' : 'Contact number', fix: () => onEdit('location'), fixLabel: 'Add number' },
    { ok: store.lat != null && store.lon != null, text: 'Map pin for riders', fix: () => onEdit('location'), fixLabel: 'Set pin' },
    { ok: (store.tags || []).length > 0, text: 'Cuisine tags', fix: () => onEdit('basics'), fixLabel: 'Add tags' },
  ];
  const todo = checks.filter(c => !c.ok);
  const recent = orders.slice(0, 8);
  return (
    <div className="space-y-6">
      {!store.isActive && (
        <Callout tone={todo.length ? 'amber' : 'green'} title={storeStatus(store) === 'draft' ? 'This store is a draft' : 'This store is hidden'}>
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{todo.length ? `Finish ${todo.length} thing${todo.length === 1 ? '' : 's'} below, then publish.` : 'Everything looks ready. Publish to make it visible to customers.'}</span>
            <Button size="sm" variant="primary" onClick={onPublish}>Publish now</Button>
          </span>
        </Callout>
      )}
      <section aria-label="Store numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {local ? (
          <>
            <Stat label="Customer taps (all time)" value={(store.clickCount ?? 0).toLocaleString('en-IN')} sub="Call / WhatsApp / open taps" />
            <Stat label="Menu items" value={store.itemCount ?? 0} />
            <Stat label="Rating" value={rating > 0 ? `${rating.toFixed(1)} ★` : 'New'} />
            <Stat label="Listed" value={store.createdAt ? timeAgo(store.createdAt) : '—'} />
          </>
        ) : (
          <>
            <Stat label="Orders today" value={stats.todayOrders} sub={stats.cancelledToday ? `${stats.cancelledToday} cancelled` : coverage.todayComplete ? 'IST calendar day' : `From latest ${coverage.scanned} orders`} />
            <Stat label="Sales today" value={formatINR(stats.todayRevenue)} tone="green" sub="Item subtotal, excl. cancelled" />
            <Stat label="Last 7 days" value={stats.weekOrders} sub={<>{formatINR(stats.weekRevenue)}{coverage.weekComplete ? '' : ` · latest ${coverage.scanned} orders only`}</>} />
            <Stat label="Unsettled payout" value={payout.state === 'loading' ? <Skeleton className="h-7 w-20" /> : payout.state === 'error' ? '—' : formatINR(payout.row?.netPayout || 0)} tone="amber" sub={payout.row ? `${payout.row.totalOrders} delivered orders · ${formatINR(payout.row.totalCommission)} commission` : 'Settle from Finance → Payouts'} />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-white/10 p-4" aria-labelledby="ready-title">
            <h3 id="ready-title" className="mb-3 text-sm font-bold">Setup checklist <span className="font-normal text-gray-500">· {checks.length - todo.length}/{checks.length}</span></h3>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${((checks.length - todo.length) / checks.length) * 100}%` }} /></div>
            <ul className="space-y-2">
              {checks.map(c => (
                <li key={c.text} className="flex items-center gap-3 text-sm">
                  <span aria-hidden className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black', c.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')}>{c.ok ? '✓' : '!'}</span>
                  <span className={c.ok ? 'text-gray-300' : 'text-white'}>{c.text}</span>
                  {!c.ok && <button type="button" onClick={c.fix} className="ml-auto text-xs font-semibold text-emerald-300 hover:underline">{c.fixLabel} →</button>}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-white/10" aria-labelledby="details-title">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
              <h3 id="details-title" className="text-sm font-bold">Details</h3>
              <button type="button" onClick={() => onEdit()} className="text-xs font-semibold text-emerald-300 hover:underline">Edit</button>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2">
              <DD k="Type" v={vendorLabel(store.vendorType)} />
              <DD k="Address" v={store.location || '—'} />
              <DD k="Campus · zone" v={[store.campus, store.zone].filter(Boolean).join(' · ') || '—'} />
              <DD k="Map pin" v={store.lat != null && store.lon != null ? <a className="text-emerald-300 hover:underline" href={mapsUrl(store.lat, store.lon)} target="_blank" rel="noreferrer">{store.lat}, {store.lon} ↗</a> : 'Not set'} />
              <DD k="WhatsApp" v={store.whatsappNumber ? <a className="text-emerald-300 hover:underline" href={`https://wa.me/${store.whatsappNumber}`} target="_blank" rel="noreferrer">+91 {formatWhatsapp(store.whatsappNumber)} ↗</a> : 'Not set'} />
              <DD k="Hours" v={summarizeWeekly(weekly)} />
              {!local && <DD k="Delivery time" v={store.deliveryTime ? `${store.deliveryTime} min` : 'Hidden'} />}
              {!local && <DD k="Commission" v={store.commissionType === 'flat' ? `₹${store.commissionRate ?? 0} per order` : `${store.commissionRate ?? 0}% of order`} />}
              <DD k="Partner app" v={store.isOffline ? 'Managed by Zenvy (no app)' : 'Partner accepts orders in the app'} />
              <DD k="Added" v={store.createdAt ? new Date(store.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            </dl>
          </section>

          {!local && (
            <section className="rounded-xl border border-white/10" aria-labelledby="recent-title">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                <h3 id="recent-title" className="text-sm font-bold">Recent orders</h3>
                {stats.lastOrderAt && <span className="text-xs text-gray-500">Last order {timeAgo(stats.lastOrderAt)}</span>}
              </div>
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500">No orders in the latest {coverage.scanned} platform orders.{store.isActive ? '' : ' Publish the store to start receiving orders.'}</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {recent.map(o => (
                    <li key={o._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                      <code className="text-xs text-gray-500">#{String(o._id || o.id).slice(0, 8)}</code>
                      <Chip tone={STATUS_COLOR[o.status] || 'slate'}>{o.status}</Chip>
                      <span className="text-gray-400">{o.paymentMethod || ''}</span>
                      <span className="ml-auto font-semibold">{formatINR(Number(o.totalPrice) || 0)}</span>
                      <span className="w-20 text-right text-xs text-gray-500">{timeAgo(o.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <div>
          <StorePreviewCard data={{
            name: store.name, imageUrl: store.imageUrl, tags: store.tags || [], description: store.stallDescription,
            deliveryTime: store.deliveryTime, isOpen: store.isOpen !== false && store.isActive, opensAt: store.opensAt,
            rating: store.rating, isFeatured: store.isFeatured, featuredBadge: store.featuredBadge, promoOffer: store.promoOffer,
            isLocal: local, whatsappNumber: store.whatsappNumber, brand: readBrandTheme(store.brandTheme),
          }} />
        </div>
      </div>
    </div>
  );
}

function DD({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-gray-500">{k}</dt><dd className="mt-0.5 break-words text-gray-200">{v}</dd></div>;
}

// ─── Hours ───────────────────────────────────────────────────────────────────
function HoursTab({ store, onChanged }: { store: Store; onChanged: (s: Store) => void }) {
  const toast = useToast();
  const local = isLocalVendorType(store.vendorType);
  const initial = useMemo(() => ({ weekly: weeklyFromStore(store.operatingHours), delivery: store.deliveryTime != null ? String(store.deliveryTime) : '' }), [store.operatingHours, store.deliveryTime]);
  const [weekly, setWeekly] = useState<Weekly>(initial.weekly);
  const [delivery, setDelivery] = useState(initial.delivery);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(weekly) !== JSON.stringify(initial.weekly) || delivery !== initial.delivery;
  // A live update from elsewhere refreshes the form when there are no local edits.
  useEffect(() => { if (!dirty) { setWeekly(initial.weekly); setDelivery(initial.delivery); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const w = validateWeekly(weekly);
    if (w) return setError(w);
    const d = delivery.trim() === '' ? null : Number(delivery);
    if (d !== null && (!Number.isInteger(d) || d < 5 || d > 240)) return setError('Delivery time must be 5–240 minutes, or empty.');
    setSaving(true);
    setError('');
    try {
      const saved = await patchStore(storeId(store), { operatingHours: operatingHoursPayload(weekly), ...(local ? {} : { deliveryTime: d }) });
      onChanged(saved);
      if (!isUniform(weekly) && !saved?.operatingHours?.weekly) {
        const p = primaryWindow(weekly);
        toast.info(`Saved. The server keeps one daily window for now (${formatTime(p.start)}–${formatTime(p.end)}); per-day hours apply after the server update.`);
      } else toast.success('Hours saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the hours.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <WeeklyHoursEditor value={weekly} onChange={setWeekly} />
      {!local && (
        <Field label="Typical delivery time (minutes)" optional help="Shown on the store card. Empty hides it.">
          {({ id, msgId }) => <input id={id} aria-describedby={msgId} inputMode="numeric" className={cx(INPUT, 'max-w-[140px]')} value={delivery} onChange={e => setDelivery(e.target.value.replace(/\D/g, ''))} />}
        </Field>
      )}
      {error && <Callout tone="red">{error}</Callout>}
      <div className="flex items-center gap-3">
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>{dirty ? 'Save hours' : 'Saved'}</Button>
        {dirty && <Button variant="ghost" onClick={() => { setWeekly(initial.weekly); setDelivery(initial.delivery); setError(''); }}>Undo changes</Button>}
      </div>
    </div>
  );
}

// ─── Partner login ───────────────────────────────────────────────────────────
function LoginTab({ store, onChanged }: { store: Store; onChanged: (s: Store) => void }) {
  const toast = useToast();
  const id = storeId(store);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmManaged, setConfirmManaged] = useState<boolean | null>(null);
  const strength = passwordStrength(pw);
  const loginText = (password: string) => `Zenvy partner app login\nStore: ${store.name}\nStore ID: ${id}\nPassword: ${password}\nOpen the Zenvy Restaurant app and sign in with the Store ID and password.`;

  const reset = async () => {
    if (pw.trim().length < 6) return setError('At least 6 characters (12+ recommended).');
    setSaving(true);
    setError('');
    try {
      const saved = await patchStore(id, { password: pw.trim() });
      onChanged(saved);
      setShown(pw.trim());
      setPw('');
      toast.success('New partner password is active.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set the password.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4" aria-labelledby="signin-title">
        <h3 id="signin-title" className="text-sm font-bold">How the partner signs in</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-300">
          <li>Open the <b>Zenvy Restaurant</b> app.</li>
          <li>Enter the Store ID below (or the exact store name “{store.name}”).</li>
          <li>Enter the password you shared.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <code className="flex-1 select-all break-all rounded-lg border border-white/10 bg-[#111318] px-3 py-2 text-xs text-emerald-300">{id}</code>
          <CopyButton text={id} label="Copy Store ID" />
        </div>
        <p className="text-xs text-gray-500">Zenvy stores only a hash, so the current password cannot be shown. Reset it to share a new one. Phone-number login is not available yet.</p>
      </section>

      <section className="rounded-xl border border-white/10 p-4">
        <Toggle
          checked={!!store.isOffline}
          onChange={v => setConfirmManaged(v)}
          label="Managed by Zenvy (no partner app)"
          description="Orders skip the partner's accept step; the Zenvy team / rider handles them. Turn off once the partner uses the app."
        />
      </section>

      {shown ? (
        <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4" aria-live="polite">
          <div className="flex items-center justify-between"><h3 className="font-bold text-amber-100">New password (shown once)</h3><Chip tone="amber">Copy it now</Chip></div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 select-all rounded-lg bg-black/30 px-3 py-2 font-mono text-white">{shown}</code>
            <CopyButton text={shown} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton text={loginText(shown)} label="Copy message for the partner" variant="amber" size="md" />
            {store.whatsappNumber && <a className="text-xs font-semibold text-emerald-300 hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/${store.whatsappNumber}?text=${encodeURIComponent(loginText(shown))}`}>Send on WhatsApp ↗</a>}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShown(null)}>I have shared it</Button>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <Field
            label="Reset password"
            error={error || null}
            help="The new password works immediately and the old one stops working. Apps already signed in stay signed in."
            aside={pw ? <span className={cx('text-[11px] font-semibold', strength.score >= 3 ? 'text-emerald-300' : strength.score === 2 ? 'text-amber-300' : 'text-red-300')}>{strength.label}</span> : null}
          >
            {({ id: fid, msgId, invalid }) => (
              <div className="flex flex-wrap gap-2">
                <input id={fid} aria-describedby={msgId} aria-invalid={invalid} autoComplete="new-password" spellCheck={false} className={cx(INPUT, 'min-w-[200px] flex-1 font-mono')} value={pw} onChange={e => setPw(e.target.value)} placeholder="Generate or type a new password" />
                <Button onClick={() => setPw(generatePassword(12))}>Generate strong</Button>
              </div>
            )}
          </Field>
          <Button variant="primary" loading={saving} disabled={!pw.trim()} onClick={reset}>Set new password</Button>
        </section>
      )}
      {confirmManaged !== null && (
        <ConfirmModal
          title={confirmManaged ? 'Manage this store from Zenvy?' : 'Hand over to the partner app?'}
          body={<p>{confirmManaged ? 'New orders will skip the partner accept step and go straight to the kitchen flow handled by the Zenvy team and rider.' : 'New orders will wait for the partner to accept them in the Zenvy Restaurant app. Make sure they can sign in first.'}</p>}
          actionLabel={confirmManaged ? 'Yes, Zenvy manages it' : 'Yes, partner app'}
          onClose={() => setConfirmManaged(null)}
          onConfirm={async () => {
            const saved = await patchStore(id, { isOffline: confirmManaged });
            onChanged(saved);
            setConfirmManaged(null);
            toast.success(confirmManaged ? 'Store is now managed by Zenvy.' : 'Store now uses the partner app.');
          }}
        />
      )}
    </div>
  );
}

// ─── Promote ─────────────────────────────────────────────────────────────────
const BADGES = ['Featured', 'Bestseller', 'New on Zenvy', 'Campus favourite', 'Late-night'];
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

function PromoteTab({ store, onChanged, onEdit }: { store: Store; onChanged: (s: Store) => void; onEdit: (s?: StepKey) => void }) {
  const toast = useToast();
  const id = storeId(store);
  const [badge, setBadge] = useState(store.featuredBadge && store.isFeatured ? store.featuredBadge : 'Featured');
  const [offer, setOffer] = useState(store.promoOffer || '');
  const [until, setUntil] = useState(toLocalInput(store.featuredUntil));
  const [banner, setBanner] = useState<boolean | null>(null);
  const [wantBanner, setWantBanner] = useState(false);
  const [saving, setSaving] = useState<null | 'save' | 'end'>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    hasStoreBanner(id).then(v => { if (alive) { setBanner(v); setWantBanner(v); } }).catch(() => { if (alive) setBanner(null); });
    return () => { alive = false; };
  }, [id]);
  const expired = store.featuredUntil && new Date(store.featuredUntil).getTime() < Date.now();

  const save = async () => {
    if (until && new Date(until).getTime() < Date.now()) return setError('The end date is in the past.');
    if (wantBanner && !store.imageUrl) return setError('Add a cover photo before adding a Home banner.');
    setSaving('save');
    setError('');
    try {
      const saved = await patchStore(id, { isFeatured: true, featuredBadge: badge.trim() || 'Featured', promoOffer: offer.trim() || null, featuredUntil: until ? new Date(until).toISOString() : null });
      onChanged(saved);
      let bannerMsg = '';
      if (wantBanner) {
        try { await upsertStoreBanner({ ...store, ...saved }, badge.trim(), offer.trim()); setBanner(true); }
        catch (e) { bannerMsg = ` Home banner not updated: ${e instanceof Error ? e.message : 'error'}`; }
      } else if (banner) {
        const err = await removeStoreBanner(id);
        if (err) bannerMsg = ` Home banner not removed: ${err}`; else setBanner(false);
      }
      if (bannerMsg) toast.error(`Promotion saved.${bannerMsg}`); else toast.success(`${store.name} is promoted.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the promotion.');
    } finally {
      setSaving(null);
    }
  };
  const end = async () => {
    setSaving('end');
    setError('');
    try {
      const saved = await patchStore(id, { isFeatured: false, featuredBadge: null, promoOffer: null, featuredUntil: null });
      onChanged(saved);
      const err = await removeStoreBanner(id);
      setBanner(false); setWantBanner(false); setOffer(''); setUntil('');
      if (err) toast.error(`Promotion ended, but the Home banner was not removed: ${err}`); else toast.success('Promotion ended.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not end the promotion.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <Callout tone={store.isFeatured ? 'green' : 'sky'} title={store.isFeatured ? `Promoted${store.featuredUntil ? ` until ${new Date(store.featuredUntil).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}` : 'Not promoted'}>
          Promoted stores get a gold border and badge and rise in the Home feed. Only describe offers the store really gives.
          {expired && <span className="mt-1 block text-amber-200">The end date has passed. The server does not end promotions automatically yet, so end it here.</span>}
        </Callout>
        <Field label="Badge text" help="Short, 1–3 words.">
          {({ id: fid, msgId }) => (
            <div className="space-y-2">
              <input id={fid} aria-describedby={msgId} className={INPUT} maxLength={30} value={badge} onChange={e => setBadge(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                {BADGES.map(b => <button key={b} type="button" onClick={() => setBadge(b)} className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold', badge === b ? 'border-amber-500/50 text-amber-300' : 'border-white/10 text-gray-400 hover:text-white')}>{b}</button>)}
              </div>
            </div>
          )}
        </Field>
        <Field label="Offer ribbon" optional help="e.g. “Free drink above ₹299”. Shown on the card and as a line under the name.">
          {({ id: fid, msgId }) => <input id={fid} aria-describedby={msgId} className={INPUT} maxLength={80} value={offer} onChange={e => setOffer(e.target.value)} />}
        </Field>
        <Field label="Promote until" optional help="Reminder date shown here and on the list. Leave empty for no end date.">
          {({ id: fid, msgId }) => <input id={fid} aria-describedby={msgId} type="datetime-local" className={cx(INPUT, 'max-w-[260px]')} value={until} onChange={e => setUntil(e.target.value)} />}
        </Field>
        <div className="rounded-xl border border-white/10 p-4">
          <Toggle
            tone="amber"
            checked={wantBanner}
            onChange={setWantBanner}
            label="Home hero banner"
            description={store.imageUrl
              ? `${banner ? 'A banner for this store is live on Home.' : 'Adds a large banner at the top of Home that opens this store.'} Uses the cover photo.`
              : <>Needs a cover photo first. <button type="button" className="font-semibold text-emerald-300 underline" onClick={() => onEdit('branding')}>Add one</button></>}
          />
        </div>
        {error && <Callout tone="red">{error}</Callout>}
        <div className="flex flex-wrap gap-2">
          <Button variant="amber" loading={saving === 'save'} disabled={!!saving} onClick={save}>{store.isFeatured ? 'Update promotion' : 'Promote store'}</Button>
          {store.isFeatured && <Button variant="danger" loading={saving === 'end'} disabled={!!saving} onClick={end}>End promotion</Button>}
        </div>
      </div>
      <StorePreviewCard data={{
        name: store.name, imageUrl: store.imageUrl, tags: store.tags || [], deliveryTime: store.deliveryTime,
        isOpen: store.isOpen !== false && store.isActive, opensAt: store.opensAt, rating: store.rating,
        isFeatured: true, featuredBadge: badge, promoOffer: offer, brand: null,
      }} />
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────
interface AuditLog { _id: string; adminId?: string; targetId?: string; action: string; details?: string; timestamp?: string }
const ACTION_TEXT: Record<string, string> = {
  CREATE_RESTAURANT: 'Store created',
  UPDATE_RESTAURANT: 'Store details updated',
  RESTAURANT_DELETE: 'Store deleted',
  UPSERT_MENU_ITEM: 'Menu item saved',
  DELETE_MENU_ITEM: 'Menu item deleted',
  RESTAURANT_PAYOUT_SETTLED: 'Payout settled',
};
const FIELD_TEXT: Record<string, string> = {
  isActive: 'visibility', isOpenNow: 'open/paused', operatingHours: 'hours', imageUrl: 'cover photo', brandTheme: 'brand kit',
  isFeatured: 'promotion', featuredBadge: 'badge', promoOffer: 'offer', featuredUntil: 'promotion end', whatsappNumber: 'WhatsApp',
  deliveryTime: 'delivery time', commissionRate: 'commission', commissionType: 'commission type', isOffline: 'managed by Zenvy',
  stallDescription: 'description', vendorType: 'type', lat: 'map pin', lon: 'map pin',
};

function ActivityTab({ store, orders }: { store: Store; orders: StoreOrder[] }) {
  const id = storeId(store);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [items, setItems] = useState<Map<string, string>>(new Map());
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [audit, products] = await Promise.all([
        adminRequest<{ logs?: AuditLog[] }>('/api/admin/audit?limit=200'),
        adminRequest<Product[]>(`/api/admin/menu-items?restaurantId=${encodeURIComponent(id)}`).catch(() => [] as Product[]),
      ]);
      setLogs(Array.isArray(audit?.logs) ? audit!.logs! : []);
      setItems(new Map((Array.isArray(products) ? products : []).map(p => [p._id || p.id || '', p.name])));
      setState('ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity.');
      setState('error');
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useLiveSync(['store', 'product'], events => { if (events.some(e => String(e.id) === id || String(e.storeId) === id)) load(); }, { debounceMs: 1200 });

  const entries = useMemo(() => {
    const out: { at: string; title: string; detail?: string; kind: 'admin' | 'order' }[] = [];
    for (const l of logs) {
      const target = String(l.targetId || '');
      if (target !== id && !items.has(target)) continue;
      let parsed: Record<string, unknown> = {};
      try { parsed = l.details ? JSON.parse(l.details) : {}; } catch { parsed = {}; }
      let detail = '';
      if (l.action === 'UPDATE_RESTAURANT' && Array.isArray(parsed.fields)) {
        const names = Array.from(new Set((parsed.fields as string[]).map(f => FIELD_TEXT[f] || f)));
        detail = `Changed: ${names.slice(0, 6).join(', ')}${names.length > 6 ? '…' : ''}`;
      } else if (l.action === 'UPSERT_MENU_ITEM') {
        detail = `${parsed.name || items.get(target) || 'Item'}${parsed.price != null ? ` · ₹${parsed.price}` : ''}`;
      } else if (typeof parsed.name === 'string') detail = parsed.name;
      out.push({ at: l.timestamp || '', title: ACTION_TEXT[l.action] || l.action.replace(/_/g, ' ').toLowerCase(), detail, kind: 'admin' });
    }
    for (const o of orders.slice(0, 30)) {
      out.push({ at: o.createdAt, title: `Order #${String(o._id || o.id).slice(0, 8)} · ${o.status}`, detail: `${formatINR(Number(o.totalPrice) || 0)}${o.paymentMethod ? ` · ${o.paymentMethod}` : ''}`, kind: 'order' });
    }
    return out.filter(e => e.at).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 80);
  }, [logs, items, orders, id]);

  if (state === 'loading') return <div className="space-y-3" role="status" aria-label="Loading activity">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (state === 'error') return <Callout tone="red"><span className="flex justify-between gap-3">{error}<button type="button" className="font-bold underline" onClick={() => { setState('loading'); load(); }}>Retry</button></span></Callout>;
  if (!entries.length) return <EmptyState icon="🕘" title="No activity yet" body="Admin changes to this store and its menu, and its orders, will show up here." />;
  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-xs text-gray-500">Admin changes from the latest 200 audit entries, plus recent orders. Changes made in the partner app (stock, open/close) are not in the audit log.</p>
      <ol className="relative space-y-4 border-l border-white/10 pl-5">
        {entries.map((e, i) => (
          <li key={i} className="relative">
            <span aria-hidden className={cx('absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[#0b0d12]', e.kind === 'order' ? 'bg-sky-400' : 'bg-emerald-400')} />
            <p className="text-sm font-semibold text-gray-100">{e.title}</p>
            {e.detail && <p className="text-xs text-gray-400">{e.detail}</p>}
            <p className="text-[11px] text-gray-600">{timeAgo(e.at)} · {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
