"use client";
import { useState } from 'react';
import { Store } from './catalogue';
import { FIELD, LABEL } from './StoreForm';

export interface PromotionInput {
  isFeatured: boolean;
  featuredBadge: string;
  promoOffer: string;
  addToCarousel: boolean;
}

/** Feature a store on Home (badge + offer ribbon) and optionally add a hero banner. */
export function PromoteModal({ store, onClose, onSave }: {
  store: Store;
  onClose: () => void;
  onSave: (input: PromotionInput) => Promise<void>;
}) {
  const [badge, setBadge] = useState(store.featuredBadge || 'Featured');
  const [offer, setOffer] = useState(store.promoOffer || '');
  const [addToCarousel, setAddToCarousel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (input: PromotionInput) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the promotion.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="promote-title">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0f14] p-6 text-white shadow-2xl">
        <h2 id="promote-title" className="text-xl font-bold">Promote {store.name}</h2>
        <p className="mt-1 text-sm text-gray-400">Featured stores show a badge and move up the Home feed.</p>

        <div className="mt-5 space-y-4">
          <label className={LABEL}>Badge text
            <input className={FIELD} value={badge} maxLength={30} onChange={e => setBadge(e.target.value)} placeholder="e.g. Featured" />
          </label>
          <label className={LABEL}>Offer ribbon (optional)
            <input className={FIELD} value={offer} maxLength={80} onChange={e => setOffer(e.target.value)} placeholder="Only describe an offer the store really gives" />
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-300">
            <input type="checkbox" checked={addToCarousel} onChange={e => setAddToCarousel(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-500" />
            <span>Also add (or update) a Home hero banner that opens this store</span>
          </label>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {store.isFeatured && (
            <button type="button" disabled={saving} onClick={() => save({ isFeatured: false, featuredBadge: '', promoOffer: '', addToCarousel: false })} className="mr-auto rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50">
              End promotion
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white">Cancel</button>
          <button type="button" disabled={saving} onClick={() => save({ isFeatured: true, featuredBadge: badge.trim() || 'Featured', promoOffer: offer.trim(), addToCarousel })} className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
            {saving ? 'Saving…' : store.isFeatured ? 'Update promotion' : 'Promote'}
          </button>
        </div>
      </div>
    </div>
  );
}
