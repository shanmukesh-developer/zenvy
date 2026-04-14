"use client";
import React, { useState, useRef } from 'react';
import Image from 'next/image';

interface DeliveryProofProps {
  orderId: string;
  apiUrl: string;
  token: string;
  onProofUploaded?: () => void;
}

export default function DeliveryProof({ orderId, apiUrl, onProofUploaded }: DeliveryProofProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const preview = URL.createObjectURL(file);
    setPhotoUrl(preview);

    try {
      const form = new FormData();
      form.append('image', file);
      form.append('orderId', orderId);
      const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        console.log('[DeliveryProof] Uploaded:', data.imageUrl);
        onProofUploaded?.();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      {photoUrl ? (
        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src={photoUrl} alt="Delivery proof" width={400} height={128} className="w-full h-32 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
            <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">
              {uploading ? '⏳ Uploading...' : '✅ Proof Captured'}
            </p>
          </div>
          <button
            onClick={() => { setPhotoUrl(null); if(inputRef.current) inputRef.current.value = ''; }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
          >×</button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-3 rounded-2xl bg-white/3 border border-white/5 text-gray-400 hover:border-white/10 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <span className="text-base">📸</span> Capture Proof of Delivery
        </button>
      )}
    </div>
  );
}
