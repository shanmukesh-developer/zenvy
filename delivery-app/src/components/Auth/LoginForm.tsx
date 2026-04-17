"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Driver {
  _id: string;
  name: string;
  token: string;
}

interface LoginFormProps {
  onLogin: (driver: Driver) => void;
  apiUrl: string;
}

export default function LoginForm({ onLogin, apiUrl }: LoginFormProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Credentials required.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      // If it contains letters, use raw input (e.g. "driver-1"). 
      // Otherwise, assume it is a phone number and take last 10 digits.
      const last10 = /[a-zA-Z]/.test(phone) ? phone : phone.replace(/\D/g, '').slice(-10);
      
      const res = await fetch(`${apiUrl}/api/delivery/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: last10, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Authentication failed.');
        return;
      }

      localStorage.setItem('driverToken', data.token);
      localStorage.setItem('driver', JSON.stringify({ _id: data._id, name: data.name }));
      onLogin({ _id: data._id, name: data.name, token: data.token });
    } catch {
      setError('System unreachable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden font-outfit text-white">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-emerald-600/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-white/[0.03] border border-white/10 rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-8">🛵</div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Zenvy <span className="font-light text-slate-400">Rider</span></h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-bold">Authentication Gateway</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Credential ID (Phone)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-6 py-4 rounded-[20px] bg-white/[0.02] border border-white/5 outline-none focus:border-blue-500/40 transition-all font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Secure Key (Password)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-6 py-4 rounded-[20px] bg-white/[0.02] border border-white/5 outline-none focus:border-blue-500/40 transition-all font-bold"
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-[9px] font-bold uppercase tracking-widest text-center">{error}</motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-12 py-5 rounded-[22px] bg-white text-black font-bold text-xs uppercase tracking-[0.3em] hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Sign In'}
        </button>

        <p className="mt-12 text-center text-[8px] text-slate-600 font-medium uppercase tracking-[0.2em]">Logistics Protocol v2.5.0 // Secured via Nexus</p>
      </motion.div>
    </main>
  );
}
