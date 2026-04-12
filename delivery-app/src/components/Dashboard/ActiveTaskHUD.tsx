"use client";
import React from 'react';

interface Task {
  type: 'PICKUP' | 'DELIVERY';
  location: string;
  address: string;
}

interface ActiveTaskHUDProps {
  task: Task;
  remainingTasksCount: number;
}

export default function ActiveTaskHUD({ task, remainingTasksCount }: ActiveTaskHUDProps) {
  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 rounded-[34px] shadow-2xl relative overflow-hidden group mb-6">
       <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
       </div>
       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200 mb-2">Priority Tactical Task</p>
       <h3 className="text-lg font-black text-white leading-tight">
          {task.type === 'PICKUP' ? 'Pick up from' : 'Deliver to'} <br />
          <span className="text-yellow-400">{task.location}</span>
       </h3>
       <p className="text-[10px] text-emerald-100/60 font-bold uppercase tracking-widest mt-2 truncate">{task.address}</p>
       
       <div className="mt-4 flex items-center justify-between">
          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.address)}`} 
            target="_blank" rel="noreferrer"
            className="bg-white/20 hover:bg-white/30 text-white text-[9px] font-black px-4 py-2 rounded-xl transition-all"
          >
            START NAVIGATION →
          </a>
          {remainingTasksCount > 0 && (
            <span className="text-[9px] font-black text-emerald-200/50 uppercase tracking-widest">+ {remainingTasksCount} More Tasks</span>
          )}
       </div>
    </div>
  );
}
