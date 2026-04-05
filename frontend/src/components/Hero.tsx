import Image from 'next/image';
import Link from 'next/link';

const Hero = () => {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-between py-20 overflow-hidden">
      {/* Floating Food Decorations */}
      <div className="absolute top-12 -left-8 w-32 h-32 animate-float" style={{ animationDelay: '0s' }}>
        <Image 
          src="https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=200&auto=format&fit=crop" 
          alt="biryani" 
          width={128}
          height={128}
          className="w-full h-full object-contain rotate-12" 
        />
      </div>
      <div className="absolute top-1/2 -right-12 w-44 h-44 animate-float" style={{ animationDelay: '1s' }}>
        <Image 
          src="https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=200&auto=format&fit=crop" 
          alt="dosa" 
          width={176}
          height={176}
          className="w-full h-full object-contain -rotate-45" 
        />
      </div>

      <div className="flex flex-col items-center w-full max-w-lg px-8">
        {/* Hero dish image */}
        <div className="relative w-80 h-80 mb-16">
          <div className="absolute inset-4 bg-primary-yellow/10 blur-[100px] rounded-full" />
          <Image 
            src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=2070&auto=format&fit=crop" 
            alt="Delicious Food" 
            fill
            className="w-full h-full object-cover rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative z-10"
          />
        </div>

        <div className="text-center">
          <p className="text-[11px] font-black text-primary-yellow uppercase tracking-[0.4em] mb-3">Now Live in Amaravathi 🌆</p>
          <h1 className="text-[42px] leading-[1.05] font-extrabold mb-6 tracking-tight">
            Your city,<br />
            your cravings <span className="serif-italic text-primary-yellow">delivered.</span>
          </h1>
          <p className="text-secondary-text text-[15px] font-medium leading-relaxed mb-12 max-w-[280px] mx-auto">
            Explore restaurants across Amaravathi. <br />
            Fast delivery, zero fuss.
          </p>
          
          <Link href="/restaurants" className="btn-yellow">
            EXPLORE RESTAURANTS
          </Link>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="w-full px-12 flex justify-start items-center space-x-2.5">
         <div className="w-10 h-1.5 bg-primary-yellow rounded-full" />
         <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
         <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
      </div>
    </div>
  );
};

export default Hero;
