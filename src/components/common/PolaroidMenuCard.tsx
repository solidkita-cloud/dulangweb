import React, { useState } from 'react';
import { MenuItem } from '../../types';

interface PolaroidMenuCardProps {
  item: MenuItem;
  index: number;
  onAddToCart: (item: MenuItem, pilihanOpsi?: string, variantType?: 'matang' | 'frozen', qty?: number) => void;
  cartQty?: number;
  isTomorrow?: boolean;
}

export const PolaroidMenuCard: React.FC<PolaroidMenuCardProps> = ({
  item,
  onAddToCart,
  cartQty = 0,
  isTomorrow = false,
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [orderQty, setOrderQty] = useState(1);
  const [selectedOpsi, setSelectedOpsi] = useState<string>(
    item.opsi && item.opsi.length > 0 ? item.opsi[0] : ''
  );
  const effectiveServingType: 'matang_only' | 'frozen_only' | 'both' = (() => {
    if (item.servingType) return item.servingType;
    const name = item.nama.toLowerCase();
    if (item.variantType === 'frozen' || name.includes('frozen') || name.includes('beku')) {
      return 'frozen_only';
    }
    return 'matang_only';
  })();

  const [selectedVariant, setSelectedVariant] = useState<'matang' | 'frozen'>(() => {
    if (effectiveServingType === 'frozen_only') return 'frozen';
    if (effectiveServingType === 'matang_only') return 'matang';
    return item.variantType || 'matang';
  });

  const hasStockLimit = !isTomorrow && item.sisaStok !== null && item.sisaStok !== undefined;
  const isOutOfStock = hasStockLimit && (item.sisaStok as number) <= 0;
  const isAvailable = isTomorrow ? item.tersediaBesok !== false : (item.tersedia && !isOutOfStock);
  const isLowStock = hasStockLimit && (item.sisaStok as number) > 0 && (item.sisaStok as number) <= 5;

  const handleOpenSheet = () => {
    if (!isAvailable) return;
    setOrderQty(1);
    if (effectiveServingType === 'frozen_only') setSelectedVariant('frozen');
    else if (effectiveServingType === 'matang_only') setSelectedVariant('matang');
    else setSelectedVariant(item.variantType || 'matang');
    setIsSheetOpen(true);
  };

  const handleConfirmOrder = () => {
    onAddToCart(item, selectedOpsi || undefined, selectedVariant, orderQty);
    setIsSheetOpen(false);
    setOrderQty(1);
  };

  return (
    <>
      {/* KARTU MENU ETALASE (Grid 2 Kolom di HP, Rapi & Proporsional) */}
      <div
        onClick={handleOpenSheet}
        className={`group relative bg-white rounded-[20px] sm:rounded-[22px] p-2.5 sm:p-3.5 border border-[#111111]/15 sm:border-2 sm:border-[#111111] shadow-[2px_2px_0_#111111] hover:shadow-[3px_3px_0_#FFD700] transition-all duration-200 flex flex-col justify-between ${
          isAvailable
            ? 'cursor-pointer active:scale-[0.98]'
            : 'opacity-70 cursor-not-allowed'
        }`}
      >
        <div>
          {/* Foto Menu Kotak 1:1 Bersih */}
          <div className="relative aspect-square w-full rounded-[14px] sm:rounded-[16px] overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/50 border border-[#111111]/10">
            {item.foto ? (
              <img
                src={item.foto}
                alt={item.nama}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-4xl sm:text-5xl select-none">
                🥟
              </div>
            )}

            {/* Badge Kiri Atas: Status Ketersediaan */}
            <div className="absolute top-1.5 left-1.5 z-10">
              {!isAvailable ? (
                <span className="bg-[#111111] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  {isTomorrow ? 'Penuh' : 'Habis'}
                </span>
              ) : isTomorrow ? (
                <span className="bg-[#FFD700] text-[#111111] text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs border border-[#111111]/30">
                  📅 Besok
                </span>
              ) : (
                <span className="bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Ready
                </span>
              )}
            </div>

            {/* Badge Kanan Atas: Stok / Social Proof */}
            <div className="absolute top-1.5 right-1.5 z-10">
              {isLowStock ? (
                <span className="bg-red-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs animate-pulse">
                  🔥 Sisa {item.sisaStok}
                </span>
              ) : (
                <span className="bg-black/60 backdrop-blur-xs text-[#FFD700] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                  <span>⭐</span>
                  <span>4.9</span>
                </span>
              )}
            </div>

            {/* Badge Kuantitas di Keranjang (Jika sudah dipilih) */}
            {cartQty > 0 && (
              <div className="absolute bottom-1.5 right-1.5 z-10 bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full font-sans font-bold text-[10px] sm:text-[11px] border border-[#111111] shadow-xs animate-in zoom-in-75">
                ✓ {cartQty}
              </div>
            )}
          </div>

          {/* Info Menu */}
          <div className="mt-2 space-y-0.5">
            <h3 className="font-bold text-[13px] sm:text-[15px] text-[#111111] leading-snug line-clamp-1">
              {item.nama}
            </h3>
            <p className="font-sans text-[11px] text-[#5C3D2E]/70 line-clamp-1">
              {item.deskripsi || 'Gorengan renyah anget khas Dulang'}
            </p>
          </div>
        </div>

        {/* Baris Harga & Tombol Tambah */}
        <div className="mt-2.5 pt-1.5 border-t border-[#111111]/10 flex items-center justify-between gap-1">
          <div className="font-mono font-bold text-xs sm:text-[13px] text-[#111111]">
            Rp {item.harga.toLocaleString('id-ID')}
          </div>

          <button
            type="button"
            disabled={!isAvailable}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenSheet();
            }}
            className={`cursor-pointer rounded-full font-sans font-bold text-xs transition flex items-center justify-center active:scale-90 ${
              isAvailable
                ? cartQty > 0
                  ? 'bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] px-2.5 py-1 border border-[#111111] shadow-xs'
                  : 'w-7 h-7 sm:w-8 sm:h-8 bg-[#111111] hover:bg-black text-[#FFD700] shadow-xs'
                : 'w-7 h-7 bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={isAvailable ? 'Atur dan pesan menu ini' : 'Stok habis'}
          >
            {cartQty > 0 ? `+ Tambah` : `+`}
          </button>
        </div>
      </div>

      {/* SLIDE-UP ORDER BOTTOM SHEET (DRAWER PEMESANAN DETAIL) */}
      {isSheetOpen && (
        <div
          onClick={() => setIsSheetOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[28px] sm:rounded-[24px] border-2 border-[#111111] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* Mobile Drag Pill */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1 sm:hidden" />

            {/* Header: Foto Preview & Tombol Tutup */}
            <div className="relative">
              <div className="aspect-[16/9] w-full rounded-[18px] overflow-hidden bg-amber-50 relative border border-[#111111]/10">
                {item.foto ? (
                  <img
                    src={item.foto}
                    alt={item.nama}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-6xl">
                    🥟
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-xs text-[#FFD700] px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <span>⭐</span>
                  <span>4.9 • Favorit Sidoarjo</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="cursor-pointer absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 hover:text-black flex items-center justify-center font-bold text-sm shadow-md border border-gray-200"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Judul & Harga */}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold text-xl sm:text-2xl text-[#111111] leading-tight">
                  {item.nama}
                </h2>
                <span className="font-mono font-bold text-lg text-[#5C3D2E] whitespace-nowrap">
                  Rp {item.harga.toLocaleString('id-ID')}
                </span>
              </div>
              <p className="font-sans text-xs text-[#5C3D2E]/80 mt-1 leading-relaxed">
                {item.deskripsi || 'Digoreng dadakan di wajan panas 180°. Minyak selalu bersih & renyah.'}
              </p>
            </div>

            {/* Pilihan Opsi Rasa (Jika Ada) */}
            {item.opsi && item.opsi.length > 0 && (
              <div className="bg-[#FFFDF4] p-3.5 rounded-[16px] border border-[#111111]/15 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111]">
                    🌶️ Pilihan Rasa / Saus
                  </label>
                  <span className="text-[10px] text-gray-500 font-semibold">Pilih salah satu</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.opsi.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedOpsi(opt)}
                      className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-sans font-bold transition border ${
                        selectedOpsi === opt
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                          : 'bg-white text-[#111111] border-[#111111]/30 hover:border-[#111111]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pilihan / Keterangan Penyajian (Matang Saja / Frozen Saja / Bisa Keduanya) */}
            {effectiveServingType === 'both' ? (
              <div className="bg-[#FFFDF4] p-3.5 rounded-[16px] border border-[#111111]/15 space-y-2">
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111] block">
                  🍽️ Mau Disajikan Bagaimana?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant('matang')}
                    className={`cursor-pointer p-2.5 rounded-[14px] text-left transition border-2 ${
                      selectedVariant === 'matang'
                        ? 'bg-amber-100/90 border-[#111111] shadow-xs'
                        : 'bg-white border-[#111111]/20 hover:border-[#111111]'
                    }`}
                  >
                    <div className="font-bold text-xs text-[#111111] flex items-center gap-1.5">
                      <span>🍳</span>
                      <span>Goreng Matang</span>
                    </div>
                    <span className="text-[10px] text-[#5C3D2E]/80 block mt-0.5">
                      Hangat renyah, siap santap
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedVariant('frozen')}
                    className={`cursor-pointer p-2.5 rounded-[14px] text-left transition border-2 ${
                      selectedVariant === 'frozen'
                        ? 'bg-sky-100/90 border-sky-800 shadow-xs'
                        : 'bg-white border-[#111111]/20 hover:border-[#111111]'
                    }`}
                  >
                    <div className="font-bold text-xs text-sky-950 flex items-center gap-1.5">
                      <span>❄️</span>
                      <span>Frozen Food</span>
                    </div>
                    <span className="text-[10px] text-sky-800 block mt-0.5">
                      Beku kedap udara (3 mgg)
                    </span>
                  </button>
                </div>
              </div>
            ) : effectiveServingType === 'frozen_only' ? (
              <div className="bg-sky-50 border border-sky-200 rounded-[14px] p-2.5 flex items-center gap-2.5 text-xs text-sky-950">
                <span className="text-xl">❄️</span>
                <div>
                  <span className="font-bold block text-[11px]">Kemasan Frozen Food Beku</span>
                  <span className="text-[10px] text-sky-800">Dikemas beku higienis, siap digoreng hangat di rumah kapan saja.</span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-[14px] p-2.5 flex items-center gap-2 text-xs text-[#5C3D2E]">
                <span className="text-xl">🍳</span>
                <div>
                  <span className="font-bold text-[#111111] block text-[11px]">Goreng Matang Dadakan</span>
                  <span className="text-[10px] text-[#5C3D2E]/80">Digoreng hangat dari wajan panas 180°, siap santap renyah.</span>
                </div>
              </div>
            )}

            {/* Stepper Jumlah Porsi */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-sans font-bold text-xs text-[#111111] uppercase tracking-wider">
                Jumlah Porsi:
              </span>
              <div className="flex items-center gap-3 bg-[#FFF8E7] px-3 py-1.5 rounded-full border border-amber-300">
                <button
                  type="button"
                  onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                  className="cursor-pointer w-7 h-7 rounded-full bg-white hover:bg-gray-100 border border-[#111111] font-bold text-sm flex items-center justify-center active:scale-95"
                >
                  −
                </button>
                <span className="font-mono font-bold text-sm text-[#111111] min-w-[24px] text-center">
                  {orderQty}
                </span>
                <button
                  type="button"
                  onClick={() => setOrderQty(orderQty + 1)}
                  className="cursor-pointer w-7 h-7 rounded-full bg-[#111111] hover:bg-black text-[#FFD700] border border-[#111111] font-bold text-sm flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            {/* Tombol Konfirmasi CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleConfirmOrder}
                className="w-full cursor-pointer bg-[#111111] hover:bg-black text-[#FFD700] rounded-full py-3.5 font-sans font-bold text-sm border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] hover:brightness-105 active:translate-y-0.5 transition-all flex items-center justify-between px-6"
              >
                <span>+ Masukin ke Dulang</span>
                <span className="font-mono font-bold">
                  Rp {(item.harga * orderQty).toLocaleString('id-ID')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

