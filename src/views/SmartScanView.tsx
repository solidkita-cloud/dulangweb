import React, { useState, useEffect } from 'react';
import { Customer, MenuItem, Voucher } from '../types';
import { BRAND, INDONESIA_CITIES, CITY_DISTRICTS, MONTHS_INDONESIA } from '../lib/constants';
import { storageService } from '../services/storageService';

interface SmartScanViewProps {
  initialQrId?: string;
  menus: MenuItem[];
  onOrderSuccess: (msg: string) => void;
}

export const SmartScanView: React.FC<SmartScanViewProps> = ({
  initialQrId = 'DULANG-042',
  menus,
  onOrderSuccess,
}) => {
  const [activeQrId, setActiveQrId] = useState(initialQrId.toUpperCase());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');
  const [city, setCity] = useState('Kabupaten Sidoarjo');
  const [district, setDistrict] = useState('Sidoarjo Kota');
  const [village, setVillage] = useState('');
  const [streetDetail, setStreetDetail] = useState('');
  const [favoriteMenu, setFavoriteMenu] = useState<string>(menus[0]?.nama || 'Risoles Mayo Lumer');
  const [consent, setConsent] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Step 7: CRM Tanggal & Bulan Lahir (Tanpa Tahun Demi Privasi)
  const [birthDay, setBirthDay] = useState<number | ''>('');
  const [birthMonth, setBirthMonth] = useState<number | ''>('');

  // 3b: Opsi Ekstra Menu Repeat Order
  const [repeatChili, setRepeatChili] = useState(true);
  const [repeatMayo, setRepeatMayo] = useState<'original' | 'pedas'>('original');
  const [repeatNote, setRepeatNote] = useState('');

  // Step 6: Voucher Diskon di Repeat Order
  const [scanVoucherCode, setScanVoucherCode] = useState('');
  const [appliedScanVoucher, setAppliedScanVoucher] = useState<Voucher | null>(null);
  const [scanDiscountAmount, setScanDiscountAmount] = useState(0);
  const [scanVoucherError, setScanVoucherError] = useState<{ message: string; code: string } | null>(null);

  // Birthday checks
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1; // 1-12
  const isBirthdayToday =
    customer &&
    customer.birth_day === currentDay &&
    customer.birth_month === currentMonth;
  const isBirthdayMonth =
    customer &&
    customer.birth_month === currentMonth;

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const districts = CITY_DISTRICTS[newCity] || [];
    setDistrict(districts[0] || '');
  };

  useEffect(() => {
    loadCustomer(activeQrId);
  }, [activeQrId]);

  const loadCustomer = (qrId: string) => {
    const found = storageService.getCustomerByQR(qrId);
    setCustomer(found);
    if (found) {
      setName(found.name);
      setWa(found.wa);
      setCity(found.city || 'Kabupaten Sidoarjo');
      setDistrict(found.district || found.area || 'Sidoarjo Kota');
      setVillage(found.village || '');
      setStreetDetail(found.street_detail || found.address || '');
      setFavoriteMenu(found.favorite_menu);
      setBirthDay(found.birth_day || '');
      setBirthMonth(found.birth_month || '');
      setIsEditing(false);
    } else {
      setName('');
      setWa('');
      setCity('Kabupaten Sidoarjo');
      setDistrict('Sidoarjo Kota');
      setVillage('');
      setStreetDetail('');
      setFavoriteMenu(menus[0]?.nama || 'Risoles Mayo Lumer');
      setBirthDay('');
      setBirthMonth('');
      setIsEditing(true);
    }
    // Reset voucher state
    setAppliedScanVoucher(null);
    setScanDiscountAmount(0);
    setScanVoucherCode('');
    setScanVoucherError(null);
  };

  const handleApplyScanVoucher = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanVoucherCode.trim()) return;

    setScanVoucherError(null);
    const favItem = menus.find((m) => m.nama === customer?.favorite_menu) || menus[0];
    const estimatedPrice = favItem ? favItem.harga : 18000;

    const result = storageService.validateVoucher(scanVoucherCode, estimatedPrice);
    if (!result.valid || !result.voucher) {
      setScanVoucherError({
        message: result.message,
        code: scanVoucherCode.trim().toUpperCase(),
      });
      setAppliedScanVoucher(null);
      setScanDiscountAmount(0);
    } else {
      setAppliedScanVoucher(result.voucher);
      setScanDiscountAmount(result.discountAmount);
      setScanVoucherError(null);
    }
  };

  const handleRemoveScanVoucher = () => {
    setAppliedScanVoucher(null);
    setScanDiscountAmount(0);
    setScanVoucherCode('');
    setScanVoucherError(null);
  };

  const handleSaveData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nama panggilan wajib diisi yaa');
      return;
    }
    if (!wa.trim()) {
      setFormError('Nomor WhatsApp wajib diisi');
      return;
    }
    if (!streetDetail.trim()) {
      setFormError('Nama jalan, perumahan, atau nomor rumah wajib diisi');
      return;
    }
    if (!consent) {
      setFormError('Persetujuan UU PDP wajib dicentang untuk menyimpan data');
      return;
    }

    setFormError(null);

    const cleanStreet = streetDetail.trim();
    const cleanVillage = village.trim();
    const formattedAddress = cleanVillage
      ? `${cleanStreet}, Kel./Desa ${cleanVillage}`
      : cleanStreet;

    const saved = await storageService.saveCustomer({
      qr_code_id: activeQrId,
      name: name.trim(),
      wa: wa.trim().replace(/[^0-9]/g, ''),
      address: formattedAddress,
      area: district,
      city,
      district,
      village: cleanVillage,
      street_detail: cleanStreet,
      favorite_menu: favoriteMenu,
      birth_day: birthDay ? Number(birthDay) : undefined,
      birth_month: birthMonth ? Number(birthMonth) : undefined,
      consent_at: new Date().toISOString(),
    });

    setCustomer(saved);
    setIsEditing(false);
    onOrderSuccess(`Data Kak ${saved.name} tersimpan! Next scan langsung kebaca otomatis ✨`);
  };

  const handleQuickRepeatOrder = async () => {
    if (!customer) return;

    // Increment orders in database/storage
    const updated = await storageService.repeatOrder(customer.qr_code_id);
    if (updated) setCustomer(updated);

    const addressParts = [
      customer.address,
      customer.district ? `Kec. ${customer.district}` : (customer.area ? `Kec. ${customer.area}` : ''),
      customer.city || 'Kab. Sidoarjo'
    ].filter(Boolean);

    const optionsText = [
      repeatChili ? 'Ekstra Cabe Rawit Hijau (Banyakin 🌶️)' : 'Cabe Standar',
      repeatMayo === 'pedas' ? 'Varian: Mayo Pedas Mantap 🌶️' : 'Varian: Mayo Original Gurih 🥟',
      repeatNote.trim() ? `Catatan: ${repeatNote.trim()}` : '',
    ].filter(Boolean).join(' • ');

    let voucherText = '';
    if (appliedScanVoucher) {
      voucherText = `\n🎟️ *Voucher Diskon:* ${appliedScanVoucher.code} (-Rp ${scanDiscountAmount.toLocaleString('id-ID')})`;
      if (appliedScanVoucher.childVoucher) {
        voucherText += `\n🎁 *Tiket Bonus Rahasia:* ${appliedScanVoucher.childVoucher.title} (${appliedScanVoucher.childVoucher.unlockCode})`;
      }
      storageService.markVoucherUsed(appliedScanVoucher.code);
    }

    // Construct returning WhatsApp message with 3b Extras & Tim Dulang Indonesia
    const msg = `Halo Tim Dulang Indonesia! Aku kangen yang anget-anget - aku ${customer.name} ID ${customer.qr_code_id} mau ${customer.favorite_menu} lagi ya\n\n🌶️ *Opsi Racikan:* ${optionsText}\n📍 *Alamat Antar:* ${addressParts.join(', ')}${voucherText}\nTotal pesanan sebelumnya: ${customer.total_orders}x. Mohon info ketersediaan di dapur yaa! 🙏💛`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${encoded}`, '_blank', 'noopener,noreferrer');

    onOrderSuccess(`yey! Pesanan Kak ${customer.name.split(' ')[0]} dikirim ke dapur! 🥟`);
  };

  // Mask sensitive PII so unauthorized passers-by photographing the QR cannot see full contact
  const getMaskedPhone = (phone: string) => {
    const d = phone.replace(/[^0-9]/g, '');
    if (d.length <= 6) return d;
    return `${d.slice(0, 4)}-xxxx-${d.slice(-4)}`;
  };

  const getMaskedAddress = (addr: string, ar: string) => {
    if (addr.length > 20) {
      return `${addr.slice(0, 18)}... (${ar})`;
    }
    return `${addr} (${ar})`;
  };

  const firstName = customer ? customer.name.split(' ')[0] : '';

  return (
    <div className="max-w-[960px] mx-auto px-4 py-8">
      {/* Top Title & QR Selector */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111111] text-[#FFD700] text-[11px] font-sans font-bold tracking-widest uppercase mb-2">
          <span>📱</span> Smart QR Scanner Simulation
        </div>
        <h1 className="font-hand font-bold text-[36px] lg:text-[46px] leading-none text-[#111111]">
          Simulasi Scan Stiker Dus
        </h1>
        <p className="font-sans text-[13px] text-[#5C3D2E]/80 mt-1 max-w-[50ch] mx-auto">
          Coba scan QR stiker unik yang ditempel di dus risoles atau gantungan kunci akrilik.
        </p>

        {/* QR ID Input / Switcher */}
        <div className="mt-5 flex justify-center items-center gap-2 max-w-[380px] mx-auto">
          <input
            type="text"
            value={activeQrId}
            onChange={(e) => setActiveQrId(e.target.value.toUpperCase())}
            placeholder="DULANG-042"
            className="flex-1 rounded-full bg-white border-2 border-[#111111] px-4 py-2 font-mono font-bold text-[14px] text-center focus:outline-none focus:border-[#FFD700] shadow-[2px_2px_0_#111111]"
          />
          <button
            type="button"
            onClick={() => loadCustomer(activeQrId)}
            className="rounded-full bg-[#111111] text-[#FFD700] px-4 py-2 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:bg-[#222222] cursor-pointer"
          >
            Scan →
          </button>
        </div>

        {/* Quick Sample Badges */}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-xs font-mono">
          <span className="text-[11px] text-[#5C3D2E]/60 self-center">Contoh coba:</span>
          {['DULANG-042', 'DULANG-015', 'DULANG-088', 'DULANG-BARU-99'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveQrId(id)}
              className={`px-2.5 py-0.5 rounded-full border cursor-pointer transition ${
                activeQrId === id
                  ? 'bg-[#FFD700] text-[#111111] border-[#111111] font-bold'
                  : 'bg-white text-[#5C3D2E]/70 border-[#111111]/20 hover:border-[#111111]'
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scan Simulation Container */}
      <div className="bg-[#111111] text-white rounded-[28px] p-6 lg:p-10 border-[3px] border-[#111111] shadow-[8px_8px_0_#FFD700] rotate-[-0.5deg] relative">
        {/* Top Tape */}
        <div className="tape absolute -top-3.5 left-1/2 -translate-x-1/2 w-[88px] h-[22px] bg-[#FFD700] rotate-[-2deg] rounded-[3px] border border-[#111111]/20" />

        {/* CASE 1: RETURNING CUSTOMER (RECOGNIZED!) */}
        {customer && !isEditing ? (
          <div className="space-y-6">
            {/* Birthday Alert Banner (Step 7) */}
            {isBirthdayToday ? (
              <div className="bg-gradient-to-r from-[#FFD700] via-[#FFEEC2] to-[#FFD700] text-[#111111] rounded-[20px] p-4 border-2 border-white shadow-[4px_4px_0_#FFFFFF] flex items-center gap-3">
                <span className="text-3xl animate-bounce">🎂</span>
                <div>
                  <h4 className="font-hand font-bold text-xl leading-none">
                    SELAMAT ULANG TAHUN KAK {firstName}! 🎉
                  </h4>
                  <p className="font-sans text-xs text-[#5C3D2E] mt-0.5 font-medium">
                    Hari ini hari spesialmu! Tim Dulang Indonesia mendoakan sehat, berkah, & bahagia selalu! 💛
                  </p>
                </div>
              </div>
            ) : isBirthdayMonth ? (
              <div className="bg-[#FFD700]/20 border border-[#FFD700]/50 rounded-[16px] px-4 py-2.5 flex items-center gap-2.5 text-xs font-sans text-white">
                <span className="text-xl">🎈</span>
                <span>
                  Bulan ini bulan kelahiran Kak {firstName}! Jangan lupa klaim traktiran hangat dari Tim Dulang Indonesia ya!
                </span>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#FFD700] text-[#111111] font-hand font-bold text-[28px] grid place-items-center border-2 border-white shadow-md">
                  {customer.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 font-sans text-[11px] tracking-widest uppercase font-bold text-[#FFD700]">
                    <span>✦</span> Pelanggan Dikenali (ID: {customer.qr_code_id})
                  </div>
                  <h2 className="font-hand font-bold text-[34px] lg:text-[42px] leading-tight text-white">
                    Halo Kak {firstName}! Kangen yang anget-anget?
                  </h2>
                </div>
              </div>

              {/* Loyalty Tier Pill */}
              <div>
                <span
                  className={`inline-block px-4 py-1.5 rounded-full font-sans font-bold text-[12px] uppercase tracking-wider border-2 ${
                    customer.status === 'Sultan Dulang'
                      ? 'bg-[#FFD700] text-[#111111] border-white shadow-[2px_2px_0_#FFFFFF]'
                      : customer.status === 'Setia'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white/10 text-white border-white/20'
                  }`}
                >
                  👑 Tier: {customer.status} ({customer.total_orders}x Order)
                </span>
              </div>
            </div>

            {/* Returning Summary Box */}
            <div className="bg-[#FFF8E7] text-[#111111] rounded-[20px] p-6 border-2 border-[#111111] space-y-4">
              <div className="font-hand font-bold text-[24px] text-[#111111] leading-none">
                Mau pesan <span className="underline decoration-[#FFD700] decoration-4">{customer.favorite_menu}</span> lagi kayak kemarin?
              </div>

              <div className="grid sm:grid-cols-2 gap-3 font-sans text-[13px] bg-white rounded-[14px] p-4 border border-[#111111]/10">
                <div>
                  <span className="text-[#5C3D2E]/60 text-[11px] uppercase font-bold block">
                    Alamat Pengiriman (Privasi Terjaga)
                  </span>
                  <span className="font-bold text-[#111111]">
                    {getMaskedAddress(customer.address, customer.area)}
                  </span>
                  <span className="text-xs text-emerald-700 block mt-0.5">
                    ✓ Alamat lengkap otomatis masuk ke WA
                  </span>
                </div>
                <div>
                  <span className="text-[#5C3D2E]/60 text-[11px] uppercase font-bold block">
                    Nomor WhatsApp (Masked)
                  </span>
                  <span className="font-bold text-[#111111] font-mono">
                    +{getMaskedPhone(customer.wa)}
                  </span>
                  <span className="text-xs text-[#5C3D2E]/70 block mt-0.5">
                    Privasi UU PDP terlindungi
                  </span>
                </div>
              </div>

              {/* 3b: OPSI EKSTRA & RACIKAN DAPUR */}
              <div className="bg-[#FFF8E7] rounded-[18px] p-3.5 border-2 border-[#111111] space-y-2.5">
                <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                  <span>🌶️</span> Opsi Racikan Hari Ini:
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-[10px] border border-[#111111]/20 select-none">
                    <input
                      type="checkbox"
                      checked={repeatChili}
                      onChange={(e) => setRepeatChili(e.target.checked)}
                      className="w-4 h-4 accent-[#111111] rounded cursor-pointer"
                    />
                    <span className="font-sans text-xs font-bold text-[#111111]">
                      Ekstra Cabe Rawit (Gratis 🌶️)
                    </span>
                  </label>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-[10px] border border-[#111111]/20">
                    <button
                      type="button"
                      onClick={() => setRepeatMayo('original')}
                      className={`flex-1 py-1 rounded-[8px] font-sans font-bold text-[11px] transition ${
                        repeatMayo === 'original'
                          ? 'bg-[#111111] text-[#FFD700]'
                          : 'text-[#111111]/70 hover:bg-gray-100'
                      }`}
                    >
                      Mayo Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepeatMayo('pedas')}
                      className={`flex-1 py-1 rounded-[8px] font-sans font-bold text-[11px] transition ${
                        repeatMayo === 'pedas'
                          ? 'bg-red-600 text-white'
                          : 'text-[#111111]/70 hover:bg-gray-100'
                      }`}
                    >
                      Mayo Pedas 🌶️
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={repeatNote}
                  onChange={(e) => setRepeatNote(e.target.value)}
                  placeholder="Catatan untuk dapur (misal: minta agak garing / kirim jam 12)..."
                  className="w-full rounded-full border border-[#111111]/30 px-3.5 py-1.5 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                />
              </div>

              {/* Step 6: Voucher Diskon di Repeat Order */}
              <div className="bg-white rounded-[16px] p-3.5 border border-[#111111]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E] flex items-center gap-1.5">
                    <span>🎟️</span> Voucher Diskon / Traktiran
                  </span>
                  {appliedScanVoucher && (
                    <span className="text-[10px] font-sans font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-400">
                      Aktif ✓
                    </span>
                  )}
                </div>

                {!appliedScanVoucher ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scanVoucherCode}
                        onChange={(e) => {
                          setScanVoucherCode(e.target.value.toUpperCase());
                          setScanVoucherError(null);
                        }}
                        placeholder="Punya kode? Misal: AMANDA-LUMER-24"
                        className="flex-1 uppercase font-mono font-bold text-xs bg-[#FFF8E7] rounded-full border border-[#111111]/30 px-3.5 py-1.5 focus:outline-none focus:border-[#FFD700] tracking-wider placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyScanVoucher()}
                        disabled={!scanVoucherCode.trim()}
                        className="cursor-pointer bg-[#111111] text-[#FFD700] disabled:opacity-50 rounded-full px-3.5 py-1.5 font-sans font-bold text-xs border border-[#111111] hover:brightness-110"
                      >
                        Klaim
                      </button>
                    </div>

                    {scanVoucherError && (
                      <div className="bg-rose-50 border border-rose-300 rounded-[12px] p-2 text-rose-950 text-xs font-sans space-y-1">
                        <p>{scanVoucherError.message}</p>
                        <a
                          href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                            `Halo Tim Dulang Indonesia! Mau tanya kode voucher "${scanVoucherError.code}" yaa 🙏`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-amber-900 font-bold hover:underline"
                        >
                          💬 Tanya Tim Dulang via WA
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-400 rounded-[12px] p-2">
                      <span className="font-mono font-bold text-emerald-900">
                        ✓ {appliedScanVoucher.code} (-Rp {scanDiscountAmount.toLocaleString('id-ID')})
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveScanVoucher}
                        className="cursor-pointer text-[11px] font-sans text-rose-600 hover:underline font-bold"
                      >
                        Lepas ✕
                      </button>
                    </div>

                    {appliedScanVoucher.childVoucher && (
                      <div className="bg-[#FFF2B2] border border-dashed border-[#111111] rounded-[12px] p-2 text-xs font-sans space-y-0.5">
                        <span className="font-bold block text-[#111111]">
                          🎁 {appliedScanVoucher.childVoucher.title}
                        </span>
                        <span className="text-[11px] text-[#5C3D2E] block">
                          {appliedScanVoucher.childVoucher.perk} ({appliedScanVoucher.childVoucher.condition})
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Repeat Order Direct Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleQuickRepeatOrder}
                  className="flex-1 cursor-pointer bg-[#FFD700] text-[#111111] rounded-full py-3.5 px-6 font-sans font-bold text-[14px] tracking-wide border-2 border-[#111111] shadow-[4px_4px_0_#111111] hover:brightness-105 transition-all text-center"
                >
                  Ya, Pesan {customer.favorite_menu} Lagi via WA 🥟
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="cursor-pointer bg-white text-[#111111] rounded-full py-3.5 px-5 font-sans font-bold text-[13px] border-2 border-[#111111] hover:bg-gray-100 transition-all"
                >
                  Ganti Alamat / Menu
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 2: FIRST TIME OR EDITING FORM */
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-5">
              <div className="inline-flex items-center gap-1.5 font-sans text-[11px] tracking-widest uppercase font-bold text-[#FFD700]">
                <span>✨</span> Stiker Baru Ditemukan (ID: {activeQrId})
              </div>
              <h2 className="font-hand font-bold text-[32px] lg:text-[40px] leading-tight text-white mt-1">
                Hai! Kamu dapet Dulang spesial ✨
              </h2>
              <p className="font-sans text-[13px] text-white/70 mt-1">
                Isi sekali aja yaa. Next scan dus berikutnya, data langsung kebaca otomatis—gak perlu ngetik alamat lagi!
              </p>
            </div>

            <form onSubmit={handleSaveData} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                    Nama Panggilan
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="contoh: Rina"
                    className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans text-[14px] focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={wa}
                    onChange={(e) => setWa(e.target.value)}
                    placeholder="087703397035"
                    className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans text-[14px] focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
              </div>

              {/* ALAMAT PENGIRIMAN TERSTRUKTUR: KOTA -> KECAMATAN -> KELURAHAN -> DETAIL JALAN */}
              <div className="bg-white/5 p-4 rounded-[20px] border border-white/15 space-y-3.5">
                <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                  <span className="text-base">📍</span>
                  <span className="font-hand font-bold text-[20px] text-[#FFD700]">Alamat Pengiriman</span>
                  <span className="font-sans text-[11px] text-white/60 ml-auto">Urut & Mudah Diisi</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* 1. KOTA / KABUPATEN */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      1. Kota / Kabupaten *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans font-bold text-[13px] focus:outline-none focus:border-[#FFD700]"
                    >
                      {INDONESIA_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. KECAMATAN */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      2. Kecamatan *
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans font-bold text-[13px] focus:outline-none focus:border-[#FFD700]"
                    >
                      {(CITY_DISTRICTS[city] || []).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {/* 3. KELURAHAN / DESA */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      3. Kelurahan / Desa
                    </label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="contoh: Sidokare / Pepelegi / Pucang"
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans text-[13px] focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* MENU FAVORIT */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      Menu Favorit
                    </label>
                    <select
                      value={favoriteMenu}
                      onChange={(e) => setFavoriteMenu(e.target.value)}
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans text-[13px] focus:outline-none focus:border-[#FFD700]"
                    >
                      {menus.map((m) => (
                        <option key={m.id} value={m.nama}>
                          {m.nama} (Rp {m.harga.toLocaleString('id-ID')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. DETAIL NAMA JALAN / PERUMAHAN / BLOK / PATOKAN */}
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                    4. Nama Jalan, No. Rumah, RT/RW, & Patokan *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={streetDetail}
                    onChange={(e) => setStreetDetail(e.target.value)}
                    placeholder="contoh: Perumahan Kahuripan Nirwana Blok C-12, pagar hitam depan pos satpam..."
                    className="w-full rounded-[16px] bg-white text-[#111111] border-2 border-white px-4 py-2.5 font-sans text-[13px] focus:outline-none focus:border-[#FFD700] resize-none"
                  />
                </div>
              </div>

              {/* 5. TANGGAL & BULAN LAHIR (OPSIONAL - TANPA TAHUN DEMI PRIVASI) */}
              <div className="bg-white/5 p-4 rounded-[20px] border border-white/15 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎂</span>
                  <span className="font-hand font-bold text-[20px] text-[#FFD700]">
                    Hari Spesial Ulang Tahun (Opsional)
                  </span>
                </div>
                <p className="font-sans text-[11px] text-white/70">
                  Biar Tim Dulang Indonesia bisa kirim traktiran / voucher kejutan pas hari ulang tahunmu! Tenang, tahun lahir rahasia, nggak perlu diisi 😉
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-sans text-[10px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      Tanggal Lahir
                    </label>
                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2 font-sans font-bold text-[13px] focus:outline-none focus:border-[#FFD700]"
                    >
                      <option value="">Pilih Tanggal</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Tanggal {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-sans text-[10px] font-bold uppercase tracking-wider text-[#FFD700] mb-1">
                      Bulan Lahir
                    </label>
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-full bg-white text-[#111111] border-2 border-white px-4 py-2 font-sans font-bold text-[13px] focus:outline-none focus:border-[#FFD700]"
                    >
                      <option value="">Pilih Bulan</option>
                      {MONTHS_INDONESIA.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* UU PDP Consent Checkbox - Security Audit Mandatory */}
              <div className="bg-white/10 rounded-[16px] p-3.5 border border-white/15">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[#FFD700] rounded"
                  />
                  <span className="font-sans text-[12px] leading-[1.5] text-white/90">
                    <span className="font-bold text-[#FFD700]">Persetujuan Privasi (UU PDP):</span> Saya setuju data nama, nomor WA, dan alamat disimpan dengan aman oleh Dulang Indonesia khusus untuk keperluan pengiriman pesanan dan repeat order.
                  </span>
                </label>
              </div>

              {formError && (
                <div className="font-hand font-bold text-[18px] text-red-400">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 cursor-pointer bg-[#FFD700] text-[#111111] rounded-full py-3.5 px-6 font-sans font-bold text-[14px] tracking-wide border-2 border-[#111111] shadow-[4px_4px_0_#FFFFFF] hover:brightness-105 transition-all text-center"
                >
                  Simpan Data — Next Gak Perlu Ngetik Lagi ✓
                </button>
                {customer && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="cursor-pointer bg-white/20 text-white rounded-full py-3.5 px-5 font-sans font-bold text-[13px] hover:bg-white/30"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
