/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from 'react';


interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    customer: string;
    upiUTR?: string;
    upiScreenshot?: string;
    price: number;
  } | null;
  /** Resolves to an error message on failure (modal stays open), or null on success. */
  onVerify: (orderId: string, isVerified: boolean) => Promise<string | null>;
}

export default function PaymentVerificationModal({ isOpen, onClose, order, onVerify }: PaymentVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setError(null);
    setImageFailed(false);
  }, [order?.id]);

  if (!isOpen || !order) return null;

  const handleAction = async (isVerified: boolean) => {
    if (loading) return;
    if (!isVerified && !confirm('Reject this payment? The order will be cancelled.')) return;
    setLoading(true);
    setError(null);
    const failure = await onVerify(order.id, isVerified);
    setLoading(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0D0D12] border border-white/10 w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Verify UPI payment</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Order #{order.id.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all">✕</button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em]">Customer</p>
              <p className="text-lg font-bold text-white">{order.customer}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em]">Amount</p>
              <p className="text-lg font-black text-white">₹{order.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em]">UTR Reference</p>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 font-mono text-sm text-blue-400 tracking-widest">
              {order.upiUTR || 'No UTR provided'}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em]">Payment screenshot</p>
            <div className="aspect-video bg-black rounded-3xl border border-white/5 overflow-hidden relative group">
              {order.upiScreenshot && !imageFailed ? (
                <img 
                  src={order.upiScreenshot} 
                  alt="Payment Screenshot" 
                  className="w-full h-full object-contain cursor-zoom-in group-hover:scale-105 transition-transform duration-500" 
                  onClick={() => { if (/^https?:\/\//i.test(order.upiScreenshot!)) window.open(order.upiScreenshot!, '_blank', 'noopener,noreferrer'); }}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                  {order.upiScreenshot ? 'The screenshot could not be loaded.' : 'No screenshot uploaded.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-8 mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
          <button
            disabled={loading}
            onClick={() => handleAction(false)}
            className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
          >
            Reject Payment
          </button>
          <button
            disabled={loading}
            onClick={() => handleAction(true)}
            className="flex-[2] py-4 bg-emerald-600 shadow-[0_0_40px_rgba(16,185,129,0.2)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:scale-[1.02] transition-all disabled:opacity-30"
          >
            {loading ? 'Saving...' : 'Mark payment verified'}
          </button>
        </div>
      </div>
    </div>
  );
}
