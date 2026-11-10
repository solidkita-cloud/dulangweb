import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { OrderRecord, KitchenCookingStatus } from '../../types';
import { storageService } from '../../services/storageService';
import {
  playNewCustomerChime,
  unlockAudioContext,
  isAudioContextUnlocked,
  triggerKitchenVibration,
} from '../../lib/audioNotifier';

interface KitchenDisplaySystemProps {
  onShowToast: (msg: string) => void;
  isStandalone?: boolean;
  onCloseStandalone?: () => void;
  onPrintReceipt?: (order: OrderRecord) => void;
}

export const KitchenDisplaySystem: React.FC<KitchenDisplaySystemProps> = ({
  onShowToast,
  isStandalone = false,
  onCloseStandalone,
  onPrintReceipt,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>(() => storageService.getKitchenOrders());
  const [filterTab, setFilterTab] = useState<'semua' | 'antre' | 'sedang_goreng' | 'packing' | 'siap' | 'selesai'>('semua');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => isAudioContextUnlocked());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const prevAntreCountRef = useRef<number>(orders.filter((o) => (o.kitchen_status || 'antre') === 'antre').length);

  // Standalone Thermal Receipt Modal State
  const [standaloneReceiptOrder, setStandaloneReceiptOrder] = useState<OrderRecord | null>(null);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string>('');
  const storeConfig = storageService.getStoreConfig();

  useEffect(() => {
    if (standaloneReceiptOrder) {
      const trackUrl = storageService.generateTrackingUrl(standaloneReceiptOrder.id);
      QRCode.toDataURL(trackUrl, { width: 140, margin: 1 })
        .then((url) => setReceiptQrDataUrl(url))
        .catch((err) => console.error('Failed to generate receipt QR:', err));
    } else {
      setReceiptQrDataUrl('');
    }
  }, [standaloneReceiptOrder]);

  // Clock tick every 10 seconds for elapsed timer calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Listen to order & kitchen updates
  useEffect(() => {
    const refreshData = () => {
      const freshOrders = storageService.getKitchenOrders();
      setOrders(freshOrders);

      const currentAntre = freshOrders.filter((o) => (o.kitchen_status || 'antre') === 'antre').length;
      if (currentAntre > prevAntreCountRef.current) {
        if (soundEnabled) {
          playNewCustomerChime();
        }
        triggerKitchenVibration();
      }
      prevAntreCountRef.current = currentAntre;
    };

    const handleKitchenUpdate = (e: any) => {
      refreshData();
      if (soundEnabled && e.detail?.kitchenStatus === 'antre') {
        playNewCustomerChime();
        triggerKitchenVibration();
      }
    };

    let isMounted = true;
    window.addEventListener('dulang_kitchen_updated', handleKitchenUpdate);
    window.addEventListener('dulang_orders_updated', refreshData);
    window.addEventListener('storage', refreshData);

    // Auto-poll every 5 seconds for live multi-device synchronization
    const pollInterval = setInterval(async () => {
      await storageService.syncOrdersFromSupabase().catch(() => {});
      if (isMounted) refreshData();
    }, 5000);

    return () => {
      isMounted = false;
      window.removeEventListener('dulang_kitchen_updated', handleKitchenUpdate);
      window.removeEventListener('dulang_orders_updated', refreshData);
      window.removeEventListener('storage', refreshData);
      clearInterval(pollInterval);
    };
  }, [soundEnabled]);

  const handleUpdateStatus = (orderId: string, nextStatus: KitchenCookingStatus) => {
    const updated = storageService.updateKitchenCookingStatus(orderId, nextStatus);
    if (updated) {
      setOrders(storageService.getKitchenOrders());
      if (soundEnabled) {
        playNewCustomerChime();
      }
      let label = 'Status masakan diperbarui';
      if (nextStatus === 'sedang_goreng') label = `🔥 Pesanan #${orderId} masuk wajan penggorengan!`;
      else if (nextStatus === 'packing') label = `📦 Pesanan #${orderId} ditiriskan & masuk dus kemasan.`;
      else if (nextStatus === 'siap') label = `🥟 Pesanan #${orderId} SIAP diambil/dikirim!`;
      else if (nextStatus === 'selesai') label = `🎉 Pesanan #${orderId} selesai diserahkan!`;
      onShowToast(label);
    }
  };

  const handleSendWaUpdate = (order: OrderRecord) => {
    const text = storageService.generateWaTrackingMessage(order);
    const cleanWa = (order.customer_wa || '').replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanWa) {
      const waNumber = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
      url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast(`Membuka WhatsApp untuk update status masak #${order.id}... 📱`);
  };

  // Metrics
  const activeOrders = orders.filter((o) => o.kitchen_status !== 'selesai' && o.status !== 'batal');
  const countAntre = orders.filter((o) => (!o.kitchen_status || o.kitchen_status === 'antre') && o.status !== 'batal').length;
  const countGoreng = orders.filter((o) => o.kitchen_status === 'sedang_goreng' && o.status !== 'batal').length;
  const countPacking = orders.filter((o) => o.kitchen_status === 'packing' && o.status !== 'batal').length;
  const countSiap = orders.filter((o) => o.kitchen_status === 'siap' && o.status !== 'batal').length;
  const countSelesai = orders.filter((o) => o.kitchen_status === 'selesai').length;

  // Total pcs in active queue
  const totalActivePcs = activeOrders.reduce((sum, o) => {
    return sum + (o.items || []).reduce((s, i) => s + i.qty, 0);
  }, 0);

  // Filtered list
  const filteredOrders = orders.filter((o) => {
    const kStatus = o.kitchen_status || 'antre';
    if (filterTab === 'semua') return o.status !== 'batal' && kStatus !== 'selesai';
    return kStatus === filterTab;
  });

  // Calculate elapsed time in minutes
  const getElapsedMinutes = (dateString?: string): number => {
    if (!dateString) return 0;
    const diffMs = currentTime.getTime() - new Date(dateString).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  return (
    <div className={`space-y-6 ${isStandalone ? 'p-4 sm:p-6 bg-[#161616] min-h-screen text-white' : ''}`}>
      {/* Top Header & Live Metrics Bar */}
      <div className="bg-[#1C1C1E] border-2 border-[#2C2C2E] rounded-[24px] p-5 shadow-xl text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#2C2C2E]">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍳</span>
              <div>
                <h2 className="font-hand font-bold text-2xl sm:text-3xl text-[#FFD700] tracking-wide">
                  Layar Dapur & Antrean Goreng (KDS)
                </h2>
                <p className="font-sans text-xs text-white/60">
                  Monitor pesanan real-time tim penggorengan & packing Dapur Dulang Sidoarjo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={async () => {
                if (!soundEnabled) {
                  await unlockAudioContext();
                  setAudioUnlocked(true);
                  setSoundEnabled(true);
                  onShowToast('🔊 Bel Dapur Aktif!');
                } else {
                  setSoundEnabled(false);
                  onShowToast('🔕 Bel Dapur Senyap (Mute)');
                }
              }}
              className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 border ${
                soundEnabled
                  ? 'bg-[#FFD700] text-[#111111] border-[#FFD700]'
                  : 'bg-white/10 text-white/60 border-white/20'
              }`}
            >
              <span>{soundEnabled ? '🔔 Bel Bunyi ON' : '🔕 Mute'}</span>
            </button>

            {/* Standalone Close Button if in modal/fullscreen */}
            {isStandalone && onCloseStandalone && (
              <button
                type="button"
                onClick={onCloseStandalone}
                className="cursor-pointer px-4 py-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold transition"
              >
                ✕ Keluar Mode Penuh
              </button>
            )}
          </div>
        </div>

        {/* Banner Aktivasi Audio jika belum di-unlock oleh klik pengguna */}
        {!audioUnlocked && (
          <div
            onClick={async () => {
              await unlockAudioContext();
              setAudioUnlocked(true);
              setSoundEnabled(true);
              onShowToast('🔊 Audio Bel Dapur Aktif! Siap berbunyi otomatis saat ada pesanan.');
            }}
            className="mt-3 cursor-pointer bg-gradient-to-r from-amber-500 via-[#FFD700] to-amber-400 text-[#111111] p-3 rounded-[16px] border-2 border-[#111111] shadow-[3px_3px_0_#FFFFFF] flex items-center justify-between gap-3 animate-pulse hover:brightness-105 transition-all"
          >
            <div className="flex items-center gap-2.5 font-sans font-bold text-xs sm:text-sm">
              <span className="text-xl">🔔</span>
              <span>
                <strong className="underline">Klik di sini sekali</strong> untuk aktifkan Suara Dapur (agar tidak di-mute oleh aturan browser)
              </span>
            </div>
            <button
              type="button"
              className="bg-[#111111] text-[#FFD700] text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap shadow-sm pointer-events-none"
            >
              Tes Suara 🔊
            </button>
          </div>
        )}

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
          <div className="bg-[#2C2C2E] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] font-sans text-white/60 uppercase tracking-wider">Antre Masak</div>
            <div className="text-2xl font-bold font-mono text-[#FFD700] mt-0.5">{countAntre} <span className="text-xs font-normal text-white/50">tiket</span></div>
          </div>
          <div className="bg-[#2C2C2E] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] font-sans text-orange-400 uppercase tracking-wider">🔥 Di Wajan</div>
            <div className="text-2xl font-bold font-mono text-orange-400 mt-0.5">{countGoreng} <span className="text-xs font-normal text-white/50">wajan</span></div>
          </div>
          <div className="bg-[#2C2C2E] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] font-sans text-amber-300 uppercase tracking-wider">📦 Packing Dus</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-0.5">{countPacking} <span className="text-xs font-normal text-white/50">dus</span></div>
          </div>
          <div className="bg-[#2C2C2E] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] font-sans text-green-400 uppercase tracking-wider">🥟 Siap Ambil</div>
            <div className="text-2xl font-bold font-mono text-green-400 mt-0.5">{countSiap} <span className="text-xs font-normal text-white/50">order</span></div>
          </div>
          <div className="bg-[#2C2C2E] rounded-xl p-3 border border-white/5 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-sans text-white/60 uppercase tracking-wider">Total Goreng</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">{totalActivePcs} <span className="text-xs font-normal text-white/50">pcs risoles</span></div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'semua', label: `Semua (${activeOrders.length})` },
          { key: 'antre', label: `⏳ Antre (${countAntre})` },
          { key: 'sedang_goreng', label: `🔥 Sedang Digoreng (${countGoreng})` },
          { key: 'packing', label: `📦 Packing Dus (${countPacking})` },
          { key: 'siap', label: `🥟 Siap Ambil/Kirim (${countSiap})` },
          { key: 'selesai', label: `✅ Selesai (${countSelesai})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterTab(tab.key as any)}
            className={`cursor-pointer px-4 py-2 rounded-full font-sans text-xs font-bold transition whitespace-nowrap border ${
              filterTab === tab.key
                ? 'bg-[#FFD700] text-[#111111] border-[#FFD700] shadow-md'
                : 'bg-[#1C1C1E] text-white/70 border-white/10 hover:text-white hover:bg-[#2C2C2E]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Kitchen Tickets */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[24px] p-12 text-center border-2 border-dashed border-[#2C2C2E]">
          <span className="text-5xl block mb-3">🍳✨</span>
          <h3 className="font-hand font-bold text-2xl text-[#FFD700]">Wajan Bersih & Siap Tempur!</h3>
          <p className="font-sans text-sm text-white/60 mt-1 max-w-md mx-auto">
            Tidak ada pesanan pada filter ini. Pesanan baru dari kasir atau bot WhatsApp akan otomatis masuk ke sini dan membunyikan bel dapur!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredOrders.map((ord) => {
            const kStatus: KitchenCookingStatus = ord.kitchen_status || 'antre';
            const elapsedOrder = getElapsedMinutes(ord.created_at);
            const elapsedCooking = getElapsedMinutes(ord.cooking_started_at);

            // Card highlight theme depending on kitchen status
            let borderStyle = 'border-white/10';
            let headerBg = 'bg-[#2A2A2E]';
            let statusBadge = <span className="bg-white/10 text-white/80 px-2.5 py-0.5 rounded-full text-xs font-bold">⏳ Antre Masak</span>;

            if (kStatus === 'antre') {
              if (elapsedOrder < 5) {
                borderStyle = 'border-[#FFD700] ring-2 ring-[#FFD700]/50 shadow-[0_0_20px_rgba(255,215,0,0.35)] animate-pulse';
                headerBg = 'bg-yellow-950/80 text-yellow-200';
                statusBadge = <span className="bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm animate-bounce">🔔 Pesanan Baru!</span>;
              } else {
                borderStyle = 'border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
                headerBg = 'bg-amber-950/60 text-amber-200';
                statusBadge = <span className="bg-amber-500/30 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-full text-xs font-bold">⏳ Antre ({elapsedOrder} mnt)</span>;
              }
            } else if (kStatus === 'sedang_goreng') {
              borderStyle = 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.25)]';
              headerBg = 'bg-orange-950/60 text-orange-200';
              statusBadge = <span className="bg-orange-500 text-white px-2.5 py-0.5 rounded-full text-xs font-bold animate-pulse">🔥 Di Wajan ({elapsedCooking} mnt)</span>;
            } else if (kStatus === 'packing') {
              borderStyle = 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]';
              headerBg = 'bg-amber-950/60 text-amber-200';
              statusBadge = <span className="bg-amber-400 text-black px-2.5 py-0.5 rounded-full text-xs font-bold">📦 Tiriskan & Packing</span>;
            } else if (kStatus === 'siap') {
              borderStyle = 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
              headerBg = 'bg-emerald-950/60 text-emerald-200';
              statusBadge = <span className="bg-emerald-500 text-black px-2.5 py-0.5 rounded-full text-xs font-bold">🥟 Siap Diambil/Kirim</span>;
            } else if (kStatus === 'selesai') {
              borderStyle = 'border-white/5 opacity-60';
              headerBg = 'bg-[#222224] text-white/60';
              statusBadge = <span className="bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full text-xs font-bold">✅ Selesai</span>;
            }

            const hasMatang = (ord.items || []).some((i) => (i.variantType || 'matang') === 'matang');

            return (
              <div
                key={ord.id}
                className={`bg-[#1C1C1E] rounded-[22px] border-2 ${borderStyle} flex flex-col justify-between overflow-hidden transition-all`}
              >
                {/* Ticket Top Bar */}
                <div>
                  <div className={`p-4 ${headerBg} flex items-center justify-between border-b border-white/10`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-white">#{ord.id}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-[#FFD700] font-mono">
                          {elapsedOrder} mnt lalu
                        </span>
                      </div>
                      <div className="font-hand font-bold text-xl text-white mt-0.5">
                        {ord.customer_name}
                      </div>
                    </div>
                    <div>{statusBadge}</div>
                  </div>

                  {/* Delivery & Channel Badges */}
                  <div className="px-4 py-2 bg-[#252528] flex items-center justify-between text-xs border-b border-white/5">
                    <span className="text-white/70 font-sans">
                      {ord.channel === 'gofood' || ord.channel === 'shopeefood' || ord.channel === 'grabfood' ? (
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <span className="animate-pulse text-xs">⚡</span> Ambil Driver Ojol
                        </span>
                      ) : ord.delivery_method === 'delivery' ? (
                        <span className="text-cyan-400 font-bold">🛵 Delivery ({ord.shipping_district || 'Sidoarjo'})</span>
                      ) : (
                        <span className="text-amber-300 font-bold">🥟 Ambil di Dapur Pasar Payan</span>
                      )}
                    </span>
                    <div>
                      {ord.channel === 'gofood' && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold inline-flex items-center gap-1 shadow-xs">
                          <span>🛵</span> GoFood {ord.external_order_id ? `#${ord.external_order_id}` : ''}
                        </span>
                      )}
                      {ord.channel === 'shopeefood' && (
                        <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/40 text-[11px] font-bold inline-flex items-center gap-1 shadow-xs">
                          <span>🍔</span> ShopeeFood {ord.external_order_id ? `#${ord.external_order_id}` : ''}
                        </span>
                      )}
                      {ord.channel === 'grabfood' && (
                        <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-300 border border-green-500/40 text-[11px] font-bold inline-flex items-center gap-1 shadow-xs">
                          <span>🟢</span> GrabFood {ord.external_order_id ? `#${ord.external_order_id}` : ''}
                        </span>
                      )}
                      {ord.channel === 'walk_in' && (
                        <span className="text-white/70 text-[11px] font-mono">
                          🟡 Walk-In Kasir
                        </span>
                      )}
                      {(!ord.channel || ord.channel === 'web_wa') && (
                        <span className="text-emerald-400 text-[11px] font-mono">
                          📱 WA Order
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cooking Items List */}
                  <div className="p-4 space-y-2.5">
                    {(ord.items || []).map((item, idx) => {
                      const isFrozen = item.variantType === 'frozen';
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                            isFrozen
                              ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                              : 'bg-[#2A2A2E] border-white/10 text-white'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-lg text-[#FFD700]">
                                {item.qty}x
                              </span>
                              <span className="font-bold text-base">{item.nama}</span>
                            </div>
                            {item.pilihanOpsi && (
                              <div className="text-xs text-[#FFD700] mt-0.5 pl-6 font-semibold">
                                {item.qty > 1 ? `↳ Semua ${item.pilihanOpsi} (${item.qty} pcs)` : `↳ Opsi: ${item.pilihanOpsi}`}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            {isFrozen ? (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold border border-blue-400/40">
                                ❄️ FROZEN
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[11px] font-bold border border-orange-400/40">
                                🔥 GORENG
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Customer Notes */}
                    {ord.notes && (
                      <div className="p-2.5 rounded-lg bg-yellow-950/30 border border-yellow-700/40 text-yellow-200 text-xs font-sans">
                        <strong className="text-yellow-400">Catatan Khusus:</strong> {ord.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="p-4 pt-2 border-t border-white/10 bg-[#161618] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Progression Actions */}
                    {kStatus === 'antre' && (
                      <>
                        {hasMatang ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'sedang_goreng')}
                            className="col-span-2 cursor-pointer w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                          >
                            <span>🔥 Masuk Wajan Goreng</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ord.id, 'packing')}
                            className="col-span-2 cursor-pointer w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                          >
                            <span>📦 Langsung Packing (Frozen)</span>
                          </button>
                        )}
                      </>
                    )}

                    {kStatus === 'sedang_goreng' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(ord.id, 'packing')}
                        className="col-span-2 cursor-pointer w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                      >
                        <span>🍟 Matang! Tiriskan & Dus Box</span>
                      </button>
                    )}

                    {kStatus === 'packing' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(ord.id, 'siap')}
                        className="col-span-2 cursor-pointer w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                      >
                        <span>🥟 Siap Diambil / Dikirim!</span>
                      </button>
                    )}

                    {kStatus === 'siap' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(ord.id, 'selesai')}
                        className="col-span-2 cursor-pointer w-full py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                      >
                        <span>✅ Serahkan ke Pembeli (Selesai)</span>
                      </button>
                    )}

                    {kStatus === 'selesai' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(ord.id, 'siap')}
                        className="col-span-2 cursor-pointer w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-xs transition"
                      >
                        ↩ Kembalikan ke Siap Ambil
                      </button>
                    )}
                  </div>

                  {/* Secondary Actions: WA Update & Cetak Struk & Tracking Link */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSendWaUpdate(ord)}
                      className="cursor-pointer flex-1 py-1.5 px-2.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] text-xs font-bold transition flex items-center justify-center gap-1 border border-[#25D366]/40 truncate"
                      title="Kirim notifikasi status masak langsung ke WA pembeli"
                    >
                      <span>📱 Update WA</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onPrintReceipt) {
                          onPrintReceipt(ord);
                        } else {
                          setStandaloneReceiptOrder(ord);
                        }
                      }}
                      className="cursor-pointer py-1.5 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-1 border border-amber-400/40"
                      title="Cetak struk kasir / thermal box slip"
                    >
                      <span>🧾 Struk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const url = storageService.generateTrackingUrl(ord.id);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-mono transition flex items-center gap-1"
                      title="Buka tampilan lacak pesanan live"
                    >
                      <span>🔗 Lacak</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL STRUK THERMAL STANDALONE KITCHEN */}
      {standaloneReceiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] max-w-md w-full border-2 border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#111111] text-[#FFD700] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <span className="font-hand font-bold text-xl text-white">Struk & Slip Dapur</span>
              </div>
              <button
                type="button"
                onClick={() => setStandaloneReceiptOrder(null)}
                className="cursor-pointer text-white/70 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Paper Width Selector */}
            <div className="bg-[#FFF8E7] px-6 py-2.5 border-b border-[#111111]/15 flex items-center justify-between text-xs font-sans">
              <span className="font-bold text-[#5C3D2E]">Format Kertas Thermal:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReceiptPaperWidth('58mm')}
                  className={`cursor-pointer px-3 py-1 rounded-full font-bold text-xs transition ${
                    receiptPaperWidth === '58mm'
                      ? 'bg-[#111111] text-[#FFD700]'
                      : 'bg-white text-[#111111] border border-[#111111]/20'
                  }`}
                >
                  58mm (Mini)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptPaperWidth('80mm')}
                  className={`cursor-pointer px-3 py-1 rounded-full font-bold text-xs transition ${
                    receiptPaperWidth === '80mm'
                      ? 'bg-[#111111] text-[#FFD700]'
                      : 'bg-white text-[#111111] border border-[#111111]/20'
                  }`}
                >
                  80mm (Standar)
                </button>
              </div>
            </div>

            {/* Thermal Receipt Visual Preview */}
            <div className="p-6 bg-gray-100 flex justify-center max-h-[60vh] overflow-y-auto">
              <div
                id="thermal-receipt-area"
                className={`bg-white p-5 border border-dashed border-gray-400 font-mono text-xs text-gray-900 shadow-sm leading-tight ${
                  receiptPaperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
                }`}
              >
                <div className="text-center pb-2 border-b border-dashed border-gray-400">
                  <div className="font-bold text-sm">{(storeConfig.brandName || 'DAPUR DULANG INDONESIA').toUpperCase()}</div>
                  <div className="text-[10px] text-gray-600">{storeConfig.brandTagline || 'Dibuat dengan wajan panas & tulisan tangan'}</div>
                  <div className="text-[10px] text-gray-500">{storeConfig.pickupAddressNote || 'Sedati • Sidoarjo, Jawa Timur'}</div>
                  <div className="text-[10px] text-gray-500">WA: {storeConfig.brandPhone || '0877-0339-7035'}</div>
                </div>

                <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>No. Pesanan:</span>
                    <span className="font-bold">#{standaloneReceiptOrder.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>
                      {new Date(standaloneReceiptOrder.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold truncate max-w-[150px]">{standaloneReceiptOrder.customer_name}</span>
                  </div>
                  {standaloneReceiptOrder.customer_wa && (
                    <div className="flex justify-between text-[10px]">
                      <span>WhatsApp:</span>
                      <span>+{standaloneReceiptOrder.customer_wa}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="font-bold uppercase">{standaloneReceiptOrder.payment_method || 'TUNAI'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jenis Pesanan:</span>
                    <span className="font-bold">
                      {standaloneReceiptOrder.delivery_method === 'delivery'
                        ? '🛵 DELIVERY'
                        : '🥟 AMBIL DI DAPUR'}
                    </span>
                  </div>
                  {standaloneReceiptOrder.delivery_method === 'delivery' ? (
                    <div className="pt-1 text-[10px] text-gray-600">
                      <div>Kecamatan: {standaloneReceiptOrder.shipping_district ? `Kec. ${standaloneReceiptOrder.shipping_district}` : 'Sidoarjo'}</div>
                    </div>
                  ) : null}
                  {standaloneReceiptOrder.notes && (
                    <div className="pt-1 text-[10px] text-amber-900 bg-amber-50 p-1 rounded border border-amber-200">
                      <strong>Catatan:</strong> {standaloneReceiptOrder.notes}
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                  {(standaloneReceiptOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[11px]">
                      <div className="flex-1 pr-2">
                        <div className="font-bold">
                          {it.qty}x {it.nama}
                        </div>
                        {it.pilihanOpsi && (
                          <div className="text-[10px] text-gray-600 pl-2">↳ {it.pilihanOpsi}</div>
                        )}
                        {it.variantType && (
                          <div className="text-[9px] text-gray-500 pl-2 font-mono uppercase">
                            [{it.variantType}]
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-right shrink-0">
                        Rp {(it.harga * it.qty).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-0.5">
                  {standaloneReceiptOrder.shipping_cost !== undefined && standaloneReceiptOrder.shipping_cost > 0 && (
                    <div className="flex justify-between text-gray-600 text-[10px]">
                      <span>Ongkir Kurir:</span>
                      <span>Rp {standaloneReceiptOrder.shipping_cost.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>Rp {standaloneReceiptOrder.total_price.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="text-[10px] text-center text-emerald-700 font-bold pt-1">
                    *** LUNAS / SIAP AMBIL ***
                  </div>
                </div>

                {/* Footer Quote */}
                <div className="text-center pt-2 text-[10px] text-gray-600 space-y-0.5">
                  <div>{storeConfig.receiptFooterNote || 'Matur suwun sanget sampun jajan! Hangatkan kembali bila perlu yaa 🙏✨'}</div>
                </div>

                {/* QR Code Resi Lacak Wajan */}
                {receiptQrDataUrl && (
                  <div className="pt-2 text-center flex flex-col items-center border-t border-dashed border-gray-400 mt-2">
                    <img
                      src={receiptQrDataUrl}
                      alt="QR Resi Lacak Pesanan"
                      className="w-24 h-24 mx-auto mb-1 border border-gray-300 rounded p-1 bg-white"
                    />
                    <div className="text-[9px] text-gray-700 font-sans font-bold">
                      SCAN UNTUK LACAK STATUS WAJAN
                    </div>
                    <div className="text-[8px] text-gray-500 font-mono">
                      {storageService.generateTrackingUrl(standaloneReceiptOrder.id).replace(/^https?:\/\//, '')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Print CSS for Thermal Printer */}
            <style>{`
              @media print {
                @page {
                  size: ${receiptPaperWidth === '58mm' ? '58mm' : '80mm'} auto;
                  margin: 0;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #thermal-receipt-area, #thermal-receipt-area * {
                  visibility: visible !important;
                }
                #thermal-receipt-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: ${receiptPaperWidth === '58mm' ? '58mm' : '80mm'} !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: ${receiptPaperWidth === '58mm' ? '1.5mm 2mm' : '2.5mm 3.5mm'} !important;
                  border: none !important;
                  box-shadow: none !important;
                  font-family: monospace !important;
                  font-size: ${receiptPaperWidth === '58mm' ? '10px' : '11px'} !important;
                  line-height: 1.2 !important;
                  background: white !important;
                  color: black !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `}</style>

            {/* Action Buttons */}
            <div className="p-4 bg-white border-t border-[#111111]/15 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStandaloneReceiptOrder(null)}
                className="cursor-pointer py-2.5 px-4 rounded-full font-sans text-xs text-gray-600 hover:text-black font-semibold border border-gray-300"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="cursor-pointer bg-[#111111] hover:bg-[#222222] text-[#FFD700] rounded-full py-2.5 px-6 font-sans font-bold text-xs flex items-center gap-1.5 shadow-[2px_2px_0_#FFD700] transition active:translate-y-0.5"
              >
                <span>🖨️</span> Cetak Thermal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
