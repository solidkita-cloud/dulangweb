import React from 'react';
import { StoreConfig } from '../../types';
import { BRAND } from '../../lib/constants';

interface StoreClosedModalProps {
  isOpen: boolean;
  config: StoreConfig;
  onClose: () => void;
}

export const StoreClosedModal: React.FC<StoreClosedModalProps> = ({
  isOpen,
  config,
  onClose,
}) => {
  if (!isOpen) return null;

  const quoteText =
    config.closedReason ||
    'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia';

  const handleContactWA = () => {
    const text = encodeURIComponent(
      'Halo Dulang Indonesia! Mau tanya info kapan dapur buka lagi ya? Mau siap-siap pesan risolesnya 🙏🥟'
    );
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-[#FFF8E7] text-[#111111] border-4 border-[#111111] rounded-[32px] p-6 sm:p-8 shadow-[8px_8px_0_#111111] z-10 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-bold text-base flex items-center justify-center cursor-pointer hover:bg-[#FFD700] hover:scale-105 transition-all"
          title="Tutup pengumuman"
        >
          ✕
        </button>

        {/* Top Hanging Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-[#111111] text-[#FFD700] px-4 py-1.5 rounded-full font-sans text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#FFD700] rotate-[-1.5deg]">
            <span>🪧</span> Papan Pintu Dapur • Libur Goreng
          </div>

          {/* Big Cute Illustration */}
          <div className="mt-3 flex items-center justify-center gap-2 text-5xl">
            <span>🍳</span>
            <span className="text-3xl animate-pulse">💤</span>
          </div>

          <h2 className="font-hand font-bold text-[36px] sm:text-[46px] leading-[1.05] text-[#111111] mt-2">
            Lagi Nggak Goreng Dulu Ya...
          </h2>
        </div>

        {/* Unique Custom Closed Quote Box */}
        <div className="bg-[#FFD700]/30 border-2 border-[#111111] rounded-[22px] p-5 shadow-[4px_4px_0_#111111] relative rotate-[0.5deg]">
          <span className="font-hand text-5xl text-[#111111]/30 absolute -top-3 left-3 select-none leading-none">
            “
          </span>
          <p className="font-hand font-bold text-[22px] sm:text-[26px] leading-snug text-[#111111] relative z-10 text-center px-2">
            {quoteText}
          </p>
        </div>

        {/* Supporting Warm Note */}
        <p className="font-sans text-[13px] text-[#5C3D2E]/80 text-center leading-relaxed max-w-md mx-auto">
          Wajan dan kompor kami istirahatkan sebentar biar besok bisa bangun jam 3 subuh lagi buat nyiapin risoles mayo yang lebih lumer dan krispi buat kamu.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 cursor-pointer bg-[#111111] text-[#FFD700] rounded-full py-3.5 px-6 font-sans font-bold text-[14px] border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] hover:brightness-110 active:translate-y-0.5 transition-all text-center"
          >
            Siap, Besok Aku Balik Lagi! 🥟
          </button>

          <button
            type="button"
            onClick={handleContactWA}
            className="w-full sm:w-auto cursor-pointer bg-white text-[#111111] rounded-full py-3.5 px-5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#111111] hover:bg-emerald-50 hover:text-emerald-800 transition-all flex items-center justify-center gap-1.5"
          >
            <span>💬</span> Tanya Jadwal via WA
          </button>
        </div>
      </div>
    </div>
  );
};
