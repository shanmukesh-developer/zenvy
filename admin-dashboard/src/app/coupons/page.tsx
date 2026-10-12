"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { API_URL } from '@/lib/config';
import { useLiveSync } from '@/lib/useLiveSync';

interface User {
  id: string;
  _id: string;
  name: string;
  phone: string;
  role?: string;
}

interface Coupon {
  id: string;
  _id: string;
  code: string;
  type: 'FREEDEL' | 'DISCOUNT';
  value: number;
  userId: string;
  isUsed: boolean;
  expiryDate: string | null;
  createdAt: string;
  user?: { id: string; name: string; phone: string } | null;
}

type Filter = 'all' | 'active' | 'used' | 'expired';
type Notice = { kind: 'success' | 'error'; text: string } | null;

const CODE_PATTERN = /^[A-Z0-9-]{4,20}$/;
const MAX_DISCOUNT = 5000;
const USER_FETCH_LIMIT = 500;

/** fetch + JSON with friendly errors (never shows raw server internals). */
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = res.status < 500 && body && typeof body.message === 'string' ? body.message : null;
    throw new Error(msg || (res.status >= 500 ? 'The server ran into a problem. Please try again.' : `Request failed (${res.status}).`));
  }
  return body as T;
}

/** YYYY-MM-DD in the browser's local time zone (toISOString would give the UTC date). */
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysFromToday = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return localDate(d); };

const couponState = (c: Coupon): Exclude<Filter, 'all'> => {
  if (c.isUsed) return 'used';
  if (c.expiryDate && new Date(c.expiryDate) < new Date()) return 'expired';
  return 'active';
};

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  return `ZV-${Array.from(bytes, b => chars[b % chars.length]).join('')}`;
};

export default function CouponManagement() {
  const { isAuthed } = useAdminAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [listSearch, setListSearch] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  // Form state
  const [code, setCode] = useState('');
  const [type, setType] = useState<'FREEDEL' | 'DISCOUNT'>('FREEDEL');
  const [value, setValue] = useState<number | ''>('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<Coupon[]>(`${API_URL}/api/admin/coupons`);
      setCoupons(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load coupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await requestJson<{ users?: User[] }>(`${API_URL}/api/admin/users?limit=${USER_FETCH_LIMIT}`);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setUsersError(null);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Could not load customers.');
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      fetchCoupons();
      fetchUsers();
    }
  }, [isAuthed, fetchCoupons, fetchUsers]);

  // Realtime sync: coupon changes (Vault coupons have their own page) and user changes.
  useLiveSync(['coupon', 'user'], (events, { reconnect }) => {
    if (reconnect || events.some(e => e.type === 'coupon' && e.scope !== 'vault')) fetchCoupons();
    if (reconnect || events.some(e => e.type === 'user')) fetchUsers();
  }, { enabled: isAuthed });

  // Older accounts are found with a server-side search (name, phone or email) and merged in.
  useEffect(() => {
    const q = userSearch.trim();
    if (!isAuthed || selectedUserId || q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await requestJson<{ users?: User[] }>(`${API_URL}/api/admin/users?limit=20&search=${encodeURIComponent(q)}`);
        if (cancelled || !Array.isArray(data.users)) return;
        setUsers(prev => {
          const known = new Set(prev.map(u => u._id || u.id));
          const extra = data.users!.filter(u => !known.has(u._id || u.id));
          return extra.length ? [...prev, ...extra] : prev;
        });
      } catch {
        /* the local list still works */
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isAuthed, userSearch, selectedUserId]);

  const resetForm = () => {
    setCode('');
    setType('FREEDEL');
    setValue('');
    setSelectedUserId('');
    setExpiryDate('');
    setUserSearch('');
    setErrorMsg('');
  };

  const openCreate = () => {
    resetForm();
    setCode(randomCode());
    setExpiryDate(daysFromToday(7));
    setShowCreateModal(true);
  };

  const closeCreate = () => {
    if (submitLoading) return;
    setShowCreateModal(false);
    setErrorMsg('');
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setErrorMsg('');

    const cleanCode = code.toUpperCase().trim();
    if (!CODE_PATTERN.test(cleanCode)) {
      setErrorMsg('Code must be 4–20 characters: letters, numbers or hyphens.');
      return;
    }
    if (!selectedUserId) {
      setErrorMsg('Pick the customer this coupon is for.');
      return;
    }
    if (type === 'DISCOUNT') {
      const v = Number(value);
      if (!Number.isInteger(v) || v < 1 || v > MAX_DISCOUNT) {
        setErrorMsg(`Discount must be a whole number of rupees between 1 and ${MAX_DISCOUNT}.`);
        return;
      }
    }
    if (!expiryDate) {
      setErrorMsg('Pick an expiry date.');
      return;
    }
    // Valid until the end of the chosen day (local time).
    const expiry = new Date(`${expiryDate}T23:59:59`);
    if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
      setErrorMsg('Expiry date must be today or later.');
      return;
    }

    inFlight.current = true;
    setSubmitLoading(true);
    try {
      const created = await requestJson<Coupon>(`${API_URL}/api/admin/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          type,
          value: type === 'DISCOUNT' ? Number(value) : 0,
          userId: selectedUserId,
          expiryDate: expiry.toISOString(),
        }),
      });
      setNotice({ kind: 'success', text: `Coupon ${created?.code || cleanCode} created for ${userSearch}.` });
      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create the coupon.');
    } finally {
      inFlight.current = false;
      setSubmitLoading(false);
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (inFlight.current) return;
    const owner = coupon.user?.name ? ` from ${coupon.user.name}` : '';
    if (!confirm(`Revoke coupon ${coupon.code}${owner}? The customer will no longer be able to use it. This cannot be undone.`)) return;
    const id = coupon.id || coupon._id;
    inFlight.current = true;
    setRevokingId(id);
    try {
      await requestJson(`${API_URL}/api/admin/coupons/${id}`, { method: 'DELETE' });
      setCoupons(prev => prev.filter(c => (c.id || c._id) !== id));
      setNotice({ kind: 'success', text: `Coupon ${coupon.code} revoked.` });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not revoke the coupon.' });
    } finally {
      inFlight.current = false;
      setRevokingId(null);
    }
  };

  const term = userSearch.trim().toLowerCase();
  const filteredUsers = term
    ? users.filter(u => u.name?.toLowerCase().includes(term) || u.phone?.toLowerCase().includes(term))
    : [];

  const listTerm = listSearch.trim().toLowerCase();
  const visibleCoupons = coupons.filter(c =>
    (filter === 'all' || couponState(c) === filter) &&
    (!listTerm || c.code.toLowerCase().includes(listTerm) || c.user?.name?.toLowerCase().includes(listTerm) || c.user?.phone?.includes(listTerm))
  );
  const counts = coupons.reduce((acc, c) => { acc[couponState(c)]++; return acc; }, { active: 0, used: 0, expired: 0 });

  if (!isAuthed) return <div className="p-20 text-center font-black text-white uppercase tracking-widest animate-pulse">Checking access…</div>;

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="flex flex-wrap gap-6 justify-between items-center bg-white/5 p-8 rounded-[40px] border border-white/5 glass">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Coupons</h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Personal discount and free-delivery coupons</p>
        </div>
        <button
          onClick={openCreate}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
        >
          + New coupon
        </button>
      </header>

      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex justify-between items-start gap-4 ${notice.kind === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {([
            ['all', `All (${coupons.length})`],
            ['active', `Active (${counts.active})`],
            ['used', `Used (${counts.used})`],
            ['expired', `Expired (${counts.expired})`],
          ] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${filter === f ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/5 text-gray-500 border-white/10 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search code or customer…"
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500/40 w-64"
        />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-gray-500 font-black uppercase text-xs tracking-widest">Loading coupons…</div>
        ) : loadError ? (
          <div className="py-20 text-center">
            <p className="text-xs text-red-400 font-bold">{loadError}</p>
            <button onClick={fetchCoupons} className="mt-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white">Try again</button>
          </div>
        ) : visibleCoupons.length === 0 ? (
          <div className="py-20 text-center text-gray-500 text-xs">
            {coupons.length === 0 ? 'No coupons yet. Create one with "New coupon".' : 'No coupons match this filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  {['Code', 'Type', 'Customer', 'Expires', 'Status', ''].map(h => (
                    <th key={h} className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-white">
                {visibleCoupons.map((coupon) => {
                  const state = couponState(coupon);
                  const id = coupon.id || coupon._id;
                  return (
                    <tr key={id} className="hover:bg-white/[0.01] transition-all">
                      <td className="px-8 py-5 font-mono text-sm font-black text-blue-400">{coupon.code}</td>
                      <td className="px-8 py-5">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${coupon.type === 'FREEDEL' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                          {coupon.type === 'FREEDEL' ? 'Free delivery' : `₹${coupon.value} off`}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        {coupon.user ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">{coupon.user.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">{coupon.user.phone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Deleted account</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-gray-300">
                        {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No expiry'}
                      </td>
                      <td className="px-8 py-5">
                        {state === 'used' ? (
                          <span className="px-2 py-0.5 rounded bg-gray-500/10 text-gray-500 text-[9px] font-black uppercase tracking-wider border border-gray-500/20">Used</span>
                        ) : state === 'expired' ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-wider border border-red-500/20">Expired</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/20">Active</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        {state !== 'used' && (
                          <button
                            onClick={() => handleDeleteCoupon(coupon)}
                            disabled={revokingId !== null}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                          >
                            {revokingId === id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={closeCreate}>
          <div className="bg-[#0D0D15] border border-white/10 rounded-[32px] w-full max-w-xl overflow-hidden glass" onClick={e => e.stopPropagation()}>
            <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">New coupon</h3>
              <button onClick={closeCreate} disabled={submitLoading} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-lg transition-all disabled:opacity-40" aria-label="Close">✕</button>
            </header>

            <form onSubmit={handleCreateCoupon} className="p-8 space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400">{errorMsg}</div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name or phone…"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-all"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setSelectedUserId('');
                    }}
                  />
                  {term && !selectedUserId && (
                    <div className="absolute left-0 right-0 mt-2 bg-[#0D0D15] border border-white/10 rounded-2xl max-h-56 overflow-y-auto z-50 glass">
                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-xs text-gray-500 text-center font-bold">No customers match.</div>
                      ) : (
                        filteredUsers.slice(0, 8).map((u) => (
                          <button
                            key={u.id || u._id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(u.id || u._id);
                              setUserSearch(`${u.name} (${u.phone})`);
                            }}
                            className="w-full text-left px-5 py-3 hover:bg-white/[0.03] text-sm text-white flex justify-between items-center transition-all border-b border-white/5 last:border-0"
                          >
                            <span className="font-bold">{u.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{u.phone}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {usersError ? (
                  <p className="text-[10px] text-red-400 font-bold">{usersError} <button type="button" onClick={fetchUsers} className="underline">Retry</button></p>
                ) : null}
                {selectedUserId && (
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">✓ {userSearch}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. FLAT100"
                    maxLength={20}
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm font-mono text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-all uppercase"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  />
                  <button type="button" onClick={() => setCode(randomCode())} className="px-5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`space-y-2 ${type === 'FREEDEL' ? 'col-span-2' : ''}`}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</label>
                  <select
                    className="w-full bg-[#0D0D15] border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                    value={type}
                    onChange={(e) => setType(e.target.value as 'FREEDEL' | 'DISCOUNT')}
                  >
                    <option value="FREEDEL">Free delivery</option>
                    <option value="DISCOUNT">Flat ₹ off</option>
                  </select>
                </div>

                {type === 'DISCOUNT' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Discount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_DISCOUNT}
                      step={1}
                      placeholder="e.g. 50"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-all"
                      value={value}
                      onChange={(e) => setValue(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                )}
              </div>
              {type === 'DISCOUNT' && (
                <p className="text-[10px] text-gray-500 -mt-3">The discount is capped at the item total of the order.</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valid until (end of day)</label>
                  <div className="flex gap-2">
                    {[1, 3, 7, 30].map(days => (
                      <button key={days} type="button" onClick={() => setExpiryDate(daysFromToday(days))} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded text-[9px] font-bold transition-all">
                        +{days}d
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="date"
                  min={daysFromToday(0)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button type="button" onClick={closeCreate} disabled={submitLoading} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                  Cancel
                </button>
                <button type="submit" disabled={submitLoading} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  {submitLoading ? 'Creating…' : 'Create coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
