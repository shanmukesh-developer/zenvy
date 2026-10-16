"use client";

// Shared building blocks for the Auto-Ride admin page (same look as /rentals: square borders, dark panels).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LayoutCell, SeatLayout } from '@/lib/autoRideApi';

export const label = (v: string) => String(v || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const inr = (n?: number | string | null) => (n === null || n === undefined || n === '' ? '—' : `₹${(Math.round(Number(n) * 100) / 100).toLocaleString('en-IN')}`);
export const when = (v?: string | null) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';
};
export const timeOnly = (v?: string | null) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
};
export const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
/** Phones in lists are masked (last 4 only); full numbers appear only in detail views. */
export const maskPhone = (p?: string | null) => {
  const s = String(p || '').replace(/\D/g, '');
  return s.length >= 4 ? `••••••${s.slice(-4)}` : s ? '••••' : '—';
};
export const short = (id?: string | null) => (id ? String(id).slice(-6).toUpperCase() : '—');
/** Today in IST as YYYY-MM-DD. */
export const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
/** Days from IST today to a YYYY-MM-DD date (negative = past). */
export const daysUntil = (ymd?: string | null) => {
  if (!ymd) return null;
  const a = Date.parse(`${istToday()}T00:00:00Z`);
  const b = Date.parse(`${String(ymd).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(b) ? null : Math.round((b - a) / 86400000);
};

const TONES: Record<string, string> = {
  PENDING_REVIEW: 'text-amber-300 border-amber-400/30', PENDING_DOCS: 'text-amber-200 border-amber-300/20', REQUESTED: 'text-amber-300 border-amber-400/30',
  OPEN: 'text-amber-300 border-amber-400/30', HELD: 'text-amber-300 border-amber-400/30', REFUND_PENDING: 'text-amber-300 border-amber-400/30', DELAYED: 'text-amber-300 border-amber-400/30',
  VERIFIED: 'text-emerald-300 border-emerald-400/30', APPROVED: 'text-emerald-300 border-emerald-400/30', ACCEPTED: 'text-emerald-300 border-emerald-400/30',
  CONFIRMED: 'text-emerald-300 border-emerald-400/30', COMPLETED: 'text-emerald-300 border-emerald-400/30', RESOLVED: 'text-emerald-300 border-emerald-400/30', REFUNDED: 'text-emerald-300 border-emerald-400/30',
  OPEN_FOR_BOOKING: 'text-sky-300 border-sky-400/30', PUBLISHED: 'text-sky-200 border-sky-300/20', DEPARTURE_THRESHOLD_REACHED: 'text-cyan-300 border-cyan-400/30',
  FULL: 'text-violet-300 border-violet-400/30', DRIVER_CONFIRMED: 'text-indigo-300 border-indigo-400/30', BOARDING: 'text-indigo-300 border-indigo-400/30',
  IN_PROGRESS: 'text-sky-300 border-sky-400/30', BOARDED: 'text-sky-300 border-sky-400/30', REVIEWING: 'text-sky-300 border-sky-400/30',
  REJECTED: 'text-red-300 border-red-400/30', SUSPENDED: 'text-red-300 border-red-400/30', CANCELLED: 'text-red-300 border-red-400/30', DECLINED: 'text-red-300 border-red-400/30',
  NO_SHOW: 'text-red-300 border-red-400/30', DRIVER_UNAVAILABLE: 'text-red-300 border-red-400/30', VEHICLE_UNAVAILABLE: 'text-red-300 border-red-400/30',
  CONFLICT: 'text-red-300 border-red-400/30', EXPIRED: 'text-gray-400 border-white/10', DISMISSED: 'text-gray-400 border-white/10', DRAFT: 'text-gray-400 border-white/10',
};
export const Pill = ({ s }: { s: string }) => <span className={`inline-block whitespace-nowrap border px-2 py-0.5 text-xs font-bold ${TONES[s] || 'text-gray-300 border-white/10'}`}>{label(s)}</span>;

export function Empty({ text }: { text: string }) {
  return <div className="border border-white/10 p-10 text-center text-sm text-gray-400">{text}</div>;
}
export function Loading({ text }: { text: string }) {
  return <div role="status" className="border border-white/10 p-8 text-sm text-gray-400">{text}</div>;
}
export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
      {text}{retry && <button type="button" onClick={retry} className="font-bold underline">Retry</button>}
    </div>
  );
}
export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>;
}
export function Select({ value, onChange, options, name, allLabel = 'All' }: { value: string; onChange: (v: string) => void; options: readonly string[] | { value: string; label: string }[]; name: string; allLabel?: string }) {
  const opts = (options as (string | { value: string; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o ? label(o) : allLabel } : o));
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">{name}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="ml-2 max-w-[240px] border border-white/10 bg-[#111318] p-2 text-sm font-normal normal-case text-white">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4 border border-white/10 bg-white/[0.02] p-4">{children}</div>;
}
export const inputCls = 'w-full border border-white/10 bg-[#111318] p-2 text-sm text-white disabled:opacity-50';
export function Field({ name, children, hint }: { name: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
      <span>{name}</span>
      <div className="mt-1 font-normal normal-case tracking-normal">{children}</div>
      {hint && <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-gray-500">{hint}</span>}
    </label>
  );
}
export function Btn({ children, onClick, tone = 'plain', disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; tone?: 'plain' | 'good' | 'bad' | 'primary'; disabled?: boolean; type?: 'button' | 'submit' }) {
  const cls = {
    plain: 'border border-white/15 text-gray-200 hover:bg-white/5',
    good: 'bg-emerald-600 text-white hover:bg-emerald-500',
    bad: 'border border-red-400/40 text-red-300 hover:bg-red-500/10',
    primary: 'bg-sky-600 text-white hover:bg-sky-500',
  }[tone];
  return <button type={type} disabled={disabled} onClick={onClick} className={`px-4 py-2 text-sm font-bold disabled:opacity-50 ${cls}`}>{children}</button>;
}

/** Only http(s) or same-origin links are rendered (never javascript: / data: from user content). */
export const safeUrl = (u: string | null | undefined) => {
  const v = String(u || '').trim();
  return /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//')) ? v : null;
};
/** Private document preview (short-lived signed link from the server). */
export function Doc({ url: rawUrl, name, required, expiry }: { url: string | null | undefined; name: string; required?: boolean; expiry?: string | null }) {
  const url = safeUrl(rawUrl);
  const days = daysUntil(expiry);
  return (
    <div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="block border border-white/10" title={`Open ${name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full bg-black/30 object-cover" />
          <span className="block bg-black/40 px-2 py-1 text-xs font-bold text-gray-200">{name} ↗</span>
        </a>
      ) : (
        <div className={`flex h-32 items-center justify-center border border-dashed text-xs ${required ? 'border-red-400/40 text-red-300' : 'border-white/15 text-gray-500'}`}>
          {name} {required ? 'missing (required)' : 'not uploaded'}
        </div>
      )}
      {expiry !== undefined && <Expiry date={expiry} days={days} />}
    </div>
  );
}
export function Expiry({ date, days, prefix = 'Expires' }: { date: string | null | undefined; days?: number | null; prefix?: string }) {
  const d = days === undefined ? daysUntil(date) : days;
  if (!date) return <p className="mt-1 text-xs text-gray-500">{prefix}: not given</p>;
  const cls = d !== null && d < 0 ? 'text-red-300 font-bold' : d !== null && d <= 30 ? 'text-amber-300 font-bold' : 'text-gray-400';
  return <p className={`mt-1 text-xs ${cls}`}>{prefix} {String(date).slice(0, 10)}{d !== null && d < 0 ? ' · EXPIRED' : d !== null && d <= 30 ? ` · in ${d} day${d === 1 ? '' : 's'}` : ''}</p>;
}

export function StatCard({ name, value, tone = 'plain', hint }: { name: string; value: number | string | null | undefined; tone?: 'plain' | 'warn' | 'bad' | 'good'; hint?: string }) {
  const cls = { plain: 'text-white', warn: 'text-amber-300', bad: 'text-red-300', good: 'text-emerald-300' }[tone];
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{name}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${cls}`}>{value === null || value === undefined ? '—' : value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** Modal confirm, optionally with a reason box (min length enforced like the server's reasonOf). */
export function ConfirmDialog({ open, title, body, confirmLabel, tone = 'bad', reason, onCancel, onConfirm }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; tone?: 'bad' | 'good' | 'primary';
  reason?: { label: string; min: number; placeholder?: string }; onCancel: () => void; onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setText(''); setError(''); setBusy(false); setTimeout(() => ref.current?.querySelector<HTMLElement>('textarea,button')?.focus(), 0); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  const go = async () => {
    if (reason && text.trim().length < reason.min) { setError(`Write at least ${reason.min} characters.`); return; }
    setBusy(true);
    setError('');
    try { await onConfirm(text.trim()); } catch (e) { setError(errText(e, 'Could not complete this.')); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className="w-full max-w-lg border border-white/15 bg-[#0d0f14] p-6 text-white shadow-2xl">
        <h2 className="text-lg font-black">{title}</h2>
        {body && <div className="mt-3 space-y-2 text-sm text-gray-300">{body}</div>}
        {reason && (
          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-gray-400">{reason.label}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} placeholder={reason.placeholder} className={`${inputCls} mt-1 font-normal normal-case`} />
          </label>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
          <Btn tone={tone} onClick={go} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

/** Top-down seat grid (front row first). 'D' = driver, null = gap. Optional per-seat states. */
export function SeatGrid({ layout, seatState, onCellClick, editable }: {
  layout: SeatLayout | null | undefined; seatState?: Record<number, string>; onCellClick?: (r: number, c: number) => void; editable?: boolean;
}) {
  if (!layout || !Array.isArray(layout.rows) || !layout.rows.length) return <p className="text-xs text-gray-500">No seat layout yet.</p>;
  const cellCls = (c: LayoutCell) => {
    if (c === 'D') return 'border-gray-500 bg-gray-700/60 text-gray-200';
    if (c === null) return 'border-dashed border-white/10 text-gray-600';
    const st = seatState?.[c];
    if (st === 'CONFIRMED' || st === 'BOARDED') return 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200';
    if (st === 'HELD') return 'border-amber-400/60 bg-amber-500/20 text-amber-200';
    return 'border-sky-400/50 bg-sky-500/10 text-sky-100';
  };
  return (
    <div className="inline-block rounded-t-[2rem] border border-white/15 bg-black/30 px-4 pb-4 pt-3" aria-label="Seat layout">
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500">Front</p>
      <div className="space-y-2">
        {layout.rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2">
            {row.map((c, ci) => {
              const fixed = c === 'D';
              const content = c === 'D' ? '🛞' : c === null ? '·' : c;
              const title = c === 'D' ? 'Driver seat (fixed)' : c === null ? 'Gap' : `Seat ${c}${seatState?.[c] ? ` · ${label(seatState[c])}` : ''}`;
              return editable && !fixed && onCellClick ? (
                <button key={ci} type="button" title={`${title} · click to toggle`} onClick={() => onCellClick(ri, ci)} className={`flex h-10 w-10 items-center justify-center border text-sm font-bold ${cellCls(c)} hover:ring-1 hover:ring-white/40`}>{content}</button>
              ) : (
                <span key={ci} title={title} className={`flex h-10 w-10 items-center justify-center border text-sm font-bold ${cellCls(c)}`}>{content}</span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
