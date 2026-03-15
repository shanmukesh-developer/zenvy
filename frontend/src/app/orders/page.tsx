"use client";
import Navbar from '@/components/Navbar';
import { useLiveOrder } from '@/hooks/useLiveOrder';

export default function OrdersPage() {
  const activeOrderId = '1025'; // Simulated active order
  useLiveOrder(activeOrderId);

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-40 pb-32 px-10 max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold serif text-secondary mb-12">Active Logistics</h1>
        
        {/* Live Tracking Card - Refined */}
        <div className="p-12 border border-black/[0.05] rounded-[50px] relative overflow-hidden mb-16 bg-[#fafafa]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12">
            <div>
              <p className="text-primary font-bold mb-3 uppercase text-[10px] tracking-[0.3em]">Transit Status</p>
              <h2 className="text-4xl font-bold serif text-secondary leading-tight">Arrival Expected <br />in 12 Minutes</h2>
            </div>
            <div className="mt-6 md:mt-0 px-6 py-3 border border-primary/20 bg-primary/5 rounded-full text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              AUTHENTICATION OTP: 4921
            </div>
          </div>

          {/* Map Placeholder - Minimalist & Styled */}
          <div className="w-full h-[450px] bg-[#f0ede6] rounded-[40px] relative overflow-hidden mb-12 border border-black/[0.05]">
             <div className="absolute inset-0 opacity-40 grayscale-[0.8] bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop')] bg-cover" />
             
             {/* Delivery Icon Overlay - Classy */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-3xl shadow-2xl border border-black/[0.05] animate-bounce">
                  🛵
                </div>
                <div className="mt-4 px-4 py-2 bg-secondary text-white text-[9px] font-black rounded-lg uppercase tracking-widest">
                  PATRON RAHUL
                </div>
             </div>
          </div>

          <div className="flex items-center justify-between">
             <div className="flex items-center space-x-6">
                <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-gray-200">
                    <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1887&auto=format&fit=crop" alt="Rider" className="w-full h-full object-cover" />
                </div>
                <div>
                    <p className="text-xl font-bold serif text-secondary">Rahul Mishra</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Certified Campus Logistics Partner</p>
                </div>
             </div>
             <button className="px-10 py-4 border border-secondary text-secondary rounded-full font-bold text-[10px] uppercase tracking-widest hover:bg-secondary hover:text-white transition-all duration-300">
                INITIATE CONTACT
             </button>
          </div>
        </div>

        {/* Recent History - Minimalist */}
        <h3 className="text-2xl font-bold serif text-secondary mb-8">Culinary History</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {[1, 2].map((i) => (
             <div key={i} className="p-8 border border-black/[0.03] rounded-3xl flex items-center justify-between hover:border-primary/20 transition-all duration-500">
                <div className="flex items-center space-x-6">
                   <div className="w-16 h-16 bg-[#fafafa] rounded-2xl flex items-center justify-center text-2xl">🍔</div>
                   <div>
                      <p className="font-bold text-secondary serif text-xl">The Bake Shop</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">12 March • Concluded</p>
                   </div>
                </div>
                <span className="text-primary font-black serif">₹430</span>
             </div>
           ))}
        </div>
      </div>
    </main>
  );
}
