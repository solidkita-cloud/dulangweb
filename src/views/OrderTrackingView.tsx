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
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Review & Rating State
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([
    '🔥 Kulit Krispi Renyah',
    '🧀 Mayo Meleleh Lumer',
  ]);
  const [selectedFavMenu, setSelectedFavMenu] = useState<string>('');
  const [isReviewed, setIsReviewed] = useState<boolean>(false);
  const [rewardVoucher, setRewardVoucher] = useState<string | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const REVIEW_TAGS = [
    '🔥 Kulit Krispi Renyah',
    '🧀 Mayo Meleleh Lumer',
    '🥟 Isian Daging Padat',
    '♨️ Tiba Masih Anget',
    '📦 Kemasan Cantik & Rapi',
    '⚡ Pelayanan Super Ramah',
  ];

  // Parse order from query param, initial props, or last order created on this browser
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromParam = params.get('track') || params.get('order') || initialOrderId || '';
    if (idFromParam) {
      const clean = idFromParam.trim();
      setInputOrderId(clean);
      findAndSetOrder(clean);
    } else {
      let lastOwnOrderId = '';
      try {
        lastOwnOrderId = (localStorage.getItem('dulang_last_order_id') || '').trim();
      } catch {}
      if (lastOwnOrderId) {
        setInputOrderId(lastOwnOrderId);
        findAndSetOrder(lastOwnOrderId);
      }
    }
  }, [initialOrderId]);

  // Listen for live updates
  useEffect(() => {
    const handleUpdate = () => {
      if (inputOrderId) {
        const orders = storageService.getOrders();
        const found = orders.find((o) => o.id.toUpperCase() === inputOrderId.toUpperCase());
        setCurrentOrder(found && found.status !== ('dihapus' as any) ? found : null);
      }
    };

    window.addEventListener('dulang_kitchen_updated', handleUpdate);
    window.addEventListener('dulang_orders_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Polling live sync dari cloud setiap 4 detik agar status wajan penggorengan selalu mutakhir
    const interval = setInterval(async () => {
      handleUpdate();
      if (inputOrderId) {
        try {
          const cloudOrder = await storageService.fetchOrderById(inputOrderId);
          setCurrentOrder(cloudOrder || null);
        } catch {
          // ignore
        }
      }
    }, 4000);

    return () => {
      window.removeEventListener('dulang_kitchen_updated', handleUpdate);
      window.removeEventListener('dulang_orders_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(interval);
    };
  }, [inputOrderId]);

  const findAndSetOrder = async (id: string) => {
    const clean = id.trim().toUpperCase();
    if (!clean) return;

    // Cek cache lokal terlebih dahulu
    const orders = storageService.getOrders();
    const found = orders.find((o) => o.id.toUpperCase() === clean);
    if (found) setCurrentOrder(found);

    // Tarik status terkini langsung dari Cloud Supabase
    try {
      const cloudOrder = await storageService.fetchOrderById(clean);
      setCurrentOrder(cloudOrder || null);
    } catch {
      // fallback ke lokal
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputOrderId.trim()) return;
    setIsRefreshing(true);
    await findAndSetOrder(inputOrderId);
    setIsRefreshing(false);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await findAndSetOrder(inputOrderId);
    setIsRefreshing(false);
  };

  // Check if current order already has a saved review
  useEffect(() => {
    if (!currentOrder) return;
    const reviewedKey = `dulang_reviewed_${currentOrder.id}`;
    const voucherKey = `dulang_reward_voucher_${currentOrder.id}`;
    const alreadyReviewed = localStorage.getItem(reviewedKey) === 'true';
    setIsReviewed(alreadyReviewed);
    if (alreadyReviewed) {
      setRewardVoucher(localStorage.getItem(voucherKey) || null);
    }
    if (currentOrder.items && currentOrder.items.length > 0 && !selectedFavMenu) {
      setSelectedFavMenu(currentOrder.items[0].nama);
    }
  }, [currentOrder?.id]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCopyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedVoucher(true);
    setTimeout(() => setCopiedVoucher(false), 2500);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder) return;
    setIsSubmittingReview(true);

    try {
      const tagStr = selectedTags.length > 0 ? selectedTags.join(', ') : '';
      const finalComment = reviewComment.trim()
        ? tagStr ? `${reviewComment.trim()} (${tagStr})` : reviewComment.trim()
        : tagStr || 'Risoles Dulang super anget dan nagih!';

      storageService.addTestimonial({
        customer_name: currentOrder.customer_name || 'Pelanggan Dulang',
        area: currentOrder.shipping_district || 'Sidoarjo',
        comment: finalComment,
        favorite_menu: selectedFavMenu || (currentOrder.items[0]?.nama || 'Risol Mayo Lumer'),
        rating: reviewRating,
        is_active: true,
      });

      // Bonus repeat order voucher Rp 5.000 (Min order Rp 30.000)
      const numPart = currentOrder.id.replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000).toString();
      const code = `SOBATDULANG-${numPart}`;
      await storageService.saveVoucher({
        code,
        recipientName: currentOrder.customer_name || 'Pelanggan Dulang',
        discountType: 'nominal',
        discountValue: 5000,
        minOrder: 30000,
        description: `Kupon Traktiran Sobat Dulang (Ulasan Bintang ${reviewRating})`,
        isUsed: false,
        createdAt: new Date().toISOString(),
      });

      localStorage.setItem(`dulang_reviewed_${currentOrder.id}`, 'true');
      localStorage.setItem(`dulang_reward_voucher_${currentOrder.id}`, code);
      setRewardVoucher(code);
      setIsReviewed(true);
    } catch (err) {
      console.warn('Failed to submit review:', err);
    } finally {
      setIsSubmittingReview(false);
    }
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
                      ? 'Diantar Kurir'
                      : 'Ambil Sendiri di Dapur Dulang'}
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
            {/* Gift Card Message Banner */}
            {(currentOrder.is_gift || currentOrder.gift_recipient) && (
              <div className="bg-pink-50 rounded-[18px] p-4 border border-pink-200 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎁</span>
                  <div>
                    <h4 className="font-sans font-bold text-xs text-pink-900 uppercase tracking-wider">
                      Paket Hadiah / Hampers Spesial
                    </h4>
                    <span className="text-xs text-pink-950 font-bold">
                      Untuk: Kak {currentOrder.gift_recipient || 'Penerima Istimewa'}
                    </span>
                  </div>
                </div>
                {currentOrder.gift_message && (
                  <div className="text-xs italic text-pink-900 bg-white/80 p-2.5 rounded-[12px] border border-pink-200/80 mt-1">
                    "{currentOrder.gift_message}"
                  </div>
                )}
                <p className="text-[11px] text-pink-700 pt-0.5">
                  ✨ Tim Dulang sedang menyiapkan dus & kartu ucapan tulisan tangan manis untuk paket hadiah ini!
                </p>
              </div>
            )}

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
                      <div className="text-xs text-[#5C3D2E]/80 pl-6 font-medium">
                        {item.qty > 1 ? `↳ Semua ${item.pilihanOpsi} (${item.qty} pcs)` : `↳ ${item.pilihanOpsi}`}
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
                  <span>Ongkir Kurir:</span>
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

            {/* Tips Hangat Menikmati di Rumah */}
            <div className="bg-[#FFF8E7] rounded-[18px] p-4 border border-[#FFD700] space-y-1">
              <div className="font-sans font-bold text-xs text-[#5C3D2E] flex items-center gap-1.5">
                <span>💡</span>
                <span>Tips Dapur: Cara Menghangatkan Risol Dulang di Rumah</span>
              </div>
              <p className="font-sans text-[11px] text-[#5C3D2E]/85 leading-relaxed">
                Panaskan di atas wajan teflon api kecil <strong>tanpa minyak</strong> selama 3-4 menit sambil dibolak-balik perlahan. Kulitnya bakal renyah krispi lagi dan mayonya lumer maksimal seperti baru keluar dari wajan!
              </p>
            </div>

            {/* RATING & TESTIMONI BINTANG 5 SAAT PESANAN SELESAI */}
            {currentOrder.kitchen_status === 'selesai' && (
              <div className="bg-gradient-to-br from-[#FFFDF4] to-[#FFF8E7] rounded-[22px] p-4 sm:p-5 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-3.5 animate-in slide-in-from-bottom duration-300">
                {!isReviewed ? (
                  <form onSubmit={handleSubmitReview} className="space-y-3">
                    <div className="text-center space-y-1">
                      <span className="text-2xl animate-bounce inline-block">⭐</span>
                      <h4 className="font-hand font-bold text-2xl text-[#111111] leading-none">
                        Gimana rasa risolesnya, Kak {currentOrder.customer_name}?
                      </h4>
                      <p className="font-sans text-xs text-[#5C3D2E]/80">
                        Beri rating bintang & dapatkan <strong className="text-amber-800">Kupon Diskon Rp 5.000</strong> untuk pesanan berikutnya! 🎁
                      </p>
                    </div>

                    {/* Star Rating Picker */}
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className={`cursor-pointer text-3xl sm:text-4xl transition-transform hover:scale-125 active:scale-95 ${
                            star <= reviewRating
                              ? 'text-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.6)]'
                              : 'text-gray-300 hover:text-amber-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    {/* Quick Tags Chips */}
                    <div className="space-y-1.5">
                      <span className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 text-center">
                        Apa yang paling kamu suka? (Pilih sesukamu)
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {REVIEW_TAGS.map((tag) => {
                          const isSel = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={`cursor-pointer px-2.5 py-1 rounded-full font-sans text-xs font-bold transition-all border ${
                                isSel
                                  ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-2xs'
                                  : 'bg-white text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Favorite Menu Selector */}
                    {currentOrder.items && currentOrder.items.length > 1 && (
                      <div className="space-y-1">
                        <label className="block font-sans text-[11px] font-bold text-[#5C3D2E]/70 text-center uppercase">
                          Menu Paling Juara:
                        </label>
                        <select
                          value={selectedFavMenu}
                          onChange={(e) => setSelectedFavMenu(e.target.value)}
                          className="w-full bg-white border-2 border-[#111111] rounded-full px-4 py-2 text-xs font-sans font-bold text-[#111111] focus:outline-none focus:border-[#FFD700]"
                        >
                          {currentOrder.items.map((it, idx) => (
                            <option key={idx} value={it.nama}>
                              {it.nama}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Textarea for Honest Thoughts */}
                    <textarea
                      rows={2}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Tulis kesan manismu di sini... (misal: Mayonya melimpah banget, kulitnya kriuk nagih!)"
                      className="w-full rounded-[14px] border-2 border-[#111111] p-3 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                    />

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="cursor-pointer w-full py-2.5 sm:py-3 rounded-full bg-[#111111] hover:bg-black text-[#FFD700] font-sans font-bold text-xs sm:text-sm shadow-[3px_3px_0_#FFD700] border-2 border-[#111111] transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>🎁</span>
                      <span>Kirim Ulasan & Klaim Kupon Diskon</span>
                    </button>
                  </form>
                ) : (
                  /* REVIEW COMPLETED & REWARD DISPLAY */
                  <div className="text-center space-y-3 py-2 animate-in zoom-in-95 duration-200">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 text-2xl mx-auto flex items-center justify-center border-2 border-emerald-500 shadow-xs">
                      🎉
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-hand font-bold text-2xl text-[#111111] leading-none">
                        Matur Suwun Sanget, Kak {currentOrder.customer_name}!
                      </h4>
                      <p className="font-sans text-xs text-[#5C3D2E]/80">
                        Ulasan bintang {reviewRating} darimu sangat berharga bagi dapur kecil kami.
                      </p>
                    </div>

                    {/* Bonus Voucher Card */}
                    {rewardVoucher && (
                      <div className="bg-white rounded-[16px] p-3.5 border-2 border-dashed border-[#111111] shadow-xs space-y-2 max-w-sm mx-auto">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
                          <span>🎟️</span>
                          <span>Kupon Traktiran Repeat Order (Hemat Rp 5.000)</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 bg-[#FFF8E7] p-2 rounded-xl border border-[#111111]/20">
                          <span className="font-mono font-bold text-base text-[#111111] tracking-wider">
                            {rewardVoucher}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyVoucher(rewardVoucher)}
                            className="cursor-pointer bg-[#111111] hover:bg-black text-[#FFD700] px-3 py-1 rounded-full font-sans font-bold text-[11px] transition active:scale-95"
                          >
                            {copiedVoucher ? 'Tersalin! ✓' : 'Salin 📋'}
                          </button>
                        </div>
                        <p className="font-sans text-[10px] text-[#5C3D2E]/70">
                          Gunakan kupon ini saat checkout pesanan berikutnya di web Dulang (min. order Rp 30.000).
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={onBackToMenu}
                      className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] font-sans font-bold text-xs border border-[#111111] shadow-xs active:scale-95 transition"
                    >
                      <span>🥟</span>
                      <span>Pesan Risol Lagi Pakai Kupon</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Direct WhatsApp Action to Kitchen */}
            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                  `Halo Dapur Dulang! Mau tanya tentang pesanan saya #${currentOrder.id} (${currentOrder.customer_name}) 🙏✨`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
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
