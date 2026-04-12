"use client";
import React, { useState, useEffect } from 'react';

interface OrderTimerProps {
  createdAt: string;
}

export function OrderTimer({ createdAt }: OrderTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const base = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isLate = mins >= 20;
  const isWarning = mins >= 12;

  return (
    <span className={`text-[10px] font-black tabular-nums px-2 py-0.5 rounded-lg ${
      isLate ? 'bg-red-500/20 text-red-400' 
      : isWarning ? 'bg-yellow-500/20 text-yellow-400' 
      : 'bg-white/5 text-gray-400'
    }`}>
      {isLate ? '⏰' : isWarning ? '⚡' : '🕐'} {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
    </span>
  );
}

interface CustomerContactProps {
  phone?: string;
  name: string;
}

export function CustomerContact({ phone, name }: CustomerContactProps) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\D/g, '');
  return (
    <div className="flex gap-2 mt-3">
      <a
        href={`tel:${cleanPhone}`}
        className="flex-1 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest text-center hover:bg-blue-500/20 transition-all"
      >
        📞 Call {name.split(' ')[0]}
      </a>
      <a
        href={`https://wa.me/91${cleanPhone}?text=Hi+I'm+your+Zenvy+rider!+I'm+on+my+way.`}
        target="_blank"
        rel="noreferrer"
        className="flex-1 py-2.5 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest text-center hover:bg-green-500/20 transition-all"
      >
        💬 WhatsApp
      </a>
    </div>
  );
}

interface SpecialInstructionsProps {
  note?: string;
}

export function SpecialInstructions({ note }: SpecialInstructionsProps) {
  if (!note) return null;
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl mb-4">
      <p className="text-[8px] font-black uppercase tracking-widest text-yellow-500 mb-1">Customer Note</p>
      <p className="text-xs text-yellow-200/80 font-medium italic">"{note}"</p>
    </div>
  );
}
