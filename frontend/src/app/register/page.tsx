"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SuccessOverlay from '@/components/SuccessOverlay';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: ''
  });
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const handleRegister = async () => {
    const { name, phone, password } = formData;
    
    if (!name || !phone || !password) {
      setOverlay({
        isOpen: true,
        title: 'Missing Details',
        message: 'Please fill in all required fields to proceed.',
        type: 'error'
      });
      return;
    }

    if (phone.length < 10) {
      setOverlay({
        isOpen: true,
        title: 'Invalid Number',
        message: 'Please enter a valid 10-digit phone number.',
        type: 'error'
      });
      return;
    }

    setOverlay({
      isOpen: true,
      title: 'Creating Account',
      message: 'Setting up your Zenvy account...',
      type: 'success'
    });

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ 
          id: data._id, 
          name: data.name,
          phone: data.phone
        }));
        
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setOverlay({
          isOpen: true,
          title: 'Crafting Failed',
          message: data.message || 'Something went wrong during registration.',
          type: 'error'
        });
      }
    } catch {
      setOverlay({
        isOpen: true,
        title: 'Network Interrupted',
        message: 'Unable to reach Zenvy servers. Please check your connection.',
        type: 'error'
      });
    }
  };

  return (
    <main className="min-h-screen bg-background text-white p-8 pb-20">
      <div className="w-full sm:max-w-[430px] mx-auto">
        <Link href="/login" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-8 mt-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </Link>
        
        <h1 className="text-4xl font-black leading-tight mb-2">
           Create <br />
           <span className="text-primary-yellow italic font-serif">Account</span>
        </h1>
        <p className="text-secondary-text text-[11px] font-bold uppercase tracking-[0.2em] mb-10">
           Experience premium dining at your doorstep.
        </p>

        <div className="space-y-6">
           <div className="space-y-2">
              <label className="text-[9px] font-black text-secondary-text uppercase tracking-widest ml-4">Full Name</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoComplete="name"
                placeholder="Enter your full name"
                className="w-full bg-[#141416] border border-white/[0.03] rounded-[24px] h-[64px] px-6 font-bold text-sm focus:ring-1 focus:ring-primary-yellow transition-all outline-none"
              />
           </div>

           <div className="space-y-2">
              <label className="text-[9px] font-black text-secondary-text uppercase tracking-widest ml-4">Phone Number</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 font-black text-sm">+91</span>
                <input 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    autoComplete="tel"
                    placeholder="Enter Number"
                    className="w-full bg-[#141416] border border-white/[0.03] rounded-[24px] h-[64px] pl-16 pr-6 font-bold text-sm focus:ring-1 focus:ring-primary-yellow transition-all outline-none"
                />
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[9px] font-black text-secondary-text uppercase tracking-widest ml-4">Password</label>
              <input 
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="new-password"
                placeholder="********"
                className="w-full bg-[#141416] border border-white/[0.03] rounded-[24px] h-[64px] px-6 font-bold text-sm focus:ring-1 focus:ring-primary-yellow transition-all outline-none"
              />
           </div>


           <div className="pt-4">
              <button 
                onClick={handleRegister}
                className="w-full btn-yellow flex justify-center py-6 text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary-yellow/10"
              >
                  Create Account
              </button>
           </div>
        </div>

        <div className="mt-12 text-center">
           <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold">
              Already have an account? <Link href="/login" className="text-primary-yellow underline underline-offset-4 ml-1">Login Instead</Link>
           </p>
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

