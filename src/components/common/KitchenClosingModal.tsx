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
    };
    storageService.saveKitchenRecap(recap);
    storageService.setOwnerWa(ownerWa);

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
    };
    storageService.saveKitchenRecap(recap);
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
