interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CartModal = ({ isOpen, onClose }: CartModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white rounded-[40px] p-10 shadow-2xl animate-reveal">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold serif text-secondary">Your Selection</h2>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors text-gray-400">✕</button>
        </div>

        {/* Feature Highlight: Batch Delivery */}
        <div className="bg-[#fcfaf5] border border-[#f0ede6] rounded-3xl p-6 mb-10 flex items-center space-x-6">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white text-lg">
            📜
          </div>
          <div>
            <p className="text-[10px] font-black tracking-widest text-primary uppercase mb-1">Privilege Window</p>
            <h4 className="font-bold text-secondary">Next Curated Batch: 7:30 PM</h4>
            <p className="text-xs text-gray-500">Includes complimentary artisanal gift.</p>
          </div>
        </div>

        <div className="space-y-6 mb-12">
            <div className="flex justify-between items-center">
                <div>
                   <p className="font-bold text-secondary">Margherita Artisanal</p>
                   <p className="text-[10px] text-gray-400 uppercase tracking-widest">Quantity: 01</p>
                </div>
                <span className="font-bold text-secondary">₹249</span>
            </div>
            
            <div className="flex justify-between items-center text-primary italic font-medium">
                <span>Loyalty Distinction Applied</span>
                <span>-₹49</span>
            </div>

            <div className="bg-[#fafafa] p-6 rounded-3xl flex justify-between items-center border border-black/[0.02]">
                <div>
                   <p className="font-bold text-secondary text-sm">Gate Reception</p>
                   <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Acquire at Hostel Gate for 30% Relief</p>
                </div>
                <div className="w-12 h-6 bg-primary rounded-full flex items-center px-1 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full translate-x-6" />
                </div>
            </div>
        </div>

        <div className="border-t border-black/[0.05] pt-8 space-y-3 mb-12">
          <div className="flex justify-between text-gray-400 text-xs font-bold uppercase tracking-widest">
            <span>Subtotal</span>
            <span>₹200</span>
          </div>
          <div className="flex justify-between text-gray-400 text-xs font-bold uppercase tracking-widest">
            <span>Service & Logistics</span>
            <span>₹25</span>
          </div>
          <div className="flex justify-between items-end pt-4">
            <span className="text-xl font-bold serif text-secondary">Total Investment</span>
            <span className="text-3xl font-black text-primary">₹225</span>
          </div>
        </div>

        <button className="w-full py-5 rounded-full btn-gold !text-sm !font-black !tracking-[0.2em] shadow-xl shadow-primary/20">
          PROCEED TO SECURE PAYMENT
        </button>
      </div>
    </div>
  );
};

export default CartModal;
