import React, { useState } from 'react';
import { MenuItem } from '../../types';

interface MixMatchBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  menus: MenuItem[];
  onAddBoxToCart: (
    item: MenuItem,
    pilihanOpsi?: string,
    variantType?: 'matang' | 'frozen',
    qty?: number
  ) => void;
  onShowToast: (msg: string) => void;
}

export const MixMatchBoxModal: React.FC<MixMatchBoxModalProps> = ({
  isOpen,
  onClose,
  menus,
  onAddBoxToCart,
  onShowToast,
}) => {
  const [boxCapacity, setBoxCapacity] = useState<6 | 10>(6);
  const [selectedCounts, setSelectedCounts] = useState<{ [menuId: string]: number }>({});
  const [servingType, setServingType] = useState<'matang' | 'frozen'>('matang');
  const [selectedSauce, setSelectedSauce] = useState<string>('Saos Pedas');

  if (!isOpen) return null;

  // Filter single pieces suitable for mixing into a box
  const eligibleItems = menus.filter(
    (m) =>
      m.tersedia &&
      !m.nama.toLowerCase().includes('isi 5') &&
      !m.nama.toLowerCase().includes('isi 10') &&
      !m.nama.toLowerCase().includes('paket') &&
      !m.nama.toLowerCase().includes('snack box')
  );

  const totalSelected = Object.values(selectedCounts).reduce((sum, count) => sum + count, 0);
  const remaining = boxCapacity - totalSelected;
  const isFull = totalSelected === boxCapacity;

  const totalBoxPrice = Object.entries(selectedCounts).reduce((sum, [menuId, count]) => {
    const item = eligibleItems.find((m) => m.id === menuId);
    return sum + (item ? item.harga * count : 0);
  }, 0);

  const handleIncrement = (menuId: string) => {
    if (totalSelected >= boxCapacity) return;
    setSelectedCounts((prev) => ({
      ...prev,
      [menuId]: (prev[menuId] || 0) + 1,
    }));
  };

  const handleDecrement = (menuId: string) => {
    if (!selectedCounts[menuId] || selectedCounts[menuId] <= 0) return;
    setSelectedCounts((prev) => {
      const next = { ...prev };
      next[menuId] -= 1;
      if (next[menuId] <= 0) delete next[menuId];
      return next;
    });
  };

  const handleReset = () => {
    setSelectedCounts({});
  };

  const handleAddToCart = () => {
    if (!isFull) return;

    const details: string[] = [];
    Object.entries(selectedCounts).forEach(([menuId, count]) => {
      if (count > 0) {
        const item = eligibleItems.find((m) => m.id === menuId);
        if (item) details.push(`${count}x ${item.nama}`);
      }
    });

    const boxItem: MenuItem = {
      id: `box_mix_${boxCapacity}_${Date.now()}`,
      nama: `Dus Campur (${boxCapacity} Pcs)`,
      harga: totalBoxPrice,
      deskripsi: `Rincian Isi: ${details.join(', ')}`,
      tersedia: true,
      opsi: ['Saos Pedas', 'Saos Tidak Pedas', 'Cabai Rawit Saja'],
      servingType: 'both',
    };

    onAddBoxToCart(boxItem, selectedSauce, servingType, 1);
    onShowToast(`Dus Campur isi ${boxCapacity} pcs berhasil masuk ke keranjang! 📦✨`);
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#FFF8E7] text-[#111111] border-t-4 sm:border-4 border-[#111111] rounded-t-[32px] sm:rounded-[32px] shadow-[8px_8px_0_#111111] z-10 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b-2 border-[#111111]/15 bg-[#FFF8E7] shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider border border-[#111111]/20">
              📦 Paket Dus Sendiri
            </div>
            <h3 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-none mt-1">
              Bikin Dus Campur Dulang
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#111111] flex items-center justify-center text-xs font-bold hover:bg-red-50 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* 1. Pilih Ukuran Dus */}
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-wider text-[#5C3D2E] mb-2">
              1. Pilih Ukuran Dus:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBoxCapacity(6);
                  handleReset();
                }}
                className={`cursor-pointer p-3 rounded-[16px] border-2 text-left transition ${
                  boxCapacity === 6
                    ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                    : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                }`}
              >
                <div className="font-hand font-bold text-lg leading-tight">Dus Reguler (Isi 6)</div>
                <div className="text-[11px] font-sans opacity-80 mt-0.5">Pas buat 2-3 orang ngemil</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBoxCapacity(10);
                  handleReset();
                }}
                className={`cursor-pointer p-3 rounded-[16px] border-2 text-left transition ${
                  boxCapacity === 10
                    ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                    : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                }`}
              >
                <div className="font-hand font-bold text-lg leading-tight">Dus Pesta (Isi 10)</div>
                <div className="text-[11px] font-sans opacity-80 mt-0.5">Pas buat arisan / keluarga</div>
              </button>
            </div>
          </div>

          {/* 2. Counter Status Box */}
          <div className="bg-white rounded-[18px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-sans font-bold text-[#5C3D2E]">
                Kapasitas Dus: <strong>{totalSelected} / {boxCapacity} Pcs</strong>
              </span>
              {isFull ? (
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  ✓ Dus Lengkap!
                </span>
              ) : (
                <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Kurang {remaining} pcs lagi
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-[#111111]/20">
              <div
                className="h-full bg-gradient-to-r from-[#FFD700] to-emerald-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (totalSelected / boxCapacity) * 100)}%` }}
              />
            </div>
          </div>

          {/* 3. Daftar Gorengan yang Bisa Dipilih */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-sans text-xs font-bold uppercase tracking-wider text-[#5C3D2E]">
                2. Pilih Isian Gorengan:
              </label>
              {totalSelected > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="cursor-pointer text-[11px] text-red-600 hover:underline font-bold"
                >
                  Reset Pilihan
                </button>
              )}
            </div>

            <div className="divide-y divide-[#111111]/10 bg-white rounded-[18px] border-2 border-[#111111] overflow-hidden">
              {eligibleItems.map((item) => {
                const count = selectedCounts[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-[#FFFDF4] transition"
                  >
                    <div className="min-w-0">
                      <div className="font-sans font-bold text-xs text-[#111111] truncate">
                        {item.nama}
                      </div>
                      <div className="font-sans text-[11px] text-[#5C3D2E]/80 mt-0.5">
                        Rp {item.harga.toLocaleString('id-ID')} / pcs
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDecrement(item.id)}
                        disabled={count <= 0}
                        className="w-7 h-7 rounded-full bg-gray-100 disabled:opacity-30 border border-[#111111]/30 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-gray-200 transition"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-xs w-5 text-center">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIncrement(item.id)}
                        disabled={totalSelected >= boxCapacity}
                        className="w-7 h-7 rounded-full bg-[#FFD700] disabled:opacity-30 border border-[#111111] flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-[#FFE033] transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Bentuk Penyajian & Saos Dus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                3. Penyajian:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setServingType('matang')}
                  className={`cursor-pointer py-1.5 px-2 rounded-full font-sans font-bold text-xs border text-center transition ${
                    servingType === 'matang'
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                      : 'bg-white text-[#5C3D2E] border-[#111111]/20'
                  }`}
                >
                  🍳 Matang Hangat
                </button>
                <button
                  type="button"
                  onClick={() => setServingType('frozen')}
                  className={`cursor-pointer py-1.5 px-2 rounded-full font-sans font-bold text-xs border text-center transition ${
                    servingType === 'frozen'
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white text-[#5C3D2E] border-[#111111]/20'
                  }`}
                >
                  ❄️ Frozen Beku
                </button>
              </div>
            </div>

            <div>
              <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                4. Opsi Saos Dus:
              </label>
              <select
                value={selectedSauce}
                onChange={(e) => setSelectedSauce(e.target.value)}
                className="w-full rounded-full border-2 border-[#111111] px-3.5 py-1.5 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700]"
              >
                <option value="Saos Pedas">🌶️ Saos Pedas Gurih</option>
                <option value="Saos Tidak Pedas">🍅 Saos Manis / Tidak Pedas</option>
                <option value="Cabai Rawit Saja">🌱 Cabai Rawit Hijau Saja</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-5 sm:px-6 py-3.5 border-t-2 border-[#111111]/15 bg-[#FFF8E7] shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs text-[#5C3D2E]">
              Total Harga 1 Dus ({totalSelected} Pcs):
            </span>
            <span className="font-sans font-bold text-xl text-[#111111]">
              Rp {totalBoxPrice.toLocaleString('id-ID')}
            </span>
          </div>

          <button
            type="button"
            disabled={!isFull}
            onClick={handleAddToCart}
            className="w-full cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed rounded-full py-3 px-4 font-sans font-bold text-xs sm:text-sm border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] transition flex items-center justify-center gap-2"
          >
            <span>📦</span>
            <span>
              {isFull
                ? `Masukkan Dus Campur ke Keranjang (Rp ${totalBoxPrice.toLocaleString('id-ID')}) ✓`
                : `Lengkapi ${remaining} Pcs Lagi untuk Masuk Keranjang`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
