import React, { useState, useEffect } from 'react';
import { MenuItem, StoreConfig, CustomerTestimonial, Customer, SnackBoxType, SnackBoxDrink } from '../types';
import { BRAND, LOCKED_COPY, DEFAULT_STORE_CONFIG, checkStoreOpenStatus } from '../lib/constants';
import { PolaroidMenuCard } from '../components/common/PolaroidMenuCard';
import { CuteQRCard } from '../components/common/CuteQRCard';
import { MixMatchBoxModal } from '../components/common/MixMatchBoxModal';
import { storageService } from '../services/storageService';

export type MenuCategory = 'all' | 'risol' | 'gorengan' | 'manis' | 'frozen';

export const MENU_CATEGORIES: { id: MenuCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'Semua Menu', icon: '✨' },
  { id: 'risol', label: 'Risoles Favorit', icon: '🔥' },
  { id: 'gorengan', label: 'Gorengan Gurih', icon: '🥟' },
  { id: 'manis', label: 'Manis & Roti', icon: '🍌' },
  { id: 'frozen', label: 'Frozen Pack', icon: '❄️' },
];

interface LandingViewProps {
  menus: MenuItem[];
  storeConfig?: StoreConfig;
  onAddToCart: (item: MenuItem, pilihanOpsi?: string, variantType?: 'matang' | 'frozen', qty?: number) => void;
  getCartQty: (itemId: string) => number;
  onNavigateToScan: (qrId: string) => void;
  onOpenOwnerLogin?: () => void;
  onOpenClosedNotice?: () => void;
  onShowToast?: (msg: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  menus,
  storeConfig = DEFAULT_STORE_CONFIG,
  onAddToCart,
  getCartQty,
  onNavigateToScan,
  onOpenOwnerLogin,
  onOpenClosedNotice,
  onShowToast,
}) => {
  const [menuTab, setMenuTab] = useState<'today' | 'tomorrow'>('today');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>('all');
  const [servingFilter, setServingFilter] = useState<'all' | 'matang' | 'frozen'>('all');
  const [isTestimonialsOpen, setIsTestimonialsOpen] = useState(false);
  const [isMixMatchOpen, setIsMixMatchOpen] = useState(false);
  const [lastCart, setLastCart] = useState<any[] | null>(() => {
    try {
      const data = localStorage.getItem('dulang_last_cart');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });

  // --- HERO SLIDESHOW STATE ---
  const heroPhotoList: string[] = React.useMemo(() => {
    const list: string[] = [];
    if (storeConfig.heroImages && storeConfig.heroImages.length > 0) {
      list.push(...storeConfig.heroImages.filter(Boolean));
    } else if (storeConfig.heroImage && storeConfig.heroImage !== '/dulang-logo.png') {
      list.push(storeConfig.heroImage);
    }
    return list;
  }, [storeConfig.heroImages, storeConfig.heroImage]);

  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  useEffect(() => {
    if (heroPhotoList.length <= 1 || isHeroHovered) return;
    const timer = setInterval(() => {
      setActiveHeroIdx((prev) => (prev + 1) % heroPhotoList.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [heroPhotoList.length, isHeroHovered]);

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

  // Operating Hours Status (Real-time)
  const openStatus = checkStoreOpenStatus(storeConfig);

  // --- PAKET SNACK BOX / HAJATAN / ARISAN BUILDER STATE ---
  const minSnackBoxOrder = storeConfig.snackBoxMinOrder || 10;
  const minEventDateStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // minimal H-1
    return d.toISOString().split('T')[0];
  }, []);

  const DULANG_SNACK_BOX_ITEMS = [
    { name: 'Risol Mayo', tag: 'Gurih Lumer Smoked Beef', price: 3500 },
    { name: 'Risol Rogut', tag: 'Ayam Wortel Creamy', price: 3500 },
    { name: 'Lumpia Sayur', tag: 'Rebung Renyah Gurih', price: 2500 },
    { name: 'Pisang Coklat', tag: 'Cokelat Lumer Manis', price: 2500 },
    { name: 'Tahu Isi Pedas', tag: 'Sayur Pedas Renyah', price: 3000 },
    { name: 'Ote-Ote', tag: 'Bakwan Sayur Renyah', price: 2000 },
  ];

  const [isSnackBoxOpen, setIsSnackBoxOpen] = useState(false);
  const [sbType, setSbType] = useState<SnackBoxType>('standar_3');
  // Default awal otomatis terisi gorengan favorit Dulang (Risol Mayo + Risol Rogut + Lumpia)
  const [sbSelectedItems, setSbSelectedItems] = useState<string[]>([
    'Risol Mayo',
    'Risol Rogut',
    'Lumpia Sayur',
  ]);
  const [sbDrink, setSbDrink] = useState<SnackBoxDrink>('mineral');
  const [sbQty, setSbQty] = useState<number>(20);
  const [sbEventDate, setSbEventDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [sbEventTime, setSbEventTime] = useState<string>('09:30');
  const [sbCustomLabel, setSbCustomLabel] = useState<string>('');
  const [sbNotes, setSbNotes] = useState<string>('');
  const [sbOrderSentSuccess, setSbOrderSentSuccess] = useState<boolean>(false);

  // Snack Box Capacity & Pricing: Pancingan harga paket minimal, bisa disesuaikan bila isian diganti
  const sbCapacity = sbType === 'mini_2' ? 2 : sbType === 'standar_3' ? 3 : 4;
  const minBasePrice = sbType === 'mini_2' ? 8000 : sbType === 'standar_3' ? 11000 : 14000;
  
  // Hitung total harga kue yang dipilih pembeli + kemasan dus & sekat bersih (Rp 1.500)
  const itemsSum = sbSelectedItems.reduce((acc, name) => {
    const it = DULANG_SNACK_BOX_ITEMS.find((d) => d.name === name);
    return acc + (it ? it.price : 2500);
  }, 0);
  const packagingCost = 1500;
  const sbBaseItemPrice = Math.max(minBasePrice, itemsSum + packagingCost);

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
        // Ganti item terakhir agar kapasitas tetap pas
        setSbSelectedItems([...sbSelectedItems.slice(0, sbCapacity - 1), itemName]);
      }
    }
  };

  const handleSbTypeChange = (newType: SnackBoxType) => {
    setSbType(newType);
    if (newType === 'mini_2') {
      setSbSelectedItems(['Risol Mayo', 'Pisang Coklat']);
    } else if (newType === 'standar_3') {
      setSbSelectedItems(['Risol Mayo', 'Risol Rogut', 'Lumpia Sayur']);
    } else {
      setSbSelectedItems(['Risol Mayo', 'Risol Rogut', 'Lumpia Sayur', 'Pisang Coklat']);
    }
  };

  const handleOrderSnackBoxWA = () => {
    if (sbQty < minSnackBoxOrder) {
      alert(`Minimal pemesanan Paket Snack Box Acara adalah ${minSnackBoxOrder} box.`);
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
    <div className="space-y-7 sm:space-y-16 lg:space-y-24 pb-20">
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

      {/* Operating Status Banner: If Manual Closed or Auto Closed Outside Operating Hours */}
      {!openStatus.isOpen && (
        <div
          onClick={onOpenClosedNotice}
          className="cursor-pointer bg-gradient-to-r from-[#FFD700] to-amber-300 text-[#111111] border-2 border-[#111111] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 hover:brightness-105 transition-all"
        >
          <div className="flex items-center gap-3.5">
            <span className="text-3xl">{openStatus.isManualClosed ? '🪧' : '🌙'}</span>
            <div>
              <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                {openStatus.isManualClosed ? 'Dapur Sedang Libur Goreng' : 'Dapur Sedang Istirahat / Tutup'}
              </div>
              <p className="font-hand font-bold text-[20px] sm:text-[23px] leading-tight text-[#111111]">
                {openStatus.isManualClosed
                  ? (storeConfig.closedReason || 'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya.')
                  : `${openStatus.reason} Tetap bisa pesan untuk diantar besok subuh/pagi!`}
              </p>
            </div>
          </div>
          <span className="font-sans text-xs font-bold underline bg-white border border-[#111111] px-3 py-1.5 rounded-full shadow-sm shrink-0 text-center">
            {openStatus.isManualClosed ? 'Buka Pengumuman 📖' : 'Jadwal Buka & Pre-Order 🥟'}
          </span>
        </div>
      )}

      {/* HERO SECTION - Brand Book Locked */}
      <section className="mt-2 sm:mt-6 lg:mt-14 relative">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-12 items-start">
          {/* Left Column: Big Black Canopy (Full-Bleed di HP mentok kanan-kiri agar tulisan bernapas lega) */}
          <div className="relative">
            <div className="-mx-4 sm:mx-0 bg-[#111111] text-[#FFF8E7] rounded-none sm:rounded-[28px] rounded-b-[28px] px-6 py-7 sm:p-7 lg:p-10 pb-9 sm:pb-10 lg:pb-28 sm:rotate-[-1.2deg] shadow-[0_4px_16px_rgba(0,0,0,0.18)] sm:shadow-[5px_5px_0_#111111] border-b-2 sm:border-2 border-[#111111] relative overflow-hidden transition-transform">
              {/* Cute Washi Tape Pin Accent (Tampil di Laptop) */}
              <div className="tape absolute -top-3 left-8 w-24 h-5 bg-[#FFD700] rotate-[-2deg] border border-[#111111]/20 shadow-xs pointer-events-none hidden sm:block" />

              {/* Pills Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] rounded-full px-3.5 sm:px-4 py-1.5 text-[10px] sm:text-[11px] font-bold tracking-widest uppercase font-sans rotate-[0.8deg] sm:rotate-[1deg] border border-[#111111]">
                  <span className="w-1.5 h-1.5 bg-[#111111] rounded-full animate-pulse" />
                  {LOCKED_COPY.pillHot}
                </div>

                {openStatus.isOpen ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-full px-3 py-1.5 text-[10px] sm:text-[11px] font-bold font-sans">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Dapur Buka • {openStatus.openHour} - {openStatus.closeHour} WIB
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-[#FFD700] border border-[#FFD700]/40 rounded-full px-3 py-1.5 text-[10px] sm:text-[11px] font-bold font-sans">
                    <span>🌙</span>
                    Dapur Tutup • Pre-Order Besok
                  </div>
                )}
              </div>

              {/* Locked H1 Headline (Lega dengan padding px-6, tidak mepet tepi) */}
              <h1 className="leading-[0.98] tracking-tight">
                <span className="font-hand font-bold text-[36px] sm:text-[44px] lg:text-[64px] block text-white">
                  Sudah makan?
                </span>
                <span className="font-sans font-bold text-[24px] sm:text-[28px] lg:text-[40px] leading-[1.08] block mt-1.5 sm:mt-2 text-[#FFF8E7]">
                  Jangan biarkan
                  <br />
                  tubuhmu kelaparan
                </span>
              </h1>

              {/* Best Seller Sub-badge */}
              <div className="mt-5 sm:mt-6 flex flex-wrap sm:flex-nowrap items-start gap-2.5 sm:gap-3">
                <div className="bg-[#FFD700] text-[#111111] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-[12px] sm:rounded-[14px] rotate-[-1deg] font-hand font-bold text-[19px] sm:text-[22px] leading-none border border-[#111111]">
                  RISOLES MAYO LUMER
                </div>
                <div className="font-hand text-[#FFF8E7]/70 text-[13px] sm:text-[15px] leading-tight pt-1 whitespace-pre-line">
                  {storeConfig.heroHeadlineSub || 'digoreng jam 10 pagi\nhabis jam 8 malem'}
                </div>
              </div>

              {/* Paragraph with safe max-width so it never collides with sticky note */}
              <p className="font-sans text-[13px] sm:text-[14px] leading-[1.6] text-[#FFF8E7]/80 mt-4 sm:mt-6 max-w-full sm:max-w-[340px] xl:max-w-[390px]">
                {LOCKED_COPY.heroSub}
              </p>

              {/* Decorative Pills */}
              <div className="mt-4 sm:mt-6 flex gap-2">
                <div className="h-[3px] w-12 bg-[#FFD700] rounded-full" />
                <div className="h-[3px] w-6 bg-[#FFF8E7]/30 rounded-full" />
                <div className="h-[3px] w-6 bg-[#FFF8E7]/20 rounded-full" />
              </div>
            </div>

            {/* Floating Sticky Note: "tunggu agak dingin dulu..." */}
            <div className="relative lg:absolute lg:-bottom-8 lg:-right-4 xl:-right-6 -mt-4 sm:mt-4 lg:mt-0 z-20 flex justify-end px-2 sm:px-0">
              <div className="relative bg-white rounded-[18px] p-4 sm:p-5 w-full sm:w-[310px] max-w-[340px] rotate-[1.5deg] polaroid-shadow border-2 border-[#111111] shadow-[4px_4px_0_#111111]">

                {/* Yellow Tape */}
                <div className="tape absolute -top-3 left-1/2 -translate-x-1/2 w-[88px] h-[22px] rotate-[-3deg] rounded-[2px] border border-[#111111]/20" />

                <div className="font-hand text-[16px] sm:text-[19px] leading-[1.3] text-[#111111]">
                  <div className="text-[#5C3D2E] font-bold">ps: makannya jangan buru-buru ya</div>
                  <div className="mt-1 font-bold text-[#111111]">
                    {LOCKED_COPY.psWajib}
                  </div>
                  <div className="mt-2 sm:mt-3 text-[11px] sm:text-[12px] text-[#5C3D2E]/60 font-sans">
                    — dari dapur Dulang ♡
                  </div>
                </div>

                <div className="absolute -bottom-1 -right-2 w-10 h-3 bg-[#FFD700]/70 rotate-[18deg] border border-[#111111]/10" />
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Frame + Callout */}
          <div
            className="relative lg:pt-2 group mt-3 lg:mt-0"
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
          >
            <div className="relative rounded-[22px] sm:rounded-[28px] bg-white p-2.5 sm:p-4 rotate-[0.8deg] sm:rotate-[1deg] polaroid-shadow border-2 border-[#111111] transition-transform">
              <div className="rounded-[16px] sm:rounded-[20px] overflow-hidden bg-[#FFEEC2] aspect-[16/10] sm:aspect-[4/3] max-h-[220px] sm:max-h-none relative grid place-items-center border border-[#111111]/10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#FFF8E7_0%,#FFE6A0_45%,#FFD36B_100%)]" />

                {heroPhotoList.length > 0 ? (
                  <>
                    {heroPhotoList.map((photoUrl, pIdx) => (
                      <img
                        key={pIdx}
                        src={photoUrl}
                        alt={`Foto Utama Dulang ${pIdx + 1}`}
                        className={`w-full h-full object-cover absolute inset-0 z-10 transition-opacity duration-700 ease-in-out ${
                          activeHeroIdx === pIdx ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                        }`}
                      />
                    ))}

                    {/* Left & Right Interactive Arrows (if > 1 photo) */}
                    {heroPhotoList.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveHeroIdx((prev) => (prev - 1 + heroPhotoList.length) % heroPhotoList.length);
                          }}
                          className="cursor-pointer absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-25 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-black text-[#FFD700] hover:text-white flex items-center justify-center font-bold text-base sm:text-lg backdrop-blur-xs transition shadow-md border border-white/20 active:scale-90"
                          title="Foto sebelumnya"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveHeroIdx((prev) => (prev - 1 + heroPhotoList.length) % heroPhotoList.length);
                          }}
                          className="cursor-pointer absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-25 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-black text-[#FFD700] hover:text-white flex items-center justify-center font-bold text-base sm:text-lg backdrop-blur-xs transition shadow-md border border-white/20 active:scale-90"
                          title="Foto selanjutnya"
                        >
                          ›
                        </button>
                      </>
                    )}

                    {/* Dot Indicators if more than 1 photo */}
                    {heroPhotoList.length > 1 && (
                      <div className="absolute top-2.5 right-2.5 z-25 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/20">
                        {heroPhotoList.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => setActiveHeroIdx(dotIdx)}
                            className={`rounded-full transition-all cursor-pointer ${
                              activeHeroIdx === dotIdx ? 'w-4 h-1.5 bg-[#FFD700]' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
                            }`}
                            title={`Foto ${dotIdx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-[110px] h-[110px] sm:w-[124px] sm:h-[124px] bg-[#111111] rounded-full grid place-items-center rotate-[-6deg] shadow-lg border-2 border-[#111111]">
                      <img
                        src="/dulang-logo.png"
                        alt="risoles"
                        className="w-[80px] h-[80px] sm:w-[90px] sm:h-[90px] object-contain"
                      />
                    </div>
                    <div className="mt-3 sm:mt-4 bg-white/95 backdrop-blur-sm px-3.5 sm:px-4 py-1.5 rounded-full font-hand font-bold text-[15px] sm:text-[17px] text-[#111111] rotate-[-2deg] border border-[#111111] shadow-sm">
                      angetnya masih ngebul ☁️
                    </div>
                  </div>
                )}

                <div className="absolute bottom-2.5 sm:bottom-3 left-3 sm:left-4 font-hand font-bold text-[12px] sm:text-[13px] text-[#5C3D2E] bg-white/90 px-2.5 py-0.5 rounded-full rotate-[-4deg] z-20 border border-[#111111]/10 shadow-sm">
                  wajan panas 180° • minyak selalu baru
                </div>
              </div>

              <div className="pt-2.5 sm:pt-3 px-2 flex justify-between items-center font-sans text-[11px] text-[#5C3D2E]/70 font-semibold">
                <span>Dapur Dulang Sidoarjo</span>
                <span className="font-bold text-[#111111]">Sejak 2020</span>
              </div>
            </div>

            {/* Side Callout Note - Repositioned to top-left corner */}
            <div className="-mt-3 mb-1 sm:mt-5 lg:mt-0 lg:absolute lg:-top-14 lg:-left-8 xl:-left-12 relative z-30 pointer-events-none sm:pointer-events-auto">
              <div className="relative bg-[#FFD700] border-2 border-[#111111] rounded-[16px] px-3.5 sm:px-4 py-2 sm:py-3 rotate-[-2.5deg] sm:rotate-[-3deg] shadow-[3px_3px_0_#111111] sm:shadow-[4px_4px_0_#111111] max-w-[215px]">
                {/* Cute masking tape accent */}
                <div className="tape absolute -top-2.5 left-6 w-[52px] h-[14px] bg-white/70 rotate-[-5deg] rounded-[1px] border border-[#111111]/20 z-10" />

                <div className="font-hand font-bold text-[16px] sm:text-[18px] leading-[1.2] text-[#111111]">
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
      <section className="mt-4 sm:mt-16 lg:mt-24">
        {/* Mobile View: Compact Badge Strip (Memangkas Jarak Scrolling ke Menu!) */}
        <div className="sm:hidden bg-white border-2 border-[#111111] rounded-2xl p-3 shadow-[3px_3px_0_#111111] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">🍳</span>
            <div className="min-w-0">
              <div className="font-bold text-[11px] text-[#111111] uppercase tracking-wider">Jam Masak Panas Dulang</div>
              <div className="font-mono text-[11px] text-[#5C3D2E] truncate font-semibold">10:00 • 13:00 • 16:30 • 20:00 WIB</div>
            </div>
          </div>
          <span className="text-[10px] font-sans font-bold bg-[#FFD700] text-[#111111] px-2 py-1 rounded-full border border-[#111111] shrink-0">
            Fresh Wajan 🔥
          </span>
        </div>

        {/* Desktop View: Full 4-Card Polaroid Grid */}
        <div className="hidden sm:block">
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
            <h2 className="font-hand font-bold text-[28px] sm:text-[36px] lg:text-[46px] leading-none text-[#111111]">
              tempat ngumpul, bukan cuma jualan
            </h2>
            <span className="font-sans text-[11px] sm:text-[12px] px-3 sm:px-3.5 py-1 rounded-full bg-white border border-[#111111]/15 font-semibold text-[#5C3D2E]">
              sejak 2020 • {storeConfig.jamBukaTeks || 'masih pake wajan yang sama'}
            </span>
          </div>

          <div className="mt-6 sm:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {(storeConfig.schedules && storeConfig.schedules.length > 0
              ? storeConfig.schedules
              : DEFAULT_STORE_CONFIG.schedules
            ).map((item, idx) => {
              return (
                <div
                  key={idx}
                  className={`bg-white rounded-[18px] sm:rounded-[20px] p-4 sm:p-5 polaroid-shadow border-2 border-[#111111] shadow-[2px_2px_0_#111111] ${
                    idx % 4 === 0
                      ? '-rotate-1'
                      : idx % 4 === 1
                      ? 'rotate-1'
                      : idx % 4 === 2
                      ? '-rotate-1'
                      : 'rotate-1'
                  } transition-transform`}
                >
                  <div className="inline-flex bg-[#111111] text-[#FFD700] px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold font-sans tracking-widest border border-[#111111]">
                    {item.jam}
                  </div>
                  <p className="mt-3 font-sans text-[12px] sm:text-[13px] leading-[1.6] text-[#5C3D2E]">
                    {item.teks}
                  </p>
                  <div className="mt-3.5 sm:mt-4 h-[2px] w-10 bg-[#FFD700] rounded-full" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* MENU CATALOG SECTION (3a: Hari Ini vs Menu Besok) */}
      <section id="menu-section" className="mt-6 sm:mt-20 space-y-4 sm:space-y-6">
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

        {/* Serving Mode Filter (Segmented Control: 100% Pas di Layar HP Tanpa Perlu Digulir) */}
        {(() => {
          const activeMenusList = menuTab === 'today' ? menus : menus.filter((m) => m.tersediaBesok !== false);
          const countMatang = activeMenusList.filter((item) => {
            const name = item.nama.toLowerCase();
            return item.servingType === 'matang_only' || item.servingType === 'both' || (item.variantType !== 'frozen' && !name.includes('frozen') && !name.includes('beku'));
          }).length;
          const countFrozen = activeMenusList.filter((item) => {
            const name = item.nama.toLowerCase();
            return item.servingType === 'frozen_only' || item.servingType === 'both' || item.variantType === 'frozen' || name.includes('frozen') || name.includes('beku');
          }).length;

          return (
            <div className="w-full">
              <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-full sm:rounded-[20px] border-2 border-[#111111] shadow-[2px_2px_0_#111111]">
                <button
                  type="button"
                  onClick={() => setServingFilter('all')}
                  className={`cursor-pointer px-1 sm:px-3.5 py-2 rounded-full font-sans font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1 active:scale-95 text-center ${
                    servingFilter === 'all'
                      ? 'bg-[#111111] text-[#FFD700] shadow-xs'
                      : 'text-[#5C3D2E] hover:text-[#111111]'
                  }`}
                >
                  <span>✨</span>
                  <span className="truncate">Semua ({activeMenusList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServingFilter('matang')}
                  className={`cursor-pointer px-1 sm:px-3.5 py-2 rounded-full font-sans font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1 active:scale-95 text-center ${
                    servingFilter === 'matang'
                      ? 'bg-[#FFD700] text-[#111111] shadow-xs'
                      : 'text-[#5C3D2E] hover:text-[#111111]'
                  }`}
                >
                  <span>🍳</span>
                  <span className="truncate">Siap Santap ({countMatang})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setServingFilter('frozen')}
                  className={`cursor-pointer px-1 sm:px-3.5 py-2 rounded-full font-sans font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1 active:scale-95 text-center ${
                    servingFilter === 'frozen'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-[#5C3D2E] hover:text-[#111111]'
                  }`}
                >
                  <span>❄️</span>
                  <span className="truncate">Frozen ({countFrozen})</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Category Filter Pills (Horizontal Scroll on Mobile dengan Padding Samping Rapi) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {MENU_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const activeMenusList = menuTab === 'today' ? menus : menus.filter((m) => m.tersediaBesok !== false);
            const count = activeMenusList.filter((item) => {
              const name = item.nama.toLowerCase();
              const isFrozen = item.variantType === 'frozen' || item.servingType === 'frozen_only' || item.servingType === 'both' || name.includes('frozen') || name.includes('beku');
              const isFrozenOnly = item.servingType === 'frozen_only' || item.variantType === 'frozen' || name.includes('frozen') || name.includes('beku');

              if (servingFilter === 'matang' && isFrozenOnly) return false;
              if (servingFilter === 'frozen' && !isFrozen) return false;

              if (cat.id === 'all') return true;
              if (cat.id === 'frozen') return isFrozen;
              if (cat.id === 'risol') return name.includes('risol') && !isFrozenOnly;
              if (cat.id === 'gorengan') {
                return (
                  (name.includes('lumpia') ||
                    name.includes('tahu') ||
                    name.includes('ote') ||
                    name.includes('bakwan') ||
                    name.includes('tempe') ||
                    name.includes('pastel') ||
                    name.includes('sosis solo') ||
                    name.includes('cireng')) &&
                  !isFrozenOnly
                );
              }
              if (cat.id === 'manis') {
                return (
                  name.includes('pisang') ||
                  name.includes('coklat') ||
                  name.includes('kebab') ||
                  name.includes('burger') ||
                  name.includes('roti') ||
                  name.includes('manis')
                );
              }
              return true;
            }).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`cursor-pointer whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-full font-sans font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700] border-2 border-[#111111]'
                    : 'bg-white hover:bg-amber-50 text-[#111111] border-2 border-[#111111]/15 hover:border-[#111111]/40'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-[#FFD700] text-[#111111]' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fitur 1: Pesan Lagi Menu Kemarin (1-Tap Reorder) */}
        {lastCart && lastCart.length > 0 && (
          <div className="bg-[#FFFDF4] border-2 border-[#111111] rounded-[20px] p-3 sm:p-4 shadow-[3px_3px_0_#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#FFD700] border border-[#111111] flex items-center justify-center text-lg shrink-0">
                ⚡
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-hand font-bold text-base sm:text-lg text-[#111111] leading-none">
                    Mau pesan lagi menu kemarin?
                  </span>
                  <span className="text-[10px] font-bold bg-[#111111] text-[#FFD700] px-2 py-0.2 rounded-full">
                    1-Klik
                  </span>
                </div>
                <p className="font-sans text-[11px] text-[#5C3D2E]/80 truncate mt-0.5">
                  {lastCart.map((c: any) => `${c.qty}x ${c.item?.nama || c.nama}`).join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  lastCart.forEach((c: any) => {
                    if (c.item) {
                      onAddToCart(c.item, c.pilihanOpsi, c.variantType, c.qty);
                    }
                  });
                  if (onShowToast) onShowToast('Menu kemarin langsung masuk ke keranjang! Siap di-checkout 🛒✨');
                }}
                className="w-full sm:w-auto cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border-2 border-[#111111] px-4 py-1.5 sm:py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111] active:translate-y-0.5 transition flex items-center justify-center gap-1.5"
              >
                <span>🛒</span>
                <span>Pesan Ulang Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('dulang_last_cart');
                  setLastCart(null);
                }}
                className="cursor-pointer text-gray-400 hover:text-black p-1 text-xs"
                title="Tutup saran ini"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Fitur 3: Bikin Dus Campur Sendiri Banner Card */}
        <div className="bg-gradient-to-r from-[#FFF8E7] via-[#FFFDF4] to-[#FFEEC2] rounded-[22px] p-4 sm:p-5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:rotate-[-0.8deg] relative overflow-hidden transition-transform">
          <div className="tape absolute -top-2.5 right-10 w-24 h-4 bg-[#FFD700] rotate-[3deg] border border-[#111111]/20 shadow-xs pointer-events-none" />
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#111111] text-[#FFD700] border-2 border-[#111111] flex items-center justify-center text-2xl shrink-0 shadow-xs rotate-[-2deg]">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-hand font-bold text-xl sm:text-2xl text-[#111111] leading-tight">
                  Bikin Dus Campur Sendiri (Mix & Match)
                </span>
                <span className="text-[10px] font-bold bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full border border-[#111111]/30">
                  Favorit Pembeli ⭐
                </span>
              </div>
              <p className="font-sans text-xs text-[#5C3D2E]/80 mt-0.5">
                Bebas pilih aneka gorengan sesukamu (Isi 6 atau Isi 10) dalam 1 kotak cantik Dulang.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMixMatchOpen(true)}
            className="cursor-pointer bg-[#111111] hover:bg-[#222222] text-[#FFD700] hover:brightness-110 border-2 border-[#111111] px-5 py-2.5 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#FFD700] active:scale-95 transition flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <span>✨</span>
            <span>Racik Dus Sekarang</span>
          </button>
        </div>

        {/* Menu Grid - 2 Kolom di Mobile, 3 di Tablet, 4 di Desktop */}
        {(() => {
          const activeMenusList = menuTab === 'today' ? menus : menus.filter((m) => m.tersediaBesok !== false);
          const filteredMenus = activeMenusList.filter((item) => {
            const name = item.nama.toLowerCase();
            const isFrozen = item.variantType === 'frozen' || item.servingType === 'frozen_only' || item.servingType === 'both' || name.includes('frozen') || name.includes('beku');
            const isFrozenOnly = item.servingType === 'frozen_only' || item.variantType === 'frozen' || name.includes('frozen') || name.includes('beku');

            if (servingFilter === 'matang' && isFrozenOnly) return false;
            if (servingFilter === 'frozen' && !isFrozen) return false;

            if (selectedCategory === 'all') return true;
            if (selectedCategory === 'frozen') return isFrozen;
            if (selectedCategory === 'risol') return name.includes('risol') && !isFrozenOnly;
            if (selectedCategory === 'gorengan') {
              return (
                (name.includes('lumpia') ||
                  name.includes('tahu') ||
                  name.includes('ote') ||
                  name.includes('bakwan') ||
                  name.includes('tempe') ||
                  name.includes('pastel') ||
                  name.includes('sosis solo') ||
                  name.includes('cireng')) &&
                !isFrozenOnly
              );
            }
            if (selectedCategory === 'manis') {
              return (
                name.includes('pisang') ||
                name.includes('coklat') ||
                name.includes('kebab') ||
                name.includes('burger') ||
                name.includes('roti') ||
                name.includes('manis')
              );
            }
            return true;
          });

          if (filteredMenus.length === 0) {
            return (
              <div className="text-center py-12 bg-white rounded-[22px] border-2 border-dashed border-[#111111]/20 p-6 space-y-2">
                <div className="text-4xl">🥟</div>
                <div className="font-bold text-sm text-[#111111]">Belum ada menu di kategori atau pilihan ini</div>
                <p className="text-xs text-[#5C3D2E]/70 max-w-sm mx-auto">
                  Silakan ganti pilihan sajian atau tampilkan seluruh menu andalan Dapur Dulang.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setServingFilter('all');
                  }}
                  className="mt-2 cursor-pointer bg-[#111111] text-[#FFD700] px-4 py-2 rounded-full font-bold text-xs shadow-xs"
                >
                  Tampilkan Semua Menu
                </button>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 pt-3 pb-2">
              {filteredMenus.map((item, idx) => (
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
          );
        })()}
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
                      price: 'Mulai Rp 8.000 / box',
                      desc: 'Porsi santai / rapat kilat',
                    },
                    {
                      type: 'standar_3' as SnackBoxType,
                      name: 'Box Standar (3 Pcs)',
                      price: 'Mulai Rp 11.000 / box',
                      desc: 'Paling laris buat pengajian & arisan',
                      recommended: true,
                    },
                    {
                      type: 'lengkap_4' as SnackBoxType,
                      name: 'Box Lengkap (4 Pcs)',
                      price: 'Mulai Rp 14.000 / box',
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
                  {DULANG_SNACK_BOX_ITEMS.map((item) => {
                    const isSelected = sbSelectedItems.includes(item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => toggleSbItem(item.name)}
                        className={`cursor-pointer p-3 rounded-[16px] text-xs font-sans text-left border-2 transition flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-[#FFD700] text-[#111111] border-[#111111] shadow-[2px_2px_0_#111111]'
                            : 'bg-white text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-bold text-xs sm:text-[13px]">{item.name}</div>
                          <div className="text-[10px] opacity-75">{item.tag} • Rp {item.price.toLocaleString('id-ID')}</div>
                        </div>
                        <span className="text-sm font-bold shrink-0">{isSelected ? '✓' : '+'}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#5C3D2E]/70 italic mt-2">
                  *Isian awal sudah otomatis terisi rekomendasi favorit Dulang. Kamu bebas mengganti kombinasinya sesuai selera!
                </p>
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
                  {[10, 20, 30, 50, 75, 100, 150].map((num) => (
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
                      {`${num} Box`}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={minSnackBoxOrder}
                  max="300"
                  step="5"
                  value={sbQty}
                  onChange={(e) => setSbQty(Number(e.target.value))}
                  className="w-full accent-[#111111] cursor-pointer"
                />

                {sbQty < minSnackBoxOrder && (
                  <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-[12px] text-red-600 text-xs font-sans font-bold text-center">
                    ⚠️ Minimal pemesanan paket custom hajatan/arisan adalah {minSnackBoxOrder} box.
                  </div>
                )}

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
                      min={minEventDateStr}
                      value={sbEventDate}
                      onChange={(e) => setSbEventDate(e.target.value)}
                      className="w-full bg-[#FFFDF4] border-2 border-[#111111] rounded-[12px] px-3 py-2 text-xs font-sans font-bold"
                    />
                    <span className="text-[10px] text-[#5C3D2E]/70 block mt-1">
                      *Minimal H-1 dari hari ini agar adonan dan dus disiapkan maksimal.
                    </span>
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
                      if (sbQty < minSnackBoxOrder) {
                        alert(`Minimal pemesanan Paket Snack Box Acara adalah ${minSnackBoxOrder} box.`);
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

      {/* Modal Bikin Dus Campur / Mix & Match */}
      <MixMatchBoxModal
        isOpen={isMixMatchOpen}
        onClose={() => setIsMixMatchOpen(false)}
        menus={menus}
        onAddBoxToCart={onAddToCart}
        onShowToast={(msg) => (onShowToast ? onShowToast(msg) : alert(msg))}
      />
    </div>
  );
};
