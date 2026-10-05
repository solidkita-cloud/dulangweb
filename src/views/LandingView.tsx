import React, { useState, useEffect } from 'react';
import { MenuItem, StoreConfig, CustomerTestimonial, Customer, SnackBoxType, SnackBoxDrink } from '../types';
import { BRAND, LOCKED_COPY, DEFAULT_STORE_CONFIG } from '../lib/constants';
import { PolaroidMenuCard } from '../components/common/PolaroidMenuCard';
import { CuteQRCard } from '../components/common/CuteQRCard';
import { storageService } from '../services/storageService';

interface LandingViewProps {
  menus: MenuItem[];
  storeConfig?: StoreConfig;
  onAddToCart: (item: MenuItem, pilihanOpsi?: string, variantType?: 'matang' | 'frozen') => void;
  getCartQty: (itemId: string) => number;
  onNavigateToScan: (qrId: string) => void;
  onOpenOwnerLogin?: () => void;
  onOpenClosedNotice?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  menus,
  storeConfig = DEFAULT_STORE_CONFIG,
  onAddToCart,
  getCartQty,
  onNavigateToScan,
  onOpenOwnerLogin,
  onOpenClosedNotice,
}) => {
  const [menuTab, setMenuTab] = useState<'today' | 'tomorrow'>('today');
  const [isTestimonialsOpen, setIsTestimonialsOpen] = useState(false);
  const [testimonials] = useState<CustomerTestimonial[]>(() =>
    storageService.getTestimonials().filter((t) => t.is_active)
  );

  // --- RECOGNIZED CUSTOMER (SUPER SMART BARCODE GREETING) ---
  const [recognizedCustomer, setRecognizedCustomer] = useState<Customer | null>(() =>
    storageService.getRecognizedCustomer()
  );

  useEffect(() => {
    const handleCustomerChange = () => {
      setRecognizedCustomer(storageService.getRecognizedCustomer());
    };
    window.addEventListener('dulang_active_customer_updated', handleCustomerChange);
    return () => {
      window.removeEventListener('dulang_active_customer_updated', handleCustomerChange);
    };
  }, []);

  // --- PAKET SNACK BOX / HAJATAN / ARISAN BUILDER STATE ---
  const [isSnackBoxOpen, setIsSnackBoxOpen] = useState(false);
  const [sbType, setSbType] = useState<SnackBoxType>('standar_3');
  const [sbSelectedItems, setSbSelectedItems] = useState<string[]>([
    'Risoles Mayo Lumer',
    'Risoles Rogout Ayam',
    'Sosis Solo Ayam Gurih',
  ]);
  const [sbDrink, setSbDrink] = useState<SnackBoxDrink>('mineral');
  const [sbQty, setSbQty] = useState<number>(0);
  const [sbEventDate, setSbEventDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [sbEventTime, setSbEventTime] = useState<string>('09:30');
  const [sbCustomLabel, setSbCustomLabel] = useState<string>('');
  const [sbNotes, setSbNotes] = useState<string>('');
  const [sbOrderSentSuccess, setSbOrderSentSuccess] = useState<boolean>(false);

  // Snack Box Capacity & Pricing
  const sbCapacity = sbType === 'mini_2' ? 2 : sbType === 'standar_3' ? 3 : 4;
  const sbBaseItemPrice = sbType === 'mini_2' ? 8000 : sbType === 'standar_3' ? 11000 : 14000;
  const sbDrinkPrice = sbDrink === 'mineral' ? 1000 : sbDrink === 'teh' ? 3500 : 0;
  const sbPricePerBox = sbBaseItemPrice + sbDrinkPrice;
  const sbGrossTotal = sbPricePerBox * sbQty;

  // Tiered discounts & bonuses
  let sbDiscountPercent = 0;
  let sbBonusBoxes = 0;
  let sbFreeSticker = false;

  if (sbQty >= 100) {
    sbDiscountPercent = 15;
    sbBonusBoxes = 5;
    sbFreeSticker = true;
  } else if (sbQty >= 50) {
    sbDiscountPercent = 10;
    sbBonusBoxes = 2;
    sbFreeSticker = true;
  } else if (sbQty >= 30) {
    sbDiscountPercent = 5;
    sbBonusBoxes = 0;
    sbFreeSticker = false;
  }

  const sbDiscountNominal = Math.round((sbGrossTotal * sbDiscountPercent) / 100);
  const sbFinalPrice = sbGrossTotal - sbDiscountNominal;
  const sbTotalBoxesReceived = sbQty > 0 ? sbQty + sbBonusBoxes : 0;

  const toggleSbItem = (itemName: string) => {
    if (sbSelectedItems.includes(itemName)) {
      if (sbSelectedItems.length > 1) {
        setSbSelectedItems(sbSelectedItems.filter((i) => i !== itemName));
      }
    } else {
      if (sbSelectedItems.length < sbCapacity) {
        setSbSelectedItems([...sbSelectedItems, itemName]);
      } else {
        // Replace last item
        setSbSelectedItems([...sbSelectedItems.slice(0, sbCapacity - 1), itemName]);
      }
    }
  };

  const handleSbTypeChange = (newType: SnackBoxType) => {
    setSbType(newType);
    const newCap = newType === 'mini_2' ? 2 : newType === 'standar_3' ? 3 : 4;
    const defaultAvailable = [
      'Risoles Mayo Lumer',
      'Risoles Rogout Ayam',
      'Sosis Solo Ayam Gurih',
      'Pastel Sayur Telur',
    ];
    setSbSelectedItems(defaultAvailable.slice(0, newCap));
  };

  const handleOrderSnackBoxWA = () => {
    if (sbQty <= 0) {
      alert('Silakan tentukan jumlah pesanan box terlebih dahulu (misal: 20 atau 30 box).');
      return;
    }

    const boxLabel =
      sbType === 'mini_2' ? 'Mini (2 Pcs)' : sbType === 'standar_3' ? 'Standar (3 Pcs)' : 'Lengkap (4 Pcs)';
    const drinkLabel =
      sbDrink === 'mineral'
        ? 'Air Mineral Gelas 🧊'
        : sbDrink === 'teh'
        ? 'Teh Kotak Segar 🧃'
        : 'Tanpa Minuman';

    let msg = `Halo Tim Dapur Dulang! 🙏✨\n`;
    msg += `Saya mau reservasi *Paket Snack Box Hajatan / Arisan Dulang*:\n\n`;
    msg += `📦 *Tipe Box:* Paket ${boxLabel}\n`;
    msg += `🥟 *Isian Kue:* ${sbSelectedItems.join(', ')}\n`;
    msg += `🥤 *Minuman:* ${drinkLabel}\n`;
    msg += `📊 *Jumlah Pesanan:* ${sbQty} Box ${
      sbBonusBoxes > 0 ? `(+ Bonus ${sbBonusBoxes} Box Gratis = Total ${sbTotalBoxesReceived} Box!)` : ''
    }\n`;
    msg += `🗓️ *Jadwal Acara:* ${sbEventDate} jam ${sbEventTime} WIB\n`;
    if (sbCustomLabel.trim()) {
      msg += `🏷️ *Tulisan Stiker Tutup Dus:* "${sbCustomLabel.trim()}"\n`;
    }
    if (sbNotes.trim()) {
      msg += `📝 *Catatan Khusus:* ${sbNotes.trim()}\n`;
    }
    msg += `\n💰 *Rincian Biaya:*\n`;
    msg += `• Harga Normal: Rp ${sbPricePerBox.toLocaleString('id-ID')} / box\n`;
    msg += `• Subtotal (${sbQty} box): Rp ${sbGrossTotal.toLocaleString('id-ID')}\n`;
    if (sbDiscountNominal > 0) {
      msg += `• Diskon Spesial (${sbDiscountPercent}%): -Rp ${sbDiscountNominal.toLocaleString('id-ID')}\n`;
    }
    msg += `*✨ TOTAL BAYAR: Rp ${sbFinalPrice.toLocaleString('id-ID')}*\n\n`;
    msg += `Mohon dicek slot dapur dan konfirmasi ya. Terima kasih banyak! 🙏`;

    // Automatically record to kitchen queue
    try {
      storageService.addOrder({
        customer_name: recognizedCustomer ? recognizedCustomer.name : 'Pemesan Snack Box',
        customer_wa: recognizedCustomer ? recognizedCustomer.wa : undefined,
        customer_qr_id: recognizedCustomer ? recognizedCustomer.qr_code_id : undefined,
        items: [
          {
            menu_id: `snack_box_${sbType}`,
            nama: `Snack Box ${boxLabel}`,
            harga: Math.round(sbFinalPrice / sbQty),
            qty: sbQty,
            pilihanOpsi: `Isi: ${sbSelectedItems.join(' + ')} | Minuman: ${drinkLabel}`,
          },
        ],
        total_price: sbFinalPrice,
        delivery_schedule: `${sbEventDate} jam ${sbEventTime}`,
        notes: [
          `Acara/Stiker: ${sbCustomLabel || 'Standar'}`,
          sbBonusBoxes > 0 ? `Bonus: ${sbBonusBoxes} Box Gratis` : '',
          sbNotes.trim() ? `Catatan: ${sbNotes.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        status: 'menunggu',
        channel: 'web_wa',
      });
    } catch (e) {
      console.warn('Auto record snack box error:', e);
    }

    const url = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSbOrderSentSuccess(true);
    setTimeout(() => setSbOrderSentSuccess(false), 5000);
  };

  const todayDate = new Date();
  const curDay = todayDate.getDate();
  const curMonth = todayDate.getMonth() + 1;
  const isCustBdayToday = recognizedCustomer?.birth_day === curDay && recognizedCustomer?.birth_month === curMonth;
  const isCustBdayThisMonth = recognizedCustomer?.birth_month === curMonth;

  return (
    <div className="space-y-16 lg:space-y-24 pb-20">
      {/* Birthday Celebration Banner for Recognized Customer (Item 8) */}
      {recognizedCustomer && (isCustBdayToday || isCustBdayThisMonth) && (
        <div className="bg-gradient-to-r from-[#FFD700] via-[#FFF2B2] to-[#FFD700] text-[#111111] border-2 border-[#111111] rounded-[24px] p-5 sm:p-6 shadow-[5px_5px_0_#111111] relative overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="tape absolute -top-3 right-10 w-28 h-5 bg-rose-400 rotate-[3deg] border border-[#111111]/20 shadow-xs" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex items-center justify-center text-3xl shrink-0 rotate-[4deg] animate-bounce">
                🎂
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="bg-[#111111] text-[#FFD700] px-3 py-0.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider">
                    {isCustBdayToday ? '🎉 Selamat Ulang Tahun Hari Ini!' : '🎈 Bulan Kelahiranmu Spesial!'}
                  </span>
                  <span className="text-xs text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full font-bold">
                    Kado dari Dapur Dulang 💛
                  </span>
                </div>
                <h3 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-tight">
                  Barakallah Fii Umrik, Kak {recognizedCustomer.name}! 🥳
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#5C3D2E]/90 mt-0.5">
                  Hari spesialmu wajib ditemenin risoles lumer hangat. Kami siapin traktiran potongan harga buat kamu!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center shrink-0">
              <a
                href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                  `Halo Tim Dulang! Saya ${recognizedCustomer.name} (${recognizedCustomer.qr_code_id}), mau klaim traktiran ulang tahun spesial risoles hangat dong 🎉🥟`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 border-2 border-[#111111] px-5 py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm shadow-[3px_3px_0_#FFD700] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2 transition"
              >
                <span>🎁</span>
                <span>Klaim Traktiran di WA</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Recognized Customer Personal Greeting Banner (Super Smart Barcode) */}
      {recognizedCustomer && (
        <div className="bg-[#FFFDF4] text-[#111111] border-2 border-[#111111] rounded-[24px] p-5 sm:p-6 shadow-[5px_5px_0_#111111] relative overflow-hidden rotate-[-0.5deg] animate-in fade-in duration-300">
          <div className="tape absolute -top-3 left-10 w-28 h-5 bg-[#FFD700] rotate-[-2deg] border border-[#111111]/20 shadow-xs" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#FFD700] border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex items-center justify-center text-3xl shrink-0 rotate-[-3deg]">
                🥟
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="bg-[#111111] text-[#FFD700] px-3 py-0.5 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider">
                    ✨ Sobat Dulang Setia
                  </span>
                  <span className="font-mono text-xs font-bold text-[#5C3D2E] bg-white border border-[#111111]/30 px-2 py-0.5 rounded-full">
                    {recognizedCustomer.qr_code_id}
                  </span>
                  {recognizedCustomer.area && (
                    <span className="text-xs text-[#5C3D2E]/70 font-sans font-semibold">
                      📍 {recognizedCustomer.area}
                    </span>
                  )}
                  {recognizedCustomer.total_orders && recognizedCustomer.total_orders > 0 && (
                    <span className="text-xs text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                      Order ke-{(recognizedCustomer.total_orders || 0) + 1}
                    </span>
                  )}
                </div>
                <h3 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-tight">
                  Halo Kak {recognizedCustomer.name}! Seneng ketemu lagi 😊
                </h3>
                <p className="font-sans text-xs sm:text-sm text-[#5C3D2E]/90 mt-0.5">
                  {recognizedCustomer.favorite_menu ? (
                    <>
                      Risoles <strong className="text-[#111111] underline">{recognizedCustomer.favorite_menu}</strong> favoritmu mau digorengin anget-anget lagi hari ini?
                    </>
                  ) : (
                    'Mau digorengin risoles lumer apa hari ini buat nemenin harimu?'
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center shrink-0">
              {recognizedCustomer.favorite_menu && (
                <button
                  type="button"
                  onClick={() => {
                    const fav =
                      menus.find((m) =>
                        m.nama.toLowerCase().includes((recognizedCustomer.favorite_menu || '').toLowerCase())
                      ) || menus[0];
                    if (fav) {
                      onAddToCart(fav);
                    }
                  }}
                  className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border-2 border-[#111111] px-4 py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm shadow-[3px_3px_0_#111111] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 transition"
                >
                  <span>🔥</span>
                  <span>Pesan {recognizedCustomer.favorite_menu.split(' ')[0]} Langsung</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  storageService.setActiveCustomerQR(null);
                }}
                className="cursor-pointer text-xs text-[#5C3D2E]/70 hover:text-red-600 underline font-sans font-medium px-2 py-1"
                title="Bukan akunmu? Klik untuk keluar atau reset sesi"
              >
                Bukan Kak {recognizedCustomer.name}?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed Kitchen Banner If Closed */}
      {storeConfig.isStoreClosed && (
        <div
          onClick={onOpenClosedNotice}
          className="cursor-pointer bg-[#FFD700] text-[#111111] border-2 border-[#111111] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-3.5">
            <span className="text-3xl">🪧</span>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                Dapur Sedang Libur Goreng
              </div>
              <p className="font-hand font-bold text-[22px] sm:text-[24px] leading-tight text-[#111111]">
                {storeConfig.closedReason || 'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya.'}
              </p>
            </div>
          </div>
          <span className="font-sans text-xs font-bold underline bg-white border border-[#111111] px-3 py-1.5 rounded-full shadow-sm shrink-0 text-center">
            Buka Pengumuman 📖
          </span>
        </div>
      )}

      {/* HERO SECTION - Brand Book Locked */}
      <section className="mt-6 lg:mt-14 relative">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-12 items-start">
          {/* Left Column: Big Black Card */}
          <div className="relative">
            <div className="bg-[#111111] text-[#FFF8E7] rounded-[28px] p-7 lg:p-10 pb-10 lg:pb-28 rotate-[-1.2deg] polaroid-shadow border-2 border-[#111111] relative overflow-hidden">
              {/* Hot Pill */}
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase font-sans mb-6 rotate-[1deg] border border-[#111111]">
                <span className="w-1.5 h-1.5 bg-[#111111] rounded-full animate-pulse" />
                {LOCKED_COPY.pillHot}
              </div>

              {/* Locked H1 Headline */}
              <h1 className="leading-[0.95] tracking-tight">
                <span className="font-hand font-bold text-[44px] lg:text-[64px] block text-white">
                  Sudah makan?
                </span>
                <span className="font-sans font-bold text-[28px] lg:text-[40px] leading-[1.08] block mt-2 text-[#FFF8E7]">
                  Jangan biarkan
                  <br />
                  tubuhmu kelaparan
                </span>
              </h1>

              {/* Best Seller Sub-badge */}
              <div className="mt-6 flex items-start gap-3">
                <div className="bg-[#FFD700] text-[#111111] px-4 py-2 rounded-[14px] rotate-[-1deg] font-hand font-bold text-[22px] leading-none border border-[#111111]">
                  RISOLES MAYO LUMER
                </div>
                <div className="font-hand text-[#FFF8E7]/70 text-[15px] leading-tight pt-1 whitespace-pre-line">
                  {storeConfig.heroHeadlineSub || 'digoreng jam 10 pagi\nhabis jam 8 malem'}
                </div>
              </div>

              {/* Paragraph with safe max-width so it never collides with sticky note */}
              <p className="font-sans text-[14px] leading-[1.6] text-[#FFF8E7]/80 mt-6 max-w-full sm:max-w-[340px] xl:max-w-[390px]">
                {LOCKED_COPY.heroSub}
              </p>

              {/* Decorative Pills */}
              <div className="mt-6 flex gap-2">
                <div className="h-[3px] w-12 bg-[#FFD700] rounded-full" />
                <div className="h-[3px] w-6 bg-[#FFF8E7]/30 rounded-full" />
                <div className="h-[3px] w-6 bg-[#FFF8E7]/20 rounded-full" />
              </div>
            </div>

            {/* Floating Sticky Note: "tunggu agak dingin dulu..." */}
            <div className="relative lg:absolute lg:-bottom-8 lg:-right-4 xl:-right-6 mt-4 lg:mt-0 z-20 flex justify-start lg:justify-end">
              <div className="relative bg-white rounded-[16px] p-5 w-full sm:w-[310px] rotate-[1.5deg] polaroid-shadow border-2 border-[#111111]">

                {/* Yellow Tape */}
                <div className="tape absolute -top-3 left-1/2 -translate-x-1/2 w-[88px] h-[22px] rotate-[-3deg] rounded-[2px] border border-[#111111]/20" />

                <div className="font-hand text-[19px] leading-[1.3] text-[#111111]">
                  <div className="text-[#5C3D2E] font-bold">ps: makannya jangan buru-buru ya</div>
                  <div className="mt-1 font-bold text-[#111111]">
                    {LOCKED_COPY.psWajib}
                  </div>
                  <div className="mt-3 text-[12px] text-[#5C3D2E]/60 font-sans">
                    — dari dapur Dulang ♡
                  </div>
                </div>

                <div className="absolute -bottom-1 -right-2 w-10 h-3 bg-[#FFD700]/70 rotate-[18deg] border border-[#111111]/10" />
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Frame + Callout */}
          <div className="relative lg:pt-2">
            <div className="relative rounded-[28px] bg-white p-4 rotate-[1deg] polaroid-shadow border-2 border-[#111111]">
              <div className="rounded-[20px] overflow-hidden bg-[#FFEEC2] aspect-[4/3] relative grid place-items-center border border-[#111111]/10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#FFF8E7_0%,#FFE6A0_45%,#FFD36B_100%)]" />

                {storeConfig.heroImage && storeConfig.heroImage !== '/dulang-logo.png' ? (
                  <img
                    src={storeConfig.heroImage}
                    alt="Foto Utama Dulang"
                    className="w-full h-full object-cover relative z-10"
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-[124px] h-[124px] bg-[#111111] rounded-full grid place-items-center rotate-[-6deg] shadow-lg border-2 border-[#111111]">
                      <img
                        src="/dulang-logo.png"
                        alt="risoles"
                        className="w-[90px] h-[90px] object-contain"
                      />
                    </div>
                    <div className="mt-4 bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-full font-hand font-bold text-[17px] text-[#111111] rotate-[-2deg] border border-[#111111] shadow-sm">
                      angetnya masih ngebul ☁️
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-4 font-hand font-bold text-[13px] text-[#5C3D2E] bg-white/90 px-2.5 py-0.5 rounded-full rotate-[-4deg] z-20 border border-[#111111]/10 shadow-sm">
                  wajan panas 180° • minyak selalu baru
                </div>
              </div>

              <div className="pt-3 px-2 flex justify-between items-center font-sans text-[11px] text-[#5C3D2E]/70 font-semibold">
                <span>Dapur Dulang Sidoarjo</span>
                <span className="font-bold text-[#111111]">Sejak 2020</span>
              </div>
            </div>

            {/* Side Callout Note - Repositioned to top-left corner so it NEVER covers the hero photo */}
            <div className="mt-5 lg:mt-0 lg:absolute lg:-top-14 lg:-left-8 xl:-left-12 relative z-30 pointer-events-none sm:pointer-events-auto">
              <div className="relative bg-[#FFD700] border-2 border-[#111111] rounded-[16px] px-4 py-3 rotate-[-3deg] shadow-[4px_4px_0_#111111] max-w-[215px]">
                {/* Cute masking tape accent */}
                <div className="tape absolute -top-2.5 left-6 w-[52px] h-[14px] bg-white/70 rotate-[-5deg] rounded-[1px] border border-[#111111]/20 z-10" />

                <div className="font-hand font-bold text-[18px] leading-[1.2] text-[#111111]">
                  ini beneran lumer ↳
                  <br />
                  bisa nglelehin hati
                  <br />
                  yang kacau
                </div>
                <div className="mt-1 font-sans text-[10px] font-bold uppercase tracking-widest text-[#111111]">
                  jangan kaget kalo netes 😋
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCHEDULE & ROUTINE SECTION */}
      <section className="mt-20 lg:mt-24">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-hand font-bold text-[36px] lg:text-[46px] leading-none text-[#111111]">
            tempat ngumpul, bukan cuma jualan
          </h2>
          <span className="font-sans text-[12px] px-3.5 py-1 rounded-full bg-white border border-[#111111]/15 font-semibold text-[#5C3D2E]">
            sejak 2020 • {storeConfig.jamBukaTeks || 'masih pake wajan yang sama'}
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(storeConfig.schedules && storeConfig.schedules.length > 0
            ? storeConfig.schedules
            : DEFAULT_STORE_CONFIG.schedules
          ).map((item, idx) => {
            const rot = item.rot || ['-1.2deg', '1.2deg', '-0.8deg', '1deg'][idx % 4];
            return (
              <div
                key={idx}
                className="bg-white rounded-[20px] p-5 polaroid-shadow border-2 border-[#111111]/10"
                style={{ transform: `rotate(${rot})` }}
              >
                <div className="inline-flex bg-[#111111] text-[#FFD700] px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-widest border border-[#111111]">
                  {item.jam}
                </div>
                <p className="mt-3.5 font-sans text-[13px] leading-[1.6] text-[#5C3D2E]">
                  {item.teks}
                </p>
                <div className="mt-4 h-[2px] w-10 bg-[#FFD700] rounded-full" />
              </div>
            );
          })}
        </div>
      </section>

      {/* MENU CATALOG SECTION (3a: Hari Ini vs Menu Besok) */}
      <section id="menu-section" className="mt-20 space-y-6">
        {/* Tab Switcher & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-[#111111]/15 pb-5">
          <div>
            {/* Active Tab Switcher */}
            <div className="inline-flex p-1.5 bg-white border-2 border-[#111111] rounded-full shadow-[3px_3px_0_#111111] gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setMenuTab('today')}
                className={`cursor-pointer px-4 sm:px-5 py-2 rounded-full font-sans font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                  menuTab === 'today'
                    ? 'bg-[#111111] text-[#FFD700] shadow-sm'
                    : 'text-[#111111]/70 hover:text-[#111111]'
                }`}
              >
                <span>🍳</span>
                <span>Kloter Hari Ini</span>
              </button>

              <button
                type="button"
                onClick={() => setMenuTab('tomorrow')}
                className={`cursor-pointer px-4 sm:px-5 py-2 rounded-full font-sans font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                  menuTab === 'tomorrow'
                    ? 'bg-[#FFD700] text-[#111111] border border-[#111111] shadow-sm'
                    : 'text-[#111111]/70 hover:text-[#111111]'
                }`}
              >
                <span>📅</span>
                <span>Menu Besok (Pre-Order)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="font-hand font-bold text-[36px] sm:text-[46px] leading-none text-[#111111]">
                {menuTab === 'today' ? 'Menu Kloter Hari Ini' : 'Booking Menu Besok Subuh'}
              </h2>
            </div>
            <p className="font-sans text-[13px] text-[#5C3D2E]/80 mt-1">
              {menuTab === 'today'
                ? 'Semua digoreng fresh dadakan di wajan panas. Klik + Masukin Dulang untuk pesan.'
                : 'Pesan sekarang agar Tim Dulang siapkan porsi fresh khusus buatmu besok!'}
            </p>
          </div>

          {/* Today's Kloter Status / Right Badge */}
          {menuTab === 'today' ? (
            <div className="inline-flex items-center gap-2 bg-[#111111] text-[#FFD700] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_#FFD700] self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              <span>{storeConfig.activeKloter || 'Kloter Siang (13.00) • Sedang Digoreng Panas 🔥'}</span>
            </div>
          ) : (
            <div className="font-hand font-bold text-[18px] text-emerald-800 rotate-[1deg] self-start md:self-auto">
              ✨ Dijamin kebagian kloter besok!
            </div>
          )}
        </div>

        {/* Tomorrow Pre-Order Info Banner */}
        {menuTab === 'tomorrow' && (
          <div className="bg-[#FFD700] text-[#111111] border-2 border-[#111111] rounded-[24px] p-5 sm:p-6 shadow-[4px_4px_0_#111111] space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-3 py-1 rounded-full text-[11px] font-sans font-bold uppercase tracking-wider">
                <span>📅</span> Slot Pre-Order Dapur Dulang
              </div>
              <span className="font-hand font-bold text-base sm:text-lg text-[#111111]">
                *Batas booking malam ini jam 21.00 ya!
              </span>
            </div>

            <h3 className="font-hand font-bold text-2xl sm:text-3xl text-[#111111] leading-tight">
              Anti Kehabisan! Amankan Kuota Risoles Gorengan Besok 🥟
            </h3>

            <p className="font-sans text-xs sm:text-sm text-[#111111]/85 max-w-2xl leading-relaxed">
              {storeConfig.tomorrowOrderNote ||
                'Pesan sekarang agar Tim Dulang bisa siapkan bahan dan gulung risoles segar khusus untukmu besok subuh. Gorengan tiba di mejamu pas masih anget-angetnya!'}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 font-sans text-xs font-bold">
              <span className="text-[#5C3D2E]">Pilihan Jam Kirim Besok:</span>
              <span className="bg-white px-3 py-1 rounded-full border border-[#111111] shadow-xs">
                ⏰ Slot Pagi (10.00)
              </span>
              <span className="bg-white px-3 py-1 rounded-full border border-[#111111] shadow-xs">
                ⏰ Slot Siang (13.00)
              </span>
              <span className="bg-white px-3 py-1 rounded-full border border-[#111111] shadow-xs">
                ⏰ Slot Sore (16.00)
              </span>
            </div>
          </div>
        )}

        {/* Menu Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 pt-2">
          {(menuTab === 'today'
            ? menus
            : menus.filter((m) => m.tersediaBesok !== false)
          ).map((item, idx) => (
            <PolaroidMenuCard
              key={item.id}
              item={item}
              index={idx}
              onAddToCart={onAddToCart}
              cartQty={getCartQty(item.id)}
              isTomorrow={menuTab === 'tomorrow'}
            />
          ))}
        </div>
      </section>

      {/* PAKET SNACK BOX / HAJATAN / ARISAN BUILDER SECTION (Opsi A - Accordion Collapsible) */}
      <section id="snack-box-builder" className="mt-14 lg:mt-20">
        <div className="bg-[#FFFDF4] rounded-[28px] border-2 sm:border-3 border-[#111111] polaroid-shadow relative overflow-hidden transition-all duration-300">
          {/* Decorative masking tape top-right */}
          <div className="tape absolute -top-3.5 right-12 w-32 h-5 bg-[#FFD700] rotate-[3deg] border border-[#111111]/20 shadow-xs pointer-events-none" />

          {/* Accordion Toggle Header Banner */}
          <button
            type="button"
            onClick={() => setIsSnackBoxOpen(!isSnackBoxOpen)}
            className="w-full text-left p-5 sm:p-7 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-[#FFF8E7]/60 transition-colors"
            aria-expanded={isSnackBoxOpen}
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3.5 py-1 rounded-full text-xs font-sans font-bold uppercase tracking-wider border border-[#111111] mb-2.5">
                <span>📦</span>
                <span>Spesial Hajatan, Tahlilan & Arisan Sidoarjo</span>
              </div>
              <h2 className="font-hand font-bold text-[30px] sm:text-[42px] leading-[1.05] text-[#111111]">
                Rancang Paket Snack Box Sendiri
              </h2>
              <p className="font-sans text-xs sm:text-sm text-[#5C3D2E]/85 mt-2 leading-relaxed">
                Bebas pilih isian kue favorit, kemasan dus higienis & rapi, gratis stiker nama acara, digoreng mendadak subuh pas hari H. Klik untuk buka kalkulator paket dus.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
              <span className={`font-sans font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-full border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition-all flex items-center gap-1.5 ${
                isSnackBoxOpen
                  ? 'bg-[#111111] text-[#FFD700]'
                  : 'bg-[#FFD700] text-[#111111] hover:brightness-105'
              }`}>
                <span>{isSnackBoxOpen ? 'Tutup Kalkulator Box ▲' : 'Buka Kalkulator Box ▼'}</span>
              </span>
            </div>
          </button>

          {/* Builder Interactive Area (Hanya muncul saat dibuka) */}
          {isSnackBoxOpen && (
            <div className="px-5 pb-7 sm:px-8 sm:pb-9 lg:px-10 lg:pb-10 pt-2 border-t-2 border-[#111111]/15 animate-in fade-in duration-200">
              <div className="mt-4 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-10 items-start">
                {/* Left Column: Form & Configuration */}
                <div className="space-y-6">
              {/* Step 1: Pilih Tipe Box */}
              <div>
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#5C3D2E] block mb-2">
                  1. Pilih Ukuran Dus (Kapasitas Kue)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      type: 'mini_2' as SnackBoxType,
                      name: 'Box Mini (2 Pcs)',
                      price: 'Rp 8.000 / box',
                      desc: 'Porsi santai / rapat kilat',
                    },
                    {
                      type: 'standar_3' as SnackBoxType,
                      name: 'Box Standar (3 Pcs)',
                      price: 'Rp 11.000 / box',
                      desc: 'Paling laris buat pengajian & arisan',
                      recommended: true,
                    },
                    {
                      type: 'lengkap_4' as SnackBoxType,
                      name: 'Box Lengkap (4 Pcs)',
                      price: 'Rp 14.000 / box',
                      desc: 'Mewah hajatan besar & syukuran',
                    },
                  ].map((b) => (
                    <button
                      key={b.type}
                      type="button"
                      onClick={() => handleSbTypeChange(b.type)}
                      className={`cursor-pointer p-4 rounded-[18px] text-left border-2 transition-all relative ${
                        sbType === b.type
                          ? 'bg-[#111111] text-[#FFF8E7] border-[#111111] shadow-[3px_3px_0_#FFD700]'
                          : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                      }`}
                    >
                      {b.recommended && (
                        <span className="absolute -top-2.5 right-3 bg-[#FFD700] text-[#111111] text-[9px] font-sans font-extrabold uppercase px-2 py-0.5 rounded-full border border-[#111111] shadow-xs">
                          ⭐ Favorit
                        </span>
                      )}
                      <div className="font-hand font-bold text-xl sm:text-2xl leading-none">
                        {b.name}
                      </div>
                      <div
                        className={`font-sans font-bold text-xs mt-1 ${
                          sbType === b.type ? 'text-[#FFD700]' : 'text-[#5C3D2E]'
                        }`}
                      >
                        {b.price}
                      </div>
                      <div
                        className={`text-[11px] mt-1 line-clamp-1 ${
                          sbType === b.type ? 'text-[#FFF8E7]/70' : 'text-[#5C3D2E]/70'
                        }`}
                      >
                        {b.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Pilih Isian Kue */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#5C3D2E] block">
                    2. Pilih {sbCapacity} Macam Isian Kue
                  </label>
                  <span className="font-sans text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Terpilih: {sbSelectedItems.length} dari {sbCapacity} jenis
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    'Risoles Mayo Lumer',
                    'Risoles Rogout Ayam',
                    'Sosis Solo Ayam Gurih',
                    'Pastel Sayur Telur',
                    'Kue Lumpur Tradisional',
                    'Lemper Ayam Bakar',
                  ].map((item) => {
                    const isSelected = sbSelectedItems.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleSbItem(item)}
                        className={`cursor-pointer px-3 py-2.5 rounded-[14px] text-xs font-sans font-bold text-left border-2 transition flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-[#FFD700] text-[#111111] border-[#111111] shadow-[2px_2px_0_#111111]'
                            : 'bg-white text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                        }`}
                      >
                        <span className="truncate">{item}</span>
                        <span className="text-sm shrink-0">{isSelected ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Pilihan Minuman */}
              <div>
                <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#5C3D2E] block mb-2">
                  3. Minuman Tambahan (Opsional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'none' as SnackBoxDrink, name: 'Tanpa Minuman', add: '+Rp 0' },
                    { id: 'mineral' as SnackBoxDrink, name: 'Air Mineral Gelas 🧊', add: '+Rp 1.000 / box' },
                    { id: 'teh' as SnackBoxDrink, name: 'Teh Kotak Segar 🧃', add: '+Rp 3.500 / box' },
                  ].map((dr) => (
                    <button
                      key={dr.id}
                      type="button"
                      onClick={() => setSbDrink(dr.id)}
                      className={`cursor-pointer p-3 rounded-[14px] text-left border-2 transition ${
                        sbDrink === dr.id
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                          : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                      }`}
                    >
                      <div className="font-sans font-bold text-xs">{dr.name}</div>
                      <div
                        className={`text-[10px] ${
                          sbDrink === dr.id ? 'text-[#FFD700]/90' : 'text-[#5C3D2E]/70'
                        }`}
                      >
                        {dr.add}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Jumlah Box & Tier Diskon */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-sans font-bold text-xs uppercase tracking-wider text-[#5C3D2E] block">
                    4. Jumlah Pesanan (Box)
                  </label>
                  <span className="font-hand font-bold text-2xl text-[#111111]">
                    {sbQty} Box
                  </span>
                </div>

                {/* Quick Pick Buttons */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[0, 20, 30, 50, 75, 100, 150].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSbQty(num)}
                      className={`cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-sans font-bold border-2 transition ${
                        sbQty === num
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                          : 'bg-white text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                      }`}
                    >
                      {num === 0 ? 'Reset (0 Box)' : `${num} Box`}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="5"
                  value={sbQty}
                  onChange={(e) => setSbQty(Number(e.target.value))}
                  className="w-full accent-[#111111] cursor-pointer"
                />

                {/* Tier Discount Badges */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className={`p-2.5 rounded-[12px] border text-center transition ${
                      sbQty >= 30 && sbQty < 50
                        ? 'bg-[#FFD700] border-[#111111] font-bold text-[#111111] shadow-xs'
                        : 'bg-white/80 border-[#111111]/15 text-[#5C3D2E]/70 text-xs'
                    }`}
                  >
                    <div className="font-bold text-xs">≥ 30 Box</div>
                    <div className="text-[11px]">Diskon 5% Otomatis</div>
                  </div>

                  <div
                    className={`p-2.5 rounded-[12px] border text-center transition ${
                      sbQty >= 50 && sbQty < 100
                        ? 'bg-[#FFD700] border-[#111111] font-bold text-[#111111] shadow-xs'
                        : 'bg-white/80 border-[#111111]/15 text-[#5C3D2E]/70 text-xs'
                    }`}
                  >
                    <div className="font-bold text-xs">≥ 50 Box</div>
                    <div className="text-[11px]">Diskon 10% + 2 Box Gratis</div>
                  </div>

                  <div
                    className={`p-2.5 rounded-[12px] border text-center transition ${
                      sbQty >= 100
                        ? 'bg-[#FFD700] border-[#111111] font-bold text-[#111111] shadow-xs'
                        : 'bg-white/80 border-[#111111]/15 text-[#5C3D2E]/70 text-xs'
                    }`}
                  >
                    <div className="font-bold text-xs">≥ 100 Box</div>
                    <div className="text-[11px]">Diskon 15% + 5 Box + Stiker Custom</div>
                  </div>
                </div>
              </div>

              {/* Step 5: Detail Acara & Stiker Custom */}
              <div className="p-4 bg-white rounded-[20px] border-2 border-[#111111]/20 space-y-3">
                <div className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span>Detail Acara & Personalisasi Stiker Tutup Dus</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-sans text-[11px] font-bold text-[#5C3D2E] block mb-1">
                      Tanggal Acara Hari H:
                    </label>
                    <input
                      type="date"
                      value={sbEventDate}
                      onChange={(e) => setSbEventDate(e.target.value)}
                      className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-[12px] px-3 py-2 text-xs font-sans font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-sans text-[11px] font-bold text-[#5C3D2E] block mb-1">
                      Jam Kirim / Tiba:
                    </label>
                    <input
                      type="time"
                      value={sbEventTime}
                      onChange={(e) => setSbEventTime(e.target.value)}
                      className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-[12px] px-3 py-2 text-xs font-sans font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-sans text-[11px] font-bold text-[#5C3D2E] block mb-1">
                    Tulisan Stiker Tutup Dus (Gratis untuk pesanan Hajatan):
                  </label>
                  <input
                    type="text"
                    value={sbCustomLabel}
                    onChange={(e) => setSbCustomLabel(e.target.value)}
                    placeholder="Contoh: Syukuran Khitanan Ananda Rayyan / Arisan RT 04"
                    className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-[12px] px-3 py-2 text-xs font-sans placeholder:text-[#5C3D2E]/40"
                  />
                </div>

                <div>
                  <label className="font-sans text-[11px] font-bold text-[#5C3D2E] block mb-1">
                    Catatan Tambahan (Misal: cabe rawit dipisah, kirim hangat):
                  </label>
                  <input
                    type="text"
                    value={sbNotes}
                    onChange={(e) => setSbNotes(e.target.value)}
                    placeholder="Catatan untuk tim dapur..."
                    className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-[12px] px-3 py-2 text-xs font-sans placeholder:text-[#5C3D2E]/40"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Live Price Summary & Order Action */}
            <div className="sticky top-6">
              <div className="bg-[#111111] text-[#FFF8E7] rounded-[24px] p-6 border-2 border-[#111111] shadow-[6px_6px_0_#FFD700] space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/15">
                  <div className="font-hand font-bold text-2xl text-[#FFD700]">
                    Kalkulator Snack Box
                  </div>
                  <span className="font-sans text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full text-white/80">
                    Live Hitung
                  </span>
                </div>

                {/* Summary Items */}
                <div className="space-y-2.5 font-sans text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/70">Tipe Paket:</span>
                    <span className="font-bold text-white capitalize">
                      {sbType === 'mini_2' ? 'Box Mini (2 Pcs)' : sbType === 'standar_3' ? 'Box Standar (3 Pcs)' : 'Box Lengkap (4 Pcs)'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-white/70">Isian Dus ({sbSelectedItems.length}):</span>
                    <span className="font-semibold text-right max-w-[180px] text-white/90 truncate">
                      {sbSelectedItems.join(', ')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-white/70">Minuman:</span>
                    <span className="font-semibold text-white">
                      {sbDrink === 'mineral' ? 'Air Mineral Gelas' : sbDrink === 'teh' ? 'Teh Kotak Segar' : 'Tanpa Minuman'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-white/70">Harga Dasar Dus:</span>
                    <span className="font-semibold text-white">
                      Rp {sbPricePerBox.toLocaleString('id-ID')} / box
                    </span>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-white/10">
                    <span className="text-white/70">Jumlah Pesanan:</span>
                    <span className="font-bold text-[#FFD700]">
                      {sbQty} Box
                    </span>
                  </div>

                  {sbBonusBoxes > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-[8px]">
                      <span>🎁 Bonus Box Tambahan:</span>
                      <span>+{sbBonusBoxes} Box Gratis!</span>
                    </div>
                  )}

                  {sbFreeSticker && (
                    <div className="flex justify-between text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-[8px]">
                      <span>🏷️ Desain Stiker Acara:</span>
                      <span>Gratis 100% ✓</span>
                    </div>
                  )}

                  <div className="flex justify-between text-white/80 pt-1">
                    <span>Subtotal Normal:</span>
                    <span>Rp {sbGrossTotal.toLocaleString('id-ID')}</span>
                  </div>

                  {sbDiscountNominal > 0 && (
                    <div className="flex justify-between text-red-400 font-bold">
                      <span>Potongan Diskon ({sbDiscountPercent}%):</span>
                      <span>-Rp {sbDiscountNominal.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>

                {/* Final Total Box Received & Price */}
                <div className="pt-4 border-t-2 border-white/20">
                  <div className="text-[11px] text-white/60 font-sans uppercase tracking-wider">
                    Total Dus Siap Terima:
                  </div>
                  <div className="font-hand font-bold text-2xl text-white">
                    {sbTotalBoxesReceived} Box Siap Kirim
                  </div>

                  <div className="mt-2 text-[11px] text-white/60 font-sans uppercase tracking-wider">
                    Total Biaya Akhir:
                  </div>
                  <div className="font-hand font-bold text-[36px] leading-tight text-[#FFD700]">
                    Rp {sbFinalPrice.toLocaleString('id-ID')}
                  </div>
                  <div className="font-sans text-[11px] text-white/60">
                    Rata-rata: {sbTotalBoxesReceived > 0 ? `Rp ${Math.round(sbFinalPrice / sbTotalBoxesReceived).toLocaleString('id-ID')} / box` : 'Rp 0 / box'}
                  </div>
                </div>

                {sbQty === 0 && (
                  <div className="p-3 bg-white/10 border border-[#FFD700]/40 rounded-[14px] text-[#FFD700] text-xs font-sans text-center">
                    💡 Pilih jumlah box di atas untuk mulai menghitung biaya & bonus!
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleOrderSnackBoxWA}
                    className="w-full cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] font-sans font-bold py-3.5 px-4 rounded-full border-2 border-[#111111] shadow-[3px_3px_0_#FFFFFF] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 text-sm transition"
                  >
                    <span>📱</span>
                    <span>Pesan Snack Box via WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (sbQty <= 0) {
                        alert('Silakan pilih jumlah pesanan box terlebih dahulu (misal: 20 atau 30 box).');
                        return;
                      }
                      const boxTitle =
                        sbType === 'mini_2' ? 'Mini (2 Pcs)' : sbType === 'standar_3' ? 'Standar (3 Pcs)' : 'Lengkap (4 Pcs)';
                      onAddToCart(
                        {
                          id: `snack_box_${sbType}_${Date.now()}`,
                          nama: `Paket Snack Box ${boxTitle} (${sbQty} Box)`,
                          harga: sbFinalPrice,
                          deskripsi: `Isian: ${sbSelectedItems.join(', ')}. Acara: ${sbEventDate} jam ${sbEventTime} WIB. Stiker: ${sbCustomLabel || 'Standar'}.`,
                          tersedia: true,
                        },
                        `${sbQty} Box (${sbSelectedItems.length} macam)`
                      );
                    }}
                    className="w-full cursor-pointer bg-white/10 hover:bg-white/20 text-white font-sans font-bold py-2.5 px-4 rounded-full border border-white/20 text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <span>🥟</span>
                    <span>+ Masukkan ke Keranjang Dulang</span>
                  </button>
                </div>

                {sbOrderSentSuccess && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-400 rounded-[14px] text-emerald-300 text-xs font-sans text-center animate-in fade-in">
                    ✓ Pesanan snack box berhasil dialihkan ke WhatsApp & tercatat di sistem dapur!
                  </div>
                )}
              </div>
            </div>
          </div>
            </div>
          )}
        </div>
      </section>

      {/* PENDAPAT & CERITA SOBAT DULANG (COLLAPSIBLE / ACCORDION) */}
      {testimonials.length > 0 && (
        <section className="mt-12 lg:mt-16">
          <div className="bg-white rounded-[24px] p-5 sm:p-7 border-2 border-[#111111] polaroid-shadow rotate-[0.3deg]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#FFD700] text-[#111111] grid place-items-center text-2xl border-2 border-[#111111] shadow-[2px_2px_0_#111111] shrink-0">
                  💬
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1 font-sans">
                    <span>⭐️ Ulasan Sobat Dulang</span>
                  </div>
                  <h3 className="font-hand font-bold text-[24px] sm:text-[30px] leading-tight text-[#111111]">
                    Apa Kata Sobat Dapur Dulang?
                  </h3>
                  <p className="font-sans text-xs text-[#5C3D2E]/80">
                    Cerita hangat dari tetangga Sidoarjo & Surabaya yang sering jajan di sini.
                  </p>
                </div>
              </div>

              {/* Toggle Button (Hide by default, click to show) */}
              <button
                type="button"
                onClick={() => setIsTestimonialsOpen(!isTestimonialsOpen)}
                className="cursor-pointer bg-[#FFD700] text-[#111111] hover:bg-[#FFE033] border-2 border-[#111111] px-5 py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm transition-all shadow-[3px_3px_0_#111111] active:translate-x-0.5 active:translate-y-0.5 shrink-0 flex items-center justify-center gap-2 self-start sm:self-center"
              >
                <span>{isTestimonialsOpen ? 'Sembunyikan Cerita ▴' : `Buka ${testimonials.length} Cerita Sobat ▾`}</span>
              </button>
            </div>

            {/* Expandable Content Area */}
            {isTestimonialsOpen && (
              <div className="mt-6 pt-6 border-t-2 border-[#111111]/10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                {testimonials.map((t, idx) => {
                  const rot = ['-1deg', '1deg', '-0.5deg', '0.8deg'][idx % 4];
                  return (
                    <div
                      key={t.id}
                      className="bg-[#FFFDF4] rounded-[18px] p-4 border-2 border-[#111111] shadow-[2px_2px_0_#111111] relative flex flex-col justify-between"
                      style={{ transform: `rotate(${rot})` }}
                    >
                      {/* Masking tape on top */}
                      <div className="tape absolute -top-2.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-[#FFD700]/80 rounded-[1px] border border-[#111111]/20" />

                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex text-amber-500 text-xs">
                            {Array.from({ length: t.rating || 5 }).map((_, i) => (
                              <span key={i}>★</span>
                            ))}
                          </div>
                          {t.favorite_menu && (
                            <span className="bg-white border border-[#111111]/20 text-[10px] font-bold px-2 py-0.5 rounded-full text-[#5C3D2E]">
                              🥟 {t.favorite_menu}
                            </span>
                          )}
                        </div>
                        <p className="font-hand text-[17px] leading-snug text-[#111111]">
                          "{t.comment}"
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#111111]/10 flex items-center justify-between font-sans text-[11px]">
                        <div>
                          <span className="font-bold text-[#111111] block">{t.customer_name}</span>
                          <span className="text-[#5C3D2E]/70">{t.area}</span>
                        </div>
                        <span className="text-[10px] text-[#5C3D2E]/50">
                          {new Date(t.created_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SMART QR DUS & REPEAT ORDER INFO */}
      <section className="mt-20 lg:mt-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
        {/* Left Explanation Box */}
        <div className="bg-white rounded-[24px] p-7 lg:p-9 polaroid-shadow border-2 border-[#111111]/10 rotate-[-0.5deg]">
          <h3 className="font-hand font-bold text-[34px] leading-none text-[#111111]">
            mau pesen? langsung chat aja
          </h3>
          <p className="font-sans text-[13px] text-[#5C3D2E]/80 mt-2">
            kita bales cepet kok, kecuali lagi goreng di wajan — tangan berminyak.
          </p>

          <div className="mt-6 space-y-4 font-sans text-[14px]">
            <div className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-[#111111] text-[#FFD700] grid place-items-center text-[12px] font-bold border border-[#111111]">
                IG
              </span>
              <div>
                <div className="font-bold text-[#111111]">Instagram Resmi</div>
                <a
                  href={`https://instagram.com/${BRAND.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5C3D2E] underline decoration-[#FFD700] decoration-2 underline-offset-4 hover:text-[#111111] font-semibold"
                >
                  @{BRAND.instagram}
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-[#FFD700] text-[#111111] grid place-items-center text-[12px] font-bold border border-[#111111]">
                WA
              </span>
              <div>
                <div className="font-bold text-[#111111]">WhatsApp Pemesanan</div>
                <a
                  href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(LOCKED_COPY.waCheckout)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold tracking-wide text-[#111111] hover:text-[#5C3D2E]"
                >
                  {BRAND.displayWhatsapp}
                </a>
                <div className="text-[12px] text-[#5C3D2E]/60 mt-0.5">
                  chat aja: “masih anget gak min?”
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="w-8 h-8 rounded-full bg-white border border-[#111111]/20 grid place-items-center text-sm shadow-sm">
                📍
              </span>
              <div>
                <div className="font-bold text-[#111111]">Alamat Dapur</div>
                <div className="text-[#5C3D2E] text-[13px] leading-relaxed">
                  {BRAND.locationDetail}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-[16px] bg-[#FFF3C7] border border-[#FFD700] font-hand font-bold text-[18px] text-[#111111]">
            ⏰ Jam buka: {BRAND.operatingHours}
          </div>
        </div>

        {/* Right Cute QR Card Spec */}
        <CuteQRCard
          qrId="DULANG-042"
          onScanClick={(id) => onNavigateToScan(id)}
        />
      </section>

      {/* FOOTER */}
      <footer className="mt-20 pt-8 border-t-2 border-[#111111]/10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center font-sans text-[12px] text-[#5C3D2E]/70">
        <div>
          {LOCKED_COPY.footer}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-[#111111] text-[#FFF8E7] text-[11px] font-bold tracking-wider uppercase font-sans">
            {LOCKED_COPY.badgeSince}
          </span>
          <span className="px-3 py-1 rounded-full bg-[#FFD700] text-[#111111] text-[11px] font-bold tracking-wider uppercase font-sans border border-[#111111]">
            {LOCKED_COPY.pillHot}
          </span>
          {/* Pintu Masuk Rahasia Dapur (Opsi A) */}
          {onOpenOwnerLogin && (
            <button
              type="button"
              onClick={onOpenOwnerLogin}
              className="cursor-pointer ml-1 p-1 text-[#5C3D2E]/35 hover:text-[#111111] hover:bg-[#111111]/5 rounded transition-all flex items-center gap-1 text-[11px] font-mono select-none"
              title="Akses Pengelola Dapur Dulang"
            >
              <span>🔒</span>
              <span className="hidden sm:inline text-[10px]">Dapur</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
