"use client";
import Link from 'next/link';
import Image from 'next/image';

export default function SplashPage() {
  return (
    <main className="min-h-screen bg-black text-white relative flex flex-col items-center justify-between p-10 overflow-hidden">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
         <Image 
           src="/images/splash_bg.png" 
           fill
           style={{ objectFit: 'cover' }}
           className="opacity-60" 
           alt="Premium Food" 
           priority
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      {/* Decorative Floating Elements (from reference style) */}
      <div className="absolute top-[20%] left-[10%] floating-plus opacity-20 text-4xl">+</div>
      <div className="absolute top-[40%] right-[15%] floating-plus opacity-10 text-6xl text-primary-yellow">+</div>

      {/* Hero Text Section */}
      <div className="relative z-10 w-full mt-20">
        <h1 className="text-[64px] font-black leading-[0.9] tracking-tighter mb-4 animate-slide-up">
           CAMPUS <br />
           <span className="italic font-serif text-primary-yellow">Bites.</span>
        </h1>
        <p className="text-secondary-text text-lg font-medium max-w-[280px] leading-snug animate-fade-in delay-200">
           The most elite food delivery for <br />
           <span className="text-white">SRM University AP.</span>
        </p>
      </div>

      {/* Branding / Tagline */}
      <div className="relative z-10 w-full flex flex-col gap-6 mb-12 animate-slide-up delay-500">
         <div className="flex items-center gap-4">
            <div className="h-[2px] w-12 bg-primary-yellow" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-yellow">EST. 2026</span>
         </div>
         
         <div className="space-y-4">
            <Link href="/login" className="w-full bg-white text-black h-[72px] rounded-full flex items-center justify-center font-black text-[15px] uppercase tracking-widest hover:bg-primary-yellow transition-all duration-500">
               Get Started
            </Link>
            <p className="text-center text-[10px] text-secondary-text uppercase tracking-widest font-bold">
               By SRMites, For SRMites.
            </p>
         </div>
      </div>
    </main>
  );
}
