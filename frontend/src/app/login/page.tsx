"use client";
import Link from 'next/link';
import { useState } from 'react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');

  const handleLogin = () => {
    // Simulate real auth by storing a dummy JWT and user ID
    localStorage.setItem('token', 'mock_jwt_token_for_srm_student');
    localStorage.setItem('user', JSON.stringify({ id: '65f1a2b3c4d5e6f7a8b9c0d1', name: 'Shanmukh' }));
    window.location.href = '/';
  };

  return (
    <main className="min-h-screen bg-background text-white p-10 flex flex-col justify-between">
      <div>
        <Link href="/splash" className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-12">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </Link>
        
        <h1 className="text-[40px] font-black leading-tight mb-2">
           Welcome <br />
           <span className="text-primary-yellow italic font-serif">Back!</span>
        </h1>
        <p className="text-secondary-text text-sm font-medium mb-12">
           Login with your SRM phone number.
        </p>

        <div className="space-y-8">
           <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary-text font-black text-sm uppercase tracking-widest">
                 +91
              </span>
              <input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter Number"
                className="w-full bg-[#1C1C1E] border-none rounded-[30px] h-[72px] pl-20 pr-6 font-black text-lg focus:ring-2 focus:ring-primary-yellow transition-all"
              />
           </div>

           <button 
             onClick={handleLogin}
             className="w-full btn-yellow flex justify-center py-6 text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(247,211,49,0.2)]"
           >
              Send OTP
           </button>
        </div>
      </div>

      <div className="text-center pb-10">
         <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold">
            Trouble logging in? <span className="text-primary-yellow">Contact IT</span>
         </p>
      </div>
    </main>
  );
}
