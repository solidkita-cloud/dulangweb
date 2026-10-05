import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { BRAND, LOCKED_COPY } from '../../lib/constants';

interface CuteQRCardProps {
  qrId?: string;
  onScanClick?: (id: string) => void;
}

export const CuteQRCard: React.FC<CuteQRCardProps> = ({
  qrId = 'DULANG-042',
  onScanClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanUrl = `${window.location.origin}/?scan=${qrId}`;

  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderQRWithLogo = async () => {
      try {
        const qrSize = 160;
        await QRCode.toCanvas(canvas, scanUrl, {
          width: qrSize,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#111111',
            light: '#FFFFFF',
          },
        });

        if (isCancelled) return;

        // Load Dulang logo
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '/dulang-logo.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });

        if (isCancelled) return;

        const ctx = canvas.getContext('2d');
        if (ctx && logoImg.complete && logoImg.naturalWidth > 0) {
          const center = qrSize / 2;
          const logoRadius = qrSize * 0.145; // ~29% diameter

          // White circular background cutout
          ctx.beginPath();
          ctx.arc(center, center, logoRadius + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#111111';
          ctx.stroke();

          // Circular clipped logo
          ctx.save();
          ctx.beginPath();
          ctx.arc(center, center, logoRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            logoImg,
            center - logoRadius,
            center - logoRadius,
            logoRadius * 2,
            logoRadius * 2
          );
          ctx.restore();
        }
      } catch (err) {
        console.error('QR rendering error:', err);
      }
    };

    renderQRWithLogo();

    return () => {
      isCancelled = true;
    };
  }, [scanUrl]);

  return (
    <div className="flex gap-3 lg:gap-4 items-start relative select-none">
      {/* Left Note: "QR-nya di sini → kecil biar gak norak" - Brand Book Locked */}
      <div className="shrink-0 pt-6 max-w-[142px] hidden sm:block">
        <div className="bg-[#111111] text-[#FFD700] rounded-[12px] px-3 py-2.5 rotate-[-6deg] shadow-[3px_3px_0_#5C3D2E] relative border border-[#111111]">
          <div className="font-hand text-[16px] leading-[1.1]">
            {LOCKED_COPY.qrNoteLeft}
          </div>
          <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-[#FFD700] rounded-full border border-[#111111]" />
        </div>
        <div className="mt-3 font-hand text-[13px] text-[#5C3D2E]/70 rotate-[-2deg]">
          scan buat WA langsung
        </div>
        <div className="mt-4 font-sans text-[10px] text-[#5C3D2E]/50 leading-tight">
          <span className="bg-white px-2 py-1 rounded-full border border-[#111111]/10 shadow-sm">
            wa.me/{BRAND.whatsapp}
          </span>
        </div>
        <div className="mt-4 font-hand text-[28px] text-[#111111] rotate-[12deg] ml-6">
          ⤷
        </div>
      </div>

      {/* Main Cute Black Card */}
      <div className="flex-1 relative bg-[#111111] text-white rounded-[26px] p-5 sm:p-6 border-[3px] border-[#111111] shadow-[8px_8px_0_#FFD700] rotate-[-2deg] mt-6 sm:mt-0">
        {/* Yellow Tape on Top */}
        <div className="tape absolute -top-3.5 left-1/2 -translate-x-1/2 w-[88px] h-[22px] rotate-[-3deg] rounded-[3px] border border-[#111111]/20 z-20" />
        <div className="tape absolute -top-2 right-10 w-[36px] h-[14px] rotate-[16deg] rounded-[2px] bg-[#FFF8E7]/70 border border-[#111111]/10 z-20 hidden sm:block" />

        {/* Top Pill Status */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 bg-[#FFD700] text-[#111111] rounded-full px-4 py-1 text-[11px] font-bold tracking-widest uppercase font-sans border-2 border-[#111111] shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
            <span className="w-1.5 h-1.5 bg-[#111111] rounded-full animate-pulse" />
            {LOCKED_COPY.pillScan}
          </div>
        </div>

        {/* Interactive QR Canvas Container */}
        <div className="mt-4 relative flex justify-center">
          {/* Cute Doodles */}
          <div className="absolute -top-3 -left-2 sm:-left-3 z-10 font-hand text-[22px] text-[#FFD700] rotate-[-18deg] select-none">
            ✦
          </div>
          <div className="absolute -top-2 -right-1 sm:-right-2 z-10 text-[18px] rotate-[12deg] select-none">
            ✨
          </div>
          <div className="absolute -bottom-2 -left-2 z-10 text-[18px] rotate-[-8deg] select-none">
            💛
          </div>
          <div className="absolute top-1/2 -right-4 z-10 font-hand text-[15px] text-[#FFD700] rotate-[14deg] hidden sm:block">
            lumer~
          </div>

          <div
            onClick={() => onScanClick && onScanClick(qrId)}
            className="cursor-pointer group relative bg-white rounded-[16px] p-3 border-2 border-[#111111] shadow-[4px_4px_0_#FFD700] hover:scale-[1.02] transition-transform"
            title="Klik untuk coba simulasi scan QR ini"
          >
            <canvas ref={canvasRef} className="block rounded-[8px]" />
            <div className="absolute inset-0 bg-[#FFD700]/0 group-hover:bg-[#FFD700]/10 transition-colors rounded-[16px]" />
          </div>
        </div>

        {/* Handwritten CTA under QR */}
        <div className="mt-4 text-center">
          <div className="font-hand font-bold text-[24px] sm:text-[26px] leading-[1.1] text-white rotate-[-0.8deg]">
            {LOCKED_COPY.qrScanNote}
          </div>
          <div className="mt-1 font-sans text-[10px] tracking-[0.16em] uppercase text-white/50">
            ID: <span className="font-bold text-[#FFD700]">{qrId}</span> • Scan & Auto-Fill
          </div>
        </div>

        {/* Direct Action Button */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onScanClick && onScanClick(qrId)}
            className="cursor-pointer inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] border-2 border-[#111111] rounded-full px-5 py-2 font-hand font-bold text-[18px] leading-none rotate-[-1deg] shadow-[3px_3px_0_#FFFFFF] hover:translate-y-[-1px] transition-all"
          >
            <span>Coba Scan Dus Ini</span>
            <span>→</span>
          </button>
        </div>

        <div className="mt-3 text-center font-hand text-[12px] text-white/40">
          pencet QR atau tombol kuning untuk simulasi
        </div>
      </div>
    </div>
  );
};
