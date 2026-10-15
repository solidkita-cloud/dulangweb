import React, { useState, useEffect } from 'react';
import { OrderRecord, KitchenCookingStatus } from '../types';
import { storageService } from '../services/storageService';
import { BRAND } from '../lib/constants';

interface OrderTrackingViewProps {
  orderId?: string;
  onBackToMenu: () => void;
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  orderId: initialOrderId,
  onBackToMenu,
}) => {
  const [inputOrderId, setInputOrderId] = useState<string>(initialOrderId || '');
  const [currentOrder, setCurrentOrder] = useState<OrderRecord | null>(null);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>(() => storageService.getOrders());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Parse order from query param or initial props
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromParam = params.get('track') || params.get('order') || initialOrderId || '';
    if (idFromParam) {
      const clean = idFromParam.trim();
      setInputOrderId(clean);
      findAndSetOrder(clean);
    } else {
      // If no ID passed, try to take the latest order
      const latest = storageService.getOrders()[0];
      if (latest) {
        setInputOrderId(latest.id);
        setCurrentOrder(latest);
      }
    }
  }, [initialOrderId]);

  // Listen for live updates
  useEffect(() => {
    const handleUpdate = () => {
      const orders = storageService.getOrders();
      setAllOrders(orders);
      if (inputOrderId) {
        const found = orders.find((o) => o.id.toUpperCase() === inputOrderId.toUpperCase());
        if (found) setCurrentOrder(found);
      }
    };

    window.addEventListener('dulang_kitchen_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    const interval = setInterval(handleUpdate, 3000); // 3-second live sync

    return () => {
      window.removeEventListener('dulang_kitchen_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [inputOrderId]);

  const findAndSetOrder = (id: string) => {
    const orders = storageService.getOrders();
    const clean = id.trim().toUpperCase();
    const found = orders.find((o) => o.id.toUpperCase() === clean);
    setCurrentOrder(found || null);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputOrderId.trim()) return;
    findAndSetOrder(inputOrderId);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    findAndSetOrder(inputOrderId);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Determine active step index
  // Steps: 0: Diterima, 1: Sedang Goreng, 2: Packing Dus, 3: Siap Ambil/Kirim, 4: Selesai
  const getStepIndex = (kStatus?: KitchenCookingStatus): number => {
    if (!kStatus || kStatus === 'antre') return 0;
    if (kStatus === 'sedang_goreng') return 1;
    if (kStatus === 'packing') return 2;
    if (kStatus === 'siap') return 3;
    if (kStatus === 'selesai') return 4;
    return 0;
  };

  const activeStep = getStepIndex(currentOrder?.kitchen_status);

  const steps = [
    {
      label: 'Pesanan Diterima',
      desc: 'Pesanan masuk dan antre jadwal masak di Dapur Dulang.',
      icon: '📝',
    },
    {
      label: 'Sedang Digoreng',
      desc: 'Wajan menyala! Kulit risoles digoreng keemasan hingga renyah & mayo meleleh lumer.',
      icon: '🔥',
    },
    {
      label: 'Tiriskan & Packing',
      desc: 'Minyak ditiriskan tuntas, dimasukkan dus kemasan Dulang & cabe rawit segar.',
      icon: '📦',
    },
    {
      label: currentOrder?.delivery_method === 'delivery' ? 'Siap Dikirim' : 'Siap Diambil',
      desc: currentOrder?.delivery_method === 'delivery'
        ? 'Dus rapi dan siap diberangkatkan oleh kurir menuju alamatmu.'
        : 'Risoles anget siap diambil di Dapur Dulang (Pasar Payan Sidoarjo).',
      icon: currentOrder?.delivery_method === 'delivery' ? '🛵' : '🥟',
    },
    {
      label: 'Selesai & Dinikmati',
      desc: 'Pesanan sudah diterima. Selamat menikmati selagi anget!',
      icon: '✨',
    },
  ];

  return (
    <div className="py-6 sm:py-10 max-w-3xl mx-auto space-y-6 select-none animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="text-center relative">
        <button
          type="button"
          onClick={onBackToMenu}
          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#111111]/15 text-[#5C3D2E] text-xs font-bold shadow-xs hover:bg-[#FFF3C7] transition mb-3"
        >
          <span>← Kembali ke Menu Dulang</span>
        </button>

        <div className="flex justify-center mb-1">
          <span className="px-3.5 py-1 rounded-full bg-[#111111] text-[#FFD700] text-[11px] font-mono font-bold tracking-widest uppercase border border-[#FFD700]/30 shadow-sm">
            Live Tracking Dapur
          </span>
        </div>

        <h1 className="font-hand font-bold text-3xl sm:text-4xl text-[#111111] mt-1">
          Pantau Pesananmu Hangat
        </h1>
        <p className="font-sans text-xs sm:text-sm text-[#5C3D2E]/80 max-w-md mx-auto mt-1">
          Lacak langsung proses penggorengan wajan dan pengemasan risolesmu dari Dapur Dulang Sidoarjo.
        </p>

        {/* Input ID Pesanan Switcher */}
        <form onSubmit={handleManualSearch} className="mt-4 flex items-center justify-center gap-2 max-w-sm mx-auto">
          <input
            type="text"
            value={inputOrderId}
            onChange={(e) => setInputOrderId(e.target.value.toUpperCase())}
            placeholder="Ketik ID: ORD-..."
            className="flex-1 px-4 py-2 rounded-full bg-white border-2 border-[#111111] font-mono font-bold text-sm text-center shadow-[2px_2px_0_#111111] focus:outline-none focus:border-[#FFD700]"
          />
          <button
            type="submit"
            className="cursor-pointer px-4 py-2 rounded-full bg-[#111111] text-[#FFD700] font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:bg-[#222222]"
          >
            Cari 🔍
          </button>
        </form>
      </div>

      {/* Main Tracking Card */}
      {!currentOrder ? (
        <div className="bg-white rounded-[26px] p-8 border-2 border-[#111111] shadow-[6px_6px_0_#111111] text-center space-y-3">
          <span className="text-4xl block">🔍</span>
          <h3 className="font-hand font-bold text-xl text-[#111111]">
            Pesanan #{inputOrderId || '...'} Belum Ditemukan
          </h3>
          <p className="font-sans text-xs text-[#5C3D2E]/70 max-w-sm mx-auto">
            Pastikan nomor pesanan sesuai dengan struk pembelian atau chat WhatsApp dari Dapur Dulang.
          </p>
          {allOrders.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] text-[#5C3D2E]/50 block mb-1">Atau coba lihat pesanan terbaru:</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {allOrders.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setInputOrderId(o.id);
                      findAndSetOrder(o.id);
                    }}
                    className="cursor-pointer px-3 py-1 rounded-full bg-[#FFF8E7] hover:bg-[#FFD700] border border-[#111111]/20 text-xs font-mono font-bold transition"
                  >
                    #{o.id} ({o.customer_name})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Stepper Container */}
          <div className="bg-[#111111] text-white rounded-[28px] p-6 sm:p-8 border-[3px] border-[#111111] shadow-[8px_8px_0_#FFD700] relative">
            {/* Top Tape */}
            <div className="tape absolute -top-3.5 left-1/2 -translate-x-1/2 w-[90px] h-[22px] bg-[#FFD700] rotate-[-2deg] rounded-[3px] border border-[#111111]/20 z-10" />

            {/* Order Header Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xl text-[#FFD700]">#{currentOrder.id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-sans text-white/80">
                    {new Date(currentOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </span>
                </div>
                <div className="font-hand font-bold text-2xl text-white mt-0.5">
                  Pesanan untuk Kak {currentOrder.customer_name}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  className={`cursor-pointer px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-sans transition flex items-center gap-1 ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                  title="Perbarui status sekarang"
                >
                  <span>🔄</span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>

                <span className="px-3 py-1 rounded-full bg-[#FFD700] text-[#111111] font-bold text-xs uppercase font-sans">
                  {currentOrder.status === 'lunas' ? '✓ Lunas' : currentOrder.status === 'dp' ? 'DP Terbayar' : 'Menunggu'}
                </span>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="py-6 space-y-6">
              {steps.map((step, idx) => {
                const isPassed = idx < activeStep;
                const isCurrent = idx === activeStep;

                return (
                  <div key={idx} className="flex items-start gap-4 relative">
                    {/* Vertical Connector Line */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-[19px] top-10 bottom-[-24px] w-1 transition-all ${
                          idx < activeStep ? 'bg-[#FFD700]' : 'bg-white/15'
                        }`}
                      />
                    )}

                    {/* Step Icon Bubble */}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all border-2 ${
                        isCurrent
                          ? 'bg-[#FFD700] text-[#111111] border-[#111111] shadow-[0_0_15px_#FFD700] scale-110 animate-bounce'
                          : isPassed
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-[#222224] text-white/40 border-white/10'
                      }`}
                    >
                      {isPassed ? '✓' : step.icon}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`font-hand font-bold text-lg sm:text-xl ${
                            isCurrent
                              ? 'text-[#FFD700]'
                              : isPassed
                              ? 'text-white'
                              : 'text-white/40'
                          }`}
                        >
                          {step.label}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase animate-pulse">
                            Sedang Berlangsung
                          </span>
                        )}
                      </div>
                      <p
                        className={`font-sans text-xs sm:text-sm mt-0.5 leading-relaxed ${
                          isCurrent
                            ? 'text-white/90 font-medium'
                            : isPassed
                            ? 'text-white/60'
                            : 'text-white/30'
                        }`}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery Destination / Pickup Badge */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  <span className="text-white/60">Metode Pengiriman:</span>
                  <div className="font-bold text-[#FFD700] text-sm">
                    {currentOrder.delivery_method === 'delivery'
                      ? `Kurir Dulang → ${currentOrder.shipping_district || 'Sidoarjo'}`
                      : 'Ambil Sendiri di Dapur Dulang (Pasar Payan)'}
                  </div>
                </div>
              </div>

              <div className="text-right self-end sm:self-auto">
                <span className="text-white/60">Estimasi Saji:</span>
                <div className="font-bold text-white text-sm">
                  {currentOrder.kitchen_status === 'siap' || currentOrder.kitchen_status === 'selesai'
                    ? 'Siap Dinikmati! 🎉'
                    : '± 10 - 20 Menit'}
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Order Details Card */}
          <div className="bg-white rounded-[24px] p-6 border-2 border-[#111111] shadow-[6px_6px_0_#111111] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🥟</span>
                <h3 className="font-hand font-bold text-xl text-[#111111]">
                  Rincian Menu Pesanan
                </h3>
              </div>
              <span className="font-mono text-xs text-[#5C3D2E]/60 font-bold">
                {(currentOrder.items || []).reduce((s, i) => s + i.qty, 0)} pcs total
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {(currentOrder.items || []).map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-bold text-[#111111] flex items-center gap-2">
                      <span className="font-mono text-[#5C3D2E]">{item.qty}x</span>
                      <span>{item.nama}</span>
                      {item.variantType === 'frozen' ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                          ❄️ Beku
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">
                          🔥 Matang
                        </span>
                      )}
                    </div>
                    {item.pilihanOpsi && (
                      <div className="text-xs text-[#5C3D2E]/60 pl-6">
                        Opsi: {item.pilihanOpsi}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-[#111111]">
                    Rp {(item.harga * item.qty).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>

            {/* Ongkir & Total */}
            <div className="pt-3 border-t border-gray-200 space-y-1.5 text-xs font-sans">
              {currentOrder.shipping_cost && currentOrder.shipping_cost > 0 && (
                <div className="flex justify-between text-[#5C3D2E]/70">
                  <span>Ongkir ({currentOrder.shipping_district}):</span>
                  <span className="font-mono font-bold">Rp {currentOrder.shipping_cost.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-base font-bold text-[#111111] pt-1">
                <span>Total Pesanan:</span>
                <span className="font-mono text-lg text-emerald-700">
                  Rp {currentOrder.total_price.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Direct WhatsApp Action to Kitchen */}
            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                  `Halo Dapur Dulang! Mau tanya tentang pesanan saya #${currentOrder.id} (${currentOrder.customer_name}) 🙏✨`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer flex-1 py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-center text-sm shadow-[3px_3px_0_#111111] border-2 border-[#111111] transition flex items-center justify-center gap-2"
              >
                <span>💬 Chat Dapur Dulang via WA</span>
              </a>

              <button
                type="button"
                onClick={onBackToMenu}
                className="cursor-pointer py-3 px-5 rounded-full bg-[#FFF3C7] hover:bg-[#FFD700] text-[#111111] font-bold text-center text-sm shadow-[3px_3px_0_#111111] border-2 border-[#111111] transition"
              >
                + Tambah Menu Lain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
