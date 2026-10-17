"use client";

// Registrations & payments: GET /registrations (event / status / payment filters, server pages) + a search over
// the loaded page; cancel (full refund), refund (idempotent: retry wallet / online, or record a cash venue refund),
// mark paid at venue; ticket void / reissue (tickets come from GET /events/:id/registrations, so pick an event).
// Online payment rows: GET /payments. Names come from the API; no phone / e-mail is shown anywhere.
import { useEffect, useMemo, useState } from 'react';
import {
  OPEN_REG_STATUSES, PAYMENT_MODES, PAYMENT_STATUSES, PAY_ROW_STATUSES, REG_STATUSES, campusEventsApi,
  type Registration, type TicketBrief,
} from '@/lib/campusEventsApi';
import {
  Btn, ConfirmDialog, Empty, ErrorBox, Loading, Msg, PageNav, Pill, Section, Select, Toolbar, inr, short, useLoader, when, type Notice,
} from './shared';

const PAGE = 100;
type Act = { kind: 'cancel' | 'refund' | 'paid'; reg: Registration } | { kind: 'void' | 'reissue'; reg: Registration; ticket: TicketBrief };

export default function RegistrationsTab({ tick, onChanged }: { tick: number; onChanged: () => void }) {
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [act, setAct] = useState<Act | null>(null);
  const [msg, setMsg] = useState<Notice>(null);
  const [showPayments, setShowPayments] = useState(false);
  useEffect(() => { setPage(1); }, [eventId, status, paymentStatus, paymentMode]);

  const events = useLoader('reg-events', tick, () => campusEventsApi.events({ limit: 200 }));
  const key = `${eventId}|${status}|${paymentStatus}|${paymentMode}|${page}`;
  const { data, loading, error, reload } = useLoader(key, tick, () => campusEventsApi.registrations({ eventId: eventId || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, paymentMode: paymentMode || undefined, page, limit: PAGE }));
  // Tickets per registration (only the per-event participant list carries them).
  const tickets = useLoader(`reg-tk:${eventId}`, tick, () => (eventId ? campusEventsApi.eventRegistrations(eventId) : Promise.resolve({ registrations: [] as Registration[] })));
  const ticketByReg = useMemo(() => new Map((tickets.data?.registrations || []).map((r) => [r.id, r.ticket])), [tickets.data]);

  const all = data?.registrations || [];
  const term = search.trim().toLowerCase();
  const rows = term ? all.filter((r) => [r.code, r.name, r.eventTitle, r.team?.name, r.ticket?.ticketCode, ticketByReg.get(r.id)?.ticketCode].some((v) => String(v || '').toLowerCase().includes(term))) : all;

  const run = async (reason: string) => {
    if (!act) return;
    const r = act.reg;
    if (act.kind === 'cancel') { const out = await campusEventsApi.cancelRegistration(r.id, reason); setMsg({ ok: true, text: `${r.code} cancelled (${out.registration.paymentStatus === 'REFUND_PENDING' ? 'refund pending' : out.registration.paymentStatus.toLowerCase().replaceAll('_', ' ')}).` }); }
    if (act.kind === 'refund') { const out = await campusEventsApi.refund(r.id); setMsg({ ok: true, text: out.registration.paymentStatus === 'REFUNDED' ? `${r.code}: ${inr(out.registration.refundAmount)} refunded.` : `${r.code}: refund still pending (${out.registration.paymentStatus}). It is retried automatically.` }); }
    if (act.kind === 'paid') { await campusEventsApi.markPaid(r.id); setMsg({ ok: true, text: `${r.code}: fee marked as collected at the venue.` }); }
    if (act.kind === 'void') { await campusEventsApi.voidTicket(act.ticket.id, reason); setMsg({ ok: true, text: `Ticket ${act.ticket.ticketCode} voided. It is refused at the gate.` }); }
    if (act.kind === 'reissue') { const out = await campusEventsApi.reissueTicket(act.ticket.id); setMsg({ ok: true, text: `New ticket ${out.ticket.ticketCode} issued; the old QR / code no longer works.` }); }
    setAct(null);
    onChanged(); reload(); tickets.reload();
  };

  return (
    <section className="space-y-4" aria-label="Registrations and payments">
      <Toolbar>
        <Select name="Event" value={eventId} onChange={setEventId} options={[{ value: '', label: 'All events' }, ...(events.data?.events || []).map((e) => ({ value: e.id, label: e.title.slice(0, 40) }))]} />
        <Select name="Status" value={status} onChange={setStatus} options={['', ...REG_STATUSES]} allLabel="Any" />
        <Select name="Payment" value={paymentStatus} onChange={setPaymentStatus} options={['', ...PAYMENT_STATUSES]} allLabel="Any" />
        <Select name="Mode" value={paymentMode} onChange={setPaymentMode} options={['', ...PAYMENT_MODES]} allLabel="Any" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code / name / ticket on this page" maxLength={60} className="w-72 border border-white/10 bg-[#111318] p-2 text-sm text-white" aria-label="Search registrations" />
        <Btn onClick={() => setShowPayments((x) => !x)}>{showPayments ? 'Hide online payments' : 'Online payment records'}</Btn>
      </Toolbar>
      {!eventId && <p className="text-xs text-gray-500">Pick an event to see and manage tickets (void / reissue).</p>}
      {events.error && <ErrorBox text={`Event list: ${events.error}`} retry={events.reload} />}
      {tickets.error && eventId && <ErrorBox text={`Tickets: ${tickets.error}`} retry={tickets.reload} />}
      <Msg msg={msg} />
      {showPayments && <PaymentsPanel tick={tick} />}
      {error && <ErrorBox text={error} retry={reload} />}
      {loading && !data ? <Loading text="Loading registrations…" /> : rows.length === 0 ? <Empty text={all.length ? 'No registration on this page matches the search.' : 'No registrations match these filters.'} /> : (
        <div className="overflow-x-auto border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-400"><tr><th className="p-3">Code</th><th className="p-3">Student / team</th><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Ticket</th><th className="p-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((r) => {
                const tk = r.ticket || ticketByReg.get(r.id) || null;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="p-3 font-mono text-xs">{r.code}<span className="block text-gray-500">{when(r.createdAt)}</span></td>
                    <td className="p-3 text-xs">{r.name}{r.team && <span className="block text-gray-400">Team {r.team.name}</span>}<span className="block font-mono text-gray-600">user #{short(r.userId)}</span></td>
                    <td className="p-3 text-xs">{r.eventTitle || '—'}<span className="block text-gray-500">{r.type.toLowerCase()}{r.unitNo ? ` · place ${r.unitNo}` : ''}</span></td>
                    <td className="p-3"><Pill s={r.status} /></td>
                    <td className="p-3 text-xs">{r.paymentMode === 'NONE' ? 'Free' : <>{r.paymentMode.toLowerCase()} · {inr(r.total)}</>}<span className="mt-1 block"><Pill s={r.paymentStatus} /></span>{r.payment?.refundAmount ? <span className="block text-gray-500">refund {inr(r.payment.refundAmount)}{r.payment.refundedAt ? ` · ${when(r.payment.refundedAt)}` : ''}</span> : null}{r.refundAttempts ? <span className="block text-amber-300">{r.refundAttempts} refund attempt(s)</span> : null}</td>
                    <td className="p-3 text-xs">{tk ? <><span className="font-mono">{tk.ticketCode}</span><span className="mt-1 block"><Pill s={tk.status} /></span></> : <span className="text-gray-500">{eventId ? 'none' : '—'}</span>}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {OPEN_REG_STATUSES.includes(r.status) && <Btn tone="bad" onClick={() => setAct({ kind: 'cancel', reg: r })}>Cancel</Btn>}
                        {r.paymentStatus === 'REFUND_PENDING' && <Btn tone="primary" onClick={() => setAct({ kind: 'refund', reg: r })}>{r.paymentMode === 'VENUE' ? 'Mark cash refunded' : 'Refund now'}</Btn>}
                        {r.paymentStatus === 'DUE_AT_VENUE' && <Btn onClick={() => setAct({ kind: 'paid', reg: r })}>Mark paid</Btn>}
                        {tk && tk.status === 'ACTIVE' && <Btn tone="bad" onClick={() => setAct({ kind: 'void', reg: r, ticket: tk })}>Void ticket</Btn>}
                        {tk && r.status === 'CONFIRMED' && ['ACTIVE', 'VOID'].includes(tk.status) && <Btn onClick={() => setAct({ kind: 'reissue', reg: r, ticket: tk })}>Reissue</Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && <PageNav page={data.pagination.page} hasMore={data.pagination.hasMore} onPage={setPage} count={all.length} noun="registrations" />}

      {act && (
        <ConfirmDialog open tone={act.kind === 'cancel' || act.kind === 'void' ? 'bad' : act.kind === 'refund' ? 'primary' : 'good'}
          title={{ cancel: `Cancel ${act.reg.code}?`, refund: act.reg.paymentMode === 'VENUE' ? `Record the cash refund for ${act.reg.code}?` : `Refund ${act.reg.code} now?`, paid: `Mark ${act.reg.code} as paid at the venue?`, void: 'Void this ticket?', reissue: 'Reissue this ticket?' }[act.kind]}
          confirmLabel={{ cancel: 'Cancel registration', refund: act.reg.paymentMode === 'VENUE' ? 'Cash handed back' : 'Refund', paid: 'Mark paid', void: 'Void ticket', reissue: 'Reissue' }[act.kind]}
          reason={act.kind === 'cancel' ? { label: 'Reason (the student sees it)', min: 3 } : act.kind === 'void' ? { label: 'Reason (kept in the audit log)', min: 3 } : undefined}
          body={{
            cancel: <p>Admin cancellation refunds 100% ({inr(act.reg.total)} {act.reg.paymentMode.toLowerCase()}), cancels the ticket and frees the place for the waitlist.</p>,
            refund: act.reg.paymentMode === 'VENUE' ? <p>Only confirm after the {inr(act.reg.payment?.refundAmount ?? act.reg.total)} cash was handed back to the student.</p> : <p>Retries the {act.reg.paymentMode.toLowerCase()} refund now. Safe to repeat: a refund is never paid twice.</p>,
            paid: <p>Records that {inr(act.reg.total)} was collected in person (audited).</p>,
            void: <p>The QR and code stop working at once. The registration itself stays as it is; reissue later if needed.</p>,
            reissue: <p>A new QR and code are issued; the old ones stop working. The student is notified.</p>,
          }[act.kind]}
          onCancel={() => setAct(null)} onConfirm={run} />
      )}
    </section>
  );
}

function PaymentsPanel({ tick }: { tick: number }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [status]);
  const { data, loading, error, reload } = useLoader(`pay:${status}:${page}`, tick, () => campusEventsApi.payments(status || undefined, { page, limit: 50 }));
  const rows = data?.payments || [];
  return (
    <Section title="Online payment records (Razorpay / wallet rows; no card data is stored)" right={<Select name="Status" value={status} onChange={setStatus} options={['', ...PAY_ROW_STATUSES]} allLabel="Any" />}>
      {error && <ErrorBox text={error} retry={reload} />}
      {loading && !data ? <Loading text="Loading payments…" /> : rows.length === 0 ? <Empty text="No payment records." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-gray-400"><tr><th className="p-2">When</th><th className="p-2">Provider</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Order / payment</th><th className="p-2">Registration</th><th className="p-2">Failure</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((p) => <tr key={p.id}><td className="p-2">{when(p.createdAt)}</td><td className="p-2">{p.provider}</td><td className="p-2">{inr(p.amount)}</td><td className="p-2"><Pill s={p.status} /></td><td className="p-2 font-mono">{p.providerOrderId || '—'}<span className="block">{p.providerPaymentId || ''}</span></td><td className="p-2 font-mono">#{short(p.registrationId)}</td><td className="p-2 text-red-300">{p.failureReason || ''}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {data && <div className="mt-2"><PageNav page={data.pagination.page} hasMore={data.pagination.hasMore} onPage={setPage} count={rows.length} noun="payments" /></div>}
    </Section>
  );
}
