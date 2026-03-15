"use client";

const Hero = () => {
  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-between py-20 overflow-hidden">
      {/* Visual Decoration: Oranges and Leaves */}
      <div className="absolute top-12 -left-8 w-32 h-32 animate-float" style={{ animationDelay: '0s' }}>
        <img src="https://images.unsplash.com/photo-1582979512210-99b6a53386f9?q=80&w=200&auto=format&fit=crop" alt="orange" className="w-full h-full object-contain rotate-12" />
      </div>
      <div className="absolute top-1/2 -right-12 w-44 h-44 animate-float" style={{ animationDelay: '1s' }}>
        <img src="https://images.unsplash.com/photo-1543333309-8745822d640e?q=80&w=200&auto=format&fit=crop" alt="leaf" className="w-full h-full object-contain -rotate-45" />
      </div>

      <div className="flex flex-col items-center w-full max-w-lg px-8">
        {/* Large Salad bowl matching the orange/lemon theme */}
        <div className="relative w-80 h-80 mb-16">
          <div className="absolute inset-4 bg-primary-yellow/10 blur-[100px] rounded-full" />
          <img 
            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=2070&auto=format&fit=crop" 
            alt="Main Dish" 
            className="w-full h-full object-cover rounded-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative z-10"
          />
          {/* Silver Fork decoration on the side as in image */}
          <div className="absolute -right-6 top-1/4 w-32 h-32 rotate-12 opacity-80">
             <img src="https://images.unsplash.com/photo-1619682570412-f0270a31604a?q=80&w=200&auto=format&fit=crop" alt="fork" className="w-full h-full object-contain grayscale brightness-125" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-[44px] leading-[1] font-extrabold mb-6 tracking-tight">
            SRM Campus <br />
            Bites <span className="serif-italic text-primary-yellow">delivered.</span>
          </h1>
          <p className="text-secondary-text text-[15px] font-medium leading-relaxed mb-12 max-w-[280px] mx-auto">
            Gourmet meals from your favorite <br />
            local spots, straight to your gate.
          </p>
          
          <button className="btn-yellow">
            GET STARTED
          </button>
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
