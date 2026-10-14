"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { adminRequest as apiRequest } from '@/lib/api';

interface ConfigRow {
  _id: string;
  key: string;
  value: unknown;
  description?: string | null;
  updatedAt?: string;
}

interface Serviceability {
  open: boolean;
  reopensAt?: string;
  message?: string;
  paymentMethods?: string[];
}

/** fetch against the one backend; throws an Error carrying the server's friendly `message`. */
// Keys the backend actually reads. Everything else in GlobalConfig is stored but not enforced.
const DELIVERY_FEE_KEY = 'delivery_fee';
const DEFAULT_DELIVERY_FEE = 30; // backend fallback in utils/orderPricing.js
const MAX_DELIVERY_FEE = 200;

const formatValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export default function ConfigTerminal() {
  const { isAuthed } = useAdminAuth();
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [serviceability, setServiceability] = useState<Serviceability | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeNotice, setFeeNotice] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, svc] = await Promise.all([
        apiRequest<ConfigRow[]>('/api/admin/config'),
        apiRequest<Serviceability>('/api/orders/serviceability').catch(() => null),
      ]);
      const list = Array.isArray(rows) ? rows : [];
      setConfigs(list);
      setServiceability(svc);
      const fee = list.find(c => c.key === DELIVERY_FEE_KEY)?.value;
      setFeeInput(String(fee ?? DEFAULT_DELIVERY_FEE));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) fetchAll();
  }, [isAuthed, fetchAll]);

  const feeRow = configs.find(c => c.key === DELIVERY_FEE_KEY);
  const currentFee = Number(feeRow?.value ?? DEFAULT_DELIVERY_FEE);
  const otherRows = configs.filter(c => c.key !== DELIVERY_FEE_KEY);

  const handleSaveFee = async () => {
    if (savingFee) return;
    setFeeError(null);
    setFeeNotice(null);
    // Number('') is 0: a cleared field must not save a free delivery fee.
    const fee = feeInput.trim() === '' ? NaN : Number(feeInput);
    if (!Number.isInteger(fee) || fee < 0 || fee > MAX_DELIVERY_FEE) {
      setFeeError(`Enter a whole number of rupees from 0 to ${MAX_DELIVERY_FEE}.`);
      return;
    }
    if (fee === currentFee) {
      setFeeNotice('No change to save.');
      return;
    }
    if (!confirm(`Change the delivery fee from ₹${currentFee} to ₹${fee}? It applies to every new order quote immediately.`)) return;
    setSavingFee(true);
    try {
      await apiRequest('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify({
          key: DELIVERY_FEE_KEY,
          value: fee,
          description: feeRow?.description || 'Global delivery fee in INR',
        }),
      });
      setFeeNotice(`Delivery fee is now ₹${fee}.`);
      await fetchAll();
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : 'Could not save the delivery fee.');
    } finally {
      setSavingFee(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-16 glass-card p-8 text-center space-y-4">
        <p className="text-sm font-bold text-red-400">{loadError}</p>
        <button onClick={fetchAll} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in relative pb-20">
      <header className="bg-white/5 p-8 rounded-[40px] border border-white/5 glass flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">System <span className="text-blue-500">Config</span></h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Pricing and ordering parameters enforced by the backend</p>
        </div>
        <button onClick={fetchAll} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:bg-white/10">
          ↻ Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Delivery fee: read by the server's order pricing */}
        <div className="glass-card p-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-xl">🛵</div>
            <div>
              <h4 className="text-lg font-black text-white uppercase tracking-tight">Delivery Fee</h4>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Used by the server for every order quote</p>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label htmlFor="delivery-fee" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Fee per order (₹)</label>
              <input
                id="delivery-fee"
                type="number"
                min={0}
                max={MAX_DELIVERY_FEE}
                step={1}
                value={feeInput}
                onChange={(e) => { setFeeInput(e.target.value); setFeeError(null); setFeeNotice(null); }}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-black"
              />
            </div>
            <button
              onClick={handleSaveFee}
              disabled={savingFee}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white"
            >
              {savingFee ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            Current: ₹{currentFee}{!feeRow && ' (server default, not set in the database yet)'}. Member perks may discount it per order.
          </p>
          {feeError && <p className="text-xs font-bold text-red-400">{feeError}</p>}
          {feeNotice && <p className="text-xs font-bold text-emerald-400">{feeNotice}</p>}
        </div>

        {/* Live ordering status (read-only) */}
        <div className="glass-card p-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-xl">🕒</div>
            <div>
              <h4 className="text-lg font-black text-white uppercase tracking-tight">Ordering Status</h4>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Live from /api/orders/serviceability</p>
            </div>
          </div>

          {serviceability ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${serviceability.open ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-sm font-black text-white uppercase tracking-wider">
                  {serviceability.open ? 'Campus ordering is open' : 'Campus ordering is closed'}
                </span>
              </div>
              {!serviceability.open && (
                <p className="text-xs text-gray-400">
                  {serviceability.message}{serviceability.reopensAt ? ` Reopens at ${serviceability.reopensAt} IST.` : ''}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Payment methods:</span>
                {(serviceability.paymentMethods || ['COD', 'Wallet']).map(m => (
                  <span key={m} className="px-2 py-0.5 text-[10px] font-black rounded-full border border-white/10 bg-white/5 text-white">{m}</span>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Night hours are set on the server (storeHours). Online UPI/card payments are off: new orders are Cash on Delivery or Wallet only.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Could not read the live ordering status.</p>
          )}
        </div>
      </div>

      {/* Other stored keys: shown honestly as not enforced */}
      <div className="glass-card p-10 space-y-6">
        <div>
          <h4 className="text-lg font-black text-white uppercase tracking-tight">Other Stored Settings</h4>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            These keys exist in the database but neither the backend nor the apps read them today, so changing them would have no effect.
            They are shown read-only to avoid a false sense of control.
          </p>
        </div>
        {otherRows.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No other settings stored.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {otherRows.map(row => (
                  <tr key={row._id || row.key} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-4 font-mono text-gray-300">{row.key}</td>
                    <td className="py-2 pr-4 text-white font-bold">{formatValue(row.value)}</td>
                    <td className="py-2 text-gray-500">{row.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
