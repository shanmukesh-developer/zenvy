"use client";
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/utils/firebase';
import SuccessOverlay from '@/components/SuccessOverlay';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

type Step = 'form' | 'otp';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false, title: '', message: '',
  });

  useEffect(() => {
    return () => {
      // Cleanup recaptcha on unmount
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      });
    }
  };

  const handleSendOtp = async () => {
    const { name, phone, password } = formData;
    if (!name || !phone || !password) {
      setOverlay({ isOpen: true, title: 'Missing Details', message: 'Please fill in all required fields.', type: 'error' });
      return;
    }
    if (phone.length < 10) {
      setOverlay({ isOpen: true, title: 'Invalid Number', message: 'Please enter a valid 10-digit phone number.', type: 'error' });
      return;
    }

    setIsSending(true);
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier!;
      const fullPhone = `+91${phone.replace(/\D/g, '')}`;
      const result = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      window.confirmationResult = result;
      setStep('otp');
    } catch (err: unknown) {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
      const message = err instanceof Error ? err.message : 'Failed to send OTP.';
      setOverlay({ isOpen: true, title: 'OTP Failed', message, type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyAndRegister = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) {
      setOverlay({ isOpen: true, title: 'Incomplete OTP', message: 'Please enter all 6 digits.', type: 'error' });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await window.confirmationResult!.confirm(enteredOtp);
      const firebaseToken = await result.user.getIdToken();

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, firebaseToken }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ id: data._id, name: data.name, phone: data.phone }));
        setOverlay({ isOpen: true, title: '🎉 Welcome to Zenvy!', message: 'Your account has been verified and created.', type: 'success' });
        setTimeout(() => router.push('/'), 2000);
      } else {
        setOverlay({ isOpen: true, title: 'Registration Failed', message: data.message || 'Something went wrong.', type: 'error' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'OTP verification failed.';
      const isWrong = message.includes('auth/invalid-verification-code') || message.includes('auth/code-expired');
      setOverlay({
        isOpen: true,
        title: isWrong ? 'Wrong OTP' : 'Verification Error',
        message: isWrong ? 'The OTP you entered is incorrect or expired. Please try again.' : message,
        type: 'error',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-white p-8 pb-20">
      {/* Invisible reCAPTCHA mount point */}
      <div id="recaptcha-container" />

      <div className="w-full sm:max-w-[430px] mx-auto">
        {step === 'form' ? (
          <>
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
                  onClick={handleSendOtp}
                  disabled={isSending}
                  className="w-full btn-yellow flex items-center justify-center gap-2 py-6 text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary-yellow/10 disabled:opacity-60"
                >
                  {isSending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      Sending OTP...
                    </>
                  ) : 'Verify & Create Account'}
                </button>
              </div>
            </div>

            <div className="mt-12 text-center">
              <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold">
                Already have an account? <Link href="/login" className="text-primary-yellow underline underline-offset-4 ml-1">Login Instead</Link>
              </p>
            </div>
          </>
        ) : (
          /* OTP Step */
          <>
            <button
              onClick={() => setStep('form')}
              className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-8 mt-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="text-4xl font-black leading-tight mb-2">
              Verify <br />
              <span className="text-primary-yellow italic font-serif">Phone</span>
            </h1>
            <p className="text-secondary-text text-[11px] font-bold uppercase tracking-[0.2em] mb-3">
              OTP sent to +91 {formData.phone}
            </p>

            {/* 6-digit OTP boxes */}
            <div className="flex gap-3 my-10 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-black bg-[#141416] border border-white/[0.08] rounded-2xl focus:ring-2 focus:ring-primary-yellow outline-none transition-all"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyAndRegister}
              disabled={isVerifying}
              className="w-full btn-yellow flex items-center justify-center gap-2 py-6 text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary-yellow/10 disabled:opacity-60"
            >
              {isVerifying ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Verifying...
                </>
              ) : 'Confirm & Create Account'}
            </button>

            <button
              onClick={handleSendOtp}
              disabled={isSending}
              className="w-full mt-4 py-4 text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-white transition-colors disabled:opacity-40"
            >
              {isSending ? 'Resending...' : 'Resend OTP'}
            </button>
          </>
        )}
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
