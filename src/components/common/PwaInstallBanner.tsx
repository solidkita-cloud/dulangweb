import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PwaInstallModal } from './PwaInstallModal';

interface PwaInstallBannerProps {
  onShowToast?: (msg: string) => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({ onShowToast }) => {
  const { isInstalled, showIOSModal, setShowIOSModal, triggerInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('dulang_pwa_banner_dismissed') === 'true';
  });

  if (isInstalled || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('dulang_pwa_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleInstallClick = () => {
    triggerInstall(() => {
      if (onShowToast) onShowToast('Aplikasi Dulang berhasil dipasang di HP! 📱🎉');
    });
  };

  return (
    <>
      <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-[#111111] text-[#FFF8E7] border-2 border-[#FFD700] rounded-[22px] p-3.5 sm:p-4 shadow-[6px_6px_0_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFD700] border border-[#111111] flex items-center justify-center shrink-0 shadow-xs">
            <span className="text-xl">📱</span>
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="font-hand font-bold text-base sm:text-lg text-[#FFD700] leading-none truncate">
              Pasang Aplikasi Dulang di HP
            </h4>
            <p className="font-sans text-[11px] sm:text-xs text-white/80 leading-snug mt-0.5 line-clamp-2">
              Buka menu wajan panas lebih cepat & tanpa ketik alamat web.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] px-3 py-1.5 rounded-full font-sans font-bold text-xs shadow-xs border border-[#111111] transition active:scale-95"
            >
              Pasang ⚡
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer text-white/60 hover:text-white p-1 text-xs"
              title="Tutup pemberitahuan"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <PwaInstallModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};
