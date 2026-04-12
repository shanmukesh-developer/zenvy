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
      setError('Credentials required for portal access.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/api/delivery/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Authentication failed. Access denied.');
        return;
      }

      localStorage.setItem('driverToken', data.token);
      localStorage.setItem('driver', JSON.stringify({ _id: data._id, name: data.name }));
      onLogin({ _id: data._id, name: data.name, token: data.token });
    } catch (err) {
      console.error('Login error:', err);
      setError('System unreachable. Check network status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden font-outfit">
      {/* Sophisticated Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-emerald-600/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-16">
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-white/[0.03] border border-white/10 rounded-[28px] flex items-center justify-center text-4xl mx-auto mb-10 shadow-sm"
          >
            🛵
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Zenvy <span className="font-light text-slate-400">Rider</span></h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-bold">Authentication Gateway</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Credential ID</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-6 py-4 rounded-[20px] bg-white/[0.02] border border-white/5 text-white placeholder-slate-700 outline-none focus:border-blue-500/40 focus:bg-white/[0.04] transition-all duration-300"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Secure Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-6 py-4 rounded-[20px] bg-white/[0.02] border border-white/5 text-white placeholder-slate-700 outline-none focus:border-blue-500/40 focus:bg-white/[0.04] transition-all duration-300"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-[10px] font-bold uppercase text-center tracking-widest"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleLogin}
          disabled={loading}
          className={`w-full mt-12 py-5 rounded-[22px] font-bold text-xs uppercase tracking-[0.3em] transition-all relative overflow-hidden ${
            loading
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-white text-black hover:bg-slate-200'
          }`}
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </motion.button>

        <p className="mt-12 text-center text-[9px] text-slate-600 font-medium uppercase tracking-[0.15em]">
          Logistics Performance & Network Protocol v2.4
        </p>
      </motion.div>
    </main>
  );
}
