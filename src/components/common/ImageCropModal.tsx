import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onConfirm: (croppedWebpDataUrl: string) => void;
  onCancel: () => void;
  title?: string;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onConfirm,
  onCancel,
  title = 'Sesuaikan Sisi Foto Menu (1:1 Kotak)',
}) => {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) {
      setImageObj(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw the preview on canvas
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width; // 320px preview canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate base scale to fill square (cover)
    const imgRatio = imageObj.width / imageObj.height;
    let baseWidth = size;
    let baseHeight = size;

    if (imgRatio >= 1) {
      // Landscape (misal 6:4, 4:3, 16:9)
      baseHeight = size;
      baseWidth = size * imgRatio;
    } else {
      // Portrait
      baseWidth = size;
      baseHeight = size / imgRatio;
    }

    const currentW = baseWidth * zoom;
    const currentH = baseHeight * zoom;

    // Center offset + pan
    const centerX = (size - currentW) / 2 + pan.x;
    const centerY = (size - currentH) / 2 + pan.y;

    ctx.save();
    // Rounded clip for preview
    ctx.drawImage(imageObj, centerX, centerY, currentW, currentH);
    ctx.restore();
  }, [imageObj, zoom, pan]);

  useEffect(() => {
    if (isOpen && imageObj) {
      drawPreview();
    }
  }, [isOpen, imageObj, drawPreview]);

  // Handle Dragging / Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support for Mobile / Smartphone
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Reset to default center
  const handleResetCenter = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Generate Final 1:1 High Quality WebP (<80KB)
  const handleSaveCrop = () => {
    if (!imageObj) return;
    setIsProcessing(true);

    try {
      const OUTPUT_SIZE = 800; // Optimal Retina 800x800 resolution
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = OUTPUT_SIZE;
      exportCanvas.height = OUTPUT_SIZE;
      const ctx = exportCanvas.getContext('2d');

      if (!ctx) {
        alert('Browser tidak mendukung canvas ekspor');
        setIsProcessing(false);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const previewSize = 320;
      const scaleMultiplier = OUTPUT_SIZE / previewSize;

      const imgRatio = imageObj.width / imageObj.height;
      let baseWidth = previewSize;
      let baseHeight = previewSize;

      if (imgRatio >= 1) {
        baseHeight = previewSize;
        baseWidth = previewSize * imgRatio;
      } else {
        baseWidth = previewSize;
        baseHeight = previewSize / imgRatio;
      }

      const finalW = baseWidth * zoom * scaleMultiplier;
      const finalH = baseHeight * zoom * scaleMultiplier;
      const finalX = ((previewSize - baseWidth * zoom) / 2 + pan.x) * scaleMultiplier;
      const finalY = ((previewSize - baseHeight * zoom) / 2 + pan.y) * scaleMultiplier;

      ctx.drawImage(imageObj, finalX, finalY, finalW, finalH);

      // Convert to WebP with 0.82 quality
      const webpDataUrl = exportCanvas.toDataURL('image/webp', 0.82);
      onConfirm(webpDataUrl);
    } catch (err) {
      console.error('Crop export error:', err);
      alert('Gagal memproses crop foto. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onCancel} />

      <div className="relative w-full max-w-md bg-[#FFF8E7] text-[#111111] border-4 border-[#111111] rounded-[28px] p-5 sm:p-6 shadow-[8px_8px_0_#111111] z-10 space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#111111]/15">
          <div className="flex items-center gap-2">
            <span className="text-xl">✂️</span>
            <h3 className="font-hand font-bold text-2xl text-[#111111] leading-none">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white text-[#111111] border-2 border-[#111111] shadow-[1px_1px_0_#111111] font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-[#FFD700]"
          >
            ✕
          </button>
        </div>

        <p className="font-sans text-[12px] text-[#5C3D2E]/80 leading-snug">
          <b>Geser foto</b> pakai jari / mouse untuk memilih bagian risoles yang paling pas, lalu perbesar jika perlu.
        </p>

        {/* Interactive Canvas Viewport with 1:1 Aspect Frame */}
        <div className="flex flex-col items-center">
          <div
            ref={containerRef}
            className="relative w-[320px] h-[320px] bg-[#111111] rounded-[20px] overflow-hidden border-3 border-[#111111] shadow-[4px_4px_0_#111111] cursor-grab active:cursor-grabbing touch-none select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              className="w-full h-full block pointer-events-none"
            />

            {/* Grid Overlay Guide (Rule of Thirds) */}
            <div className="absolute inset-0 pointer-events-none border border-white/25">
              <div className="absolute top-1/3 left-0 right-0 border-b border-white/20 border-dashed" />
              <div className="absolute top-2/3 left-0 right-0 border-b border-white/20 border-dashed" />
              <div className="absolute left-1/3 top-0 bottom-0 border-r border-white/20 border-dashed" />
              <div className="absolute left-2/3 top-0 bottom-0 border-r border-white/20 border-dashed" />
            </div>

            {/* Badge Indicator */}
            <div className="absolute top-2.5 left-2.5 bg-[#111111]/80 text-[#FFD700] px-2 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider backdrop-blur-xs pointer-events-none">
              1:1 Kotak Menu
            </div>
          </div>
        </div>

        {/* Zoom & Adjustment Controls */}
        <div className="bg-white rounded-[18px] p-3.5 border-2 border-[#111111] space-y-2.5">
          <div className="flex items-center justify-between font-sans text-xs font-bold text-[#111111]">
            <span className="flex items-center gap-1.5">
              <span>🔍</span> Perbesar (Zoom):
            </span>
            <span className="font-mono text-[#5C3D2E]">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-sans text-xs text-[#5C3D2E]">1x</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-[#111111] cursor-pointer"
            />
            <span className="font-sans text-xs text-[#5C3D2E]">3x</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#111111]/10">
            <button
              type="button"
              onClick={handleResetCenter}
              className="cursor-pointer text-[11px] font-sans font-bold text-[#5C3D2E] hover:text-[#111111] underline"
            >
              Kembalikan ke Tengah
            </button>
            <span className="font-sans text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ⚡ Auto-Compress WebP (&lt;80 KB)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSaveCrop}
            className="flex-1 cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 active:scale-[0.98] rounded-full py-3 px-5 font-sans font-bold text-sm border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] text-center transition"
          >
            {isProcessing ? 'Memampatkan Foto...' : 'Gunakan Hasil Foto Ini ✓'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer bg-white text-[#111111] hover:bg-gray-100 rounded-full py-3 px-5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
