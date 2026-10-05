import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
      <div className="bg-[#111111] text-[#FFD700] border-2 border-[#FFD700] rounded-full px-6 py-2.5 font-hand font-bold text-[20px] shadow-[4px_4px_0_#111111] rotate-[-1deg] flex items-center gap-2">
        <span>✨</span>
        <span>{message}</span>
      </div>
    </div>
  );
};
