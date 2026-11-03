import React from 'react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FFFDF4] w-full max-w-sm rounded-[24px] border-2 border-[#111111] shadow-[6px_6px_0_#111111] p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#FFD700] border-2 border-[#111111] grid place-items-center shadow-xs">
              <img src="/dulang-logo.png" alt="Dulang" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h3 className="font-hand font-bold text-xl text-[#111111] leading-none">
                Pasang di iPhone / iPad
              </h3>
              <p className="font-sans text-[11px] text-[#5C3D2E]/70 mt-0.5">
                Buka Dulang tanpa ketik browser lagi!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer w-7 h-7 rounded-full bg-white border border-[#111111] text-xs font-bold flex items-center justify-center hover:bg-[#FFD700]"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3 font-sans text-xs text-[#111111]">
          <div className="flex items-start gap-2.5 bg-white p-3 rounded-[16px] border border-[#111111]/15 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-[#FFD700] text-[#111111] font-bold text-xs grid place-items-center shrink-0 border border-[#111111]">
              1
            </span>
            <p className="leading-snug">
              Ketuk tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas <span className="inline-block px-1.5 py-0.2 bg-gray-100 rounded border border-gray-300 font-mono">⬆️</span>) di bilah bawah browser Safari.
            </p>
          </div>

          <div className="flex items-start gap-2.5 bg-white p-3 rounded-[16px] border border-[#111111]/15 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-[#FFD700] text-[#111111] font-bold text-xs grid place-items-center shrink-0 border border-[#111111]">
              2
            </span>
            <p className="leading-snug">
              Gulir menu ke bawah, lalu pilih opsi <strong>"Tambahkan ke Layar Utama"</strong> (<em>Add to Home Screen ➕</em>).
            </p>
          </div>

          <div className="flex items-start gap-2.5 bg-white p-3 rounded-[16px] border border-[#111111]/15 shadow-2xs">
            <span className="w-6 h-6 rounded-full bg-[#FFD700] text-[#111111] font-bold text-xs grid place-items-center shrink-0 border border-[#111111]">
              3
            </span>
            <p className="leading-snug">
              Ketuk <strong>"Tambah"</strong> di pojok kanan atas. Ikon Dulang akan langsung muncul di layar HP Anda!
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer w-full py-2.5 rounded-full bg-[#111111] text-[#FFD700] font-sans font-bold text-xs shadow-[2px_2px_0_#FFD700] border border-[#111111] hover:brightness-110 active:scale-95 transition"
        >
          Siap, Paham! 🙏✨
        </button>
      </div>
    </div>
  );
};
