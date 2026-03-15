import { useState } from 'react';

const SpinWheel = () => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  const spin = () => {
    setIsSpinning(true);
    setReward(null);
    
    setTimeout(() => {
      setIsSpinning(false);
      const rewards = ['Exclusive Coupon', 'Gourmet Delivery', 'Patron Privilege', 'Chef\'s Dessert'];
      setReward(rewards[Math.floor(Math.random() * rewards.length)]);
    }, 4000); // Slower, more elegant spin
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white border border-black/[0.05] rounded-[50px] max-w-md mx-auto shadow-2xl shadow-black/[0.02]">
      <span className="text-primary font-black tracking-[0.3em] text-[10px] uppercase mb-8">The wheel of fortune</span>
      
      <div className={`relative w-72 h-72 rounded-full border-[12px] border-[#f0ede6] flex items-center justify-center transition-transform duration-[4s] cubic-bezier(0.165, 0.84, 0.44, 1) ${isSpinning ? 'rotate-[1440deg]' : 'rotate-0'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f8f6f2] to-white" />
        
        {/* Minimal Divider Lines */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div key={deg} className="absolute w-[1px] h-full bg-black/[0.03]" style={{ transform: `rotate(${deg}deg)` }} />
        ))}
        
        {/* Center Pin */}
        <div className="w-12 h-12 rounded-full bg-white z-10 shadow-lg flex items-center justify-center text-[10px] font-black italic text-primary">
          HB
        </div>

        {/* Outer Decor */}
        <div className="absolute -top-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-primary" />
      </div>

      <button 
        onClick={spin}
        disabled={isSpinning}
        className={`mt-12 px-12 py-5 rounded-full font-bold tracking-widest text-[10px] uppercase transition-all duration-500 ${isSpinning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-gold'}`}
      >
        {isSpinning ? 'COMMENCING...' : 'RELEASE THE RADIANCE'}
      </button>

      {reward && (
        <div className="mt-8 flex flex-col items-center animate-reveal">
          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Acquisition Confirmed</span>
          <span className="text-2xl font-black serif text-secondary">{reward}</span>
        </div>
      )}
    </div>
  );
};

export default SpinWheel;
