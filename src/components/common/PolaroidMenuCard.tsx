import React from 'react';
import { MenuItem } from '../../types';

interface PolaroidMenuCardProps {
  item: MenuItem;
  index: number;
  onAddToCart: (item: MenuItem, pilihanOpsi?: string, variantType?: 'matang' | 'frozen') => void;
  cartQty?: number;
  isTomorrow?: boolean;
}

export const PolaroidMenuCard: React.FC<PolaroidMenuCardProps> = ({
  item,
  index,
  onAddToCart,
  cartQty = 0,
  isTomorrow = false,
}) => {
  const rotationDegrees = [-1, 0.8, -0.6][index % 3];
  const hasStockLimit = !isTomorrow && item.sisaStok !== null && item.sisaStok !== undefined;
  const isOutOfStock = hasStockLimit && (item.sisaStok as number) <= 0;
  const isAvailable = isTomorrow ? item.tersediaBesok !== false : (item.tersedia && !isOutOfStock);
  const isLowStock = hasStockLimit && (item.sisaStok as number) > 0 && (item.sisaStok as number) <= 5;
  const [selectedOpsi, setSelectedOpsi] = React.useState<string>(
    item.opsi && item.opsi.length > 0 ? item.opsi[0] : ''
  );
  const [selectedVariant, setSelectedVariant] = React.useState<'matang' | 'frozen'>('matang');

  return (
    <div
      className="group relative bg-white rounded-[20px] p-4 pb-5 polaroid-shadow border-2 border-[#111111]/10 transition-transform duration-200 hover:-translate-y-1"
      style={{ transform: `rotate(${rotationDegrees}deg)` }}
    >
      {/* Top Tape Accent */}
      <div className="tape absolute -top-3 left-8 w-[56px] h-[16px] bg-[#FFD700] rotate-[-6deg] rounded-[2px] border border-[#111111]/15 z-10" />

      {/* Status Badges */}
      {!isAvailable ? (
        <div className="absolute top-4 right-4 z-20 bg-[#111111] text-[#FFD700] text-[11px] font-bold px-3 py-1 rounded-full font-sans tracking-widest rotate-[4deg] border border-[#FFD700] shadow-md">
          {isTomorrow ? 'KUOTA BESOK PENUH' : 'HABIS HARI INI'}
        </div>
      ) : isLowStock ? (
        <div className="absolute top-4 right-4 z-20 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full font-sans tracking-wider rotate-[3deg] border-2 border-[#111111] shadow-md animate-pulse">
          🔥 Sisa {item.sisaStok} porsi!
        </div>
      ) : isTomorrow ? (
        <div className="absolute top-4 right-4 z-20 bg-[#FFD700] text-[#111111] text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans tracking-wider rotate-[3deg] border border-[#111111] shadow-xs">
          📅 SLOT BESOK BUKA
        </div>
      ) : item.kloterBadge ? (
        <div className="absolute top-4 right-4 z-20 bg-[#111111] text-[#FFD700] text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans tracking-wider rotate-[3deg] border border-[#FFD700] shadow-xs">
          {item.kloterBadge}
        </div>
      ) : hasStockLimit && (item.sisaStok as number) > 5 ? (
        <div className="absolute top-4 right-4 z-20 bg-[#FFF3C7] text-[#5C3D2E] text-[10px] font-bold px-2 py-0.5 rounded-full font-sans tracking-wider rotate-[2deg] border border-[#5C3D2E]/30">
          Sisa {item.sisaStok} porsi
        </div>
      ) : null}

      {/* Food Photo / Placeholder Area */}
      <div className="aspect-[4/3] rounded-[16px] bg-[#FFF3C7] overflow-hidden relative grid place-items-center border border-[#111111]/10">
        {item.foto ? (
          <img
            src={item.foto}
            alt={item.nama}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="relative text-center p-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#111111] grid place-items-center mb-2 shadow-sm">
              <span className="text-[24px]">🥟</span>
            </div>
            <div className="font-hand font-bold text-[22px] leading-none text-[#111111]">
              {item.nama}
            </div>
            <div className="font-sans text-[11px] text-[#5C3D2E]/60 mt-1">
              digoreng dadakan di wajan panas
            </div>
          </div>
        )}

        {/* Price Tag Badge */}
        <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full font-hand font-bold text-[16px] text-[#111111] shadow-[2px_2px_0_#111111] border border-[#111111]">
          Rp {item.harga.toLocaleString('id-ID')}
        </div>

        {/* Cart Quantity Badge if selected */}
        {cartQty > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full font-sans font-bold text-[12px] shadow-sm border border-[#111111]">
            ✓ {cartQty} di dulang
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="pt-4 px-1">
        <h3 className="font-hand font-bold text-[24px] leading-tight text-[#111111]">
          {item.nama}
        </h3>
        <p className="font-sans text-[13px] leading-[1.5] text-[#5C3D2E]/80 mt-1.5 min-h-[42px]">
          {item.deskripsi}
        </p>

        {/* Pilihan Opsi Pelengkap (Optional) */}
        {item.opsi && item.opsi.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#111111]/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans font-bold text-[11px] text-[#5C3D2E]/80">
                Pilihan Rasa / Saus:
              </span>
              <span className="font-sans text-[10px] bg-[#FFD700]/30 text-[#111111] px-1.5 py-0.5 rounded-full font-bold">
                opsional
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.opsi.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedOpsi(opt)}
                  className={`text-[11px] font-sans px-2.5 py-1 rounded-full border transition cursor-pointer ${
                    selectedOpsi === opt
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111] font-bold shadow-[1px_1px_0_#FFD700]'
                      : 'bg-[#FFF8E7] text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pilihan Sajian: Goreng Matang vs Frozen Food (DULANG-2 Feature) */}
        <div className="mt-3 pt-2.5 border-t border-dashed border-[#111111]/15">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-sans font-bold text-[11px] text-[#111111]">
              Penyajian:
            </span>
            <span className="font-hand font-bold text-[13px] text-[#5C3D2E]">
              {selectedVariant === 'frozen' ? '❄️ Stok Freezer Awet' : '🔥 Hangat Siap Makan'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#FFF8E7] rounded-xl border border-[#111111]/15">
            <button
              type="button"
              onClick={() => setSelectedVariant('matang')}
              className={`cursor-pointer py-1.5 px-2 rounded-lg text-[11px] font-sans font-bold transition flex items-center justify-center gap-1 ${
                selectedVariant === 'matang'
                  ? 'bg-[#111111] text-[#FFD700] shadow-sm'
                  : 'text-[#111111]/70 hover:text-[#111111]'
              }`}
            >
              <span>🍳</span>
              <span>Goreng Matang</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedVariant('frozen')}
              className={`cursor-pointer py-1.5 px-2 rounded-lg text-[11px] font-sans font-bold transition flex items-center justify-center gap-1 ${
                selectedVariant === 'frozen'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-[#111111]/70 hover:text-sky-700'
              }`}
            >
              <span>❄️</span>
              <span>Frozen Food</span>
            </button>
          </div>
          {selectedVariant === 'frozen' && (
            <p className="font-sans text-[10px] text-sky-800 bg-sky-50 p-1.5 rounded-lg border border-sky-200 mt-1.5 leading-tight">
              🧊 Dikemas mentah beku kedap udara. Tahan hingga 3 minggu di freezer.
            </p>
          )}
        </div>

        {/* Add to Cart CTA */}
        <button
          type="button"
          disabled={!isAvailable}
          onClick={() => onAddToCart(item, selectedOpsi || undefined, selectedVariant)}
          className={`mt-3.5 w-full cursor-pointer rounded-full py-2.5 font-sans font-bold text-[13px] tracking-wide transition-all border-2 ${
            isAvailable
              ? 'bg-[#111111] text-[#FFD700] border-[#111111] hover:bg-[#222222] shadow-[3px_3px_0_#FFD700] active:translate-y-0.5'
              : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
          }`}
        >
          {isAvailable
            ? isTomorrow
              ? `+ Booking ${selectedVariant === 'frozen' ? 'Frozen' : 'Matang'} Besok 📅`
              : `+ Masukin Dulang (${selectedVariant === 'frozen' ? 'Frozen ❄️' : 'Goreng 🍳'})`
            : isTomorrow
            ? 'Kuota Besok Penuh 😅'
            : 'Lagi habis dulu ya 😅'}
        </button>
      </div>
    </div>
  );
};
