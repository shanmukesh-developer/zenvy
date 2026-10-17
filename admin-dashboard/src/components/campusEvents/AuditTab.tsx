"use client";

// Audit: GET /audit?eventId&page&limit (CeAuditLog: approvals, edits, cancellations, refunds, overrides, roster,
// payment marks, staff grants). Event filter is server-side; action / role filters apply to the loaded page.
import { useEffect, useMemo, useState } from 'react';
import { campusEventsApi } from '@/lib/campusEventsApi';
import { Btn, Empty, ErrorBox, Loading, PageNav, Select, Toolbar, label, short, useLoader, when } from './shared';

export default function AuditTab({ tick }: { tick: number }) {
  const events = useLoader('audit-events', tick, () => campusEventsApi.events({ limit: 200 }));
  const [eventId, setEventId] = useState('');
  const [action, setAction] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [eventId]);
  const { data, loading, error, reload } = useLoader(`audit:${eventId}:${page}`, tick, () => campusEventsApi.audit(eventId || undefined, { page, limit: 100 }));
  const all = useMemo(() => data?.audit || [], [data]);
  const actions = useMemo(() => [...new Set(all.map((a) => a.action))].sort(), [all]);
  const roles = useMemo(() => [...new Set(all.map((a) => a.actorRole || 'system'))].sort(), [all]);
  const rows = all.filter((a) => (!action || a.action === action) && (!role || (a.actorRole || 'system') === role));
  const titles = useMemo(() => new Map((events.data?.events || []).map((e) => [e.id, e.title])), [events.data]);

  return (
    <section className="space-y-4" aria-label="Audit log">
      <Toolbar>
        <Select name="Event" value={eventId} onChange={setEventId} options={[{ value: '', label: 'All events' }, ...(events.data?.events || []).map((e) => ({ value: e.id, label: e.title.slice(0, 40) }))]} />
        <Select name="Action" value={action} onChange={setAction} options={[{ value: '', label: 'Any' }, ...actions.map((a) => ({ value: a, label: a }))]} />
        <Select name="By" value={role} onChange={setRole} options={[{ value: '', label: 'Anyone' }, ...roles.map((r) => ({ value: r, label: r }))]} />
        {(action || role) && <Btn onClick={() => { setAction(''); setRole(''); }}>Clear</Btn>}
      </Toolbar>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading && !data ? <Loading text="Loading audit log…" /> : rows.length === 0 ? <Empty text={all.length ? 'No entries on this page match the filters.' : 'No Campus Events actions recorded yet.'} /> : (
        <div className="overflow-x-auto border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400"><tr><th className="p-3">When</th><th className="p-3">Action</th><th className="p-3">Event</th><th className="p-3">Registration / team</th><th className="p-3">By</th><th className="p-3">Details</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap p-3 text-xs">{when(a.at)}</td>
                  <td className="p-3 text-xs font-bold">{label(a.action.replace(/\./g, ' '))}</td>
                  <td className="p-3 text-xs">{a.eventId ? <button type="button" className="text-left text-sky-300 underline" title="Filter by this event" onClick={() => setEventId(a.eventId as string)}>{titles.get(a.eventId) || `#${short(a.eventId)}`}</button> : '—'}</td>
                  <td className="p-3 font-mono text-xs text-gray-400">{a.registrationId ? `reg #${short(a.registrationId)}` : ''}{a.teamId ? ` team #${short(a.teamId)}` : ''}</td>
                  <td className="p-3 text-xs text-gray-400">{a.actorRole || 'system'}{a.actorUserId ? <span className="font-mono"> #{short(a.actorUserId)}</span> : null}</td>
                  <td className="p-3"><code className="block max-w-xl whitespace-pre-wrap break-all text-[11px] text-gray-400">{a.details === null || a.details === undefined ? '' : typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <PageNav page={data.pagination.page} hasMore={data.pagination.hasMore} onPage={setPage} count={all.length} noun="entries" />}
    </section>
  );
}
