import React, { useState, useEffect } from 'react';
import { CartItem, Voucher, Customer, GoldenTicketRecord, StoreConfig } from '../../types';
import { BRAND, LOCKED_COPY, DEFAULT_SIDOARJO_DELIVERY_RATES } from '../../lib/constants';
import { storageService } from '../../services/storageService';

interface StickyCartProps {
  cart: CartItem[];
  onUpdateQty: (itemId: string, delta: number, pilihanOpsi?: string, variantType?: 'matang' | 'frozen') => void;
  onClearCart: () => void;
  onOrderSuccess: () => void;
}

export const StickyCart: React.FC<StickyCartProps> = ({
  cart,
  onUpdateQty,
  onClearCart,
  onOrderSuccess,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Super Smart Barcode: Customer Recognition & Autofill
  const [recognizedCust, setRecognizedCust] = useState<Customer | null>(() =>
    storageService.getRecognizedCustomer()
  );

  const [buyerName, setBuyerName] = useState(() => {
    const cust = storageService.getRecognizedCustomer();
    if (cust?.name) return cust.name;
    try {
      const saved = localStorage.getItem('dulang_buyer_profile');
      if (saved) return JSON.parse(saved).name || '';
    } catch {}
    return '';
  });

  const [buyerPhone, setBuyerPhone] = useState(() => {
    const cust = storageService.getRecognizedCustomer();
    if (cust?.wa) return cust.wa;
    try {
      const saved = localStorage.getItem('dulang_buyer_profile');
      if (saved) return JSON.parse(saved).phone || '';
    } catch {}
    return '';
  });

  const [buyerAddress, setBuyerAddress] = useState(() => {
    const cust = storageService.getRecognizedCustomer();
    if (cust?.street_detail || cust?.area) {
      return [cust.street_detail, cust.village, cust.district, cust.area].filter(Boolean).join(', ');
    }
    try {
      const saved = localStorage.getItem('dulang_buyer_profile');
      if (saved) return JSON.parse(saved).address || '';
    } catch {}
    return '';
  });

  // Store Config & Flexible Kurir/Pickup
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(() => storageService.getStoreConfig());
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Sidoarjo Kota');

  // Golden Tickets (Voucher Beranak Reward)
  const [goldenTickets, setGoldenTickets] = useState<GoldenTicketRecord[]>(() =>
    storageService.getGoldenTickets().filter((t) => !t.isClaimed)
  );
  const [unlockedPerkModal, setUnlockedPerkModal] = useState<{ title: string; perk: string; code: string } | null>(null);

  useEffect(() => {
    const handleCustomerChange = () => {
      const cust = storageService.getRecognizedCustomer();
      setRecognizedCust(cust);
      if (cust) {
        if (cust.name) setBuyerName(cust.name);
        if (cust.wa) setBuyerPhone(cust.wa);
        const fullAddr = [cust.street_detail, cust.village, cust.district, cust.area].filter(Boolean).join(', ');
        if (fullAddr) setBuyerAddress(fullAddr);
      }
    };
    const handleConfigChange = () => {
      setStoreConfig(storageService.getStoreConfig());
    };
    const handleTicketsChange = () => {
      setGoldenTickets(storageService.getGoldenTickets().filter((t) => !t.isClaimed));
    };

    window.addEventListener('dulang_active_customer_updated', handleCustomerChange);
    window.addEventListener('dulang_store_config_updated', handleConfigChange);
    window.addEventListener('dulang_golden_tickets_updated', handleTicketsChange);
    return () => {
      window.removeEventListener('dulang_active_customer_updated', handleCustomerChange);
      window.removeEventListener('dulang_store_config_updated', handleConfigChange);
      window.removeEventListener('dulang_golden_tickets_updated', handleTicketsChange);
    };
  }, []);
  
  // 3b: Opsi Ekstra Menu State
  const [extraChili, setExtraChili] = useState(true); // Default true for Indonesian risoles lovers
  const [mayoChoice, setMayoChoice] = useState<'original' | 'pedas'>('original');
  const [orderNote, setOrderNote] = useState('');

  // 3a: Jadwal Kirim (Hari Ini vs Pre-Order Besok)
  const [deliveryDay, setDeliveryDay] = useState<'today' | 'tomorrow'>('today');
  const [deliverySlot, setDeliverySlot] = useState<string>('Slot Pagi (10.00)');

  // Step 6 & 7: Sistem Voucher Diskon Unik ("Voucher Beranak")
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [voucherError, setVoucherError] = useState<{ message: string; code: string } | null>(null);
  const [voucherSuccessMsg, setVoucherSuccessMsg] = useState<string | null>(null);

  if (cart.length === 0) return null;

  const totalItems = cart.reduce((acc, c) => acc + c.qty, 0);
  const totalPrice = cart.reduce((acc, c) => acc + c.qty * c.item.harga, 0);

  const deliveryRates = storeConfig.deliveryRates || DEFAULT_SIDOARJO_DELIVERY_RATES;
  const shippingCost = deliveryMethod === 'delivery' ? (deliveryRates[selectedDistrict] || 8000) : 0;
  const finalPrice = Math.max(0, totalPrice - discountAmount) + shippingCost;

  const handleApplyVoucher = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!voucherCodeInput.trim()) return;

    setVoucherError(null);
    setVoucherSuccessMsg(null);

    const result = storageService.validateVoucher(voucherCodeInput, totalPrice);
    if (!result.valid || !result.voucher) {
      setVoucherError({
        message: result.message,
        code: voucherCodeInput.trim().toUpperCase(),
      });
      setAppliedVoucher(null);
      setDiscountAmount(0);
    } else {
      setAppliedVoucher(result.voucher);
      setDiscountAmount(result.discountAmount);
      setVoucherSuccessMsg(result.message);
      setVoucherError(null);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setDiscountAmount(0);
    setVoucherCodeInput('');
    setVoucherError(null);
    setVoucherSuccessMsg(null);
  };

  const handleCheckoutWA = async () => {
    // Save buyer profile locally for effortless repeat checkout
    try {
      localStorage.setItem(
        'dulang_buyer_profile',
        JSON.stringify({
          name: buyerName.trim(),
          phone: buyerPhone.trim(),
          address: buyerAddress.trim(),
        })
      );
    } catch {}

    // Construct prefilled WhatsApp message with buyer identity + fulfillment + 3a & 3b Extra Options & Voucher
    let message = `${LOCKED_COPY.waCheckout}!\n\n`;

    if (buyerName.trim()) {
      message += `👤 *Nama Pemesan:* Kak ${buyerName.trim()}\n`;
    }
    if (buyerPhone.trim()) {
      message += `📱 *Nomor WA:* ${buyerPhone.trim()}\n`;
    }
    if (deliveryMethod === 'delivery' && buyerAddress.trim()) {
      message += `📍 *Alamat Antar / Patokan:* ${buyerAddress.trim()} (Kec. ${selectedDistrict})\n`;
    }
    if (recognizedCust?.qr_code_id) {
      message += `🏷️ *Stiker Dus Barcode:* ${recognizedCust.qr_code_id}\n`;
    }
    if (buyerName.trim() || buyerAddress.trim() || buyerPhone.trim()) {
      message += `\n`;
    }

    message += `📋 *Rincian Pesanan Saya:*\n`;
    cart.forEach((c) => {
      const opsiTxt = c.pilihanOpsi ? ` [${c.pilihanOpsi}]` : '';
      const variantTxt = c.variantType === 'frozen' ? ' [❄️ Frozen Food / Mentah Beku]' : ' [🍳 Goreng Matang]';
      message += `• ${c.qty}x ${c.item.nama}${opsiTxt}${variantTxt} (Rp ${(c.qty * c.item.harga).toLocaleString('id-ID')})\n`;
    });

    message += `\n🍳 *Metode Pengambilan:* ${
      deliveryMethod === 'pickup'
        ? 'Ambil Sendiri di Dapur (Pick-up Langsung Hangat dari Wajan) 🥟'
        : `Kurir Dapur / Ojol Lokal ke Kec. ${selectedDistrict} (Ongkir: Rp ${shippingCost.toLocaleString('id-ID')}) 🛵`
    }\n`;

    message += `📅 *Jadwal Kirim:* ${
      deliveryDay === 'tomorrow'
        ? `Besok Subuh (${deliverySlot}) 📅`
        : 'Kloter Hari Ini (Fresh Panas) 🍳'
    }\n`;

    message += `\n🌶️ *Opsi Racikan Dapur:*\n`;
    message += `• Cabe Rawit: ${extraChili ? 'Ekstra Banyak (Gratis 🌶️)' : 'Standar'}\n`;
    message += `• Varian Mayo: ${mayoChoice === 'pedas' ? 'Mayo Pedas Gurih Mantap 🌶️' : 'Mayo Original Gurih Lumer 🥟'}\n`;
    if (orderNote.trim()) {
      message += `• Catatan Khusus: ${orderNote.trim()}\n`;
    }

    if (appliedVoucher) {
      message += `\n🎟️ *Voucher Terpakai:* ${appliedVoucher.code} (-Rp ${discountAmount.toLocaleString('id-ID')})\n`;
      if (appliedVoucher.childVoucher) {
        message += `🎁 *Tiket Bonus Rahasia:* ${appliedVoucher.childVoucher.title} (Kode: ${appliedVoucher.childVoucher.unlockCode})\n`;
      }
    }

    message += `\n💰 *Subtotal Menu:* Rp ${totalPrice.toLocaleString('id-ID')}\n`;
    if (shippingCost > 0) {
      message += `🛵 *Ongkir (${selectedDistrict}):* Rp ${shippingCost.toLocaleString('id-ID')}\n`;
    }
    if (discountAmount > 0) {
      message += `🎟️ *Hemat Voucher:* -Rp ${discountAmount.toLocaleString('id-ID')}\n`;
    }
    message += `*✨ TOTAL BAYAR: Rp ${finalPrice.toLocaleString('id-ID')}*\n`;

    message += `\nMohon konfirmasi ketersediaan di dapur ya Tim Dulang! Terima kasih 🙏✨`;

    // Catat otomatis ke Antrian Kasir Dapur (Status: Menunggu Bayar/Konfirmasi)
    try {
      storageService.addOrder({
        customer_name: buyerName.trim() || (recognizedCust ? recognizedCust.name : 'Pelanggan Web WA'),
        customer_wa: buyerPhone.trim() || (recognizedCust ? recognizedCust.wa : undefined),
        customer_qr_id: recognizedCust ? recognizedCust.qr_code_id : undefined,
        items: cart.map((c) => ({
          menu_id: c.item.id,
          nama: c.item.nama,
          harga: c.item.harga,
          qty: c.qty,
          pilihanOpsi: c.pilihanOpsi,
          variantType: c.variantType || 'matang',
        })),
        total_price: finalPrice,
        delivery_schedule: deliveryDay === 'tomorrow' ? `Besok (${deliverySlot})` : 'Hari Ini (Fresh Panas)',
        notes: [
          deliveryMethod === 'pickup' ? 'Ambil di Dapur' : `Antar Kurir (${selectedDistrict}): ${buyerAddress.trim()}`,
          shippingCost > 0 ? `Ongkir: Rp ${shippingCost}` : '',
          extraChili ? 'Ekstra Cabe Rawit' : '',
          mayoChoice === 'pedas' ? 'Mayo Pedas' : 'Mayo Original',
          orderNote.trim() ? `Catatan: ${orderNote.trim()}` : '',
          appliedVoucher ? `Voucher: ${appliedVoucher.code}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        status: 'menunggu',
        channel: 'web_wa',
        delivery_method: deliveryMethod,
        shipping_cost: shippingCost,
        shipping_district: deliveryMethod === 'delivery' ? selectedDistrict : undefined,
      });
    } catch (e) {
      console.warn('Auto-save order error:', e);
    }

    if (appliedVoucher) {
      const res = await storageService.markVoucherUsed(appliedVoucher.code, buyerPhone);
      if (res.childPerkUnlocked && res.childCode) {
        setUnlockedPerkModal({
          title: res.childPerkUnlocked.title,
          perk: res.childPerkUnlocked.perk,
          code: res.childCode,
        });
      }
    }

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${BRAND.whatsapp}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    setIsDetailOpen(false);
    onOrderSuccess();
  };

  return (
    <>
      {/* Detailed Cart & Extras Modal (3b) */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsDetailOpen(false)} />

          <div className="relative w-full max-w-lg bg-[#FFF8E7] text-[#111111] border-t-4 sm:border-4 border-[#111111] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-[8px_8px_0_#111111] z-10 space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/15">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider">
                  🥟 Dapur Dulang Indonesia
                </div>
                <h3 className="font-hand font-bold text-3xl text-[#111111] leading-none mt-1">
                  Keranjang Pesanan Kamu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="w-9 h-9 rounded-full bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0_#111111] font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-[#FFD700]"
                title="Tutup Keranjang"
              >
                ✕
              </button>
            </div>

            {/* List of Cart Items */}
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {cart.map((c, i) => (
                <div
                  key={`${c.item.id}-${c.pilihanOpsi || ''}-${c.variantType || 'matang'}-${i}`}
                  className="bg-white rounded-[16px] p-3 border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-hand font-bold text-lg text-[#111111] truncate">
                        {c.item.nama}
                      </h4>
                      <span
                        className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${
                          c.variantType === 'frozen'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {c.variantType === 'frozen' ? '❄️ Frozen Beku' : '🍳 Goreng Matang'}
                      </span>
                    </div>
                    {c.pilihanOpsi && (
                      <span className="inline-block text-[11px] font-sans font-bold bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full border border-[#111111] my-0.5">
                        Opsi: {c.pilihanOpsi}
                      </span>
                    )}
                    <p className="font-sans text-xs text-[#5C3D2E] font-medium">
                      Rp {c.item.harga.toLocaleString('id-ID')} / porsi
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(c.item.id, -1, c.pilihanOpsi, c.variantType)}
                      className="w-7 h-7 rounded-full bg-[#FFF8E7] text-[#111111] border-2 border-[#111111] font-bold text-sm flex items-center justify-center cursor-pointer hover:bg-[#FFD700]"
                    >
                      −
                    </button>
                    <span className="font-sans font-bold text-sm w-5 text-center">
                      {c.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(c.item.id, 1, c.pilihanOpsi, c.variantType)}
                      className="w-7 h-7 rounded-full bg-[#111111] text-[#FFD700] border-2 border-[#111111] font-bold text-sm flex items-center justify-center cursor-pointer hover:brightness-110"
                    >
                      +
                    </button>
                    <span className="font-sans font-bold text-xs text-[#111111] ml-2 w-16 text-right">
                      Rp {(c.qty * c.item.harga).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Super Smart Barcode: Data Pemesan & Alamat Antar */}
            <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Data Pengiriman & Pemesan</span>
                </span>
                {recognizedCust && (
                  <span className="text-[10px] font-sans font-bold bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full border border-[#111111]">
                    ✨ Sobat: {recognizedCust.qr_code_id}
                  </span>
                )}
              </div>

              {recognizedCust && (
                <div className="bg-[#FFFDF4] p-2.5 rounded-[12px] border border-[#FFD700] text-xs font-sans text-[#5C3D2E] flex items-center gap-2">
                  <span className="text-base">🥟</span>
                  <span>
                    Data otomatis terisi dari scan stiker <strong>Kak {recognizedCust.name}</strong>!
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-sans text-[11px] font-bold text-[#5C3D2E] mb-1">
                    Nama Kamu:
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Contoh: Amanda"
                    className="w-full rounded-full border-2 border-[#111111] px-3.5 py-1.5 font-sans text-xs bg-[#FFFDF4] focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[11px] font-bold text-[#5C3D2E] mb-1">
                    Nomor WhatsApp:
                  </label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-full border-2 border-[#111111] px-3.5 py-1.5 font-sans text-xs bg-[#FFFDF4] focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold text-[#5C3D2E] mb-1">
                  Alamat Antar / Patokan Rumah:
                </label>
                <input
                  type="text"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  placeholder="Contoh: Jl. Diponegoro No. 12, Pagerwojo (pagar hitam depan masjid)"
                  className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-[#FFFDF4] focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                />
              </div>
            </div>

            {/* METODE PENGAMBILAN: AMBIL SENDIRI (DEFAULT) VS KURIR DAPUR */}
            <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                  <span>🛵</span>
                  <span>Metode Pengambilan Pesanan</span>
                </span>
                <span className="text-[10px] font-sans font-bold bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full border border-[#111111]">
                  {deliveryMethod === 'pickup' ? 'Ambil di Dapur' : 'Antar ke Rumah'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`cursor-pointer p-3 rounded-[14px] text-left border-2 transition ${
                    deliveryMethod === 'pickup'
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] border-[#111111]/30 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-sans font-bold text-xs flex items-center gap-1.5">
                    <span>🍳</span> Ambil Sendiri
                  </div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    Gratis • Fresh dari wajan
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`cursor-pointer p-3 rounded-[14px] text-left border-2 transition ${
                    deliveryMethod === 'delivery'
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] border-[#111111]/30 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-sans font-bold text-xs flex items-center gap-1.5">
                    <span>🛵</span> Kurir Dapur Sidoarjo
                  </div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    Diantar langsung ke rumah
                  </div>
                </button>
              </div>

              {deliveryMethod === 'pickup' ? (
                <div className="p-2.5 bg-[#FFFDF4] rounded-[12px] border border-[#111111]/20 font-sans text-xs text-[#5C3D2E]">
                  📍 <strong>Lokasi Dapur:</strong> {storeConfig.pickupAddressNote || 'Jl. Diponegoro No. 12, Pagerwojo - Dekat Pasar Payan, Sidoarjo'}
                  <div className="text-[11px] text-[#5C3D2E]/70 mt-0.5">
                    *Risoles digoreng fresh dadakan menjelang jam kamu datang yaa.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#FFFDF4] rounded-[14px] border border-[#111111]/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-sans text-xs font-bold text-[#5C3D2E]">
                      Kecamatan Pengiriman Sidoarjo:
                    </label>
                    <span className="font-sans font-bold text-xs text-red-600">
                      +Rp {shippingCost.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full rounded-[12px] border-2 border-[#111111] px-3 py-1.5 font-sans text-xs bg-white font-semibold"
                  >
                    {Object.entries(deliveryRates).map(([dist, rate]) => (
                      <option key={dist} value={dist}>
                        Kec. {dist} — Ongkir Rp {rate.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#5C3D2E]/70 italic">
                    *Posisi dus ditaruh datar agar mayo tidak tumpah dan tiba tetap hangat.
                  </p>
                </div>
              )}
            </div>

            {/* 3b: OPSI EKSTRA & RACIKAN DAPUR */}
            <div className="bg-[#FFD700]/25 rounded-[20px] p-4 border-2 border-[#111111] space-y-3.5">
              <div className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wider text-[#111111]">
                <span>🌶️</span> Opsi Racikan Dapur Dulang:
              </div>

              {/* 3a: Pilihan Waktu Pengiriman */}
              <div className="space-y-1.5">
                <span className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                  Jadwal Kirim:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryDay('today')}
                    className={`cursor-pointer py-2 px-3 rounded-[12px] font-sans font-bold text-xs border-2 text-center transition flex items-center justify-center gap-1.5 ${
                      deliveryDay === 'today'
                        ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                        : 'bg-white text-[#111111] border-[#111111]/40 hover:bg-gray-50'
                    }`}
                  >
                    <span>🍳</span> Kloter Hari Ini
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryDay('tomorrow')}
                    className={`cursor-pointer py-2 px-3 rounded-[12px] font-sans font-bold text-xs border-2 text-center transition flex items-center justify-center gap-1.5 ${
                      deliveryDay === 'tomorrow'
                        ? 'bg-[#FFD700] text-[#111111] border-[#111111] shadow-[2px_2px_0_#111111]'
                        : 'bg-white text-[#111111] border-[#111111]/40 hover:bg-gray-50'
                    }`}
                  >
                    <span>📅</span> Booking Besok
                  </button>
                </div>

                {deliveryDay === 'tomorrow' && (
                  <div className="pt-1.5 space-y-1">
                    <span className="font-sans text-[10px] text-[#5C3D2E] font-semibold">
                      Pilih jam kirim besok:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Slot Pagi (10.00)', 'Slot Siang (13.00)', 'Slot Sore (16.00)'].map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setDeliverySlot(slot)}
                          className={`cursor-pointer py-1.5 px-2 rounded-[8px] font-sans font-bold text-[10px] border text-center transition ${
                            deliverySlot === slot
                              ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                              : 'bg-white text-[#111111] border-[#111111]/30 hover:bg-gray-50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 1. Ekstra Cabe Rawit Hijau */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-white/80 p-2.5 rounded-[12px] border border-[#111111]/30 hover:bg-white transition select-none">
                <input
                  type="checkbox"
                  checked={extraChili}
                  onChange={(e) => setExtraChili(e.target.checked)}
                  className="w-4 h-4 accent-[#111111] rounded cursor-pointer"
                />
                <div className="flex-1 font-sans text-xs font-bold text-[#111111]">
                  Ekstra Cabe Rawit Hijau 🌶️
                  <span className="block text-[11px] font-normal text-emerald-800">
                    Banyakin cabe rawitnya (Gratis, siap ceplus!)
                  </span>
                </div>
              </label>

              {/* 2. Pilihan Varian Mayo */}
              <div className="space-y-1.5">
                <span className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                  Pilihan Varian Saus Mayo:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMayoChoice('original')}
                    className={`cursor-pointer py-2 px-3 rounded-[12px] font-sans font-bold text-xs border-2 text-center transition flex items-center justify-center gap-1.5 ${
                      mayoChoice === 'original'
                        ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                        : 'bg-white text-[#111111] border-[#111111]/40 hover:bg-gray-50'
                    }`}
                  >
                    <span>🥟</span> Mayo Original
                  </button>

                  <button
                    type="button"
                    onClick={() => setMayoChoice('pedas')}
                    className={`cursor-pointer py-2 px-3 rounded-[12px] font-sans font-bold text-xs border-2 text-center transition flex items-center justify-center gap-1.5 ${
                      mayoChoice === 'pedas'
                        ? 'bg-red-600 text-white border-[#111111] shadow-[2px_2px_0_#111111]'
                        : 'bg-white text-[#111111] border-[#111111]/40 hover:bg-gray-50'
                    }`}
                  >
                    <span>🔥</span> Mayo Pedas
                  </button>
                </div>
              </div>

              {/* 3. Catatan Khusus untuk Dapur */}
              <div className="space-y-1">
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                  Catatan Tambahan untuk Dapur (Opsional):
                </label>
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="misal: minta digoreng agak garing, dipisah per mika..."
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                />
              </div>

              {/* 4. Voucher Diskon & Kupon Traktiran (Step 6) */}
              <div className="bg-white rounded-[18px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E] flex items-center gap-1.5">
                    <span>🎟️</span>
                    <span>Voucher Diskon / Traktiran</span>
                  </span>
                  {appliedVoucher && (
                    <span className="text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-400">
                      Aktif ✓
                    </span>
                  )}
                </div>

                {/* Active Golden Tickets Unlocked by Customer */}
                {goldenTickets.length > 0 && !appliedVoucher && (
                  <div className="p-3 bg-[#FFF8E7] rounded-[14px] border-2 border-amber-400 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 font-sans">
                      <span>✨</span>
                      <span>Kamu Punya Tiket Emas Dapur Terbuka!</span>
                    </div>
                    {goldenTickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-xs pt-1 border-t border-amber-200">
                        <div>
                          <strong className="block text-[#111111]">{t.title}</strong>
                          <span className="text-[10px] text-[#5C3D2E]">{t.perk}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVoucherCodeInput(t.unlockCode);
                            const res = storageService.validateVoucher(t.unlockCode, totalPrice);
                            if (res.valid && res.voucher) {
                              setAppliedVoucher(res.voucher);
                              setDiscountAmount(res.discountAmount);
                              setVoucherSuccessMsg(res.message);
                              setVoucherError(null);
                            }
                          }}
                          className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border border-[#111111] px-2.5 py-1 rounded-full font-bold text-[10px] shadow-xs shrink-0 ml-2"
                        >
                          Pakai Tiket Ini →
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!appliedVoucher ? (
                  <form onSubmit={handleApplyVoucher} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => {
                          setVoucherCodeInput(e.target.value.toUpperCase());
                          setVoucherError(null);
                        }}
                        placeholder="Contoh: AMANDA-LUMER-24"
                        className="flex-1 uppercase font-mono font-bold text-xs bg-[#FFF8E7] rounded-full border-2 border-[#111111] px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#FFD700] tracking-wider placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                      />
                      <button
                        type="submit"
                        disabled={!voucherCodeInput.trim()}
                        className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] transition active:translate-y-0.5"
                      >
                        Klaim
                      </button>
                    </div>

                    {/* Fallback & Friendly Error Message if Claim Fails */}
                    {voucherError && (
                      <div className="bg-rose-50 border-2 border-rose-300 rounded-[14px] p-3 text-rose-950 space-y-2 animate-in fade-in">
                        <p className="font-sans text-xs leading-relaxed">
                          {voucherError.message}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-rose-200">
                          <span className="text-[11px] font-sans text-rose-700">
                            Butuh bantuan kode?
                          </span>
                          <a
                            href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                              `Halo Tim Dulang Indonesia! Mau tanya soal kode voucher diskon "${voucherError.code}" yaa 🙏`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-[#111111] bg-[#FFD700] hover:brightness-105 px-2.5 py-1 rounded-full border border-[#111111] shadow-[1px_1px_0_#111111]"
                          >
                            <span>💬</span>
                            <span>Tanya Tim Dulang</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </form>
                ) : (
                  /* Voucher Applied Card with Unlocked Secret Child Voucher */
                  <div className="space-y-2.5">
                    <div className="bg-emerald-50 border-2 border-emerald-500 rounded-[16px] p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-700 text-sm">✓</span>
                          <span className="font-mono font-bold text-xs text-emerald-950 tracking-wider">
                            {appliedVoucher.code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveVoucher}
                          className="cursor-pointer text-[11px] font-sans text-rose-600 hover:underline font-bold"
                        >
                          Lepas Voucher ✕
                        </button>
                      </div>

                      <p className="font-sans text-xs text-emerald-900">
                        Traktiran spesial buat <strong>{appliedVoucher.recipientName}</strong>:{' '}
                        hemat <strong className="text-emerald-700">Rp {discountAmount.toLocaleString('id-ID')}</strong>!
                      </p>
                      {voucherSuccessMsg && (
                        <p className="text-[11px] text-emerald-800 font-sans italic pt-0.5">
                          {voucherSuccessMsg}
                        </p>
                      )}
                    </div>

                    {/* Child Voucher ("Voucher Beranak") - Secret Unlocked Golden Ticket */}
                    {appliedVoucher.childVoucher && (
                      <div className="bg-gradient-to-r from-[#FFF2B2] via-[#FFEEC2] to-[#FFD700]/30 border-2 border-dashed border-[#111111] rounded-[16px] p-3 space-y-1 shadow-[2px_2px_0_#111111]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">🎁</span>
                          <span className="font-sans font-bold text-[11px] uppercase tracking-wider text-[#111111]">
                            Tiket Bonus Rahasia Terbuka!
                          </span>
                        </div>
                        <h4 className="font-hand font-bold text-base text-[#111111] leading-tight">
                          {appliedVoucher.childVoucher.title}
                        </h4>
                        <p className="font-sans text-[11px] text-[#5C3D2E] leading-relaxed">
                          ✨ <strong>Keuntungan:</strong> {appliedVoucher.childVoucher.perk}
                        </p>
                        <p className="font-sans text-[10px] text-[#5C3D2E]/80 italic">
                          Syarat: {appliedVoucher.childVoucher.condition} (Otomatis tercatat di WA pesanan).
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Total Price & Checkout Action */}
            <div className="pt-2 border-t-2 border-[#111111]/15 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-[11px] text-[#5C3D2E] font-medium block">
                    Total {totalItems} Porsi ({cart.length} Jenis Menu)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans font-bold text-2xl text-[#111111]">
                      Rp {finalPrice.toLocaleString('id-ID')}
                    </span>
                    {(discountAmount > 0 || shippingCost > 0) && (
                      <span className="font-sans text-xs text-[#5C3D2E]/60">
                        (Menu: Rp {totalPrice.toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                  {shippingCost > 0 && (
                    <span className="font-sans text-[11px] font-semibold text-blue-700 block">
                      + Ongkir Kurir Dapur ({selectedDistrict}): Rp {shippingCost.toLocaleString('id-ID')}
                    </span>
                  )}
                  {discountAmount > 0 && (
                    <span className="font-sans text-[11px] font-bold text-emerald-700 block">
                      Hemat Rp {discountAmount.toLocaleString('id-ID')} ({appliedVoucher?.code})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClearCart}
                  className="cursor-pointer text-xs font-sans text-red-600 hover:underline"
                >
                  Kosongkan Dulang
                </button>
              </div>

              <button
                type="button"
                onClick={handleCheckoutWA}
                className="w-full cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 active:scale-[0.99] rounded-full py-3.5 px-6 font-sans font-bold text-sm tracking-wide border-2 border-[#111111] shadow-[4px_4px_0_#FFD700] transition flex items-center justify-center gap-2"
              >
                <span>Kirim Pesanan ke WhatsApp Tim Dulang</span>
                <span className="text-lg">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Celebratory Modal: Golden Ticket Unlocked! */}
      {unlockedPerkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-[#FFF8E7] text-[#111111] border-4 border-[#111111] rounded-[28px] p-6 shadow-[8px_8px_0_#FFD700] text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto bg-[#FFD700] rounded-full border-2 border-[#111111] flex items-center justify-center text-3xl shadow-[2px_2px_0_#111111]">
              🎉
            </div>
            <div>
              <span className="inline-block bg-[#111111] text-[#FFD700] text-[10px] font-sans font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                Golden Ticket Berhasil Terbuka!
              </span>
              <h3 className="font-hand font-bold text-2xl text-[#111111] leading-tight">
                {unlockedPerkModal.title}
              </h3>
              <p className="font-sans text-xs text-[#5C3D2E] mt-2 leading-relaxed">
                {unlockedPerkModal.perk}
              </p>
            </div>

            <div className="bg-white border-2 border-dashed border-[#111111] rounded-[16px] p-3">
              <span className="text-[11px] font-sans text-[#5C3D2E]/80 block">Kode Golden Ticket Kamu:</span>
              <span className="font-mono font-bold text-lg text-emerald-700 tracking-wider">
                {unlockedPerkModal.code}
              </span>
              <p className="text-[10px] font-sans text-emerald-800 mt-1">
                ✨ Tiket ini otomatis tersimpan di HP kamu dan siap dipakai di pesanan berikutnya!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setUnlockedPerkModal(null)}
              className="w-full cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 font-sans font-bold text-sm py-3 rounded-full border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition"
            >
              Mantap, Simpan Tiket! 👍
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar (Sticky Bar) */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[#FFF8E7] via-[#FFF8E7]/95 to-transparent">
        <div
          onClick={() => setIsDetailOpen(true)}
          className="cursor-pointer max-w-[620px] mx-auto bg-[#111111] text-[#FFF8E7] rounded-[24px] p-3.5 sm:p-4 flex items-center justify-between shadow-[0_12px_36px_rgba(0,0,0,0.3)] border-2 border-[#111111] hover:brightness-105 transition-all"
        >
          {/* Cart Total Info */}
          <div className="pl-2">
            <div className="font-sans text-[11px] uppercase tracking-wider text-[#FFD700] font-bold flex items-center gap-1.5">
              <span>🥟</span>
              <span>{cart.length} jenis • {totalItems} porsi</span>
              <span className="hidden sm:inline text-white/50">• Klik untuk lihat opsi cabe/mayo/voucher</span>
            </div>
            <div className="font-sans font-bold text-[18px] leading-tight text-white flex items-center gap-2">
              <span>Rp {finalPrice.toLocaleString('id-ID')}</span>
              {discountAmount > 0 && (
                <span className="text-xs text-white/50 line-through font-normal">
                  Rp {totalPrice.toLocaleString('id-ID')}
                </span>
              )}
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* Quick Item List Pills */}
            <div className="hidden sm:flex gap-1.5 pr-2">
              {cart.slice(0, 2).map((c) => (
                <div
                  key={c.item.id}
                  className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 text-xs"
                >
                  <span className="font-hand text-[14px] text-white">
                    {c.item.nama.split(' ')[0]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(c.item.id, -1)}
                    className="w-4 h-4 grid place-items-center bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer leading-none"
                  >
                    −
                  </button>
                  <span className="font-sans font-bold text-xs text-[#FFD700]">
                    {c.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(c.item.id, 1)}
                    className="w-4 h-4 grid place-items-center bg-[#FFD700] hover:brightness-110 rounded-full text-[#111111] cursor-pointer leading-none font-bold"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout / Open Drawer Button */}
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="cursor-pointer bg-[#FFD700] text-[#111111] rounded-full px-5 py-2.5 font-sans font-bold text-[13px] tracking-wide border-2 border-[#111111] shadow-[2px_2px_0_#FFFFFF] hover:brightness-105 active:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <span>Lihat & Pesan</span>
              <span className="text-[16px]">→</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
