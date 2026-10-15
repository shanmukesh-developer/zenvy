"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import NetworkStatus from '@/components/NetworkStatus';
import { useState, useEffect, useCallback } from 'react';
import { useVisibleInterval } from '@/lib/useVisibleInterval';
import { API_URL } from '@/lib/config';
import { logout } from '@/lib/session';
import { useAdminAuth } from '@/utils/useAdminAuth';

function AuthScreen({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-3xl border border-white/5 p-10 max-w-md w-full text-center" role="status" aria-live="polite">
        <p className="text-sm font-black text-white uppercase tracking-widest">{title}</p>
        {detail && <p className="mt-3 text-sm text-gray-400">{detail}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export default function NexusLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const isLoginPage = pathname.replace(/\/+$/, '') === "/login";
  const auth = useAdminAuth();
  const [systemHealth, setSystemHealth] = useState<{ database: string, persistence: string }>({ database: '...', persistence: '...' });

  const isAuthed = auth.status === 'authed';

  // Signed out (or not an admin): go to the login page and come back afterwards.
  useEffect(() => {
    if (isLoginPage || auth.status !== 'denied') return;
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [isLoginPage, auth.status, pathname, router]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/health`);
      if (!res.ok) return;
      const data = await res.json();
      setSystemHealth(data);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (isLoginPage || !isAuthed) return;
    fetchHealth();
  }, [isLoginPage, isAuthed, fetchHealth]);
  // Every 2 minutes, paused while the tab is hidden.
  useVisibleInterval(fetchHealth, 120000, !isLoginPage && isAuthed);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (auth.status === 'checking') {
    return <AuthScreen title="Verifying admin session" detail="Checking your access with the Zenvy server..." />;
  }

  if (auth.status === 'error') {
    return (
      <AuthScreen
        title="Can't verify your session"
        detail={auth.message || 'The server could not be reached.'}
        action={
          <div className="flex gap-3 justify-center">
            <button onClick={auth.retry} className="px-6 py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-gray-200">
              Retry
            </button>
            <button onClick={() => { logout(); }} className="px-6 py-3 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-300 hover:bg-white/5">
              Sign out
            </button>
          </div>
        }
      />
    );
  }

  if (!isAuthed) {
    return <AuthScreen title="Redirecting to sign in" />;
  }

  return (
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
          <p className="text-[12px] font-black text-blue-500 uppercase tracking-[0.3em] px-1">SRM AP Command</p>
        </div>

        <nav className="flex-1 space-y-1.5">
          {[
            { href: '/', icon: '🏠', label: 'Dashboard' },
            { href: '/fleet', icon: '🛵', label: 'Fleet Management' },
            { href: '/restaurants', icon: '🍕', label: 'Stores & Products' },
            { href: '/orders', icon: '📦', label: 'Live Orders' },
            { href: '/mega-basket', icon: '🧺', label: 'Mega Basket' },
            { href: '/service-bookings', icon: '🛠️', label: 'Service Bookings' },
            { href: '/rentals', icon: '🚗', label: 'Vehicle Rentals' },
            { href: '/vault', icon: '🕯️', label: 'Zenvy Vault' },
            { href: '/finance', icon: '💰', label: 'Finance Trace' },
            { href: '/tickets', icon: '🎫', label: 'Support Tickets' },
            { href: '/users', icon: '👥', label: 'Elite Residents' },
            { href: '/student-verification', icon: '🎓', label: 'Student Verification' },
            { href: '/coupons', icon: '🏷️', label: 'Coupon Registry' },
            { href: '/bikepool', icon: '🏍️', label: 'Co-Ride Monitor' },
            { href: '/community', icon: '💬', label: 'Community Posts' },
            { href: '/wall', icon: '📸', label: 'The Wall' },
            { href: '/pg', icon: '🏠', label: 'PG & Hostels' },
            { href: '/analytics', icon: '📈', label: 'Performance Intel' },
            { href: '/analytics/rewards', icon: '🎡', label: 'Rewards Intel' },
            { href: '/audit', icon: '📋', label: 'Audit Logs' },
            { href: '/blocks', icon: '🏆', label: 'Block Wars' },
            { href: '/config', icon: '⚙️', label: 'Delivery Fee & Config' },
            { href: '/campus', icon: '🏫', label: 'Campus Pulse' },
            { href: '/campus/spots', icon: '📍', label: 'Campus Spots' },
            { href: '/moderation', icon: '🛡️', label: 'Friends Moderation' },
            { href: '/friends', icon: '🫂', label: 'Friends Config' },
            { href: '/cms', icon: '🎨', label: 'Global CMS Layout' },
            { href: '/notifications', icon: '🔔', label: 'Push Notifications' },
          ].map(({ href, icon, label }) => {
            // trailingSlash: true can give '/analytics/'; compare without it.
            const path = pathname.replace(/\/+$/, '') || '/';
            const isActive = href === '/' ? path === '/' : (path === href || path.startsWith(`${href}/`)) && (href !== '/analytics' || path === '/analytics') && (href !== '/campus' || path === '/campus');
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${isActive ? 'sidebar-active' : ''}`}
              >
                <span>{icon}</span> {label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />}
              </Link>
            );
          })}
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
            <span className="text-[12px] font-black text-gray-500 uppercase tracking-[0.2em]">Operational HUD</span>
            
            {/* 🛡️ Global Persistence Shield */}
            <div className={`ml-4 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${systemHealth.persistence === 'VOLATILE' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${systemHealth.persistence === 'VOLATILE' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                {systemHealth.persistence} STORAGE
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-black text-white">{auth.user?.name || 'Admin'}</p>
              <button
                onClick={() => { logout(); }}
                className="text-[11px] text-gray-400 hover:text-red-400 font-bold uppercase tracking-wider"
              >
                Sign out
              </button>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--zenvy-gold)] to-[#F0D9A8] p-[1px]">
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
  );
}
