import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { generateRandomQRId, generateHMAC } from '../lib/cryptoUtils';
import { storageService } from '../services/storageService';
import { QRCodeRecord } from '../types';

interface StickerGeneratorViewProps {
  onShowToast: (msg: string) => void;
  onNavigateToScan: (qrId: string) => void;
}

type StickerSize = '3.5cm' | '4cm' | '4.5cm';
type StickerTheme = 'retro-black' | 'cream-kraft';

// Helper to draw rounded rectangle on canvas
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const StickerGeneratorView: React.FC<StickerGeneratorViewProps> = ({
  onShowToast,
  onNavigateToScan,
}) => {
  const [count, setCount] = useState<number>(20);
  const [prefix, setPrefix] = useState<string>('DULANG-');
  const [size, setSize] = useState<StickerSize>('4cm');
  const [theme, setTheme] = useState<StickerTheme>('retro-black');
  const [tagline, setTagline] = useState<string>('DULANG • MASIH ANGET');
  const [qrList, setQrList] = useState<QRCodeRecord[]>([]);
  const [stickerDataUrls, setStickerDataUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  const logoRef = useRef<HTMLImageElement | null>(null);

  // Preload Dulang circular logo once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/dulang-logo.png';
    img.onload = () => {
      logoRef.current = img;
    };
  }, []);

  // Load initial batch
  useEffect(() => {
    const existing = storageService.getQRCodes();
    if (existing.length >= count) {
      setQrList(existing.slice(0, count));
    } else {
      handleGenerate();
    }
  }, []);

  // Re-generate complete sticker canvas whenever qrList, size, theme, or tagline changes
  useEffect(() => {
    if (qrList.length === 0) return;

    let isCancelled = false;
    setIsRendering(true);

    const renderAllStickers = async () => {
      // Ensure Google Fonts are loaded
      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore font loading error
        }
      }

      // Ensure logo is loaded
      let logo = logoRef.current;
      if (!logo || !logo.complete) {
        logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.src = '/dulang-logo.png';
        await new Promise((resolve) => {
          logo!.onload = resolve;
          logo!.onerror = resolve;
        });
        logoRef.current = logo;
      }

      const urls: Record<string, string> = {};

      for (const item of qrList) {
        if (isCancelled) break;
        try {
          const targetUrl = `${window.location.origin}/?scan=${item.id}`;

          // 1. Generate QR Code canvas with high error correction for center logo
          const qrCanvas = document.createElement('canvas');
          const qrRawSize = 280;
          await QRCode.toCanvas(qrCanvas, targetUrl, {
            width: qrRawSize,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: { dark: '#111111', light: '#FFFFFF' },
          });

          // 2. Embed center Dulang logo on QR code
          const qrCtx = qrCanvas.getContext('2d');
          if (qrCtx && logo && logo.complete && logo.naturalWidth > 0) {
            const center = qrRawSize / 2;
            const logoRadius = qrRawSize * 0.145; // ~29% diameter

            // White circular background cutout with outline
            qrCtx.beginPath();
            qrCtx.arc(center, center, logoRadius + 3, 0, Math.PI * 2);
            qrCtx.fillStyle = '#FFFFFF';
            qrCtx.fill();
            qrCtx.lineWidth = 1.5;
            qrCtx.strokeStyle = '#111111';
            qrCtx.stroke();

            // Circular clipped logo
            qrCtx.save();
            qrCtx.beginPath();
            qrCtx.arc(center, center, logoRadius, 0, Math.PI * 2);
            qrCtx.clip();
            qrCtx.drawImage(
              logo,
              center - logoRadius,
              center - logoRadius,
              logoRadius * 2,
              logoRadius * 2
            );
            qrCtx.restore();
          }

          // 3. Render Complete High-Resolution Sticker Canvas (400 x 480 px, 300 DPI grade)
          const stickerCanvas = document.createElement('canvas');
          const W = 400;
          const H = 480;
          stickerCanvas.width = W;
          stickerCanvas.height = H;
          const sCtx = stickerCanvas.getContext('2d');

          if (sCtx) {
            sCtx.clearRect(0, 0, W, H);

            const isBlackTheme = theme === 'retro-black';

            // Background Card
            if (isBlackTheme) {
              // Shadow offset
              drawRoundedRect(sCtx, 16, 16, W - 28, H - 28, 26);
              sCtx.fillStyle = '#FFD700';
              sCtx.fill();

              // Main dark card
              drawRoundedRect(sCtx, 12, 12, W - 28, H - 28, 26);
              sCtx.fillStyle = '#111111';
              sCtx.fill();
              sCtx.lineWidth = 3;
              sCtx.strokeStyle = '#111111';
              sCtx.stroke();
            } else {
              // Kraft / Cream Card
              drawRoundedRect(sCtx, 16, 16, W - 28, H - 28, 26);
              sCtx.fillStyle = '#111111';
              sCtx.fill();

              drawRoundedRect(sCtx, 12, 12, W - 28, H - 28, 26);
              sCtx.fillStyle = '#FFF8E7';
              sCtx.fill();
              sCtx.lineWidth = 3;
              sCtx.strokeStyle = '#111111';
              sCtx.stroke();
            }

            // Top Masking Tape
            sCtx.save();
            sCtx.translate(W / 2, 12);
            sCtx.rotate(-0.04);
            sCtx.fillStyle = 'rgba(255, 215, 0, 0.85)';
            sCtx.fillRect(-45, -6, 90, 15);
            sCtx.strokeStyle = 'rgba(17, 17, 17, 0.2)';
            sCtx.lineWidth = 1;
            sCtx.strokeRect(-45, -6, 90, 15);
            sCtx.restore();

            // Top Status Pill
            const pillW = 210;
            const pillH = 26;
            const pillX = (W - pillW) / 2;
            const pillY = 28;

            drawRoundedRect(sCtx, pillX, pillY, pillW, pillH, 13);
            sCtx.fillStyle = isBlackTheme ? '#FFD700' : '#111111';
            sCtx.fill();
            sCtx.lineWidth = 1.5;
            sCtx.strokeStyle = '#111111';
            sCtx.stroke();

            // Pill text
            sCtx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillStyle = isBlackTheme ? '#111111' : '#FFD700';
            sCtx.fillText(`●  ${tagline}`, W / 2, pillY + pillH / 2 + 1);

            // White QR Card Container
            const qrCardW = 260;
            const qrCardH = 260;
            const qrCardX = (W - qrCardW) / 2;
            const qrCardY = 66;

            // QR Card Shadow
            drawRoundedRect(sCtx, qrCardX + 4, qrCardY + 4, qrCardW, qrCardH, 18);
            sCtx.fillStyle = isBlackTheme ? '#FFD700' : 'rgba(17, 17, 17, 0.15)';
            sCtx.fill();

            // QR Card Body
            drawRoundedRect(sCtx, qrCardX, qrCardY, qrCardW, qrCardH, 18);
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fill();
            sCtx.lineWidth = 2;
            sCtx.strokeStyle = '#111111';
            sCtx.stroke();

            // Draw QR code inside white card
            sCtx.drawImage(qrCanvas, qrCardX + 12, qrCardY + 12, qrCardW - 24, qrCardH - 24);

            // Cute Doodles
            // Sparkle top-left
            sCtx.font = 'bold 18px "Caveat", cursive';
            sCtx.fillStyle = '#FFD700';
            sCtx.fillText('✦', qrCardX - 10, qrCardY + 10);

            // Sparkle top-right
            sCtx.font = '16px "Plus Jakarta Sans", sans-serif';
            sCtx.fillText('✨', qrCardX + qrCardW + 4, qrCardY + 15);

            // Heart / Risoles text on right
            sCtx.font = 'bold 15px "Caveat", cursive';
            sCtx.fillStyle = isBlackTheme ? '#FFD700' : '#5C3D2E';
            sCtx.fillText('lumer~', qrCardX + qrCardW + 6, qrCardY + qrCardH - 20);

            // Handwritten note below QR
            sCtx.font = 'bold 24px "Caveat", cursive';
            sCtx.textAlign = 'center';
            sCtx.fillStyle = isBlackTheme ? '#FFFFFF' : '#111111';
            sCtx.fillText('kangen? scan ini yaa ↳', W / 2, 362);

            // ID Badge Pill
            const idBadgeW = 230;
            const idBadgeH = 24;
            const idBadgeX = (W - idBadgeW) / 2;
            const idBadgeY = 380;

            drawRoundedRect(sCtx, idBadgeX, idBadgeY, idBadgeW, idBadgeH, 12);
            sCtx.fillStyle = isBlackTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 215, 0, 0.35)';
            sCtx.fill();
            sCtx.lineWidth = 1;
            sCtx.strokeStyle = isBlackTheme ? 'rgba(255, 215, 0, 0.4)' : '#111111';
            sCtx.stroke();

            sCtx.font = 'bold 10px monospace';
            sCtx.textAlign = 'center';
            sCtx.textBaseline = 'middle';
            sCtx.fillStyle = isBlackTheme ? '#FFD700' : '#111111';
            sCtx.fillText(`ID: ${item.id}  •  SCAN & AUTO-FILL`, W / 2, idBadgeY + idBadgeH / 2 + 1);

            // Micro Footer
            sCtx.font = '500 9px "Plus Jakarta Sans", sans-serif';
            sCtx.fillStyle = isBlackTheme ? 'rgba(255, 255, 255, 0.5)' : '#5C3D2E';
            sCtx.fillText('Dulang Indonesia • Sejak 2020 • Sidoarjo', W / 2, 430);

            urls[item.id] = stickerCanvas.toDataURL('image/png');
          }
        } catch (err) {
          console.error('Error generating sticker:', err);
        }
      }

      if (!isCancelled) {
        setStickerDataUrls({ ...urls });
        setIsRendering(false);
      }
    };

    renderAllStickers();

    return () => {
      isCancelled = true;
    };
  }, [qrList, size, theme, tagline]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const num = Math.min(200, Math.max(1, count));
    const batchName = `BATCH-${Date.now().toString().slice(-4)}`;
    const newItems: QRCodeRecord[] = [];

    for (let i = 0; i < num; i++) {
      const id = generateRandomQRId(8, prefix);
      const hmac = await generateHMAC(id);
      newItems.push({
        id,
        hmac,
        status: 'unused',
        print_batch: batchName,
        created_at: new Date().toISOString(),
      });
    }

    setQrList(newItems);
    storageService.saveQRCodes(newItems);
    setIsGenerating(false);
    onShowToast(`Sip! ${num} stiker random anti-tebak siap dicetak! 🖨️`);
  };

  // Export CSV
  const handleDownloadCSV = () => {
    const origin = window.location.origin;
    let csv = 'id,hmac,scan_url,status,batch\n';
    qrList.forEach((q) => {
      csv += `"${q.id}","${q.hmac}","${origin}/?scan=${q.id}","${q.status}","${q.print_batch}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dulang-qr-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Data CSV stiker berhasil diunduh!');
  };

  // Single Sticker Download (PNG 300 DPI)
  const handleDownloadSinglePNG = (itemId: string) => {
    const dataUrl = stickerDataUrls[itemId];
    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `stiker-${itemId}-${theme}.png`;
    a.click();
    onShowToast(`Stiker ${itemId} berhasil disimpan sebagai PNG! 🖼️`);
  };

  // Export PDF A4 Ready to Print (High Precision Die-Cut Layout)
  const handleDownloadPDF = async () => {
    onShowToast('Sedang menyusun PDF A4 siap cetak...');
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 20 stickers per page: 4 columns x 5 rows
    // A4 = 210mm x 297mm
    // Width: 41mm, Height: 49.2mm (ratio matches 400x480)
    const cols = 4;
    const stickerW = size === '3.5cm' ? 36 : size === '4cm' ? 41 : 45;
    const stickerH = size === '3.5cm' ? 43.2 : size === '4cm' ? 49.2 : 54;
    const gapX = 6;
    const gapY = 5.5;

    // Center the 4 columns on A4
    const totalW = cols * stickerW + (cols - 1) * gapX;
    const marginX = (210 - totalW) / 2;
    const marginY = 16;

    const perPage = 20;

    for (let i = 0; i < qrList.length; i++) {
      const item = qrList[i];
      const pageIndex = Math.floor(i / perPage);
      const indexInPage = i % perPage;

      if (indexInPage === 0) {
        if (pageIndex > 0) doc.addPage();

        // Page Header for the Print Shop
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(17, 17, 17);
        doc.text(
          `Dulang Indonesia — Lembar Cetak Vinyl Doff A4 (Ukuran: ${size} • Edisi ${theme === 'retro-black' ? 'Hitam Retro' : 'Cream Kraft'})`,
          marginX,
          8
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(92, 61, 46);
        doc.text(
          `Halaman ${pageIndex + 1} dari ${Math.ceil(qrList.length / perPage)}  |  Bahan Rekomendasi: Vinyl Doff Anti-Air + Kiss Cut  |  dulangin.netlify.app`,
          marginX,
          11.5
        );
      }

      const col = indexInPage % cols;
      const row = Math.floor(indexInPage / cols);
      const x = marginX + col * (stickerW + gapX);
      const y = marginY + row * (stickerH + gapY);

      // Sticker Image
      const dataUrl = stickerDataUrls[item.id];
      if (dataUrl) {
        doc.addImage(dataUrl, 'PNG', x, y, stickerW, stickerH, undefined, 'FAST');
      }

      // Subtle kiss-cut boundary guides
      doc.setDrawColor(215, 215, 215);
      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.rect(x - 0.5, y - 0.5, stickerW + 1, stickerH + 1);
    }

    doc.save(`dulang-stiker-a4-${size}-${theme}-${Date.now()}.pdf`);
    onShowToast('PDF A4 berhasil diunduh! Siap kirim ke percetakan vinyl doff 🎉');
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 py-8 space-y-8">
      {/* Top Title & Explanation */}
      <div className="text-center max-w-[680px] mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-4 py-1.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-3 border-2 border-[#111111] shadow-[2px_2px_0_#111111]">
          <span>🖨️</span> Layout Presisi A4 • Pas di Tutup Dus Risoles
        </div>
        <h1 className="font-hand font-bold text-[38px] lg:text-[48px] leading-tight text-[#111111]">
          Cetak Stiker QR Dulang Banget
        </h1>
        <p className="font-sans text-[13px] text-[#5C3D2E]/85 mt-1 leading-relaxed">
          Stiker kompak dengan logo Dulang di tengah QR dan tulisan tangan khas. Pelanggan scan sekali dari dus kraft risoles, pesanan berikutnya langsung dikenali otomatis!
        </p>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">
        {/* Left Config Panel */}
        <div className="bg-white rounded-[24px] p-6 border-2 border-[#111111] shadow-[6px_6px_0_#111111] space-y-5 sticky top-24">
          <div className="flex items-center justify-between pb-3 border-b border-[#111111]/10">
            <div className="font-hand font-bold text-[24px] text-[#111111]">
              Pengaturan Stiker
            </div>
            <span className="font-sans text-[11px] font-bold bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full border border-[#111111]">
              {theme === 'retro-black' ? 'Hitam Khas' : 'Cream Kraft'}
            </span>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70 mb-1.5">
              Tema Tampilan Stiker
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme('retro-black')}
                className={`cursor-pointer py-2.5 px-3 rounded-[14px] font-sans font-bold text-xs border-2 transition flex items-center justify-center gap-1.5 ${
                  theme === 'retro-black'
                    ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                    : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                }`}
              >
                <span>🖤</span> Hitam Retro Dulang
              </button>
              <button
                type="button"
                onClick={() => setTheme('cream-kraft')}
                className={`cursor-pointer py-2.5 px-3 rounded-[14px] font-sans font-bold text-xs border-2 transition flex items-center justify-center gap-1.5 ${
                  theme === 'cream-kraft'
                    ? 'bg-[#FFF8E7] text-[#111111] border-[#111111] shadow-[2px_2px_0_#111111]'
                    : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                }`}
              >
                <span>📦</span> Cream Kraft (Hemat Tinta)
              </button>
            </div>
          </div>

          {/* Compact Size Selector */}
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <label className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70">
                Ukuran Stiker (Pas Dus)
              </label>
              <span className="font-sans text-[10px] text-[#5C3D2E]/60">
                tidak kebesaran
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '3.5cm', label: '3.5 cm', desc: 'Mini' },
                { id: '4cm', label: '4 cm', desc: 'Standar Dus' },
                { id: '4.5cm', label: '4.5 cm', desc: 'Medium' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id as StickerSize)}
                  className={`cursor-pointer py-2 px-1 rounded-[12px] font-sans text-center border-2 transition ${
                    size === s.id
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#5C3D2E]/80 border-[#111111]/20 hover:border-[#111111]'
                  }`}
                >
                  <div className="font-bold text-xs">{s.label}</div>
                  <div className="text-[10px] opacity-75">{s.desc}</div>
                </button>
              ))}
            </div>
            <span className="font-sans text-[11px] text-[#5C3D2E]/70 mt-1.5 block">
              💡 <b>Ukuran 4 cm:</b> Ukuran paling pas di pojok atau tengah tutup dus kraft risoles, tidak tertekuk di lipatan dus.
            </span>
          </div>

          {/* Tagline Option */}
          <div>
            <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70 mb-1">
              Tulisan Banner Atas
            </label>
            <select
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs bg-white focus:outline-none focus:border-[#FFD700]"
            >
              <option value="DULANG • MASIH ANGET">DULANG • MASIH ANGET</option>
              <option value="DULANG • SEJAK 2020">DULANG • SEJAK 2020</option>
              <option value="RISOLES MAYO • DULANG">RISOLES MAYO • DULANG</option>
              <option value="SCAN DULU • MASIH ANGET">SCAN DULU • MASIH ANGET</option>
            </select>
          </div>

          {/* Count & Prefix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70 mb-1">
                Jumlah Stiker
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 20)}
                className="w-full rounded-full border-2 border-[#111111] px-3 py-2 font-mono font-bold text-center text-sm focus:outline-none focus:border-[#FFD700]"
              />
              <span className="font-sans text-[10px] text-[#5C3D2E]/60 mt-0.5 block text-center">
                = {Math.ceil(count / 20)} lbr A4
              </span>
            </div>

            <div>
              <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]/70 mb-1">
                Prefix ID
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                className="w-full rounded-full border-2 border-[#111111] px-3 py-2 font-mono font-bold text-center text-sm focus:outline-none focus:border-[#FFD700]"
              />
              <span className="font-sans text-[10px] text-[#5C3D2E]/60 mt-0.5 block text-center">
                Contoh: {prefix}042
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full cursor-pointer bg-[#FFD700] text-[#111111] rounded-full py-3 font-sans font-bold text-[14px] border-2 border-[#111111] shadow-[3px_3px_0_#111111] hover:brightness-105 active:translate-y-0.5 transition"
          >
            {isGenerating ? 'Mengacak ID...' : `Acak ${count} ID Random Baru →`}
          </button>

          <div className="space-y-2 pt-2 border-t border-[#111111]/10">
            <button
              type="button"
              disabled={isRendering}
              onClick={handleDownloadPDF}
              className="w-full cursor-pointer bg-[#111111] text-[#FFF8E7] rounded-full py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:bg-[#222222] flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>📄</span> Download PDF Siap Cetak A4 ({size})
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="w-full cursor-pointer bg-white text-[#111111] rounded-full py-2 font-sans font-bold text-[12px] border-2 border-[#111111] hover:bg-gray-50 flex items-center justify-center gap-2 transition"
            >
              <span>📊</span> Download CSV (Data & URL)
            </button>
          </div>

          <div className="bg-[#FFF8E7] rounded-[16px] p-3.5 border border-[#FFD700] text-[11px] font-sans text-[#5C3D2E] leading-relaxed">
            ✨ <b>Saran Percetakan:</b> Cetak di lembaran <b>Vinyl Doff + Kiss Cut</b> (potong setengah tembus). Tahan minyak risoles, tidak mudah sobek, dan mudah dikelupas pas bungkus pesanan.
          </div>
        </div>

        {/* Right Preview Grid */}
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h2 className="font-hand font-bold text-[28px] text-[#111111] leading-none">
                Preview Stiker Dulang ({qrList.length} Pcs • {size})
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                {isRendering ? 'Sedang memuat visual stiker...' : 'Klik stiker untuk tes scan, atau unduh PNG satuan.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs bg-[#FFD700] text-[#111111] px-3 py-1 rounded-full font-bold border border-[#111111]">
                {size} • 1 Lembar A4 = 20 Pcs
              </span>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-6 border-2 border-[#111111] shadow-[6px_6px_0_#111111]">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {qrList.map((item) => {
                const imgDataUrl = stickerDataUrls[item.id];
                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col items-center bg-[#FFFDF4] rounded-[20px] p-2.5 border-2 border-[#111111]/15 hover:border-[#111111] hover:shadow-[4px_4px_0_#111111] hover:-translate-y-1 transition-all select-none"
                  >
                    {/* Rendered Sticker Image */}
                    <div
                      onClick={() => onNavigateToScan(item.id)}
                      className="cursor-pointer w-full aspect-[400/480] rounded-[14px] overflow-hidden flex items-center justify-center bg-gray-100"
                      title="Klik untuk tes scan stiker ini"
                    >
                      {imgDataUrl ? (
                        <img
                          src={imgDataUrl}
                          alt={`Stiker ${item.id}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                          <div className="w-8 h-8 rounded-full border-2 border-[#111111] border-t-[#FFD700] animate-spin" />
                          <span className="font-sans text-[10px] text-[#5C3D2E]/60">Membuat stiker...</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar below sticker */}
                    <div className="mt-2 w-full flex items-center justify-between gap-1 pt-1.5 border-t border-[#111111]/10">
                      <button
                        type="button"
                        onClick={() => onNavigateToScan(item.id)}
                        className="cursor-pointer text-[10px] font-sans font-bold text-[#111111] hover:text-[#5C3D2E] hover:underline"
                        title="Tes scan stiker ini"
                      >
                        🔍 Tes Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSinglePNG(item.id)}
                        className="cursor-pointer text-[10px] font-sans font-bold bg-[#FFD700] hover:bg-[#ffe033] text-[#111111] px-2 py-0.5 rounded-full border border-[#111111] transition"
                        title="Unduh stiker ini format PNG"
                      >
                        💾 PNG
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
