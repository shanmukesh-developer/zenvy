"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SuccessOverlay from '@/components/SuccessOverlay';

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false, title: '', message: '',
  });

  const handleRegister = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      setOverlay({ isOpen: true, title: 'Missing Details', message: 'Please fill in all required fields.', type: 'error' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Support alphabetic IDs
      const phoneVal = formData.phone;
      const last10 = /[a-zA-Z]/.test(phoneVal) ? phoneVal : phoneVal.replace(/\D/g, '').slice(-10);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: formData.name, 
          phone: last10, 
          password: formData.password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ id: data._id, name: data.name, phone: data.phone }));
        setOverlay({ isOpen: true, title: '🎉 Welcome to Zenvy!', message: 'Your account has been created successfully.', type: 'success' });
        setTimeout(() => router.push('/'), 2000);
      } else {
        setOverlay({ isOpen: true, title: 'Registration Failed', message: data.message || 'Something went wrong.', type: 'error' });
      }
    } catch (err: unknown) {
      console.error("Registration error:", err);
      setOverlay({ 
        isOpen: true, 
        title: 'Network Error', 
        message: 'Could not connect to the registration server. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020203] text-white p-6 md:p-10 flex flex-col justify-start md:justify-center relative overflow-y-auto">
      {/* 🌌 Optimized Cyber-Nexus Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#020203]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,76,0.1),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(139,92,246,0.05),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto">
        <Link href="/login" className="w-11 h-11 bg-white/5 backdrop-blur-3xl rounded-2xl flex items-center justify-center border border-white/10 hover:border-primary-yellow/40 transition-all mb-10 ml-4">
          <svg className="w-4 h-4 text-white/20 hover:text-primary-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* 🎭 Nexus Header */}
        <div className="text-left mb-12 ml-4">
          <h1 className="text-[10px] font-black uppercase tracking-[1em] text-primary-yellow/60 mb-4 brightness-125">
            IDENTITY TERMINAL
          </h1>
          <h2 className="text-[54px] md:text-[64px] font-black leading-[0.8] tracking-tighter text-white uppercase italic" style={{ fontFamily: "'Syne', sans-serif" }}>
             NEW <br />
             <span className="text-gold-gradient-glow font-black not-italic">OPERATIVE</span>
          </h2>
        </div>

        <div className="glass-card-extreme p-8 md:p-10 space-y-8 border-white/5 relative">
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30 ml-2">Display Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="name"
              placeholder="ENTER FULL NAME"
              className="w-full bg-[#020203] border border-white/[0.05] hover:border-white/10 focus:border-primary-yellow/40 rounded-2xl h-[68px] px-8 font-bold text-sm tracking-[0.2em] transition-all outline-none uppercase placeholder:text-white/5"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30 ml-2">Uplink ID</label>
            <div className="relative group/input">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary-yellow font-black text-xs tracking-widest opacity-20 group-focus-within/input:opacity-100 transition-opacity">+91</span>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                autoComplete="tel"
                placeholder="AUTHORIZE ID"
                className="w-full bg-[#020203] border border-white/[0.05] hover:border-white/10 focus:border-primary-yellow/40 rounded-2xl h-[68px] pl-16 pr-6 font-bold text-sm tracking-[0.2em] transition-all outline-none uppercase placeholder:text-white/5"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30 ml-2">Security Cipher</label>
            <div className="relative group/input">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
                placeholder="NEXUS CIPHER"
                className="w-full bg-[#020203] border border-white/[0.05] hover:border-white/10 focus:border-primary-yellow/40 rounded-2xl h-[68px] px-8 font-bold text-sm tracking-[0.2em] transition-all outline-none uppercase placeholder:text-white/5"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/20 hover:text-primary-yellow transition-all text-xl"
              >
                 {showPassword ? '◌' : '●'}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleRegister}
              disabled={isSubmitting}
              className="w-full h-[68px] relative rounded-2xl bg-black border border-primary-yellow/50 text-primary-yellow text-xs uppercase font-black tracking-[0.6em] shadow-[0_0_50px_rgba(201,168,76,0.1)] hover:shadow-[0_0_80px_rgba(201,168,76,0.25)] transition-all duration-700 group/btn overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-yellow/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-shimmer" />
              <span className="relative z-10">
                {isSubmitting ? 'INITIALIZING...' : 'ESTABLISH ACCESS'}
              </span>
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">
              Known Operative? <Link href="/login" className="text-primary-yellow hover:text-white transition-colors underline underline-offset-8 ml-2">Login To Terminal</Link>
            </p>
          </div>
        </div>
      </div>

      <SuccessOverlay
        isOpen={overlay.isOpen}
        onClose={() => setOverlay(prev => ({ ...prev, isOpen: false }))}
        title={overlay.title}
        message={overlay.message}
        type={overlay.type}
      />
    </main>
  );
}
