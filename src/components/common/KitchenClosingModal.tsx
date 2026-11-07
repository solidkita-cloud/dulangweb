import React, { useState } from 'react';
import { OrderRecord, ExpenseRecord, KitchenClosingRecap, StoreConfig } from '../../types';
import { storageService } from '../../services/storageService';

interface KitchenClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderRecord[];
  expenses: ExpenseRecord[];
  storeConfig: StoreConfig;
  onShowToast: (msg: string) => void;
}

export const KitchenClosingModal: React.FC<KitchenClosingModalProps> = ({
  isOpen,
  onClose,
  orders,
  expenses,
  storeConfig,
  onShowToast,
}) => {
  const [closingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [evalNotes, setEvalNotes] = useState('Alhamdulillah gorengan hari ini habis, sisa adonan aman di kulkas');
  const [ownerWa, setOwnerWa] = useState(() => storageService.getOwnerWa());

  // Cash Float & Drawer Reconciliation state
  const [openingCashFloat, setOpeningCashFloat] = useState<number | ''>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dulang_cash_float');
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    }
    return 100000; // Default Rp 100.000 modal awal kembalian pagi
  });
  const [actualDrawerCash, setActualDrawerCash] = useState<number | ''>('');
  const [drawerExpenseOverride, setDrawerExpenseOverride] = useState<number | '' | null>(null);
  const [keepFloatForTomorrow, setKeepFloatForTomorrow] = useState<boolean>(true);

  if (!isOpen) return null;

  // Filter today's completed orders and DP orders
  const todayLunasOrders = orders.filter((o) => {
    const oDate = (o.completed_at || o.created_at || '').split('T')[0];
    return oDate === closingDate && o.status === 'lunas';
  });

  const todayDpOrders = orders.filter((o) => {
    const oDate = (o.created_at || '').split('T')[0];
    return oDate === closingDate && o.status === 'dp';
  });

  // Filter today's expenses
  const todayExpenses = expenses.filter((e) => {
    return e.tanggal === closingDate;
  });

  // Calculate metrics
  let totalPortions = 0;
  let portionsMatang = 0;
  let portionsFrozen = 0;
  let cashRevenue = 0;
  let qrisRevenue = 0;
  let transferRevenue = 0;
  let dpRevenue = 0;
  let pendingReceivables = 0;
  const itemCounts: Record<string, number> = {};

  todayLunasOrders.forEach((o) => {
    if (o.payment_method === 'tunai') {
      cashRevenue += o.total_price;
    } else if (o.payment_method === 'transfer') {
      transferRevenue += o.total_price;
    } else {
      qrisRevenue += o.total_price;
    }

    o.items.forEach((it) => {
      totalPortions += it.qty;
      if (it.variantType === 'frozen') {
        portionsFrozen += it.qty;
      } else {
        portionsMatang += it.qty;
      }
      itemCounts[it.nama] = (itemCounts[it.nama] || 0) + it.qty;
    });
  });

  todayDpOrders.forEach((o) => {
    const dp = o.dp_amount || 0;
    dpRevenue += dp;
    const remaining = o.remaining_amount !== undefined ? o.remaining_amount : Math.max(0, o.total_price - dp);
    pendingReceivables += remaining;

    if (o.payment_method === 'tunai') {
      cashRevenue += dp;
    } else if (o.payment_method === 'transfer') {
      transferRevenue += dp;
    } else {
      qrisRevenue += dp;
    }

    o.items.forEach((it) => {
      totalPortions += it.qty;
      if (it.variantType === 'frozen') {
        portionsFrozen += it.qty;
      } else {
        portionsMatang += it.qty;
      }
      itemCounts[it.nama] = (itemCounts[it.nama] || 0) + it.qty;
    });
  });

  const nonCashRevenue = qrisRevenue + transferRevenue;
  const grossRevenue = cashRevenue + nonCashRevenue; // Total cash physically / digitally received today
  const totalExpenseNominal = todayExpenses.reduce((sum, e) => sum + e.nominal, 0);
  const netProfit = grossRevenue - totalExpenseNominal;
  const netProfitMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

  // Cash Drawer Reconciliation Calculations
  const floatNum = typeof openingCashFloat === 'number' ? openingCashFloat : 0;
  const drawerExpenseNum =
    drawerExpenseOverride !== null
      ? typeof drawerExpenseOverride === 'number'
        ? drawerExpenseOverride
        : 0
      : totalExpenseNominal;
  const expectedDrawerCash = Math.max(0, floatNum + cashRevenue - drawerExpenseNum);
  const isActualInputted = actualDrawerCash !== '';
  const actualCashNum = typeof actualDrawerCash === 'number' ? actualDrawerCash : 0;
  const cashDifference = isActualInputted ? actualCashNum - expectedDrawerCash : 0;
  const effectiveCashToCount = isActualInputted ? actualCashNum : expectedDrawerCash;
  const depositToOwner = keepFloatForTomorrow
    ? Math.max(0, effectiveCashToCount - floatNum)
    : effectiveCashToCount;

  // Top selling items
  const sortedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty]) => ({ name, qty }));

  // Pre-orders for tomorrow
  const tomorrowOrders = orders.filter(
    (o) => o.status !== 'batal' && (o.delivery_schedule || '').toLowerCase().includes('besok')
  );
  const tomorrowPcs = tomorrowOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.qty, 0), 0);

  const formattedDate = new Date(closingDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const generateRecapText = (): string => {
    let msg = `🌙 *LAPORAN CLOSING DAPUR DULANG INDONESIA* 🥟✨\n`;
    msg += `📅 Hari/Tgl: *${formattedDate}*\n`;
    if (storeConfig?.activeKloter) {
      msg += `🏷️ Kloter: *${storeConfig.activeKloter}*\n`;
    }
    msg += `⏰ Jam Closing: *${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *RINGKASAN KAS & PROFIT HARI INI:*\n`;
    msg += `• Total Uang Masuk (Cash In): *Rp ${grossRevenue.toLocaleString('id-ID')}*\n`;
    if (todayLunasOrders.length > 0) {
      msg += `  ├ Pesanan Lunas (${todayLunasOrders.length}x): Rp ${(grossRevenue - dpRevenue).toLocaleString('id-ID')}\n`;
    }
    if (todayDpOrders.length > 0) {
      msg += `  └ Uang Muka DP Masuk (${todayDpOrders.length}x): Rp ${dpRevenue.toLocaleString('id-ID')}\n`;
    }
    msg += `\n• Rincian Metode Penerimaan:\n`;
    msg += `  💵 Tunai (Kas Fisik Dapur): Rp ${cashRevenue.toLocaleString('id-ID')}\n`;
    msg += `  📲 QRIS: Rp ${qrisRevenue.toLocaleString('id-ID')}\n`;
    msg += `  💳 Transfer Bank: Rp ${transferRevenue.toLocaleString('id-ID')}\n`;
    msg += `\n• Total Belanja & Biaya Dapur: *-Rp ${totalExpenseNominal.toLocaleString('id-ID')}* (${todayExpenses.length} pos)\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🚀 *LABA BERSIH HARI INI: Rp ${netProfit.toLocaleString('id-ID')}*\n`;
    msg += `📊 Margin Profit: *${netProfitMargin}%*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *REKONSILIASI UANG FISIK LACI KASIR:*\n`;
    msg += `• Modal Awal Kembalian (Pagi): Rp ${floatNum.toLocaleString('id-ID')}\n`;
    msg += `• Penjualan Tunai Masuk: +Rp ${cashRevenue.toLocaleString('id-ID')}\n`;
    msg += `• Belanja Keluar dari Laci: -Rp ${drawerExpenseNum.toLocaleString('id-ID')}\n`;
    msg += `• *Seharusnya Ada di Laci:* *Rp ${expectedDrawerCash.toLocaleString('id-ID')}*\n`;
    if (isActualInputted) {
      msg += `• Uang Fisik Hasil Hitung: *Rp ${actualCashNum.toLocaleString('id-ID')}*\n`;
      const diffStatus =
        cashDifference === 0
          ? '✅ PAS (Sesuai 100%)'
          : cashDifference > 0
          ? `🟢 LEBIH (+Rp ${cashDifference.toLocaleString('id-ID')})`
          : `🔴 SELISIH KURANG (-Rp ${Math.abs(cashDifference).toLocaleString('id-ID')})`;
      msg += `• Status Selisih Fisik: *${diffStatus}*\n`;
    } else {
      msg += `• Uang Fisik Hasil Hitung: _(Belum dihitung saat rekap dibuat)_\n`;
    }
    msg += `• *Setoran Fisik ke Owner:* *Rp ${depositToOwner.toLocaleString('id-ID')}*\n`;
    if (keepFloatForTomorrow) {
      msg += `  ℹ️ (Modal Rp ${floatNum.toLocaleString('id-ID')} ditinggal di laci untuk operasional besok pagi)\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🥟 *PORSI RISOLES TERJUAL:*\n`;
    msg += `• Total Terjual: *${totalPortions} Pcs*\n`;
    msg += `  - 🍳 Goreng Matang: ${portionsMatang} Pcs\n`;
    msg += `  - ❄️ Frozen Food: ${portionsFrozen} Pcs\n`;
    if (sortedItems.length > 0) {
      msg += `\n🏆 *Menu Terlaris:*\n`;
      sortedItems.forEach((it, idx) => {
        msg += `  ${idx + 1}. ${it.name} (${it.qty} pcs)\n`;
      });
    }
    if (pendingReceivables > 0) {
      msg += `\n⏳ *Piutang / Sisa Tagihan DP Pending:* Rp ${pendingReceivables.toLocaleString('id-ID')}\n`;
    }
    if (tomorrowOrders.length > 0) {
      msg += `\n🌅 *Pre-Order Booking Besok:* ${tomorrowOrders.length} Pesanan (${tomorrowPcs} pcs risoles)\n`;
    }
    if (evalNotes.trim()) {
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📝 *Catatan Evaluasi Dapur:*\n"${evalNotes.trim()}"\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Terima kasih atas kerja keras hari ini! Dapur Dulang istirahat malam, besok subuh siap melayani pelanggan dengan sepenuh hati 😊🙏💛`;
    return msg;
  };

  const handleSendWhatsApp = () => {
    const recap: KitchenClosingRecap = {
      id: `RECAP-${closingDate}`,
      recapDate: closingDate,
      closedAt: new Date().toISOString(),
      totalOrders: todayLunasOrders.length + todayDpOrders.length,
      totalPortions,
      portionsMatang,
      portionsFrozen,
      grossRevenue,
      cashRevenue,
      nonCashRevenue,
      dpRevenue,
      pendingReceivables,
      totalCashFlowIn: grossRevenue,
      totalExpenses: totalExpenseNominal,
      netProfit,
      topSellingItems: sortedItems,
      tomorrowPreOrdersCount: tomorrowOrders.length,
      notes: evalNotes,
      openingCashFloat: floatNum,
      cashExpensesFromDrawer: drawerExpenseNum,
      expectedDrawerCash,
      actualDrawerCash: isActualInputted ? actualCashNum : undefined,
      cashDifference: isActualInputted ? cashDifference : undefined,
      depositToOwner,
    };
    storageService.saveKitchenRecap(recap);
    storageService.setOwnerWa(ownerWa);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dulang_cash_float', String(floatNum));
    }

    const text = generateRecapText();
    const cleanWa = ownerWa.replace(/\D/g, '');
    const url = cleanWa
      ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast(`Laporan closing disiapkan untuk WhatsApp Owner! 🌙📋`);
  };

  const handleCopyClipboard = () => {
    const text = generateRecapText();
    navigator.clipboard.writeText(text);
    onShowToast('Rekap tutup dapur berhasil disalin ke clipboard! 📋✓');
  };

  const handlePrintRecap = () => {
    const recap: KitchenClosingRecap = {
      id: `RECAP-${closingDate}`,
      recapDate: closingDate,
      closedAt: new Date().toISOString(),
      totalOrders: todayLunasOrders.length + todayDpOrders.length,
      totalPortions,
      portionsMatang,
      portionsFrozen,
      grossRevenue,
      cashRevenue,
      nonCashRevenue,
      dpRevenue,
      pendingReceivables,
      totalCashFlowIn: grossRevenue,
      totalExpenses: totalExpenseNominal,
      netProfit,
      topSellingItems: sortedItems,
      tomorrowPreOrdersCount: tomorrowOrders.length,
      notes: evalNotes,
      openingCashFloat: floatNum,
      cashExpensesFromDrawer: drawerExpenseNum,
      expectedDrawerCash,
      actualDrawerCash: isActualInputted ? actualCashNum : undefined,
      cashDifference: isActualInputted ? cashDifference : undefined,
      depositToOwner,
    };
    storageService.saveKitchenRecap(recap);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dulang_cash_float', String(floatNum));
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FFFDF4] w-full max-w-2xl rounded-[28px] border-3 border-[#111111] shadow-[8px_8px_0_#111111] p-5 sm:p-7 relative max-h-[92vh] flex flex-col my-auto">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b-2 border-[#111111]/15 shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-3 py-0.5 rounded-full text-xs font-bold border border-[#FFD700] mb-1">
              <span>🌙</span>
              <span>DULANG-2 KITCHEN CLOSING</span>
            </div>
            <h2 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-tight">
              Rekap Tutup Dapur Malam
            </h2>
            <p className="font-sans text-xs text-[#5C3D2E]/80 mt-0.5">
              {formattedDate} • Evaluasi penjualan, omzet tunai vs QRIS, dan sisa kas bersih
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
        <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1">
          {/* Main Profit Card */}
          <div className="bg-[#111111] text-[#FFF8E7] rounded-[22px] p-5 border-2 border-[#FFD700] shadow-[4px_4px_0_#FFD700] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                ✨ Sisa Kas Bersih (Profit Hari Ini):
              </span>
              <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded-full text-[#FFF8E7]/80">
                {todayLunasOrders.length + todayDpOrders.length} transaksi ({todayLunasOrders.length} lunas, {todayDpOrders.length} DP)
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="font-hand font-bold text-4xl sm:text-5xl text-[#FFD700] leading-none">
                Rp {netProfit.toLocaleString('id-ID')}
              </div>
              <span className="text-xs font-sans font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-700">
                Margin: {netProfitMargin}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs font-sans">
              <div>
                <span className="text-white/60 block">Total Uang Masuk (Cash In):</span>
                <strong className="text-emerald-400 font-bold text-sm">
                  +Rp {grossRevenue.toLocaleString('id-ID')}
                </strong>
                <div className="text-[10px] text-white/70 mt-1 space-y-0.5 font-mono">
                  <div>💵 Tunai: Rp {cashRevenue.toLocaleString('id-ID')}</div>
                  <div>📲 QRIS: Rp {qrisRevenue.toLocaleString('id-ID')}</div>
                  <div>💳 Transfer: Rp {transferRevenue.toLocaleString('id-ID')}</div>
                </div>
              </div>
              <div>
                <span className="text-white/60 block">Pengeluaran Bahan/Gas:</span>
                <strong className="text-red-400 font-bold text-sm">
                  -Rp {totalExpenseNominal.toLocaleString('id-ID')}
                </strong>
                <div className="text-[10px] text-white/70 mt-1">
                  {todayExpenses.length} catatan belanja
                </div>
                {pendingReceivables > 0 && (
                  <div className="mt-2 text-[10px] bg-amber-400/20 text-amber-300 p-1.5 rounded-lg border border-amber-400/30">
                    ⏳ Sisa DP Pending: Rp {pendingReceivables.toLocaleString('id-ID')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rekonsiliasi Uang Fisik Laci Kasir */}
          <div className="bg-white rounded-[22px] p-4 sm:p-5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-[#FFF8E7] text-[#5C3D2E] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#111111]/20 mb-1">
                  <span>💵</span>
                  <span>KAS KASIR & SETORAN OWNER</span>
                </div>
                <h3 className="font-hand font-bold text-xl sm:text-2xl text-[#111111] leading-tight">
                  Rekonsiliasi Uang Fisik Laci Kasir
                </h3>
                <p className="font-sans text-xs text-[#5C3D2E]/80">
                  Hitung uang tunai fisik di laci sebelum toko ditutup & pisahkan setoran owner
                </p>
              </div>
            </div>

            {/* Inputs: Modal Awal & Belanja Tunai */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
              {/* Modal Awal Kembalian Pagi */}
              <div className="bg-[#FFFDF4] p-3 rounded-2xl border-2 border-[#111111]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#111111] flex items-center gap-1">
                    <span>🪙</span> Modal Awal Kembalian:
                  </label>
                  <span className="text-[10px] text-[#5C3D2E]/70 font-mono">Pagi hari</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#5C3D2E]/60 text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    value={openingCashFloat}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setOpeningCashFloat(val);
                      if (typeof val === 'number') {
                        localStorage.setItem('dulang_cash_float', String(val));
                      }
                    }}
                    placeholder="100.000"
                    className="w-full bg-white border-2 border-[#111111] rounded-xl pl-9 pr-3 py-1.5 font-mono text-sm font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  />
                </div>
                {/* Quick Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-[#5C3D2E]/70 font-semibold">Cepat:</span>
                  {[50000, 100000, 150000, 200000].map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => {
                        setOpeningCashFloat(nominal);
                        localStorage.setItem('dulang_cash_float', String(nominal));
                      }}
                      className={`cursor-pointer px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                        openingCashFloat === nominal
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                          : 'bg-white hover:bg-gray-100 text-[#111111] border-[#111111]/30'
                      }`}
                    >
                      {nominal / 1000}rb
                    </button>
                  ))}
                </div>
              </div>

              {/* Belanja dari Laci */}
              <div className="bg-[#FFFDF4] p-3 rounded-2xl border-2 border-[#111111]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#111111] flex items-center gap-1">
                    <span>🛒</span> Belanja dari Laci Kasir:
                  </label>
                  {drawerExpenseOverride !== null && (
                    <button
                      type="button"
                      onClick={() => setDrawerExpenseOverride(null)}
                      className="cursor-pointer text-[10px] text-amber-800 underline font-bold"
                    >
                      Reset otomatis
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#5C3D2E]/60 text-xs">Rp</span>
                  <input
                    type="number"
                    min={0}
                    value={drawerExpenseOverride !== null ? drawerExpenseOverride : totalExpenseNominal}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setDrawerExpenseOverride(val);
                    }}
                    placeholder="0"
                    className="w-full bg-white border-2 border-[#111111] rounded-xl pl-9 pr-3 py-1.5 font-mono text-sm font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                  />
                </div>
                <div className="text-[10px] text-[#5C3D2E]/75">
                  Total belanja tercatat hari ini: <strong className="font-mono">Rp {totalExpenseNominal.toLocaleString('id-ID')}</strong>
                </div>
              </div>
            </div>

            {/* Expected vs Actual Count Highlight Card */}
            <div className="bg-[#FFF8E7] rounded-2xl p-3.5 border-2 border-amber-300 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Expected */}
                <div>
                  <span className="text-[11px] font-sans font-bold text-[#5C3D2E] block">
                    1. Uang Seharusnya Ada di Laci:
                  </span>
                  <div className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] mt-0.5">
                    Rp {expectedDrawerCash.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] font-mono text-[#5C3D2E]/80 mt-0.5">
                    Modal Rp {floatNum.toLocaleString('id-ID')} + Tunai Rp {cashRevenue.toLocaleString('id-ID')} - Belanja Rp {drawerExpenseNum.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Actual Physical Cash Input */}
                <div className="bg-white p-3 rounded-xl border-2 border-[#111111] shadow-[2px_2px_0_#111111]">
                  <label className="text-[11px] font-sans font-bold text-[#111111] block mb-1">
                    2. Hitung Uang Fisik di Laci: <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#111111] text-sm">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={actualDrawerCash}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                        setActualDrawerCash(val);
                      }}
                      placeholder="Ketik total uang fisik..."
                      className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-lg pl-9 pr-3 py-1.5 font-mono text-base font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                    />
                  </div>
                  <div className="text-[10px] text-[#5C3D2E]/70 mt-1">
                    Ketik jumlah total uang kertas & koin yang ada di laci kasir saat ini
                  </div>
                </div>
              </div>

              {/* Variance Alert Banner */}
              {isActualInputted ? (
                <div
                  className={`p-3 rounded-xl border-2 flex items-start gap-2.5 font-sans text-xs transition ${
                    cashDifference === 0
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                      : cashDifference > 0
                      ? 'bg-sky-50 border-sky-500 text-sky-950'
                      : 'bg-red-50 border-red-500 text-red-950'
                  }`}
                >
                  <span className="text-xl shrink-0">
                    {cashDifference === 0 ? '✅' : cashDifference > 0 ? '🟢' : '🔴'}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <strong className="text-xs uppercase font-extrabold tracking-wide">
                        {cashDifference === 0
                          ? 'Uang Fisik Kasir Pas 100%'
                          : cashDifference > 0
                          ? `Uang Kasir Lebih (+Rp ${cashDifference.toLocaleString('id-ID')})`
                          : `Perhatian: Selisih Kurang (-Rp ${Math.abs(cashDifference).toLocaleString('id-ID')})`}
                      </strong>
                      <span className="font-mono font-bold text-xs">
                        Selisih: {cashDifference >= 0 ? `+Rp ${cashDifference.toLocaleString('id-ID')}` : `-Rp ${Math.abs(cashDifference).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 opacity-90">
                      {cashDifference === 0
                        ? 'Alhamdulillah, tidak ada selisih sama sekali antara sistem dan fisik laci.'
                        : cashDifference > 0
                        ? 'Uang fisik di laci lebih banyak dari pencatatan (kemungkinan dapat tip dari pelanggan atau kembalian ikhlas).'
                        : 'Uang fisik di laci kurang dari catatan. Silakan cek kembali uang kembalian atau mungkin ada nota belanja pasar yang belum tercatat.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-100/60 rounded-xl border border-amber-300 text-[11px] font-sans text-amber-900 flex items-center gap-2">
                  <span>💡</span>
                  <span>Ketik nominal uang fisik di atas untuk memverifikasi apakah laci kasir malam ini sudah pas atau ada selisih.</span>
                </div>
              )}
            </div>

            {/* Setoran Owner & Modal Besok Card */}
            <div className="bg-[#111111] text-[#FFF8E7] rounded-2xl p-4 border-2 border-[#111111] space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-sans font-bold text-[#FFD700] uppercase tracking-wider block">
                    💰 Setoran Bersih Tunai ke Owner Malam Ini:
                  </span>
                  <div className="font-hand font-bold text-3xl sm:text-4xl text-[#FFD700] leading-tight">
                    Rp {depositToOwner.toLocaleString('id-ID')}
                  </div>
                  <p className="text-[11px] text-white/70 font-sans mt-0.5">
                    {keepFloatForTomorrow
                      ? `Modal awal Rp ${floatNum.toLocaleString('id-ID')} tetap ditinggalkan di laci untuk operasional pagi besok.`
                      : 'Semua uang kas fisik ditarik / disetor ke owner tanpa sisa di laci.'}
                  </p>
                </div>

                <label className="cursor-pointer bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl border border-white/20 flex items-center gap-2 text-xs font-sans text-white shrink-0 transition">
                  <input
                    type="checkbox"
                    checked={keepFloatForTomorrow}
                    onChange={(e) => setKeepFloatForTomorrow(e.target.checked)}
                    className="w-4 h-4 accent-[#FFD700] rounded cursor-pointer"
                  />
                  <span>Tinggalkan modal awal di laci</span>
                </label>
              </div>
            </div>
          </div>

          {/* Breakdown Portions Sold */}
          <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-bold uppercase text-[#5C3D2E]">
                🥟 Total Porsi Risoles Terjual:
              </span>
              <strong className="font-hand font-bold text-2xl text-[#111111]">
                {totalPortions} Pcs
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[#5C3D2E] block">🍳 Goreng Matang (Hangat):</span>
                <strong className="text-amber-900 font-bold text-base">{portionsMatang} pcs</strong>
              </div>
              <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200">
                <span className="text-sky-800 block">❄️ Frozen Food (Beku):</span>
                <strong className="text-sky-950 font-bold text-base">{portionsFrozen} pcs</strong>
              </div>
            </div>

            {/* Top sellers */}
            {sortedItems.length > 0 && (
              <div className="pt-2 border-t border-[#111111]/10">
                <span className="text-[11px] font-sans font-bold text-[#5C3D2E] block mb-1">
                  🏆 Menu Terlaris Hari Ini:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {sortedItems.map((it, idx) => (
                    <span
                      key={it.name}
                      className="inline-flex items-center gap-1 bg-[#FFF8E7] text-[#111111] px-2.5 py-1 rounded-full text-xs font-bold border border-[#111111]/20"
                    >
                      <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <span>{it.name}: <strong>{it.qty} pcs</strong></span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tomorrow Pre-Order Alert */}
          <div className="bg-[#FFF8E7] rounded-[18px] p-3.5 border-2 border-amber-400 flex items-center justify-between gap-3 text-xs font-sans">
            <div>
              <strong className="block text-[#111111] font-bold">
                🌅 Pre-Order Menunggu Besok Subuh:
              </strong>
              <span className="text-[#5C3D2E]">
                {tomorrowOrders.length} pesanan tercatat ({tomorrowPcs} pcs risoles siap digulung)
              </span>
            </div>
            <span className="bg-[#FFD700] text-[#111111] px-2.5 py-1 rounded-full font-bold border border-[#111111] shrink-0">
              Siap Subuh 🍳
            </span>
          </div>

          {/* Evaluation Notes */}
          <div className="space-y-1">
            <label className="block font-sans text-xs font-bold text-[#5C3D2E]">
              Catatan Evaluasi / Pesan Dapur Malam Ini:
            </label>
            <textarea
              rows={2}
              value={evalNotes}
              onChange={(e) => setEvalNotes(e.target.value)}
              placeholder="Tulis catatan evaluasi malam ini..."
              className="w-full rounded-xl border-2 border-[#111111] p-2.5 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            />
          </div>

          {/* Target Nomor WA Pribadi Owner */}
          <div className="bg-emerald-50 rounded-[18px] p-3.5 border-2 border-emerald-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-sans">
            <div>
              <strong className="block text-emerald-950 font-bold flex items-center gap-1.5">
                <span>📱</span>
                <span>Kirim Langsung ke WA Pribadi Owner:</span>
              </strong>
              <span className="text-emerald-800 text-[11px]">
                Rekap closing otomatis terbuka di chat nomor ini tanpa repot cari kontak
              </span>
            </div>
            <div className="w-full sm:w-auto flex items-center gap-1.5">
              <input
                type="tel"
                value={ownerWa}
                onChange={(e) => setOwnerWa(e.target.value)}
                placeholder="6287703397035"
                className="w-full sm:w-44 bg-white border-2 border-emerald-600 rounded-full px-3 py-1.5 font-mono text-xs font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="pt-4 border-t-2 border-[#111111]/15 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] border-2 border-[#111111] px-3.5 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5"
            >
              <span>📋</span>
              <span>Salin</span>
            </button>
            <button
              type="button"
              onClick={handlePrintRecap}
              className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] border-2 border-[#111111] px-3.5 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Cetak Struk Rekap</span>
            </button>
          </div>

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
              <span>Kirim ke WA Owner (1-Klik)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
