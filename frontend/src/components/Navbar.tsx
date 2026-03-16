"use client";
import Image from 'next/image';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 h-20 flex items-center justify-between bg-background/80 backdrop-blur-md">
      <div className="flex flex-col">
        <span className="text-secondary-text text-[10px] font-bold tracking-widest uppercase">Hello, Kristin 👋</span>
        <span className="text-sm font-bold">What you want to cook today?</span>
      </div>

      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden">
          <Image 
            src="https://i.pravatar.cc/100?u=kristin" 
            alt="Profile" 
            width={40}
            height={40}
            className="w-full h-full rounded-full object-cover" 
          />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary border-2 border-background rounded-full" />
      </div>
    </nav>
  );
};

export default Navbar;
