import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import SOSAlertModal from '@/components/SOSAlertModal';
import NexusLayoutClient from '@/components/NexusLayoutClient';
import FetchInterceptor from '@/components/FetchInterceptor';
import AdminSocketProvider from '@/components/AdminSocketProvider';

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zenvy Nexus | Command Center",
  description: "The operational heart of Zenvy campus delivery. Real-time telemetry, fleet management, and deep analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body className={`${outfit.className} antialiased bg-[#0A0A0F] text-slate-200 selection:bg-blue-500/30`} suppressHydrationWarning={true}>
        <AdminSocketProvider>
          <FetchInterceptor />
          <SOSAlertModal />
          
          {/* Cinematic Backdrop with Hardware Acceleration */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{ transform: 'translate3d(0,0,0)' }}>
            <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-blue-600/10 blur-[70px] rounded-full animate-pulse-soft" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-[var(--zenvy-gold)]/5 blur-[70px] rounded-full animate-pulse-soft" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
          </div>

          <NexusLayoutClient>
            {children}
          </NexusLayoutClient>
        </AdminSocketProvider>
      </body>
    </html>
  );
}
