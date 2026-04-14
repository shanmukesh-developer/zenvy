"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SuccessOverlay from '@/components/SuccessOverlay';
import { auth } from '@/utils/firebase';
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [useOtp, setUseOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Input, 2: OTP
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const [overlay, setOverlay] = useState<{ isOpen: boolean; title: string; message: string; type?: 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const [verifier, setVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!useOtp) return;
    const v = new RecaptchaVerifier(auth, 'login-recaptcha-container', {
      size: 'invisible',
    });
    setVerifier(v);
    // REMOVED v.clear() from here because it causes 'style of null' crash if cleanup 
    // fires while a CAPTCHA challenge is still visible or in-flight.
  }, [useOtp]);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setOverlay({ isOpen: true, title: 'Invalid Phone', message: 'Enter a valid 10-digit number.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (!verifier) throw new Error('Recaptcha not initialized. Please refresh.');

      // Robust formatting: take only numeric digits and keep the last 10
      const digits = phone.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      const formattedPhone = `+91${last10}`;
      
      // ✨ TEST MODE BYPASS for localhost simulation
      const isTestMode = process.env.NEXT_PUBLIC_SKIP_OTP === 'true';
      if (last10 === '1234567890' || isTestMode) {
        setStep(2);
        setOverlay({ isOpen: true, title: 'Test Mode', message: 'OTP bypass active. Use code 123456.', type: 'success' });
        setLoading(false);
        return;
      }

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);

      setConfirmationResult(confirmation);
      setStep(2);
      setOverlay({ isOpen: true, title: 'OTP Sent', message: 'Verification code sent to your phone.', type: 'success' });
    } catch (error) {
      console.error('OTP Error:', error);
      let message = error instanceof Error ? error.message : 'Failed to send OTP.';
      if (message.includes('billing-not-enabled')) {
        message = 'Firebase SMS limit reached or Billing not enabled. Use a TEST number or upgrade to Blaze plan.';
      } else if (message.includes('invalid-app-credential')) {
        message = 'Security Check Failed. Check Authorized Domains or API Key restrictions.';
      }
      setOverlay({ isOpen: true, title: 'Error', message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };



  const handleVerifyAndLogin = async () => {
    if (!otp || otp.length < 6) {
      setOverlay({ isOpen: true, title: 'Invalid OTP', message: 'Enter the 6-digit code.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      // ✨ TEST MODE VERIFICATION
      const isTestMode = process.env.NEXT_PUBLIC_SKIP_OTP === 'true';
      if ((phone.replace(/\D/g, '').endsWith('1234567890') || isTestMode) && otp === '123456') {
        await finalizeLogin({ firebaseToken: 'E2E_MOCK_TOKEN' });
        return;
      }

      const result = await confirmationResult?.confirm(otp);
      const firebaseToken = await result?.user.getIdToken();
      
      await finalizeLogin({ firebaseToken });
    } catch (error) {
      setOverlay({ isOpen: true, title: 'Auth Failed', message: error instanceof Error ? error.message : 'Invalid OTP.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = async (payload: { firebaseToken?: string; password?: string }) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
    try {
      const response = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, ...payload })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({ 
          id: data._id, 
          name: data.name,
          phone: data.phone,
          hostelBlock: data.hostelBlock,
          roomNumber: data.roomNumber
        }));
        
        setOverlay({ isOpen: true, title: 'Login Successful', message: `Welcome back, ${data.name}!`, type: 'success' });
        setTimeout(() => router.push('/'), 1500);
      } else {
        setOverlay({ isOpen: true, title: 'Access Denied', message: data.message || 'Login failed.', type: 'error' });
      }
    } catch {
      setOverlay({ isOpen: true, title: 'Network Error', message: 'Connection to gateway failed.', type: 'error' });
    }
  };

  const handlePasswordLogin = () => {
    if (!password) {
      setOverlay({ isOpen: true, title: 'Password Required', message: 'Please enter your gourmet password.', type: 'error' });
      return;
    }
    finalizeLogin({ password });
  };

  return (
    <main className="min-h-screen bg-background text-white p-10 flex flex-col justify-between">
      <div id="login-recaptcha-container"></div>
      
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

        {step === 1 ? (
          <div className="space-y-6">
            <p className="text-secondary-text text-sm font-medium mb-12">
               Choose your preferred login method.
            </p>

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

            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => setUseOtp(false)}
                className={`flex-1 py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${!useOtp ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-slate-500'}`}
              >
                Password Login
              </button>
              <button 
                onClick={() => setUseOtp(true)}
                className={`flex-1 py-3 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${useOtp ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-slate-500'}`}
              >
                Secure OTP
              </button>
            </div>

            {!useOtp ? (
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Gourmet Password"
                className="w-full bg-[#1C1C1E] border-none rounded-[30px] h-[72px] px-8 font-black text-lg focus:ring-2 focus:ring-primary-yellow transition-all outline-none"
              />
            ) : null}

            <button 
              onClick={useOtp ? handleSendOtp : handlePasswordLogin}
              disabled={loading}
              className="w-full btn-yellow flex justify-center py-6 text-sm uppercase font-black tracking-[0.2em] shadow-[0_20px_40px_rgba(247,211,49,0.2)] disabled:opacity-50"
            >
               {loading ? 'Processing...' : (useOtp ? 'Get Security Code' : 'Authorize Login')}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-secondary-text text-sm font-medium mb-12">
               Enter the code sent to <span className="text-white">+91 {phone}</span>
            </p>

            <input 
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="0 0 0 0 0 0"
              className="w-full bg-[#1C1C1E] border-none rounded-[30px] h-[80px] px-8 font-black text-[32px] text-center tracking-[0.5em] focus:ring-2 focus:ring-primary-yellow transition-all outline-none"
            />

            <button 
              onClick={handleVerifyAndLogin}
              disabled={loading}
              className="w-full btn-yellow flex justify-center py-6 text-sm uppercase font-black tracking-[0.2em] shadow-[0_20px_40px_rgba(247,211,49,0.2)]"
            >
               {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <button 
              onClick={() => setStep(1)}
              className="w-full text-center text-secondary-text text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
              Back to methods
            </button>
          </div>
        )}
      </div>

      <div className="text-center pb-10 space-y-4">
         <p className="text-[10px] text-secondary-text uppercase tracking-widest font-bold">
            New to Zenvy? <Link href="/register" className="text-primary-yellow underline underline-offset-4">Create Account</Link>
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

