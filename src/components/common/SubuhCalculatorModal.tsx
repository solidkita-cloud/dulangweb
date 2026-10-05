import React, { useState, useEffect } from 'react';
import { MenuItem, SubuhPrepIngredient, SubuhPrepPlan } from '../../types';
import { calculateSubuhIngredients, formatSubuhShoppingWhatsApp } from '../../lib/subuhCalculator';
import { storageService } from '../../services/storageService';

interface SubuhCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  menus: MenuItem[];
  onShowToast: (msg: string) => void;
  onExpenseAdded?: () => void;
}

export const SubuhCalculatorModal: React.FC<SubuhCalculatorModalProps> = ({
  isOpen,
  onClose,
  menus,
  onShowToast,
  onExpenseAdded,
}) => {
  // Target date (defaults to tomorrow)
  const [targetDate, setTargetDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return tmrw.toISOString().split('T')[0];
  });

  // Quantities per menu item
  const [targetPcsMap, setTargetPcsMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    menus.forEach((m) => {
      initial[m.id] = m.nama.toLowerCase().includes('mayo') ? 60 : m.nama.toLowerCase().includes('ragout') ? 40 : 20;
    });
    return initial;
  });

  const [notes, setNotes] = useState('Belanja di Pasar Larangan jam 04.30 subuh, langsung gulung kulit');
  const [ingredients, setIngredients] = useState<SubuhPrepIngredient[]>([]);
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  // Recalculate ingredients when target quantities change
  useEffect(() => {
    const targets = menus.map((m) => ({
      name: m.nama,
      targetPcs: Number(targetPcsMap[m.id]) || 0,
    }));
    const calculated = calculateSubuhIngredients(targets);
    setIngredients(calculated);
  }, [targetPcsMap, menus]);

  if (!isOpen) return null;

  const totalPcs = Object.values(targetPcsMap).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const totalEstBudget = ingredients.reduce((sum, i) => sum + i.estPrice, 0);

  const handleQtyChange = (menuId: string, val: number) => {
    setTargetPcsMap((prev) => ({
      ...prev,
      [menuId]: Math.max(0, val),
    }));
  };

  // Pull actual pre-orders booked for tomorrow
  const handlePullTomorrowOrders = () => {
    const allOrders = storageService.getOrders();
    const tomorrowOrders = allOrders.filter(
      (o) => o.status !== 'batal' && (o.delivery_schedule || '').toLowerCase().includes('besok')
    );

    if (tomorrowOrders.length === 0) {
      onShowToast('Belum ada pesanan pre-order terdata untuk besok. Gunakan target manual ya!');
      return;
    }

    const counts: Record<string, number> = {};
    menus.forEach((m) => {
      counts[m.id] = 0;
    });

    let foundItems = 0;
    tomorrowOrders.forEach((o) => {
      o.items.forEach((it) => {
        if (counts[it.menu_id] !== undefined) {
          counts[it.menu_id] += it.qty;
          foundItems += it.qty;
        } else {
          // match by name
          const matched = menus.find((m) => m.nama.toLowerCase() === it.nama.toLowerCase());
          if (matched) {
            counts[matched.id] = (counts[matched.id] || 0) + it.qty;
            foundItems += it.qty;
          }
        }
      });
    });

    // Add extra 20% safety margin for walk-in display
    Object.keys(counts).forEach((k) => {
      counts[k] = Math.max(counts[k], Math.ceil(counts[k] * 1.25) || 20);
    });

    setTargetPcsMap(counts);
    onShowToast(`Berhasil menarik ${foundItems} pcs pesanan besok + cadangan display! 🌅🥟`);
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSendWhatsApp = () => {
    const plan: SubuhPrepPlan = {
      id: `PLAN-${Date.now()}`,
      targetDate,
      items: menus.map((m) => ({
        menuId: m.id,
        name: m.nama,
        targetPcs: Number(targetPcsMap[m.id]) || 0,
      })),
      ingredients: ingredients.map((i) => ({
        ...i,
        checked: !!checkedIds[i.id],
      })),
      totalEstBudget,
      notes,
      createdAt: new Date().toISOString(),
    };

    const waText = formatSubuhShoppingWhatsApp(plan);
    const url = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast('Checklist belanja subuh siap dikirim ke WhatsApp! 📋🛒');
  };

  const handleCopyClipboard = () => {
    const plan: SubuhPrepPlan = {
      id: `PLAN-${Date.now()}`,
      targetDate,
      items: menus.map((m) => ({
        menuId: m.id,
        name: m.nama,
        targetPcs: Number(targetPcsMap[m.id]) || 0,
      })),
      ingredients: ingredients.map((i) => ({
        ...i,
        checked: !!checkedIds[i.id],
      })),
      totalEstBudget,
      notes,
      createdAt: new Date().toISOString(),
    };

    const waText = formatSubuhShoppingWhatsApp(plan);
    navigator.clipboard.writeText(waText);
    onShowToast('Checklist pasar subuh berhasil disalin ke clipboard! 📋✓');
  };

  // 1-Click Record to Kitchen Expenses
  const handleRecordToExpense = () => {
    if (totalEstBudget <= 0) return;
    const confirmExp = window.confirm(
      `Catat estimasi belanja pasar subuh sebesar Rp ${totalEstBudget.toLocaleString('id-ID')} ke Buku Kas Pengeluaran Dapur?`
    );
    if (!confirmExp) return;

    storageService.addExpense({
      tanggal: targetDate,
      kategori: 'bahan_baku',
      nama_item: `Belanja Pasar Subuh (${totalPcs} pcs Risoles Dulang)`,
      nominal: totalEstBudget,
      catatan: `Kebutuhan bahan: ${menus.map((m) => `${targetPcsMap[m.id] || 0} ${m.nama}`).join(', ')}. ${notes}`,
    });

    if (onExpenseAdded) onExpenseAdded();
    onShowToast(`Pengeluaran belanja pasar Rp ${totalEstBudget.toLocaleString('id-ID')} berhasil dicatat di Buku Kas! 📉✓`);
  };

  const categoryLabels = {
    isian: { title: '🥩 Bahan Isian Utama', color: 'border-amber-300 bg-amber-50/50' },
    kulit: { title: '🥞 Bahan Adonan Kulit', color: 'border-yellow-300 bg-yellow-50/50' },
    panir_minyak: { title: '🔥 Panir & Minyak Goreng', color: 'border-orange-300 bg-orange-50/50' },
    kemasan: { title: '📦 Pelengkap & Kemasan', color: 'border-emerald-300 bg-emerald-50/50' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FFFDF4] w-full max-w-3xl rounded-[28px] border-3 border-[#111111] shadow-[8px_8px_0_#111111] p-5 sm:p-7 relative max-h-[92vh] flex flex-col my-auto">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b-2 border-[#111111]/15 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full text-xs font-bold border border-[#111111] mb-1">
              <span>🌅</span>
              <span>DULANG-2 PREP-COOK CALCULATOR</span>
            </div>
            <h2 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-tight">
              Kalkulator Kebutuhan Bahan Subuh
            </h2>
            <p className="font-sans text-xs text-[#5C3D2E]/80 mt-0.5">
              Kalkulasi otomatis belanja pasar & resep adonan dari target porsi risoles besok
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer w-9 h-9 rounded-full bg-white text-[#111111] border-2 border-[#111111] font-bold text-sm flex items-center justify-center hover:bg-[#FFD700] shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
          {/* Target Production & Date Card */}
          <div className="bg-white rounded-[20px] p-4 sm:p-5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  📅 Tanggal Masak Subuh:
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="rounded-xl border-2 border-[#111111] px-3 py-1.5 font-sans text-xs bg-[#FFFDF4] font-bold"
                />
              </div>

              <button
                type="button"
                onClick={handlePullTomorrowOrders}
                className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border-2 border-[#111111] px-3.5 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111] flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <span>⚡</span>
                <span>Tarik dari Pre-Order Besok</span>
              </button>
            </div>

            {/* Menu Targets Input Grid */}
            <div className="pt-2 border-t border-[#111111]/10">
              <span className="font-sans text-xs font-bold text-[#5C3D2E] block mb-2">
                Target Porsi Risoles (Pcs):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {menus.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 bg-[#FFF8E7] rounded-xl border border-[#111111]/20 flex items-center justify-between gap-2"
                  >
                    <span className="font-sans text-xs font-bold text-[#111111] truncate">
                      {m.nama}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={targetPcsMap[m.id] ?? 0}
                        onChange={(e) => handleQtyChange(m.id, parseInt(e.target.value) || 0)}
                        className="w-16 text-center font-sans font-bold text-xs bg-white rounded-lg border border-[#111111] py-1"
                      />
                      <span className="text-[11px] text-[#5C3D2E] font-medium">pcs</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs bg-[#111111] text-[#FFF8E7] p-2.5 rounded-xl font-sans">
                <span>Total Target Produksi Subuh:</span>
                <strong className="text-[#FFD700] text-sm">{totalPcs} Pcs Risoles</strong>
              </div>
            </div>
          </div>

          {/* Calculated Ingredients Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-hand font-bold text-xl text-[#111111] flex items-center gap-1.5">
                <span>🛒</span>
                <span>Daftar Belanja Pasar & Kebutuhan Bahan ({ingredients.length} Item)</span>
              </h3>
              <span className="font-sans text-xs text-[#5C3D2E]">
                *Centang jika sudah dibeli di pasar
              </span>
            </div>

            {(['isian', 'kulit', 'panir_minyak', 'kemasan'] as const).map((catKey) => {
              const list = ingredients.filter((i) => i.category === catKey);
              if (list.length === 0) return null;
              const meta = categoryLabels[catKey];

              return (
                <div key={catKey} className={`rounded-[18px] p-3.5 border-2 ${meta.color} space-y-2`}>
                  <div className="font-sans font-bold text-xs text-[#111111] uppercase tracking-wider">
                    {meta.title}
                  </div>
                  <div className="divide-y divide-[#111111]/10">
                    {list.map((ing) => {
                      const isChecked = !!checkedIds[ing.id];
                      return (
                        <div
                          key={ing.id}
                          onClick={() => toggleCheck(ing.id)}
                          className={`py-2 px-1 flex items-center justify-between gap-3 cursor-pointer hover:bg-black/5 rounded-lg transition ${
                            isChecked ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-[#111111] focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <div className="font-sans text-xs font-bold text-[#111111]">
                                {ing.name}
                              </div>
                              <div className="font-sans text-[11px] text-[#5C3D2E]">
                                Jumlah: <strong>{ing.amount} {ing.unit}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-sans text-xs font-bold text-[#111111]">
                              Rp {ing.estPrice.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label className="block font-sans text-xs font-bold text-[#5C3D2E]">
              Catatan Khusus Belanja / Masak Subuh:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Beli telur di toko Bu Haji, pilih yang cangkang coklat tebal..."
              className="w-full rounded-xl border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            />
          </div>

          {/* Total Budget Card */}
          <div className="p-4 bg-[#FFD700] text-[#111111] rounded-[20px] border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-sans text-xs font-bold uppercase tracking-wider block opacity-90">
                Estimasi Total Anggaran Pasar Subuh:
              </span>
              <div className="font-hand font-bold text-3xl sm:text-4xl text-[#111111] leading-none mt-1">
                Rp {totalEstBudget.toLocaleString('id-ID')}
              </div>
              <span className="font-sans text-[11px] opacity-80 mt-0.5 block">
                Untuk produksi {totalPcs} pcs risoles lumer siap goreng
              </span>
            </div>

            <button
              type="button"
              onClick={handleRecordToExpense}
              className="cursor-pointer bg-[#111111] hover:bg-[#222222] text-[#FFD700] px-4 py-2.5 rounded-full font-sans font-bold text-xs shadow-sm border border-[#111111] transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>📉</span>
              <span>Catat ke Buku Kas Dapur</span>
            </button>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="pt-4 border-t-2 border-[#111111]/15 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyClipboard}
            className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] border-2 border-[#111111] px-4 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5"
          >
            <span>📋</span>
            <span>Salin Checklist</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-4 py-2 rounded-full font-sans font-bold text-xs text-[#5C3D2E] hover:text-[#111111] transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="cursor-pointer bg-[#25D366] hover:bg-[#20ba59] text-white border-2 border-[#111111] px-5 py-2.5 rounded-full font-sans font-bold text-xs shadow-[3px_3px_0_#111111] transition flex items-center gap-1.5 active:translate-y-0.5"
            >
              <span>📲</span>
              <span>Kirim Checklist ke WA Belanja</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
