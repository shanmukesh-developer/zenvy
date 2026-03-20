"use client";
import Link from 'next/link';
import { useState } from 'react';
import SuccessOverlay from '@/components/SuccessOverlay';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const handleLogin = async () => {
    if (!phone || phone.length < 10 || !password) {
      setOverlay({
        isOpen: true,
        title: 'Missing Details',
        message: 'Please enter your phone and gourmet password.',
        type: 'error'
      });
      return;
    }

    setOverlay({
      isOpen: true,
      title: 'Authenticating',
      message: 'Verifying your secure connection to Zenvy...',
      type: 'success'
    });

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ 
          id: data._id, 
          name: data.name,
          phone: data.phone,
          hostelBlock: data.hostelBlock, // These will be used for address management
          roomNumber: data.roomNumber
        }));
        
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setOverlay({
          isOpen: true,
          title: 'Access Denied',
          message: data.message || 'Invalid phone or password. Please try again.',
          type: 'error'
        });
      }
    } catch (err) {
      setOverlay({
        isOpen: true,
        title: 'Connection Lost',
        message: 'The Zenvy gateway is temporarily unreachable.',
        type: 'error'
      });
    }
  };

  return (
    <main className="min-h-screen bg-background text-white p-10 flex flex-col justify-between">
      <div>
        <Link href="/" className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-12">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </Link>
        
        <h1 className="text-[40px] font-black leading-tight mb-2">
           Welcome <br />
           <span className="text-primary-yellow italic font-serif">Back!</span>
        </h1>
        <p className="text-secondary-text text-sm font-medium mb-12">
           Login with your phone number and password.
        </p>

        <div className="space-y-6">
           <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary-text font-black text-sm uppercase tracking-widest">
                 +91
              </span>
              <input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter Number"
                className="w-full bg-[#1C1C1E] border-none rounded-[30px] h-[72px] pl-20 pr-6 font-black text-lg focus:ring-2 focus:ring-primary-yellow transition-all outline-none"
              />
           </div>

           <div className="relative">
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Gourmet Password"
                className="w-full bg-[#1C1C1E] border-none rounded-[30px] h-[72px] px-8 font-black text-lg focus:ring-2 focus:ring-primary-yellow transition-all outline-none"
              />
           </div>

           <button 
             onClick={handleLogin}
             className="w-full btn-yellow flex justify-center py-6 text-sm uppercase font-black tracking-[0.2em] shadow-[0_20px_40px_rgba(247,211,49,0.2)]"
           >
              Authorize Login
           </button>
        </div>
      </div>

      <div className="text-center pb-10 space-y-4">
         <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold">
            New to Zenvy? <Link href="/register" className="text-primary-yellow underline underline-offset-4">Create Account</Link>
         </p>
         <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold opacity-40">
            Trouble logging in? <span className="text-primary-yellow">Contact Support</span>
         </p>
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
