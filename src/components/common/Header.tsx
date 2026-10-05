import React from 'react';
import { BRAND, LOCKED_COPY } from '../../lib/constants';

export type NavMode = 'pembeli' | 'pemilik' | 'cetak' | 'scan';

interface HeaderProps {
  currentMode: NavMode;
  onSelectMode: (mode: NavMode) => void;
  onOpenOwnerLogin: (targetMode?: NavMode) => void;
  isOwnerLoggedIn: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  isOwnerLoggedIn,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFF8E7]/90 backdrop-blur-md border-b-2 border-[#111111]/10">
      {/* Top Notification Pill Bar — HANYA MUNCUL JIKA PEMILIK SUDAH LOGIN */}
      {isOwnerLoggedIn && (
        <div className="flex justify-center pt-2 pb-1 px-3">
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-full bg-[#111111] shadow-[0_4px_16px_rgba(0,0,0,0.2)] text-[12px] font-sans font-bold border border-[#FFD700]/30 animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => onSelectMode('pembeli')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                currentMode === 'pembeli'
                  ? 'bg-[#FFD700] text-[#111111] shadow'
                  : 'text-[#FFF8E7]/70 hover:text-[#FFF8E7]'
              }`}
            >
              Mode Pembeli
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('pemilik')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                currentMode === 'pemilik'
                  ? 'bg-[#FFD700] text-[#111111] shadow'
                  : 'text-[#FFF8E7]/70 hover:text-[#FFF8E7]'
              }`}
            >
              Mode Pemilik (Dapur)
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('cetak')}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                currentMode === 'cetak'
                  ? 'bg-[#FFD700] text-[#111111] shadow'
                  : 'text-[#FFF8E7]/70 hover:text-[#FFF8E7]'
              }`}
            >
              🖨️ Cetak Stiker
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-full transition-all cursor-pointer bg-red-500/25 hover:bg-red-500 text-red-200 hover:text-white font-sans text-[11px] ml-1 flex items-center gap-1"
                title="Keluar dari sesi pemilik"
              >
                <span>🚪</span> Keluar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Branding Bar — Selalu Bersih & Profesional */}
      <div className="max-w-[1180px] mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div
          onClick={() => onSelectMode('pembeli')}
          className="flex items-center gap-3 cursor-pointer group"
          title="Kembali ke Beranda"
        >
          <div className="w-[46px] h-[46px] rounded-full bg-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] grid place-items-center overflow-hidden rotate-[-2deg] group-hover:rotate-0 transition-transform">
            <img
              src="/dulang-logo.png"
              alt="Dulang Indonesia"
              className="w-[36px] h-[36px] object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-hand font-bold text-[28px] leading-none tracking-tight text-[#111111]">
              {BRAND.shortName.toLowerCase()}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFD700] text-[10px] font-bold tracking-widest uppercase font-sans border border-[#111111] rotate-[-2deg]">
              {LOCKED_COPY.badgeSince}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline font-hand text-[15px] text-[#5C3D2E]/70">
            Sidoarjo • wajan panas tiap hari 🔥
          </span>
          <a
            href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(LOCKED_COPY.waCheckout)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#111111] text-[#FFD700] px-3.5 py-1.5 font-sans font-bold text-[12px] border border-[#111111] hover:bg-[#222222] transition shadow-[2px_2px_0_#FFD700]"
          >
            Hubungi Dapur
          </a>
        </div>
      </div>
    </header>
  );
};
