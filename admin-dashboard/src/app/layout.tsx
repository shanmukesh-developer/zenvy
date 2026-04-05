import type { Metadata } from "next";
import Link from "next/link";
import { Outfit } from "next/font/google";
import "./globals.css";
import PushNotificationManager from '@/components/PushNotificationManager';
import NetworkStatus from '@/components/NetworkStatus';

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
    <html lang="en" className="dark">
      <body className={`${outfit.className} antialiased bg-[#0A0A0F] text-slate-200 selection:bg-blue-500/30`}>
        <script dangerouslySetInnerHTML={{ __html: `
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZjFhMmIzYzRkNWU2ZjdhOGI5YzAwMCIsIm5hbWUiOiJBZG1pbiBVc2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc0MzM5ODMxLCJleHAiOjE3NzY5MzE4MzF9.Uxu3cFn4Uz23z4Orc3otNoI2JSRrTXIyWpvBOX-wJcs');
            localStorage.setItem('user', JSON.stringify({ id: '65f1a2b3c4d5e6f7a8b9c000', name: 'Admin User', role: 'admin' }));
          }
        ` }} />
        <PushNotificationManager />
        
        {/* Cinematic Backdrop */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-soft" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#C9A84C]/5 blur-[100px] rounded-full animate-pulse-soft" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
        </div>

        <div className="relative z-10 flex min-h-screen">
          {/* Nexus Sidebar */}
          <aside className="w-72 border-r border-white/5 p-8 flex flex-col glass scrollbar-hide">
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center text-xl">
                  ⚡
                </div>
                <h1 className="text-2xl font-black tracking-tighter text-white">NEXUS</h1>
              </div>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] px-1">SRM AP Command</p>
            </div>

            <nav className="flex-1 space-y-2">
              <Link href="/" className="sidebar-link">
                <span>🏠</span> Dashboard
              </Link>
              <Link href="/fleet" className="sidebar-link">
                <span>🛵</span> Fleet Management
              </Link>
              <Link href="/restaurants" className="sidebar-link">
                <span>🍕</span> Gourmet Terminal
              </Link>
              <Link href="/orders" className="sidebar-link">
                <span>📦</span> Live Orders
              </Link>
              <Link href="/vault" className="sidebar-link">
                <span>🕯️</span> Zenvy Vault
              </Link>
              <Link href="/blocks" className="sidebar-link">
                <span>🏆</span> Block Wars
              </Link>
               <Link href="/finance" className="sidebar-link">
                 <span>💰</span> Finance Trace
               </Link>
               <Link href="/users" className="sidebar-link">
                 <span>👥</span> Elite Residents
               </Link>
               <Link href="/analytics" className="sidebar-link">
                 <span>📈</span> Performance Intel
               </Link>
               <Link href="/audit" className="sidebar-link">
                 <span>📋</span> Audit Logs
               </Link>
              <Link href="/config" className="sidebar-link">
                <span>⚙️</span> Nexus Config
              </Link>
            </nav>

            {/* System Status */}
            <div className="mt-auto pt-8 border-t border-white/5">
              <NetworkStatus />
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto bg-transparent relative">
             {/* Header Bar */}
             <header className="h-20 border-b border-white/5 px-10 flex items-center justify-between sticky top-0 bg-[#0A0A0F]/50 backdrop-blur-md z-40">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Operational HUD</span>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-xs font-black text-white">SRM Admin</p>
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Root Access Active</p>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#C9A84C] to-[#E5C973] p-[1px]">
                     <div className="w-full h-full rounded-full bg-[#0A0A0F] flex items-center justify-center text-lg">
                       👤
                     </div>
                   </div>
                </div>
             </header>
             <div className="p-10">
               {children}
             </div>
          </main>
        </div>
      </body>
    </html>
  );
}
