"use client";

import { useEffect, useState } from 'react';
import { autoRideApi, DRIVER_STATUSES, DRIVER_DOC_KEYS, REQUIRED_DRIVER_DOCS, type Driver } from '@/lib/autoRideApi';
import { useLoader } from './hooks';
import { Btn, ConfirmDialog, Doc, Empty, ErrorBox, Expiry, Loading, Msg, Pill, Select, Toolbar, maskPhone, short, when } from './ui';

const DOC_NAMES: Record<string, string> = { photo: 'Profile photo', licenceFront: 'Licence (front)', licenceBack: 'Licence (back)', badge: 'Auto badge', policeVerification: 'Police verification' };
const MISSING_NAMES: Record<string, string> = {
  licenceNumber: 'Licence number', licenceExpiresOn: 'Licence expiry', emergencyContactPhone: 'Emergency contact phone', vehicle: 'A vehicle (not rejected)',
};
const missingName = (m: string) => (m.startsWith('document:') ? DOC_NAMES[m.slice(9)] || m.slice(9) : MISSING_NAMES[m] || m);

export default function DriversTab({ tick, onChanged, openVehicle }: { tick: number; onChanged: () => void; openVehicle: (id: string) => void }) {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 400); return () => clearTimeout(t); }, [q]);
  const key = `${status}|${query}`;
  const { data, loading, error, reload } = useLoader(key, tick, () => autoRideApi.drivers(status, query || undefined));
  const rows = data?.drivers || [];
  return (
    <section className="space-y-4" aria-label="Drivers">
      <Toolbar>
        <Select name="Status" value={status} onChange={setStatus} options={[...DRIVER_STATUSES, 'ALL']} />
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" className="ml-2 border border-white/10 bg-[#111318] p-2 text-sm font-normal text-white" />
        </label>
        <span className="text-sm text-gray-500">{rows.length} driver{rows.length === 1 ? '' : 's'}{rows.length >= 200 ? ' (first 200)' : ''}</span>
      </Toolbar>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading ? <Loading text="Loading drivers…" />
        : rows.length === 0 ? <Empty text={status === 'PENDING_REVIEW' ? 'No drivers waiting for verification.' : 'No drivers with this status.'} /> : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400">
                <tr><th className="p-3">Driver</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3">Online</th><th className="p-3">Submitted</th><th className="p-3" /></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((d) => (
                  <DriverRow key={d.id} d={d} open={openId === d.id} toggle={() => setOpenId(openId === d.id ? null : d.id)} tick={tick} onChanged={() => { onChanged(); reload(); }} openVehicle={openVehicle} />
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function DriverRow({ d, open, toggle, tick, onChanged, openVehicle }: { d: Driver; open: boolean; toggle: () => void; tick: number; onChanged: () => void; openVehicle: (id: string) => void }) {
  return (
    <>
      <tr className={`align-top ${open ? 'bg-white/[0.03]' : ''}`}>
        <td className="p-3"><p className="font-bold">{d.name}</p><p className="text-xs text-gray-500">#{short(d.id)}</p></td>
        <td className="p-3 font-mono text-xs">{maskPhone(d.phone)}</td>
        <td className="p-3"><Pill s={d.status} />{d.status === 'REJECTED' && d.rejectionReason && <p className="mt-1 max-w-[220px] text-xs text-red-300">{d.rejectionReason}</p>}{d.status === 'SUSPENDED' && d.suspendedReason && <p className="mt-1 max-w-[220px] text-xs text-red-300">{d.suspendedReason}</p>}</td>
        <td className="p-3 text-xs">{d.isOnline ? <span className="font-bold text-emerald-300">● Online</span> : <span className="text-gray-500">Offline</span>}<p className="text-gray-500">{d.lastOnlineAt ? `last ${when(d.lastOnlineAt)}` : ''}</p></td>
        <td className="p-3 text-xs text-gray-400">{when(d.submittedAt)}</td>
        <td className="p-3 text-right"><Btn onClick={toggle}>{open ? 'Close' : 'Review'}</Btn></td>
      </tr>
      {open && (
        <tr><td colSpan={6} className="border-t border-white/10 bg-black/20 p-0"><DriverDetail id={d.id} tick={tick} onChanged={onChanged} openVehicle={openVehicle} /></td></tr>
      )}
    </>
  );
}

type Action = 'verify' | 'reject' | 'suspend' | 'unsuspend';

function DriverDetail({ id, tick, onChanged, openVehicle }: { id: string; tick: number; onChanged: () => void; openVehicle: (id: string) => void }) {
  const { data, loading, error, reload } = useLoader(id, tick, () => autoRideApi.driver(id));
  const [action, setAction] = useState<Action | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (loading) return <div className="p-5"><Loading text="Loading driver…" /></div>;
  if (error || !data) return <div className="p-5"><ErrorBox text={error || 'Could not load the driver.'} retry={reload} /></div>;
  const d = data.driver;
  const missing = data.missing.filter((m) => m !== 'vehicle');
  const canVerify = ['PENDING_REVIEW', 'REJECTED', 'PENDING_DOCS'].includes(d.status);
  const canReject = ['PENDING_REVIEW', 'PENDING_DOCS', 'VERIFIED'].includes(d.status);
  const run = async (a: Action, reason: string) => {
    if (a === 'verify') await autoRideApi.verifyDriver(d.id);
    if (a === 'reject') await autoRideApi.rejectDriver(d.id, reason);
    if (a === 'unsuspend') await autoRideApi.unsuspendDriver(d.id);
    let extra = '';
    if (a === 'suspend') { const r = await autoRideApi.suspendDriver(d.id, reason); extra = r.tripsEnded ? ` ${r.tripsEnded} upcoming trip${r.tripsEnded === 1 ? '' : 's'} ended; passengers were notified.` : ''; }
    setAction(null);
    setMsg({ ok: true, text: { verify: 'Driver verified and notified.', reject: 'Rejected. The driver sees your reason.', suspend: `Suspended and signed out.${extra}`, unsuspend: 'Reactivated. The driver was notified.' }[a] });
    onChanged();
    reload();
  };
  const dialog: Record<Action, { title: string; confirm: string; tone: 'bad' | 'good'; body: string; reason?: boolean }> = {
    verify: { title: `Verify ${d.name}?`, confirm: 'Verify driver', tone: 'good', body: 'Only verify after checking the licence photos, licence number + expiry and the profile photo. Verified drivers can go online and publish trips once their auto is approved.' },
    reject: { title: `Reject ${d.name}?`, confirm: 'Reject', tone: 'bad', reason: true, body: d.status === 'VERIFIED' ? 'This driver is verified: rejecting takes them offline. Tell them what to fix.' : 'Tell the driver what to fix. They can resubmit.' },
    suspend: { title: `Suspend ${d.name}?`, confirm: 'Suspend driver', tone: 'bad', reason: true, body: 'The driver is signed out on every device and goes offline. Upcoming trips (not already in progress) are ended and their passengers are notified; wallet payments are refunded in full.' },
    unsuspend: { title: `Reactivate ${d.name}?`, confirm: 'Reactivate', tone: 'good', body: d.reviewedAt ? 'The driver returns to Verified and must sign in again.' : 'The driver was never reviewed, so they return to Pending review.' },
  };
  const cfg = action ? dialog[action] : null;
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black">{d.name} <Pill s={d.status} /></h3>
          <p className="mt-1 text-sm text-gray-300">Phone <span className="font-mono">{d.phone}</span> · Emergency {d.emergencyContactName || '—'} <span className="font-mono">{d.emergencyContactPhone || '—'}</span></p>
          <p className="mt-1 text-sm text-gray-300">Licence <span className="font-mono">{d.licenceNumber || '—'}</span>{d.badgeNumber ? <> · Badge <span className="font-mono">{d.badgeNumber}</span></> : null}</p>
          <Expiry date={d.licenceExpiresOn} prefix="Licence expires" />
          <p className="mt-1 text-xs text-gray-500">Joined {when(d.createdAt)} · submitted {when(d.submittedAt)} · reviewed {when(d.reviewedAt)} · last login {when(d.lastLoginAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canVerify && <Btn tone="good" disabled={missing.length > 0} onClick={() => { setMsg(null); setAction('verify'); }}>Verify</Btn>}
          {canReject && <Btn tone="bad" onClick={() => { setMsg(null); setAction('reject'); }}>Reject</Btn>}
          {d.status !== 'SUSPENDED' && <Btn tone="bad" onClick={() => { setMsg(null); setAction('suspend'); }}>Suspend</Btn>}
          {d.status === 'SUSPENDED' && <Btn tone="good" onClick={() => { setMsg(null); setAction('unsuspend'); }}>Unsuspend</Btn>}
        </div>
      </div>
      {missing.length > 0 && canVerify && <p role="alert" className="border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">Cannot verify yet. Missing: {missing.map(missingName).join(', ')}.</p>}
      {data.missing.includes('vehicle') && <p className="text-sm text-amber-300">This driver has no vehicle under review or approved yet.</p>}
      <Msg msg={msg} />
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Documents (private, links expire)</h4>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {DRIVER_DOC_KEYS.map((k) => <Doc key={k} name={DOC_NAMES[k]} url={d.documentPreviews?.[k]} required={REQUIRED_DRIVER_DOCS.includes(k)} />)}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Vehicles</h4>
        {data.vehicles.length === 0 ? <p className="text-sm text-gray-500">No vehicles.</p> : (
          <ul className="space-y-1 text-sm">
            {data.vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono font-bold">{v.registration || v.registrationNumber}</span><Pill s={v.status} />
                <span className="text-gray-400">RC {v.rcSeatingCapacity} seats{v.approvedCapacity ? ` · approved ${v.approvedCapacity}` : ''}</span>
                <button type="button" onClick={() => openVehicle(v.id)} className="text-xs font-bold text-sky-300 underline">Open in Vehicles</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Recent trips</h4>
        {data.trips.length === 0 ? <p className="text-sm text-gray-500">No trips yet.</p> : (
          <ul className="space-y-1 text-sm">
            {data.trips.slice(0, 10).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 text-gray-300"><span className="text-xs text-gray-500">#{short(t.id)}</span><Pill s={t.status} /><span>{when(t.departureAt)}</span><span className="text-gray-400">{t.confirmedSeats}/{t.capacity} seats</span></li>
            ))}
          </ul>
        )}
      </div>
      {cfg && (
        <ConfirmDialog open title={cfg.title} body={<p>{cfg.body}</p>} confirmLabel={cfg.confirm} tone={cfg.tone}
          reason={cfg.reason ? { label: 'Reason (the driver sees this)', min: 5 } : undefined}
          onCancel={() => setAction(null)} onConfirm={(r) => run(action as Action, r)} />
      )}
    </div>
  );
}

