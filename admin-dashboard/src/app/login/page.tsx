"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '@/lib/config';
import { getAuthState, startSession } from '@/lib/session';

/** Only allow same-site relative redirects after login. */
const safeNext = () => {
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')) return next;
  } catch { /* ignore */ }
  return '/';
};

const normalizePhone = (value: string) => value.replace(/\D/g, '').slice(-10);

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Explain why the admin landed here (expired session, non-admin account, ...).
  useEffect(() => {
    const reason = getAuthState().message;
    if (reason) setError(reason);
  }, []);

  const handleLogin = async () => {
    const digits = normalizePhone(phone);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter the 10-digit mobile number of your admin account.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, password }),
      });

      let data: any = {};
      try { data = await response.json(); } catch { /* non-JSON error page */ }

      if (response.ok && data.token) {
        if (String(data.role || '').toLowerCase() !== 'admin') {
          setError('This account does not have admin access.');
          return;
        }
        startSession(data.token, {
          id: String(data.id ?? data._id ?? ''),
          name: data.name || 'Admin',
          phone: data.phone ?? digits,
          email: data.email || null,
          role: data.role,
        });
        setPassword('');
        router.replace(safeNext());
        return;
      }

      if (response.ok) {
        // e.g. { isNewUser: true } — not a usable admin login
        setError('No admin account uses this number.');
      } else if (response.status === 429) {
        setError(data.message || 'Too many attempts. Please wait 15 minutes and try again.');
      } else if (response.status === 401 && data.code === 'ACCOUNT_NOT_FOUND') {
        setError('No account uses this number.');
      } else if (response.status === 401) {
        setError('Wrong phone number or password.');
      } else if (response.status === 403) {
        setError(data.message || 'This account is suspended.');
      } else if (response.status >= 500) {
        setError('The server had a problem signing you in. Please try again.');
      } else {
        setError(data.message || data.errors?.[0]?.msg || 'Sign in failed. Please try again.');
      }
    } catch {
      setError('Could not reach the Zenvy server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-600/5 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass p-10 rounded-[32px] border border-white/5 relative z-10"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-2xl">
            ⚡
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Nexus <span className="text-blue-500">Secure</span></h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Administrative Command Terminal</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="admin-phone" className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Admin mobile number</label>
            <input
              id="admin-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="10-digit mobile number"
              maxLength={16}
              className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:border-blue-500/40 transition-all text-center tracking-[0.2em]"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Password</label>
            <input
              id="admin-password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••••••"
              className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-white font-bold outline-none focus:border-blue-500/40 transition-all text-center tracking-[0.3em]"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-white text-black py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] hover:bg-gray-200 transition-all shadow-xl shadow-blue-500/5 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="absolute bottom-10 text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em]">
        Zenvy Operations Management Portal
      </div>
    </main>
  );
}
