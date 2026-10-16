"use client";

// Zenvy Auto-Ride admin (shared autos, seat booking, separate Zenvy Auto Driver app).
// Backend: /api/admin/auto-ride/* (backend/modules/autoRide, protect + admin). Live via admin:changed
// (auto_driver, auto_vehicle, auto_route, auto_booking, auto_private_request, auto_incident, auto_trip)
// and the public data:changed auto_trip event.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useLiveSync } from '@/lib/useLiveSync';
import { autoRideApi, type Summary } from '@/lib/autoRideApi';
import { useLookups } from '@/components/autoRide/hooks';
import { ErrorBox, StatCard, errText } from '@/components/autoRide/ui';
import DriversTab from '@/components/autoRide/DriversTab';
import VehiclesTab from '@/components/autoRide/VehiclesTab';
import RoutesTab from '@/components/autoRide/RoutesTab';
import TripsTab from '@/components/autoRide/TripsTab';
import BookingsTab from '@/components/autoRide/BookingsTab';
import SettingsTab from '@/components/autoRide/SettingsTab';
import { AuditTab, FaresTab, IncidentsTab, PrivateTab } from '@/components/autoRide/MiscTabs';

type Tab = 'overview' | 'drivers' | 'vehicles' | 'routes' | 'trips' | 'bookings' | 'private' | 'incidents' | 'fares' | 'settings' | 'audit';
const LIVE_TYPES = ['auto_driver', 'auto_vehicle', 'auto_route', 'auto_booking', 'auto_private_request', 'auto_incident', 'auto_trip'];
const TAB_KEYS: Tab[] = ['overview', 'drivers', 'vehicles', 'routes', 'trips', 'bookings', 'private', 'incidents', 'fares', 'settings', 'audit'];

export default function AutoRideAdminPage() {
  const { isAuthed } = useAdminAuth();
  const [tab, setTabState] = useState<Tab>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [vehicleFocus, setVehicleFocus] = useState<string | null>(null);
  const lookups = useLookups(tick, isAuthed);

  // Remember the tab in the URL hash (#drivers) so a refresh / shared link lands on the same section.
  useEffect(() => {
    const h = window.location.hash.replace('#', '') as Tab;
    if (TAB_KEYS.includes(h)) setTabState(h);
  }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    try { window.history.replaceState(null, '', `#${t}`); } catch { /* ignore */ }
  }, []);

  // Live: any Auto-Ride change reloads quietly (coalesced).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; setTick((t) => t + 1); }, 600);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLiveSync(LIVE_TYPES, (events) => {
    if (events.some((e) => e.type === 'auto_incident' && e.action === 'created')) setToast('New Auto-Ride incident report');
    bump();
  }, { enabled: isAuthed });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    if (!isAuthed) return;
    let alive = true;
    autoRideApi.summary()
      .then((s) => { if (alive) { setSummary(s); setSummaryError(''); } })
      .catch((e) => { if (alive) setSummaryError(errText(e, 'Could not load the Auto-Ride summary.')); });
    return () => { alive = false; };
  }, [isAuthed, tick]);

  const openVehicle = useCallback((id: string) => { setVehicleFocus(id); setTab('vehicles'); }, [setTab]);
  const clearFocus = useCallback(() => setVehicleFocus(null), []);

  if (!isAuthed) return <div className="p-10 text-center text-sm text-gray-400" role="status">Checking your admin session…</div>;

  const tabs: { key: Tab; label: string; count?: number; alert?: boolean }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'drivers', label: 'Drivers', count: summary?.pendingDrivers },
    { key: 'vehicles', label: 'Vehicles', count: summary?.pendingVehicles },
    { key: 'routes', label: 'Routes & Pickup Points' },
    { key: 'trips', label: 'Trips & Queues', count: summary?.openTrips },
    { key: 'bookings', label: 'Bookings', count: summary?.refundPending, alert: true },
    { key: 'private', label: 'Private Requests', count: summary?.privateAwaiting },
    { key: 'incidents', label: 'Incidents', count: summary?.openIncidents, alert: true },
    { key: 'fares', label: 'Fares' },
    { key: 'settings', label: 'Settings' },
    { key: 'audit', label: 'Audit' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400">Campus Mobility</p>
          <h1 className="mt-1 text-2xl font-black">🛺 Zenvy Auto-Ride</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">Shared autos with seat booking. Verify drivers and their autos (approved capacity never above the RC), manage routes and pickup points, watch queues and trips, handle bookings, refunds and safety reports.</p>
        </div>
        {summary && (
          <button type="button" onClick={() => setTab('settings')} className={`border px-4 py-2 text-sm font-bold ${summary.enabled ? 'border-emerald-400/30 text-emerald-300' : 'border-red-400/30 text-red-300'}`}>
            {summary.enabled ? 'Auto-Ride ON' : 'Auto-Ride OFF'} · {summary.walletEnabled ? 'wallet on' : 'cash only'}
          </button>
        )}
      </header>

      {summaryError && !summary && <div role="alert" className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{summaryError} Counts are unavailable until it loads.</div>}
      {toast && <div role="status" className="border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{toast} · <button type="button" className="font-bold underline" onClick={() => setTab('incidents')}>Open incidents</button></div>}

      <nav className="flex flex-wrap gap-2" aria-label="Auto-Ride sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
            className={`border px-4 py-2 text-sm font-bold ${tab === t.key ? 'border-sky-400 bg-sky-400/10 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
            {t.label}{t.count ? <span className={`ml-2 px-1.5 text-xs text-white ${t.alert ? 'bg-red-500' : 'bg-sky-600'}`}>{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview summary={summary} error={summaryError} retry={bump} go={setTab} />}
      {tab === 'drivers' && <DriversTab tick={tick} onChanged={bump} openVehicle={openVehicle} />}
      {tab === 'vehicles' && <VehiclesTab tick={tick} onChanged={bump} lookups={lookups} focusId={vehicleFocus} clearFocus={clearFocus} />}
      {tab === 'routes' && <RoutesTab tick={tick} onChanged={bump} />}
      {tab === 'trips' && <TripsTab tick={tick} onChanged={bump} lookups={lookups} />}
      {tab === 'bookings' && <BookingsTab tick={tick} onChanged={bump} lookups={lookups} />}
      {tab === 'private' && <PrivateTab tick={tick} lookups={lookups} />}
      {tab === 'incidents' && <IncidentsTab tick={tick} onChanged={bump} />}
      {tab === 'fares' && <FaresTab tick={tick} lookups={lookups} />}
      {tab === 'settings' && <SettingsTab tick={tick} onChanged={bump} />}
      {tab === 'audit' && <AuditTab tick={tick} />}
    </div>
  );
}

function Overview({ summary: s, error, retry, go }: { summary: Summary | null; error: string; retry: () => void; go: (t: Tab) => void }) {
  if (!s) return error ? <ErrorBox text={error} retry={retry} /> : <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">Loading live counts…</div>;
  return (
    <section className="space-y-6" aria-label="Overview">
      {!s.enabled && (
        <div className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          Auto-Ride is OFF for passengers. Turn it on only after legal checks: permits, insurance, driver documents. <button type="button" className="font-bold underline" onClick={() => go('settings')}>Settings</button>
        </div>
      )}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Right now</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard name="Online verified autos" value={s.onlineVerifiedDrivers} tone={s.onlineVerifiedDrivers ? 'good' : 'plain'} hint="Verified drivers currently online" />
          <StatCard name="Open trips" value={s.openTrips} hint="Accepting seat bookings" />
          <StatCard name="Booked seats" value={s.bookedSeats} hint="Confirmed + boarded on active trips" />
          <StatCard name="Autos at full capacity" value={s.fullTrips} hint="Full, waiting to depart" />
          <StatCard name="Private requests awaiting" value={s.privateAwaiting} tone={s.privateAwaiting ? 'warn' : 'plain'} hint="Full-auto requests a driver has not answered" />
          <StatCard name="Trips in progress" value={s.tripsInProgress} />
          <StatCard name="Cancelled today" value={s.cancelledToday} tone={s.cancelledToday ? 'bad' : 'plain'} hint="Cancelled / no-show / unavailable since 00:00 IST" />
          <StatCard name="Open incidents" value={s.openIncidents} tone={s.openIncidents ? 'bad' : 'plain'} hint="Open + reviewing" />
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Needs action</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { n: s.pendingDrivers, t: 'drivers waiting for verification', tab: 'drivers' as Tab },
            { n: s.pendingVehicles, t: 'autos waiting for approval', tab: 'vehicles' as Tab },
            { n: s.refundPending, t: 'refunds pending (retry in Bookings)', tab: 'bookings' as Tab },
          ].map((x) => (
            <button key={x.tab} type="button" onClick={() => go(x.tab)} className={`border p-4 text-left hover:bg-white/[0.03] ${x.n ? 'border-amber-400/40' : 'border-white/10'}`}>
              <span className={`text-2xl font-black tabular-nums ${x.n ? 'text-amber-300' : 'text-gray-400'}`}>{x.n}</span>
              <span className="ml-2 text-sm text-gray-300">{x.t}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">All numbers are counted live from the database and refresh when anything changes.</p>
    </section>
  );
}
