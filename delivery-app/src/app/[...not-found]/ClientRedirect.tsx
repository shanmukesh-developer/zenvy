"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the root SPA page immediately
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-primary-yellow border-t-transparent rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-black uppercase tracking-widest">Re-routing...</h2>
      <p className="text-zinc-500 mt-2">Connecting to Logistics Command Central</p>
    </div>
  );
}
