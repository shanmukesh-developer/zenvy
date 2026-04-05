import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

import { CartProvider } from '@/context/CartContext';
import PushNotificationManager from '@/components/PushNotificationManager';
import AndroidBackButton from '@/components/AndroidBackButton';
import VFXParticles from '@/components/VFXParticles';
import CursorSpotlight from '@/components/CursorSpotlight';
import Meteors from '@/components/Meteors';
import GlobalAnnouncement from '@/components/GlobalAnnouncement';
import SurgeBanner from '@/components/SurgeBanner';

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
        <GlobalAnnouncement />
        <SurgeBanner />
        <CartProvider>
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
             <div className="film-grain" />
             <div className="vfx-bokeh opacity-40 mix-blend-screen" />
             <div className="vfx-flare" />
             
             {/* Floating Ambient Orbs */}
             <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-[#C9A84C]/[0.08] rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite]" />
             <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[#38BDF8]/[0.05] rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite_2s]" />
             
             {/* Rising Fireflies / Gold Dust */}
             <VFXParticles />
             
             {/* Diagonal Shooting Stars */}
             <Meteors number={12} />
          </div>

          {/* Interactive Mouse Lighting */}
          <CursorSpotlight />

          <div className="animate-page overflow-x-hidden w-full max-w-full relative z-10 transition-all duration-700">
            {children}
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
