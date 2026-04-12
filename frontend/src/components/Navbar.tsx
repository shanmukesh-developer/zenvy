"use client";
import { useState, useEffect } from 'react';

const Navbar = () => {
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState('Amaravathi, AP');
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || '');
        if (parsed.badges) setBadgeCount(parsed.badges.length || 0);
        if (parsed.address) setLocation(parsed.address.split(',')[0] || 'Amaravathi, AP');
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 h-20 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-white/5">
      {/* Location */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-primary-yellow text-sm">📍</span>
          <span className="text-white text-[13px] font-black tracking-tight truncate max-w-[160px]">{location}</span>
          <svg className="w-3 h-3 text-primary-yellow" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-secondary-text text-[10px] font-bold tracking-widest uppercase">
          {userName ? `Hey, ${userName.split(' ')[0]} 👋` : 'Delivering to'}
        </span>
      </div>

      {/* Avatar */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-yellow to-amber-400 flex items-center justify-center text-black font-black text-sm shadow-[0_0_20px_rgba(201,168,76,0.3)]">
          {userName ? userName[0].toUpperCase() : '👤'}
        </div>
        {badgeCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-black border border-[#C9A84C]/50 rounded-full flex items-center justify-center text-[8px] font-black text-[#C9A84C] shadow-lg animate-in zoom-in">
            {badgeCount}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-background rounded-full" />
      </div>
    </nav>
  );
};

export default Navbar;
