"use client";
import { useState, useEffect } from 'react';
import { socket } from '@/utils/socket';

export default function ZenvyPulse({ userBlock }: { userBlock: string | null }) {
  const [pulses, setPulses] = useState<{ id: number; block: string }[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    socket.on('systemUpdate', ({ type, data }: { type: string; data: { key: string; value: boolean } }) => {
      if (type === 'CONFIG_UPDATED' && data.key === 'pulse_enabled') {
        setIsEnabled(data.value);
      }
    });

    socket.on('blockOrderPulse', ({ blockName }: { blockName: string }) => {
      if (!isEnabled) return;
      if (blockName === userBlock || !userBlock) {
        const id = Date.now();
        setPulses(prev => [...prev, { id, block: blockName }]);
        setTimeout(() => {
          setPulses(prev => prev.filter(p => p.id !== id));
        }, 3000);
      }
    });

    return () => {
      socket.off('systemUpdate');
      socket.off('blockOrderPulse');
    };
  }, [userBlock, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pulses.map((pulse) => (
        <div key={pulse.id} className="absolute inset-0 flex items-center justify-center">
          <div className="w-[1px] h-[1px] bg-[#C9A84C]/40 rounded-full animate-ripple-magical" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black text-[#C9A84C] uppercase tracking-[0.5em] animate-pulse-text-fade">
             {pulse.block} Pulse
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ripple-magical {
          0% { transform: scale(0); opacity: 0.8; box-shadow: 0 0 20px 10px rgba(201, 168, 76, 0.4); }
          50% { opacity: 0.4; }
          100% { transform: scale(3000); opacity: 0; }
        }
        @keyframes pulse-text-fade {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
        }
        .animate-ripple-magical {
          animation: ripple-magical 3s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        .animate-pulse-text-fade {
          animation: pulse-text-fade 3s ease-out forwards;
        }
      ` }} />
    </div>
  );
}
