import React from 'react';
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from '@/context/CartContext';
import PushNotificationManager from '@/components/PushNotificationManager';
import AndroidBackButton from '@/components/AndroidBackButton';
import VFXParticles from '@/components/VFXParticles';
import CursorSpotlight from '@/components/CursorSpotlight';
import Meteors from '@/components/Meteors';
import ToastProvider from '@/components/ToastProvider';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Zenvy — Food Delivery in Amaravathi",
  description: "Order food from the best restaurants in Amaravathi. Fast delivery, easy tracking, premium experience.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0B"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AndroidBackButton />
        <PushNotificationManager />
        <ToastProvider />
        <CartProvider>
          {/* Performance Optimized VFX Layer */}
          <VFXController />

          <div className="relative z-10">
            {children}
          </div>
        </CartProvider>
      </body>
    </html>
  );
}

// Internal component to handle conditional rendering without polluting the main layout
function VFXController() {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 640);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.06),transparent_60%)]" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="film-grain" />
        <div className="vfx-bokeh opacity-40 mix-blend-screen" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#C9A84C]/[0.08] rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite]" style={{ willChange: 'transform' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[#38BDF8]/[0.05] rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite_2s]" style={{ willChange: 'transform' }} />
        <VFXParticles />
        <Meteors number={8} />
      </div>
      <CursorSpotlight />
    </>
  );
}
