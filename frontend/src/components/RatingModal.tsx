"use client";
import { useState } from 'react';

interface Props {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => void;
}

export default function RatingModal({ orderId: _orderId, isOpen, onClose, onSubmit }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit(rating, review);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-[#1A1A1C] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary-yellow to-emerald-500" />
        
        {!submitted ? (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                🎉
              </div>
              <h2 className="text-xl font-black text-white">Meal Delivered!</h2>
              <p className="text-gray-400 text-sm mt-1">How was your Zenvy Captain?</p>
            </div>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className={`text-4xl transition-all transform hover:scale-125 ${
                    (hover || rating) >= star ? 'text-primary-yellow drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]' : 'text-gray-700'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Any feedback for the rider? (Optional)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-emerald-500/50 transition-all h-24 mb-6 resize-none"
            />

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 text-gray-400 font-bold uppercase tracking-widest text-[10px]"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={rating === 0}
                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all"
              >
                Submit Review
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-10 animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 text-black shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              ✓
            </div>
            <h2 className="text-xl font-black text-white">Thank You!</h2>
            <p className="text-gray-400 text-sm mt-2 font-medium">Your feedback helps us be better.</p>
            <div className="mt-6 flex justify-center gap-1">
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest animate-pulse">+10 ZenPoints Earned</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
