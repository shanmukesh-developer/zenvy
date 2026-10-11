"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { API_URL } from '@/lib/config';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { useAdminSocket } from '@/components/AdminSocketProvider';
import { useLiveSync, useFreshIds, liveLabel, FRESH_ROW_CLASS } from '@/lib/useLiveSync';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string | null;
  type: string;
  collegeEmail: string | null;
  idCardImageUrl: string | null;
  status: VerificationStatus;
  reviewNotes: string | null;
  createdAt: string;
}

const FILTERS: { label: string; status: VerificationStatus }[] = [
  { label: 'Pending', status: 'pending' },
  { label: 'Approved', status: 'approved' },
  { label: 'Rejected', status: 'rejected' },
];

const imageUrl = (url: string | null) => {
  if (!url) return null;
  return url.startsWith('http') || url.startsWith('data:') ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function StudentVerificationPage() {
  const { isAuthed } = useAdminAuth();
  const [status, setStatus] = useState<VerificationStatus>('pending');
  const [retryCount, setRetryCount] = useState(0);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  // Bumped by realtime events; such reloads keep the current list on screen (no spinner, no error banner).
  const [liveTick, setLiveTick] = useState(0);
  const quietReload = useRef(false);
  const { notifyLive } = useAdminSocket();
  const { mark: markFresh, isFresh } = useFreshIds();

  useLiveSync(['verification'], (events, { reconnect }) => {
    quietReload.current = true;
    setLiveTick(t => t + 1);
    if (reconnect) return;
    markFresh(events.map(e => e.id));
    const label = liveLabel(events.filter(e => e.action === 'created'), 'verification request');
    if (label) notifyLive(label);
  }, { enabled: isAuthed });

  useEffect(() => {
    if (!isAuthed) return;
    let active = true;
    const quiet = quietReload.current;
    quietReload.current = false;
    const loadRequests = async () => {
      if (!quiet) {
        setLoading(true);
        setError('');
      }
      try {
        const response = await fetch(`${API_URL}/api/campus/verify/requests?status=${status}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(response.status === 401 ? 'Your session has expired. Please sign in again.'
            : response.status >= 500 ? 'The server had a problem loading requests. Please try again.'
            : data.message || 'Could not load verification requests.');
        }
        if (active) setRequests(Array.isArray(data.requests) ? data.requests : []);
      } catch (loadError) {
        if (active && !quiet) setError(loadError instanceof TypeError ? 'Could not reach the server. Check your connection.' : loadError instanceof Error ? loadError.message : 'Could not load verification requests.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRequests();
    return () => { active = false; };
  }, [status, retryCount, isAuthed, liveTick]);

  const reviewRequest = async (request: VerificationRequest, action: 'approve' | 'reject') => {
    if (action === 'approve' && !window.confirm(`Approve student verification for ${request.userName}?`)) return;
    // Rejection already has its own explicit "Confirm rejection" step.
    if (actingId) return;

    setActingId(request.id);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/campus/verify/${request.id}/review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: action === 'reject' ? reviewNotes.trim() : undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(response.status >= 500 ? 'The server had a problem saving this review. Please try again.'
          : data.message || 'Could not review this request.');
      }
      setRequests(current => current.filter(item => item.id !== request.id));
      setRejectingId(null);
      setReviewNotes('');
    } catch (reviewError) {
      setError(reviewError instanceof TypeError ? 'Could not reach the server. Nothing was changed.' : reviewError instanceof Error ? reviewError.message : 'Could not review this request.');
    } finally {
      setActingId(null);
    }
  };

  if (!isAuthed) {
    return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 text-white md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Campus Identity</p>
          <h1 className="mt-1 text-2xl font-black">Student Verification</h1>
          <p className="mt-2 text-sm text-gray-400">Review university email and student ID submissions.</p>
        </div>
        <span className="text-sm text-gray-400">{requests.length} {status} requests</span>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Verification request status">
        {FILTERS.map(filter => (
          <button
            key={filter.status}
            type="button"
            role="tab"
            aria-selected={status === filter.status}
            onClick={() => setStatus(filter.status)}
            className={`border px-4 py-2 text-sm font-bold transition-colors ${status === filter.status ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300' : 'border-white/10 text-gray-400 hover:text-white'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryCount(count => count + 1)} className="font-bold text-white underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="border border-white/10 p-8 text-sm text-gray-400" role="status">Loading verification requests...</div>
      ) : requests.length === 0 ? (
        <div className="border border-white/10 p-10 text-center">
          <h2 className="font-bold">No {status} requests</h2>
          <p className="mt-2 text-sm text-gray-400">New student submissions will appear here.</p>
        </div>
      ) : (
        <section className="divide-y divide-white/10 border border-white/10" aria-label={`${status} verification requests`}>
          {requests.map(request => {
            const cardUrl = imageUrl(request.idCardImageUrl);
            const busy = actingId === request.id;
            return (
              <article key={request.id} className={`grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px] ${isFresh(request.id) ? FRESH_ROW_CLASS : ''}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-lg font-bold">{request.userName || 'Unknown student'}</h2>
                    <span className="border border-white/10 px-2 py-1 text-xs uppercase text-gray-400">{String(request.type || '').replaceAll('_', ' ')}</span>
                    <span className={`px-2 py-1 text-xs font-bold uppercase ${request.status === 'pending' ? 'bg-amber-400/10 text-amber-300' : request.status === 'approved' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}>{request.status}</span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs uppercase tracking-wider text-gray-500">College email</dt><dd className="mt-1 break-all">{request.collegeEmail || 'Not provided'}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wider text-gray-500">Phone</dt><dd className="mt-1">{request.userPhone || 'Not provided'}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wider text-gray-500">Submitted</dt><dd className="mt-1">{new Date(request.createdAt).toLocaleString()}</dd></div>
                    {request.reviewNotes && <div><dt className="text-xs uppercase tracking-wider text-gray-500">Review notes</dt><dd className="mt-1">{request.reviewNotes}</dd></div>}
                  </dl>
                  {status === 'pending' && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => reviewRequest(request, 'approve')} className="bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">{busy ? 'Saving...' : 'Approve'}</button>
                      <button type="button" disabled={busy || !!actingId} onClick={() => { setRejectingId(request.id); setReviewNotes(''); }} className="border border-red-400/40 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                  {rejectingId === request.id && (
                    <div className="mt-4 max-w-xl space-y-3 border border-red-400/20 bg-red-400/5 p-4">
                      <label className="block text-sm font-bold" htmlFor={`review-notes-${request.id}`}>Rejection notes</label>
                      <textarea id={`review-notes-${request.id}`} value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} maxLength={500} rows={3} className="w-full border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-red-300" placeholder="Explain what needs correction (optional)" />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => reviewRequest(request, 'reject')} className="bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm rejection</button>
                        <button type="button" disabled={busy} onClick={() => setRejectingId(null)} className="border border-white/10 px-4 py-2 text-sm font-bold text-gray-300">Keep pending</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  {cardUrl ? (
                    <a href={cardUrl} target="_blank" rel="noreferrer" aria-label={`Open ID card for ${request.userName}`} className="block border border-white/10 bg-black/20 p-2">
                      <Image src={cardUrl} alt={`Student ID submitted by ${request.userName}`} width={220} height={160} unoptimized className="h-40 w-full object-contain" />
                      <span className="mt-2 block text-center text-xs font-bold text-emerald-300">Open full ID image</span>
                    </a>
                  ) : (
                    <div className="flex h-40 items-center justify-center border border-dashed border-white/10 text-sm text-gray-500">No ID image attached</div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}