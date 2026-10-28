import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MenuItem,
  Customer,
  StoreConfig,
  Voucher,
  OrderRecord,
  PaymentMethod,
  OrderStatus,
  CustomerTestimonial,
  ExpenseRecord,
  ExpenseCategory,
  StaffRole,
} from '../types';
import { SIDOARJO_AREAS, INDONESIA_CITIES, CITY_DISTRICTS, MONTHS_INDONESIA, DEFAULT_SIDOARJO_DELIVERY_RATES } from '../lib/constants';
import { getSupabaseCredentials, saveSupabaseCredentials, clearSupabaseCredentials } from '../lib/supabase';
import { storageService } from '../services/storageService';
import { playNewCustomerChime, isAudioEnabled, setAudioEnabled } from '../lib/audioNotifier';
import { StoreClosedModal } from '../components/common/StoreClosedModal';
import { ImageCropModal } from '../components/common/ImageCropModal';
import { SubuhCalculatorModal } from '../components/common/SubuhCalculatorModal';
import { KitchenClosingModal } from '../components/common/KitchenClosingModal';
import { InvoiceA4Modal } from '../components/common/InvoiceA4Modal';
import { RecipeInventoryTab } from '../components/owner/RecipeInventoryTab';
import { KitchenDisplaySystem } from '../components/kitchen/KitchenDisplaySystem';
import { StickerGeneratorView } from './StickerGeneratorView';
import {
  logSecurityEvent,
  getSecurityAuditLogs,
  clearSecurityAuditLogs,
  SecurityAuditEntry,
} from '../lib/security';

interface OwnerDashboardViewProps {
  menus: MenuItem[];
  onUpdateMenus: (menus: MenuItem[]) => void;
  storeConfig: StoreConfig;
  onUpdateStoreConfig: (config: StoreConfig) => void;
  onLogout: () => void;
  onShowToast: (msg: string) => void;
  initialTab?: 'menu' | 'orders' | 'expenses' | 'customers' | 'inventory' | 'kds' | 'testimonials' | 'vouchers' | 'stickers' | 'stats' | 'settings';
}

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  menus,
  onUpdateMenus,
  storeConfig,
  onUpdateStoreConfig,
  onLogout,
  onShowToast,
  initialTab,
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => storageService.getCustomers());
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'expenses' | 'customers' | 'inventory' | 'kds' | 'testimonials' | 'vouchers' | 'stickers' | 'stats' | 'settings'>(
    initialTab || 'orders'
  );

  // --- STAFF ROLE & MULTI-PIN STATE (Priority 2) ---
  const [activeRole, setActiveRole] = useState<StaffRole>(() => storageService.getStaffRole());
  const [isSwitchRoleModalOpen, setIsSwitchRoleModalOpen] = useState(false);
  const [switchRolePinInput, setSwitchRolePinInput] = useState('');
  const [switchRoleError, setSwitchRoleError] = useState('');
  const [isSwitchingRoleLoading, setIsSwitchingRoleLoading] = useState(false);

  useEffect(() => {
    const handleRoleUpdated = (e: any) => {
      const role = e.detail?.role || storageService.getStaffRole();
      setActiveRole(role);
    };
    window.addEventListener('dulang_staff_role_updated', handleRoleUpdated);
    return () => {
      window.removeEventListener('dulang_staff_role_updated', handleRoleUpdated);
    };
  }, []);

  // Enforce role-based tab restrictions automatically
  useEffect(() => {
    if (activeRole === 'cashier') {
      const cashierRestrictedTabs = ['expenses', 'customers', 'inventory', 'testimonials', 'vouchers', 'stats', 'settings'];
      if (cashierRestrictedTabs.includes(activeTab)) {
        setActiveTab('orders');
      }
    } else if (activeRole === 'kitchen') {
      if (activeTab !== 'kds' && activeTab !== 'menu') {
        setActiveTab('kds');
      }
    }
  }, [activeRole, activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    storageService.syncOrdersFromSupabase().then(() => {
      setOrders(storageService.getOrders());
    });
  }, []);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // --- MANUAL CUSTOMER REGISTRATION STATE ---
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [custName, setCustName] = useState('');
  const [custWa, setCustWa] = useState('');
  const [custCity, setCustCity] = useState('Kabupaten Sidoarjo');
  const [custDistrict, setCustDistrict] = useState('Sidoarjo Kota');
  const [custVillage, setCustVillage] = useState('');
  const [custStreetDetail, setCustStreetDetail] = useState('');
  const [custMenu, setCustMenu] = useState('Risol Mayo');
  const [custQrId, setCustQrId] = useState('');
  const [custBirthDay, setCustBirthDay] = useState<number | ''>('');
  const [custBirthMonth, setCustBirthMonth] = useState<number | ''>('');

  // --- VOUCHERS MANAGEMENT STATE (Step 6) ---
  const [vouchers, setVouchers] = useState<Voucher[]>(() => storageService.getVouchers());
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<'all' | 'active' | 'used'>('all');
  const [isAddingVoucher, setIsAddingVoucher] = useState(false);

  // New Voucher Form
  const [vRecipient, setVRecipient] = useState('');
  const [vCode, setVCode] = useState('');
  const [vDiscountType, setVDiscountType] = useState<'nominal' | 'percent'>('nominal');
  const [vDiscountValue, setVDiscountValue] = useState(10000);
  const [vMinOrder, setVMinOrder] = useState(40000);
  const [vDescription, setVDescription] = useState('Traktiran Spesial Sobat Dulang');
  const [vHasChild, setVHasChild] = useState(true);
  const [vChildTitle, setVChildTitle] = useState('Tiket Emas Dapur: Bonus 2 Risoles Rogout Hangat');
  const [vChildPerk, setVChildPerk] = useState('Gratis 2 Risoles Rogout Hangat');
  const [vChildCondition, setVChildCondition] = useState('Otomatis aktif untuk repeat order berikutnya min. 3 box dalam 7 hari');
  const [vChildCode, setVChildCode] = useState('');

  // --- ORDERS & SALES POS STATE ---
  const [orders, setOrders] = useState<OrderRecord[]>(() => storageService.getOrders());
  const [orderFilter, setOrderFilter] = useState<'all' | 'menunggu' | 'dp' | 'lunas' | 'batal'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<OrderRecord | null>(null);
  const [dpModalOrder, setDpModalOrder] = useState<OrderRecord | null>(null);
  const [dpInputNominal, setDpInputNominal] = useState<number | ''>(50000);
  const [dpPaymentMethod, setDpPaymentMethod] = useState<PaymentMethod>('transfer');
  const [customerSegmentFilter, setCustomerSegmentFilter] = useState<'all' | 'sultan' | 'setia' | 'dormant'>('all');
  const [isAddingWalkInOrder, setIsAddingWalkInOrder] = useState(false);
  const [walkInCustName, setWalkInCustName] = useState('');
  const [walkInCustWa, setWalkInCustWa] = useState('');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<PaymentMethod>('tunai');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [walkInSelectedMenu, setWalkInSelectedMenu] = useState<string>('');
  const [walkInSelectedOpsi, setWalkInSelectedOpsi] = useState<string>('');
  const [walkInVariant, setWalkInVariant] = useState<'matang' | 'frozen'>('matang');
  const [walkInQty, setWalkInQty] = useState<number>(1);
  const [walkInCart, setWalkInCart] = useState<{ menu_id: string; nama: string; harga: number; qty: number; pilihanOpsi?: string; variantType?: 'matang' | 'frozen' }[]>([]);
  const [walkInCashReceived, setWalkInCashReceived] = useState<number | ''>('');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderRecord | null>(null);
  const [receiptPaperWidth, setReceiptPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [quickWaOrderText, setQuickWaOrderText] = useState('');
  const [mobileActionOrder, setMobileActionOrder] = useState<OrderRecord | null>(null);

  // --- DULANG-2 KITCHEN COCKPIT & PROGRESSIVE DISCLOSURE STATE ---
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isSubuhModalOpen, setIsSubuhModalOpen] = useState<boolean>(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState<boolean>(false);
  const [isQrisModalOpen, setIsQrisModalOpen] = useState<boolean>(false);
  const [isChartsExpanded, setIsChartsExpanded] = useState<boolean>(false);
  const [isQuickWaOpen, setIsQuickWaOpen] = useState<boolean>(false);

  // --- TESTIMONIALS CURATION STATE ---
  const [testimonials, setTestimonials] = useState<CustomerTestimonial[]>(() => storageService.getTestimonials());
  const [isAddingTesti, setIsAddingTesti] = useState(false);
  const [testiCustName, setTestiCustName] = useState('');
  const [testiArea, setTestiArea] = useState('Sidoarjo Kota');
  const [testiComment, setTestiComment] = useState('');
  const [testiMenu, setTestiMenu] = useState('Risol Mayo');
  const [testiRating, setTestiRating] = useState<number>(5);

  // --- SISTEM PENGELUARAN & PROFIT BERSIH DAPUR (BUKU KAS) ---
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => storageService.getExpenses());
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // New Expense Form State
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('bahan_baku');
  const [expItemName, setExpItemName] = useState('');
  const [expNominal, setExpNominal] = useState<number | ''>(38000);
  const [expNotes, setExpNotes] = useState('');

  // Listen to expenses update event
  useEffect(() => {
    const handleExpensesUpdate = () => {
      setExpenses(storageService.getExpenses());
    };
    window.addEventListener('dulang_expenses_updated', handleExpensesUpdate);
    return () => {
      window.removeEventListener('dulang_expenses_updated', handleExpensesUpdate);
    };
  }, []);

  // --- CUSTOMER INTELLIGENCE / NOTES EDITING ---
  const [editingCustNotes, setEditingCustNotes] = useState<{ id: string; name: string; notes: string; favorite_option?: string } | null>(null);
  const [viewingCustDetail, setViewingCustDetail] = useState<Customer | null>(null);

  const handleCustCityChange = (newCity: string) => {
    setCustCity(newCity);
    const districts = CITY_DISTRICTS[newCity] || [];
    setCustDistrict(districts[0] || '');
  };

  // --- CLOUD DATABASE (SUPABASE) STATE ---
  const [supabaseCreds, setSupabaseCreds] = useState(() => getSupabaseCredentials());
  const [inputDbUrl, setInputDbUrl] = useState(supabaseCreds.url);
  const [inputDbKey, setInputDbKey] = useState(supabaseCreds.key);

  // --- NEW MENU STATE ---
  const [isAddingMenu, setIsAddingMenu] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newHarga, setNewHarga] = useState(18000);
  const [newDeskripsi, setNewDeskripsi] = useState('');
  const [newFoto, setNewFoto] = useState('');
  const [newStokHarian, setNewStokHarian] = useState<number | ''>('');
  const [newServingType, setNewServingType] = useState<'matang_only' | 'frozen_only' | 'both'>('matang_only');

  // --- EDIT MENU STATE ---
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // --- MENU FILTER & SEARCH STATE ---
  const [menuServingFilter, setMenuServingFilter] = useState<'all' | 'matang_only' | 'frozen_only' | 'both'>('all');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  const countMatangOnly = useMemo(() => {
    return menus.filter((m) => (m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only')) === 'matang_only').length;
  }, [menus]);

  const countFrozenOnly = useMemo(() => {
    return menus.filter((m) => (m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only')) === 'frozen_only').length;
  }, [menus]);

  const countBoth = useMemo(() => {
    return menus.filter((m) => (m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only')) === 'both').length;
  }, [menus]);

  const filteredDashboardMenus = useMemo(() => {
    return menus.filter((m) => {
      const st = m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only');
      if (menuServingFilter !== 'all' && st !== menuServingFilter) {
        return false;
      }
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase();
        return m.nama.toLowerCase().includes(q) || (m.deskripsi && m.deskripsi.toLowerCase().includes(q));
      }
      return true;
    });
  }, [menus, menuServingFilter, menuSearchQuery]);

  // --- SETTINGS FORM STATE ---
  const [localConfig, setLocalConfig] = useState<StoreConfig>({ ...storeConfig });
  const [showClosedPreview, setShowClosedPreview] = useState(false);
  const [activePin, setActivePin] = useState(() => storageService.getOwnerPin());
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditEntry[]>(() => getSecurityAuditLogs());

  useEffect(() => {
    const handleSecLogs = () => {
      setSecurityLogs(getSecurityAuditLogs());
    };
    window.addEventListener('dulang_security_log_updated', handleSecLogs);
    return () => {
      window.removeEventListener('dulang_security_log_updated', handleSecLogs);
    };
  }, []);

  // --- PWA / APK INSTALL STATE (Step 8) ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    setLocalConfig({ ...storeConfig });
  }, [storeConfig]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      onShowToast('Aplikasi Dulang berhasil dipasang di HP! 📱🎉');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // --- REAL-TIME WHATSAPP BRIDGE & ORDER SYNC LISTENERS ---
  useEffect(() => {
    // 1. Listen to Vite HMR WebSocket custom events (from terminal/external bridge)
    const hot = (import.meta as any).hot;
    if (hot) {
      const handleIncomingWa = (payload: any) => {
        console.log('[Dulang WA Bridge] Incoming order detected from WhatsApp:', payload);
        const order = storageService.addOrderFromWhatsApp(payload);
        playNewCustomerChime();
        setOrders(storageService.getOrders());
        setCustomers(storageService.getCustomers());
        onUpdateMenus(storageService.getMenus());
        onShowToast(`🔔 Pesanan Baru WhatsApp: #${order.id} (${order.customer_name}) masuk ke antrean! 🥟✨`);
      };

      const handleIncomingStock = (payload: any) => {
        if (payload?.rawText) {
          const res = storageService.parseAndUpdateStock(payload.rawText);
          onUpdateMenus(storageService.getMenus());
          playNewCustomerChime();
          onShowToast(`📦 Stok Menu Disinkronkan dari WhatsApp! (${res.targetPeriod}) 🥟✨`);
        }
      };

      hot.on('dulang:wa-incoming-order', handleIncomingWa);
      hot.on('dulang:wa-stock-updated', handleIncomingStock);
      return () => {
        hot.off('dulang:wa-incoming-order', handleIncomingWa);
        hot.off('dulang:wa-stock-updated', handleIncomingStock);
      };
    }
  }, []);

  useEffect(() => {
    // 2. Listen to custom event dulang_orders_updated & dulang_menus_updated
    const handleOrdersUpdated = () => {
      setOrders(storageService.getOrders());
      setCustomers(storageService.getCustomers());
      onUpdateMenus(storageService.getMenus());
    };
    const handleMenusUpdated = () => {
      onUpdateMenus(storageService.getMenus());
    };

    window.addEventListener('dulang_orders_updated', handleOrdersUpdated);
    window.addEventListener('dulang_menus_updated', handleMenusUpdated);

    return () => {
      window.removeEventListener('dulang_orders_updated', handleOrdersUpdated);
      window.removeEventListener('dulang_menus_updated', handleMenusUpdated);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) {
      alert('Untuk memasang di HP Android: buka menu titik tiga (⋮) di pojok kanan atas browser Chrome, lalu pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".');
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      onShowToast('Memasang Aplikasi Dulang ke HP... 📱✨');
    }
    setInstallPrompt(null);
  };

  // --- IMAGE CROP & COMPRESSION STATE ---
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTitle, setCropTitle] = useState('Sesuaikan Sisi Foto Menu (1:1 Kotak)');
  const cropCallbackRef = useRef<((url: string) => void) | null>(null);

  const triggerImageCrop = (file: File, title: string, onDone: (url: string) => void) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg')) {
      alert('Format foto wajib JPG, PNG, atau WebP ya!');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar (maksimal 15 MB). Silakan pilih foto lain!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
        setCropTitle(title);
        cropCallbackRef.current = onDone;
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- REAL-TIME & NOTIFICATION STATE ---
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isAudioEnabled());
  const [recentAlert, setRecentAlert] = useState<{ customer: Customer; isRepeat?: boolean; id: string } | null>(null);
  const [highlightedCustId, setHighlightedCustId] = useState<string | null>(null);
  const knownCustMapRef = useRef<Map<string, number>>(new Map());
  const isInitializedRef = useRef<boolean>(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setAudioEnabled(next);
    if (next) {
      playNewCustomerChime();
      onShowToast('Suara notifikasi bell diaktifkan 🔔');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } else {
      onShowToast('Suara notifikasi bell dimatikan 🔕');
    }
  };

  const handleTestSound = () => {
    playNewCustomerChime();
    onShowToast('Ting-dong! 🔔 Suara bell notifikasi aktif');
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Helper when an incoming customer arrives via WebSocket or Auto-Polling
  const handleIncomingCustomer = (cust: Customer) => {
    if (!cust || !cust.qr_code_id) return;
    const cleanQr = cust.qr_code_id.toUpperCase();
    const prevOrders = knownCustMapRef.current.get(cleanQr);

    if (prevOrders === undefined) {
      // NEW CUSTOMER
      knownCustMapRef.current.set(cleanQr, cust.total_orders || 1);

      if (isInitializedRef.current) {
        playNewCustomerChime();
        setRecentAlert({ customer: cust, isRepeat: false, id: cust.id });
        setHighlightedCustId(cust.id || cleanQr);
        onShowToast(`🔔 Pelanggan Baru! Kak ${cust.name} (${cust.area || 'Sidoarjo'}) baru saja scan stiker ${cust.qr_code_id}! ✨`);
        setTimeout(() => setHighlightedCustId(null), 8000);
      }
    } else if ((cust.total_orders || 1) > prevOrders) {
      // REPEAT SCAN / ORDER
      knownCustMapRef.current.set(cleanQr, cust.total_orders || 1);

      if (isInitializedRef.current) {
        playNewCustomerChime();
        setRecentAlert({ customer: cust, isRepeat: true, id: cust.id });
        setHighlightedCustId(cust.id || cleanQr);
        onShowToast(`🔁 Repeat Order! Kak ${cust.name} scan lagi (${cust.total_orders}x)!`);
        setTimeout(() => setHighlightedCustId(null), 8000);
      }
    }

    setCustomers((prev) => {
      const idx = prev.findIndex((p) => p.qr_code_id.toUpperCase() === cleanQr || p.id === cust.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = cust;
        return next;
      }
      return [cust, ...prev];
    });
  };

  // Auto-dismiss floating alert card after 10s
  useEffect(() => {
    if (!recentAlert) return;
    const timer = setTimeout(() => setRecentAlert(null), 10000);
    return () => clearTimeout(timer);
  }, [recentAlert]);

  // --- CUSTOMER AUTO-RELOAD & REALTIME SYNC ---
  const reloadCustomers = async () => {
    const local = storageService.getCustomers();
    setCustomers(local);
    local.forEach((c) => {
      if (c.qr_code_id) {
        knownCustMapRef.current.set(c.qr_code_id.toUpperCase(), c.total_orders || 1);
      }
    });

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setIsSyncingCloud(true);
      try {
        const synced = await storageService.fetchCustomersFromCloud();
        setCustomers(synced);
        synced.forEach((c) => {
          if (c.qr_code_id) {
            knownCustMapRef.current.set(c.qr_code_id.toUpperCase(), c.total_orders || 1);
          }
        });
      } catch (err) {
        console.warn('Sync failed:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }
  };

  useEffect(() => {
    // 1. Initial Load
    reloadCustomers().then(() => {
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 1000);
    });

    // 2. Realtime Subscription (Supabase WebSocket)
    const unsubscribe = storageService.subscribeToCustomers((cust) => {
      handleIncomingCustomer(cust);
    });

    // 3. Heartbeat polling fallback every 5 seconds (Guarantees zero-refresh updates)
    const pollInterval = setInterval(async () => {
      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        try {
          const fresh = await storageService.fetchCustomersFromCloud();
          if (Array.isArray(fresh)) {
            fresh.forEach((c) => handleIncomingCustomer(c));
          }
        } catch {
          // ignore network hiccups
        }
      }
    }, 5000);

    // 4. Local storage / window events
    const handleUpdate = () => {
      const local = storageService.getCustomers();
      local.forEach((c) => handleIncomingCustomer(c));
      setVouchers(storageService.getVouchers());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('dulang_customers_updated', handleUpdate);
    window.addEventListener('dulang_vouchers_updated', handleUpdate);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('dulang_customers_updated', handleUpdate);
      window.removeEventListener('dulang_vouchers_updated', handleUpdate);
    };
  }, []);

  const handleAddNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custWa.trim() || !custStreetDetail.trim()) {
      alert('Nama, Nomor WhatsApp, dan Detail Jalan/Alamat wajib diisi yaa');
      return;
    }

    const cleanId = custQrId.trim().toUpperCase() || `DULANG-${Date.now().toString().slice(-4)}`;
    const cleanStreet = custStreetDetail.trim();
    const cleanVillage = custVillage.trim();
    const formattedAddress = cleanVillage
      ? `${cleanStreet}, Kel./Desa ${cleanVillage}`
      : cleanStreet;

    const saved = await storageService.saveCustomer({
      qr_code_id: cleanId,
      name: custName.trim(),
      wa: custWa.trim().replace(/[^0-9]/g, ''),
      address: formattedAddress,
      area: custDistrict,
      city: custCity,
      district: custDistrict,
      village: cleanVillage,
      street_detail: cleanStreet,
      favorite_menu: custMenu,
      birth_day: custBirthDay ? Number(custBirthDay) : undefined,
      birth_month: custBirthMonth ? Number(custBirthMonth) : undefined,
      consent_at: new Date().toISOString(),
    });

    setCustName('');
    setCustWa('');
    setCustStreetDetail('');
    setCustVillage('');
    setCustQrId('');
    setCustBirthDay('');
    setCustBirthMonth('');
    setIsAddingCustomer(false);
    await reloadCustomers();
    onShowToast(`Pelanggan "${saved.name}" (ID: ${saved.qr_code_id}) berhasil dicatat! ✓`);
  };

  // --- VOUCHERS & BIRTHDAY HANDLERS (Step 6 & 7) ---
  const generateVoucherCode = (name: string) => {
    const cleanName = (name.trim() || 'SAHABAT')
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    const words = ['LUMER', 'GURIH', 'ANGET', 'RENYAH', 'MANTAP', 'HEBAT'];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const code = `${cleanName}-${word}-${num}`;
    setVCode(code);
    setVChildCode(`${cleanName}-BONUS-${num}`);
    return code;
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vRecipient.trim() || !vCode.trim() || vDiscountValue <= 0) {
      alert('Nama penerima, kode voucher, dan nilai diskon wajib diisi!');
      return;
    }

    const cleanCode = vCode.trim().toUpperCase();
    const newVoucher: Voucher = {
      code: cleanCode,
      recipientName: vRecipient.trim(),
      discountType: vDiscountType,
      discountValue: Number(vDiscountValue),
      minOrder: Number(vMinOrder) || 0,
      description: vDescription.trim() || undefined,
      isUsed: false,
      createdAt: new Date().toISOString(),
      childVoucher: vHasChild
        ? {
            title: vChildTitle.trim() || 'Tiket Emas Dapur',
            perk: vChildPerk.trim() || 'Bonus Menu Dapur',
            condition: vChildCondition.trim() || 'Untuk order berikutnya',
            unlockCode: (vChildCode.trim() || `${cleanCode}-BONUS`).toUpperCase(),
          }
        : undefined,
    };

    await storageService.saveVoucher(newVoucher);
    setVouchers(storageService.getVouchers());
    setIsAddingVoucher(false);
    setVRecipient('');
    setVCode('');
    onShowToast(`Voucher "${cleanCode}" untuk Kak ${newVoucher.recipientName} berhasil dibuat! 🎟️✨`);
  };

  const handleToggleVoucherUsed = async (v: Voucher) => {
    const updated = { ...v, isUsed: !v.isUsed, usedAt: !v.isUsed ? new Date().toISOString() : undefined };
    await storageService.saveVoucher(updated);
    setVouchers(storageService.getVouchers());
    onShowToast(`Status voucher "${v.code}" diubah jadi ${!v.isUsed ? 'Sudah Dipakai' : 'Aktif Kembali'}!`);
  };

  const handleDeleteVoucher = async (code: string) => {
    if (confirm(`Hapus voucher "${code}" dari sistem?`)) {
      await storageService.deleteVoucher(code);
      setVouchers(storageService.getVouchers());
      onShowToast(`Voucher "${code}" berhasil dihapus.`);
    }
  };

  const handleCopyVoucherWhatsApp = (v: Voucher) => {
    const discountText =
      v.discountType === 'nominal'
        ? `Rp ${v.discountValue.toLocaleString('id-ID')}`
        : `${v.discountValue}%`;
    const minText = v.minOrder > 0 ? ` (min. belanja Rp ${v.minOrder.toLocaleString('id-ID')})` : ' (tanpa minimal beli!)';
    const childText = v.childVoucher
      ? `\n🎁 *Bonus Rahasia:* Ada tiket "${v.childVoucher.perk}" yang otomatis terbuka setelah dipakai!`
      : '';

    const msg = `Halo Kak ${v.recipientName}! ✨\n\nAda traktiran hangat spesial dari Tim Dulang Indonesia buat kamu nih! 🥟💛\n\n🎟️ Kode Voucher: *${v.code}*\n💰 Potongan: *${discountText}*${minText}${childText}\n\nYuk buka https://dulangin.netlify.app sekarang buat amankan risoles angetmu hari ini! Salam hangat dari Tim Dulang Indonesia 🙏`;

    navigator.clipboard.writeText(msg);
    onShowToast(`Pesan WA voucher untuk Kak ${v.recipientName} disalin ke clipboard! 📋✓`);
  };

  const handleSendBirthdayGreeting = (c: Customer) => {
    const bdayCode = `${c.name.split(' ')[0].toUpperCase()}-ULTAH-${c.birth_day || 27}`;
    storageService.saveVoucher({
      code: bdayCode,
      recipientName: c.name,
      discountType: 'nominal',
      discountValue: 10000,
      minOrder: 0,
      description: `Traktiran Ulang Tahun Spesial buat Kak ${c.name}`,
      isUsed: false,
      createdAt: new Date().toISOString(),
      childVoucher: {
        title: 'Tiket Kejutan Ultah: Bebas Tambah Risoles Favorit',
        perk: `Gratis 1 Porsi ${c.favorite_menu}`,
        condition: 'Berlaku saat repeat order minggu ini',
        unlockCode: `${bdayCode}-BONUS`,
      },
    });
    setVouchers(storageService.getVouchers());

    const msg = `Halo Kak ${c.name}! 🎉✨\n\nSelamat Ulang Tahun dari segenap Tim Dulang Indonesia! Semoga selalu dilimpahkan kesehatan, kebahagiaan, dan rezeki yang berkah 💛\n\nSebagai tanda sayang dari dapur kami, ini ada traktiran spesial potongan Rp 10.000 (tanpa minimal beli!) buat Kak ${c.name.split(' ')[0]}:\n🎟️ Kode Voucher: *${bdayCode}*\n\nBisa langsung dipakai pas pesan risoles anget hari ini yaa di: https://dulangin.netlify.app 🥟🔥`;
    const url = `https://wa.me/${c.wa}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onShowToast(`Pesan traktiran ultah Kak ${c.name} disiapkan di WA! Voucher ${bdayCode} aktif ✓`);
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    if (confirm(`Hapus data pelanggan "${name}" dari daftar?`)) {
      storageService.deleteCustomer(id);
      setCustomers(storageService.getCustomers());
      setViewingCustDetail((prev) => (prev?.id === id ? null : prev));
      onShowToast(`Data "${name}" berhasil dihapus.`);
    }
  };

  const handleCopyCourierReceipt = (c: Customer) => {
    const fullAddress = [
      c.address,
      c.district ? `Kec. ${c.district}` : (c.area ? `Kec. ${c.area}` : ''),
      c.city || 'Kab. Sidoarjo',
    ]
      .filter(Boolean)
      .join(', ');

    const receiptText = `📦 PENGIRIMAN DULANG INDONESIA 🥟
Penerima: ${c.name} (+${c.wa.replace(/[^0-9]/g, '')})
Alamat Antar: ${fullAddress}
Menu Pesanan: ${c.favorite_menu} (${c.total_orders}x order)
ID Dus Stiker: ${c.qr_code_id}
Catatan Kurir: Pastikan posisi dus ditaruh datar agar mayo tidak tumpah ya kak.`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(receiptText);
      onShowToast(`Format resi kurir Kak ${c.name} berhasil disalin! Siap dipaste ke Grab/Gojek 📋✨`);
    } else {
      prompt('Salin teks resi pengiriman:', receiptText);
    }
  };

  // --- EXPENSE PRESETS & HANDLERS ---
  const expensePresets: { label: string; name: string; category: ExpenseCategory; nominal: number; notes: string }[] = [
    { label: 'Minyak Bimoli 2L (Rp 38.000)', name: 'Minyak Goreng Bimoli 2L', category: 'bahan_baku', nominal: 38000, notes: 'Minyak baru kloter penggorengan' },
    { label: 'Telur Ayam 1 Kg (Rp 28.000)', name: 'Telur Ayam Broiler 1 Kg', category: 'bahan_baku', nominal: 28000, notes: 'Bahan isian mayo & adonan kulit' },
    { label: 'Gas Elpiji 3 Kg (Rp 22.000)', name: 'Refill Tabung Gas 3 Kg', category: 'operasional', nominal: 22000, notes: 'Bahan bakar kompor dapur' },
    { label: 'Smoke Beef 500g (Rp 45.000)', name: 'Daging Asap / Smoke Beef 500g', category: 'bahan_baku', nominal: 45000, notes: 'Isian Risoles Mayo Spesial' },
    { label: 'Mayones MamaSuka 1 Kg (Rp 32.000)', name: 'Mayones MamaSuka 1 Kg', category: 'bahan_baku', nominal: 32000, notes: 'Saus mayo lumer resep rahasia' },
    { label: 'Dus Box Dulang 50 Pcs (Rp 35.000)', name: 'Kardus Box Dulang Cetak (50 pcs)', category: 'kemasan', nominal: 35000, notes: 'Dus kemasan bawa pulang & hajatan' },
    { label: 'Cabe Rawit Hijau 1/2 Kg (Rp 18.000)', name: 'Cabe Rawit Hijau Segar 500g', category: 'bahan_baku', nominal: 18000, notes: 'Pelengkap cabe ceplusan' },
    { label: 'Tepung Terigu Segitiga 1 Kg (Rp 12.000)', name: 'Tepung Terigu Segitiga Biru 1 Kg', category: 'bahan_baku', nominal: 12000, notes: 'Bahan kulit risoles renyah' },
  ];

  const handleApplyExpensePreset = (preset: typeof expensePresets[0]) => {
    setExpItemName(preset.name);
    setExpCategory(preset.category);
    setExpNominal(preset.nominal);
    setExpNotes(preset.notes);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expItemName.trim() || !expNominal || Number(expNominal) <= 0) {
      alert('Nama item belanja dan nominal pengeluaran wajib diisi!');
      return;
    }

    storageService.addExpense({
      tanggal: expDate || new Date().toISOString().split('T')[0],
      kategori: expCategory,
      nama_item: expItemName.trim(),
      nominal: Number(expNominal),
      catatan: expNotes.trim() || undefined,
    });

    setExpenses(storageService.getExpenses());
    setIsAddingExpense(false);
    setExpItemName('');
    setExpNominal(38000);
    setExpNotes('');
    onShowToast(`Pengeluaran "${expItemName}" (Rp ${Number(expNominal).toLocaleString('id-ID')}) berhasil dicatat! 📉✓`);
  };

  const handleDeleteExpense = (id: string, name: string) => {
    if (confirm(`Hapus catatan pengeluaran "${name}"?`)) {
      storageService.deleteExpense(id);
      setExpenses(storageService.getExpenses());
      onShowToast(`Catatan pengeluaran "${name}" telah dihapus.`);
    }
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDbUrl.trim() || !inputDbKey.trim()) {
      alert('Project URL dan Anon Key Supabase wajib diisi.');
      return;
    }
    const ok = saveSupabaseCredentials(inputDbUrl, inputDbKey);
    if (ok) {
      const updated = getSupabaseCredentials();
      setSupabaseCreds(updated);
      await reloadCustomers();
      onShowToast('Database Cloud Supabase berhasil terhubung! Data antar-perangkat langsung sinkron 🎉');
    }
  };

  const handleDisconnectSupabase = () => {
    if (confirm('Putuskan koneksi ke Cloud Supabase? Data lokal tetap tersimpan di browser.')) {
      clearSupabaseCredentials();
      const updated = getSupabaseCredentials();
      setSupabaseCreds(updated);
      setInputDbUrl('');
      setInputDbKey('');
      onShowToast('Koneksi Cloud diputus. Sistem kembali ke penyimpanan lokal.');
    }
  };

  // --- ORDERS / KASIR & PENJUALAN HANDLERS ---
  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus, method?: PaymentMethod) => {
    const updated = storageService.updateOrderStatus(orderId, status, method);
    if (updated) {
      setOrders(storageService.getOrders());
      setCustomers(storageService.getCustomers());

      // Kirim sinyal update status ke bot WhatsApp pembeli
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dulang_wa_status_notification', {
            detail: {
              order: updated,
              status,
              method: method || updated.payment_method || 'tunai',
            },
          })
        );
      }

      if (status === 'lunas') {
        const pantry = storageService.getPantryIngredients();
        const low = pantry.filter((p) => p.currentStock <= p.minStock);
        let msg = `Pesanan #${orderId} LUNAS via ${(method || updated.payment_method || 'tunai').toUpperCase()}! Selera & stok bahan baku otomatis diperbarui. 🥟✨`;
        if (low.length > 0) {
          msg += ` ⚠️ Stok (${low.map((i) => i.name).join(', ')}) menipis!`;
        }
        onShowToast(msg);
      } else if (status === 'batal') {
        onShowToast(`Pesanan #${orderId} ditandai batal beli.`);
      } else {
        onShowToast(`Status pesanan #${orderId} diperbarui.`);
      }
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (activeRole !== 'owner') {
      onShowToast('Akses ditolak! Hanya Owner yang berhak menghapus catatan pesanan. 🔒');
      return;
    }
    if (!window.confirm(`Hapus catatan pesanan #${orderId}?`)) return;
    await storageService.deleteOrder(orderId);
    setOrders(storageService.getOrders());
    onShowToast(`Pesanan #${orderId} telah dihapus permanen dari sistem & cloud.`);
  };

  const handleClearAllOrders = async () => {
    if (activeRole !== 'owner') {
      onShowToast('Akses ditolak! Hanya Owner yang berhak mereset semua pesanan. 🔒');
      return;
    }
    if (!window.confirm('Hapus SEMUA riwayat pesanan (termasuk pesanan uji coba)? Tindakan ini permanen.')) return;
    await storageService.clearOrders();
    setOrders([]);
    onShowToast('Semua riwayat pesanan berhasil dibersihkan.');
  };

  const handleSaveDP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpModalOrder) return;
    const nominal = Number(dpInputNominal) || 0;
    if (nominal <= 0) {
      alert('Nominal DP harus lebih dari Rp 0');
      return;
    }
    const updated = storageService.updateOrderDP(dpModalOrder.id, nominal, dpPaymentMethod);
    if (updated) {
      setOrders(storageService.getOrders());
      onShowToast(`Uang Muka (DP) Rp ${nominal.toLocaleString('id-ID')} berhasil dicatat untuk #${dpModalOrder.id}! 💵✨`);
      setDpModalOrder(null);
    }
  };

  const handleSettleOrder = (orderId: string, method: PaymentMethod = 'tunai') => {
    const updated = storageService.updateOrderStatus(orderId, 'lunas', method);
    if (updated) {
      setOrders(storageService.getOrders());
      setCustomers(storageService.getCustomers());
      onShowToast(`Pesanan #${orderId} telah LUNAS sepenuhnya! Data kas & pelanggan diperbarui. ✓🎉`);
    }
  };

  const handleSendDpReminderWA = (ord: OrderRecord) => {
    const dp = ord.dp_amount || 0;
    const sisa = ord.remaining_amount !== undefined ? ord.remaining_amount : (ord.total_price - dp);
    let msg = `Halo Kak ${ord.customer_name}! 🙏✨\n\n`;
    msg += `Terima kasih banyak, pembayaran *Uang Muka (DP)* sebesar *Rp ${dp.toLocaleString('id-ID')}* untuk pesanan *#${ord.id}* telah kami terima di Dapur Dulang. 🥟\n\n`;
    msg += `📋 *Rincian Pesanan:*\n`;
    ord.items.forEach((it) => {
      msg += `• ${it.qty}x ${it.nama}\n`;
    });
    msg += `\n⏰ *Jadwal Kirim/Ambil:* ${ord.delivery_schedule || 'Sesuai Jadwal'}\n`;
    msg += `💰 *Sisa Tagihan Pelunasan:* Rp ${sisa.toLocaleString('id-ID')}\n\n`;
    msg += `Sisa pembayaran dapat dilunasi saat serah terima pesanan (Tunai / QRIS). Dapur kami siap goreng fresh! Terima kasih banyak Kak! 🙏✨`;

    const waNum = (ord.customer_wa || '').replace(/\D/g, '');
    const url = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleSendFriendlyGreeting = (c: Customer) => {
    let msg = `Halo Kak ${c.name}! 😊🙏\n\n`;
    msg += `Salam hangat dari Tim Dapur Dulang Indonesia.\n`;
    msg += `Semoga harinya menyenangkan ya Kak!\n\n`;
    msg += `Dapur Dulang hari ini lagi goreng kloter fresh *${c.favorite_menu || 'Risoles Mayo Lumer'}*. Barangkali Kak ${c.name} lagi kangen yang anget-anget dan gurih dari wajan, mau kita siapin buat sore ini? 🥟🔥\n\n`;
    msg += `Bisa langsung pesan santai via web resmi kami:\n`;
    msg += `https://dulangweb.vercel.app/\n\n`;
    msg += `Terima kasih banyak ya Kak ${c.name}! Sehat selalu sekeluarga 🙏✨`;

    const waNum = c.wa ? c.wa.replace(/\D/g, '') : '';
    const url = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    storageService.markCustomerGreeted(c.id);
    setCustomers(storageService.getCustomers());
    onShowToast(`Draft sapaan untuk Kak ${c.name} dibuka di WhatsApp! Tanggal disapa tercatat. 📱✨`);
  };

  const getCustomerLastOrderDate = (c: Customer): string | undefined => {
    if (c.last_order_at) return c.last_order_at;
    const cleanQr = c.qr_code_id ? c.qr_code_id.toUpperCase() : '';
    const cleanWa = c.wa ? c.wa.replace(/\D/g, '') : '';
    const cleanName = c.name.trim().toLowerCase();
    const custOrders = orders.filter(
      (o) =>
        (cleanQr && o.customer_qr_id && o.customer_qr_id.toUpperCase() === cleanQr) ||
        (cleanWa && o.customer_wa && o.customer_wa.replace(/\D/g, '') === cleanWa) ||
        (o.customer_name.trim().toLowerCase() === cleanName)
    );
    if (custOrders.length > 0) {
      const sorted = [...custOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return sorted[0].created_at;
    }
    return c.last_scan_at || c.consent_at || undefined;
  };

  const formatRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hr lalu`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} mgg lalu`;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const isDormantCust = (c: Customer) => {
    const lastActiveStr = c.last_order_at || c.last_scan_at || c.consent_at || c.first_scan_at;
    if (!lastActiveStr) return false;
    const lastActiveDate = new Date(lastActiveStr);
    if (isNaN(lastActiveDate.getTime())) return false;
    const diffDays = (Date.now() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 14;
  };

  const handleAddWalkInItem = () => {
    const menuObj = menus.find((m) => m.id === walkInSelectedMenu);
    if (!menuObj) return;
    setWalkInCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) =>
          i.menu_id === menuObj.id &&
          (i.pilihanOpsi || '') === (walkInSelectedOpsi || '') &&
          (i.variantType || 'matang') === walkInVariant
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].qty += walkInQty;
        return next;
      }
      return [
        ...prev,
        {
          menu_id: menuObj.id,
          nama: menuObj.nama,
          harga: menuObj.harga,
          qty: walkInQty,
          pilihanOpsi: walkInSelectedOpsi || undefined,
          variantType: walkInVariant,
        },
      ];
    });
    setWalkInQty(1);
    setWalkInSelectedOpsi('');
  };

  const handleSaveWalkInOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (walkInCart.length === 0) {
      alert('Pilih minimal 1 item menu yang dibeli!');
      return;
    }
    const totalPrice = walkInCart.reduce((sum, item) => sum + item.harga * item.qty, 0);
    const cashRec = walkInPaymentMethod === 'tunai'
      ? (typeof walkInCashReceived === 'number' ? walkInCashReceived : totalPrice)
      : undefined;
    const cashChg = cashRec !== undefined ? Math.max(0, cashRec - totalPrice) : undefined;

    const newOrder: OrderRecord = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      customer_name: walkInCustName.trim() || 'Pelanggan Walk-In',
      customer_wa: walkInCustWa.trim() || undefined,
      items: walkInCart,
      total_price: totalPrice,
      payment_method: walkInPaymentMethod,
      status: 'lunas',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      channel: 'walk_in',
      notes: walkInNotes.trim() || undefined,
      cash_received: cashRec,
      cash_change: cashChg,
    };
    storageService.addOrder(newOrder);
    storageService.updateCustomerIntelligence(newOrder);
    const { lowStockItems } = storageService.deductIngredientsForOrder(newOrder);
    setOrders(storageService.getOrders());
    setCustomers(storageService.getCustomers());
    onUpdateMenus(storageService.getMenus());
    setIsAddingWalkInOrder(false);
    setWalkInCustName('');
    setWalkInCustWa('');
    setWalkInNotes('');
    setWalkInCart([]);
    setWalkInCashReceived('');
    setSelectedOrderForReceipt(newOrder);
    let toastMsg = `Transaksi Dapur senilai Rp ${totalPrice.toLocaleString('id-ID')} (${walkInPaymentMethod.toUpperCase()}) Lunas! Bahan baku terpotong otomatis. 🧾✨`;
    if (lowStockItems.length > 0) {
      toastMsg += ` ⚠️ Peringatan: Stok ${lowStockItems.map((i) => i.name).join(', ')} menipis!`;
    }
    onShowToast(toastMsg);
  };

  const handleQuickWaOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickWaOrderText.trim();
    if (!text) return;

    // Cek apakah perintah Update Stok (e.g. "Update stok 5/10/26 Risol Mayo 30...", "menu besok ready semua stok 30 semua")
    const lower = text.toLowerCase();
    if (
      lower.startsWith('update stok') ||
      lower.includes('ready semua stok') ||
      lower.includes('stok semua') ||
      lower.startsWith('stok:')
    ) {
      const stockRes = storageService.parseAndUpdateStock(text);
      if (stockRes.success) {
        playNewCustomerChime();
        onUpdateMenus(storageService.getMenus());
        setQuickWaOrderText('');
        onShowToast(`📦 ${stockRes.updatedCount} Menu Disinkronkan! (${stockRes.targetPeriod}) ✨`);
        alert(stockRes.message);
        return;
      }
    }

    const res = storageService.parseAndAddNaturalOrder(text, {
      channel: 'web_wa',
      status: 'lunas',
    });

    if (res.success && res.order) {
      playNewCustomerChime();
      const { lowStockItems } = storageService.deductIngredientsForOrder(res.order);
      setOrders(storageService.getOrders());
      setCustomers(storageService.getCustomers());
      onUpdateMenus(storageService.getMenus());
      setSelectedOrderForReceipt(res.order);
      setQuickWaOrderText('');
      let msg = `⚡ ${res.message} 🔔`;
      if (lowStockItems.length > 0) {
        msg += ` ⚠️ Stok bahan (${lowStockItems.map((i) => i.name).join(', ')}) menipis!`;
      }
      onShowToast(msg);
    } else {
      alert(res.message || 'Gagal memproses teks pesanan!');
    }
  };

  // --- TESTIMONIALS HANDLERS ---
  const handleToggleTestimonial = (id: string) => {
    const updated = storageService.toggleTestimonial(id);
    if (updated) {
      setTestimonials(storageService.getTestimonials());
      onShowToast(updated.is_active ? 'Ulasan diaktifkan di halaman depan! 🌟' : 'Ulasan disembunyikan dari depan.');
    }
  };

  const handleDeleteTestimonial = (id: string, name: string) => {
    if (!window.confirm(`Hapus ulasan dari ${name}?`)) return;
    storageService.deleteTestimonial(id);
    setTestimonials(storageService.getTestimonials());
    onShowToast('Ulasan berhasil dihapus.');
  };

  const handleSaveNewTestimonial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testiCustName.trim() || !testiComment.trim()) {
      alert('Nama dan ulasan wajib diisi!');
      return;
    }
    const newT: CustomerTestimonial = {
      id: `testi-${Date.now()}`,
      customer_name: testiCustName.trim(),
      area: testiArea.trim() || 'Sidoarjo',
      comment: testiComment.trim(),
      favorite_menu: testiMenu,
      created_at: new Date().toISOString(),
      is_active: true,
      rating: testiRating,
    };
    storageService.addTestimonial(newT);
    setTestimonials(storageService.getTestimonials());
    setIsAddingTesti(false);
    setTestiCustName('');
    setTestiComment('');
    onShowToast('Ulasan pelanggan berhasil ditambahkan & langsung aktif! 💬');
  };

  // --- CUSTOMER INTELLIGENCE / NOTES HANDLER ---
  const handleSaveCustomerNotes = () => {
    if (!editingCustNotes) return;
    const allCust = storageService.getCustomers();
    const updated = allCust.map((c) =>
      c.id === editingCustNotes.id
        ? {
            ...c,
            notes: editingCustNotes.notes,
            favorite_option: editingCustNotes.favorite_option,
          }
        : c
    );
    storageService.saveCustomers(updated);
    setCustomers(updated);
    if (viewingCustDetail && viewingCustDetail.id === editingCustNotes.id) {
      setViewingCustDetail({
        ...viewingCustDetail,
        notes: editingCustNotes.notes,
        favorite_option: editingCustNotes.favorite_option,
      });
    }
    setEditingCustNotes(null);
    onShowToast('Catatan selera pelanggan berhasil disimpan! 📝✨');
  };

  // --- MENU HANDLERS ---
  const handleUpdateItem = (id: string, updates: Partial<MenuItem>) => {
    const updated = menus.map((m) => (m.id === id ? { ...m, ...updates } : m));
    onUpdateMenus(updated);
    storageService.saveMenus(updated);
  };

  const handleToggleTersedia = (id: string) => {
    const item = menus.find((m) => m.id === id);
    if (!item) return;
    handleUpdateItem(id, { tersedia: !item.tersedia });
    onShowToast(`Menu "${item.nama}" diubah jadi ${!item.tersedia ? 'Tersedia' : 'Habis'}`);
  };

  const handleToggleTersediaBesok = (id: string) => {
    const item = menus.find((m) => m.id === id);
    if (!item) return;
    const nextVal = item.tersediaBesok === false;
    handleUpdateItem(id, { tersediaBesok: nextVal });
    onShowToast(`Menu "${item.nama}" untuk pre-order besok diset ${nextVal ? 'Tersedia' : 'Penuh/Tutup'}`);
  };

  const handleDeleteItem = (id: string) => {
    const item = menus.find((m) => m.id === id);
    if (!item) return;
    if (confirm(`Yakin mau hapus menu "${item.nama}"?`)) {
      const updated = menus.filter((m) => m.id !== id);
      onUpdateMenus(updated);
      storageService.saveMenus(updated);
      onShowToast(`Menu "${item.nama}" berhasil dihapus`);
    }
  };

  const handleAddNewMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) return;

    const stockQty = newStokHarian !== '' ? Number(newStokHarian) : null;
    const newItem: MenuItem = {
      id: `menu-${Date.now()}`,
      nama: newNama.trim(),
      harga: newHarga,
      deskripsi: newDeskripsi.trim() || 'Menu spesial wajan panas dapur Dulang.',
      foto: newFoto.trim() || undefined,
      tersedia: true,
      stokHarian: stockQty,
      sisaStok: stockQty,
      servingType: newServingType,
      variantType: newServingType === 'frozen_only' ? 'frozen' : 'matang',
    };

    const updated = [...menus, newItem];
    onUpdateMenus(updated);
    storageService.saveMenus(updated);

    setNewNama('');
    setNewHarga(18000);
    setNewDeskripsi('');
    setNewFoto('');
    setNewStokHarian('');
    setNewServingType('matang_only');
    setIsAddingMenu(false);
    onShowToast(`Menu baru "${newItem.nama}" siap disajikan! ✨`);
  };

  const handleSaveEditedMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    handleUpdateItem(editingItem.id, editingItem);
    setEditingItem(null);
    onShowToast(`Menu "${editingItem.nama}" berhasil diperbarui! ✓`);
  };

  // --- KASIR STRUK THERMAL & WHATSAPP NOTA ---
  const generateReceiptTextForWhatsApp = (ord: OrderRecord): string => {
    const brandTitle = (storeConfig.brandName || 'Dapur Dulang Indonesia').toUpperCase();
    const brandTag = storeConfig.brandTagline || 'Dibuat dengan wajan panas & tulisan tangan';
    const footerMsg = storeConfig.receiptFooterNote || 'Matur suwun sanget sampun jajan! Hangatkan kembali bila perlu yaa 🙏✨';

    const dateStr = new Date(ord.created_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsText = ord.items
      .map((it) => {
        const opt = it.pilihanOpsi ? (it.qty > 1 ? ` (_Semua ${it.pilihanOpsi} • ${it.qty} pcs_)` : ` (_${it.pilihanOpsi}_)`) : '';
        const vType = it.variantType === 'frozen' ? ' [❄️ Frozen]' : ' [🍳 Matang]';
        return `• *${it.qty}x ${it.nama}*${opt}${vType} = Rp ${(it.harga * it.qty).toLocaleString('id-ID')}`;
      })
      .join('\n');

    let cashInfo = '';
    if (ord.payment_method === 'tunai' && ord.cash_received) {
      cashInfo = `\n*Uang Tunai:* Rp ${ord.cash_received.toLocaleString(
        'id-ID'
      )}\n*Kembalian:* Rp ${(ord.cash_change || 0).toLocaleString('id-ID')}`;
    }

    let giftInfo = '';
    if (ord.is_gift || ord.gift_recipient) {
      giftInfo =
        `🎁 *PESANAN HADIAH UNTUK:* Kak ${ord.gift_recipient || 'Istimewa'}\n` +
        (ord.gift_message ? `💌 *Ucapan:* "${ord.gift_message}"\n` : '') +
        `----------------------------------------\n`;
    }

    return (
      `*🧾 NOTA RESMI ${brandTitle}*\n` +
      `_${brandTag}_\n` +
      `----------------------------------------\n` +
      `*No. Pesanan:* #${ord.id}\n` +
      `*Waktu:* ${dateStr}\n` +
      `*Pelanggan:* ${ord.customer_name}\n` +
      `*Metode Bayar:* ${(ord.payment_method || 'Tunai').toUpperCase()}\n` +
      `*Layanan:* ${ord.delivery_method === 'delivery' ? `🛵 Antar Kurir (${ord.shipping_district || 'Sidoarjo'})` : `🍳 Ambil di Dapur (${storeConfig.pickupAddressNote || 'Sedati, Sidoarjo'})`}\n` +
      (ord.delivery_method === 'delivery' && ord.notes ? `*Alamat / Catatan:* ${ord.notes}\n` : '') +
      `----------------------------------------\n` +
      `${giftInfo}` +
      `${itemsText}\n` +
      `----------------------------------------\n` +
      `*TOTAL TAGIHAN: Rp ${ord.total_price.toLocaleString('id-ID')}*\n` +
      `${cashInfo}\n` +
      `*STATUS: LUNAS* ✓\n` +
      `----------------------------------------\n` +
      `📍 *Pantau Wajan & Status Gorenganmu:* https://dulangweb.vercel.app/?track=${ord.id}\n` +
      `----------------------------------------\n` +
      `${footerMsg}\n`
    );
  };

  const handleShareReceiptToWA = (ord: OrderRecord) => {
    const text = generateReceiptTextForWhatsApp(ord);
    const cleanWa = ord.customer_wa ? ord.customer_wa.replace(/\D/g, '') : '';
    const phone = cleanWa ? (cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa) : '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendInvoiceWhatsApp = (ord: OrderRecord) => {
    const cleanWa = ord.customer_wa ? ord.customer_wa.replace(/\D/g, '') : '';
    const phone = cleanWa ? (cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa) : '';
    const brandDisplayName = storeConfig.brandName || 'Dapur Dulang Indonesia';

    const nmid = storeConfig.qrisNmid || 'ID1020057244342';
    const qrisUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/qris-dulang.png`
      : 'https://dulangweb.vercel.app/qris-dulang.png';

    const itemsText = ord.items
      .map((it) => {
        const opt = it.pilihanOpsi ? (it.qty > 1 ? ` [Semua ${it.pilihanOpsi} • ${it.qty} pcs]` : ` [${it.pilihanOpsi}]`) : '';
        const vType = it.variantType === 'frozen' ? ' [❄️ Frozen Beku]' : ' [🍳 Goreng Matang]';
        return `• ${it.qty}x ${it.nama}${opt}${vType} = Rp ${(it.harga * it.qty).toLocaleString('id-ID')}`;
      })
      .join('\n');

    let msg = `Halo Kak ${ord.customer_name}! 🙏✨\n`;
    msg += `Terima kasih banyak sudah memesan di *${brandDisplayName}* 💛\n\n`;
    msg += `📋 *RINCIAN TAGIHAN PESANAN (#${ord.id}):*\n`;
    msg += `${itemsText}\n`;
    if (ord.shipping_cost && ord.shipping_cost > 0) {
      msg += `🛵 Ongkir (${ord.shipping_district || 'Sidoarjo'}): Rp ${ord.shipping_cost.toLocaleString('id-ID')}\n`;
    }
    msg += `--------------------------------------\n`;
    msg += `*✨ TOTAL TAGIHAN: Rp ${ord.total_price.toLocaleString('id-ID')}*\n`;
    msg += `Status: *${ord.status === 'lunas' ? 'LUNAS (Terima Kasih! ✓)' : 'MENUNGGU PEMBAYARAN'}*\n\n`;

    msg += `📱 *PEMBAYARAN VIA QRIS (GPN):*\n`;
    msg += `• *Nama Merchant:* ${brandDisplayName.toUpperCase()}\n`;
    msg += `• *NMID:* ${nmid}\n`;
    msg += `• *Dukungan:* Bebas transfer dari semua Bank (BCA, Mandiri, BRI, BSI, dll) & E-Wallet (GoPay, OVO, ShopeePay, DANA, AstraPay)\n`;
    msg += `• *Link Barcode QRIS:* ${qrisUrl}\n`;
    msg += `• *Cara Bayar:* Silakan scan barcode QRIS yang kami lampirkan di chat ini atau klik link di atas ya Kak 😊\n\n`;

    msg += `Jika sudah scan & bayar, mohon kirimkan bukti tangkapan layar (screenshot) ke sini ya kak agar pesanan langsung kami proses hangat-hangat 🔥\n\n`;
    msg += `📍 *Pantau Wajan & Status Pesananmu Live:* https://dulangweb.vercel.app/?track=${ord.id}\n\n`;
    msg += `Salam hangat dari Tim ${brandDisplayName}! 🙏💛`;

    if (phone) {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      onShowToast(`Tagihan & QRIS disiapkan di WhatsApp Kak ${ord.customer_name}! 📲✨`);
    } else {
      navigator.clipboard.writeText(msg);
      onShowToast(`Format tagihan #${ord.id} disalin ke clipboard! 📋✓`);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // --- KONTROL STOK PORSI HARIAN ---
  const handleUpdateMenuStock = (id: string, stokHarian: number | null, sisaStok: number | null) => {
    storageService.updateMenuStock(id, stokHarian, sisaStok);
    const updated = storageService.getMenus();
    onUpdateMenus(updated);
  };

  const handleAdjustMenuStock = (id: string, delta: number) => {
    const item = menus.find((m) => m.id === id);
    if (!item) return;
    const curSisa = item.sisaStok ?? item.stokHarian ?? 0;
    const newSisa = Math.max(0, curSisa + delta);
    handleUpdateMenuStock(id, item.stokHarian ?? null, newSisa);
    onShowToast(`Stok "${item.nama}" diset: ${newSisa} porsi`);
  };

  const handleRefillAllStock = () => {
    if (!window.confirm('Isi penuh kembali semua stok menu sesuai kuota porsi harian masing-masing?')) return;
    storageService.refillAllMenuStock();
    const updated = storageService.getMenus();
    onUpdateMenus(updated);
    onShowToast('Semua kuota porsi menu hari ini berhasil diisi penuh! 🌅🥟');
  };

  const handleBulkSetStock = () => {
    const matangStr = window.prompt(
      'Masukkan kuota stok harian untuk SEMUA menu matang/goreng (contoh: 30):',
      '30'
    );
    if (matangStr === null) return;
    const matangQty = Number(matangStr);
    if (isNaN(matangQty) || matangQty < 0) {
      alert('Mohon masukkan angka kuota yang valid.');
      return;
    }

    const frozenStr = window.prompt(
      'Masukkan kuota stok harian untuk SEMUA menu frozen (contoh: 15):',
      '15'
    );
    if (frozenStr === null) return;
    const frozenQty = Number(frozenStr);
    if (isNaN(frozenQty) || frozenQty < 0) {
      alert('Mohon masukkan angka kuota yang valid.');
      return;
    }

    const currentMenus = storageService.getMenus();
    const updated = currentMenus.map((m) => {
      const isFrozen =
        m.variantType === 'frozen' ||
        m.servingType === 'frozen_only' ||
        m.nama.toLowerCase().includes('frozen');
      const targetQty = isFrozen ? frozenQty : matangQty;
      return {
        ...m,
        stokHarian: targetQty,
        sisaStok: targetQty,
        tersedia: targetQty > 0 ? true : false,
      };
    });
    storageService.saveMenus(updated);
    onUpdateMenus(updated);
    onShowToast(`Kuota stok harian berhasil diset: ${matangQty} porsi (matang) & ${frozenQty} pack (frozen)! 🥟❄️`);
  };

  // --- BACKUP & RESTORE DATABASE OFFLINE (.JSON) ---
  const handleExportBackup = () => {
    const backupData = storageService.exportDatabaseBackup();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup-dapur-dulang-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    logSecurityEvent('BACKUP_EXPORTED', 'Cadangan database offline (.json) berhasil diunduh.', 'INFO');
    onShowToast('Berkas cadangan dapur (.json) berhasil diunduh! Simpan file ini dengan aman. 💾');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        const confirmRestore = window.confirm(
          `⚠️ KONFIRMASI PEMULIHAN DATABASE OFFLINE:\n\n` +
            `File cadangan terdeteksi:\n` +
            `• Dibuat pada: ${parsed.exported_at ? new Date(parsed.exported_at).toLocaleString('id-ID') : 'Tidak diketahui'}\n` +
            `• Pesanan Kasir: ${parsed.orders?.length || 0} order\n` +
            `• Data Pelanggan: ${parsed.customers?.length || 0} orang\n` +
            `• Menu: ${parsed.menus?.length || 0} item\n\n` +
            `Apakah Anda yakin ingin memulihkan database dapur dari file ini? Data saat ini akan diperbarui.`
        );

        if (confirmRestore) {
          const res = storageService.importDatabaseBackup(parsed);
          if (res.success) {
            logSecurityEvent('BACKUP_RESTORED', 'Database dapur dipulihkan dari berkas cadangan offline.', 'WARN');
            setCustomers(storageService.getCustomers());
            setOrders(storageService.getOrders());
            setVouchers(storageService.getVouchers());
            setTestimonials(storageService.getTestimonials());
            onUpdateMenus(storageService.getMenus());
            onUpdateStoreConfig(storageService.getStoreConfig());
            onShowToast(res.message);
          } else {
            alert(res.message);
          }
        }
      } catch (err: any) {
        alert('Gagal membaca berkas: Format JSON tidak valid atau berkas rusak.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- SETTINGS HANDLERS ---
  const handleSaveStoreConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('Pengaturan toko & jam buka berhasil disimpan! 🍳');
  };

  const handleToggleStoreClosed = (closed: boolean) => {
    const updated = {
      ...localConfig,
      isStoreClosed: closed,
      closedReason:
        localConfig.closedReason ||
        'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia',
    };
    setLocalConfig(updated);
    onUpdateStoreConfig(updated);
    storageService.saveStoreConfig(updated);
    if (closed) {
      onShowToast('Dapur diset TUTUP (Libur Goreng) 💤 Pop-up otomatis aktif!');
    } else {
      onShowToast('Dapur diset BUKA kembali! Siap melayani pesanan 🍳');
    }
  };

  const handleSaveClosedReason = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('Pesan pengumuman libur berhasil disimpan! ✓');
  };

  const handleSaveKloterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('Pengaturan status kloter & pre-order besok berhasil disimpan! 📅🔥');
  };

  const handleSaveDeliveryConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('Pengaturan kurir dapur & ongkir Sidoarjo berhasil disimpan! 🛵✓');
  };

  const handleSaveBrandIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('Identitas usaha & white-label berhasil disimpan! ✨');
  };

  const handleSaveStaffPins = (e: React.FormEvent) => {
    e.preventDefault();
    if (localConfig.cashierPin && localConfig.cashierPin.length < 3) {
      onShowToast('PIN Kasir minimal 3 karakter!');
      return;
    }
    if (localConfig.kitchenPin && localConfig.kitchenPin.length < 3) {
      onShowToast('PIN Dapur minimal 3 karakter!');
      return;
    }
    onUpdateStoreConfig(localConfig);
    storageService.saveStoreConfig(localConfig);
    onShowToast('PIN Kasir & Dapur berhasil diperbarui! 🔑✓');
  };

  const handleSwitchRoleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = switchRolePinInput.trim();
    if (!clean) {
      setSwitchRoleError('Masukkan PIN terlebih dahulu!');
      return;
    }
    setIsSwitchingRoleLoading(true);
    setSwitchRoleError('');

    try {
      const res = await storageService.verifyAnyPin(clean);
      if (res.success) {
        storageService.setStaffRole(res.role);
        setActiveRole(res.role);
        setIsSwitchRoleModalOpen(false);
        setSwitchRolePinInput('');
        if (res.role === 'cashier') {
          setActiveTab('orders');
        } else if (res.role === 'kitchen') {
          setActiveTab('kds');
        }
        onShowToast(`Beralih akses ke ${res.label}! 🎉`);
      } else {
        setSwitchRoleError('PIN tidak cocok! Masukkan PIN Owner, Kasir, atau Dapur.');
      }
    } catch (err) {
      setSwitchRoleError('Gagal memverifikasi PIN.');
    } finally {
      setIsSwitchingRoleLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPin.trim()) {
      onShowToast('Masukkan password/PIN lama terlebih dahulu!');
      return;
    }
    const isOldValid = await storageService.verifyOwnerPin(oldPin.trim());
    if (!isOldValid) {
      onShowToast('Password lama tidak cocok! ❌');
      return;
    }
    if (newPin.trim().length < 4) {
      onShowToast('Password baru minimal 4 karakter!');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      onShowToast('Konfirmasi password baru tidak cocok! ❌');
      return;
    }
    const clean = newPin.trim();
    await storageService.saveOwnerPin(clean);
    logSecurityEvent('PIN_CHANGED', 'Password/PIN akses dapur berhasil diganti & di-hash.', 'INFO');
    setActivePin(storageService.getOwnerPin());
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    onShowToast('Password pemilik berhasil di-hash (SHA-256) & disimpan aman! 🔐✓');
  };

  // Dynamic Area clusters calculation for all regions (Sidoarjo, Surabaya, Gresik & Luar Kota)
  const customerAreas = customers.map((c) => c.area).filter(Boolean);
  const allKnownAreas = Array.from(new Set([...customerAreas, ...SIDOARJO_AREAS]));
  const areaCounts = allKnownAreas
    .map((area) => ({
      area,
      count: customers.filter((c) => c.area === area).length,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...areaCounts.map((a) => a.count), 1);

  const filteredVouchers = vouchers.filter((v) => {
    const matchSearch =
      v.code.toLowerCase().includes(voucherSearch.toLowerCase()) ||
      v.recipientName.toLowerCase().includes(voucherSearch.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(voucherSearch.toLowerCase()));
    if (!matchSearch) return false;
    if (voucherFilter === 'active') return !v.isUsed;
    if (voucherFilter === 'used') return v.isUsed;
    return true;
  });

  return (
    <div className="max-w-[1140px] mx-auto px-3 sm:px-4 py-3 sm:py-8 space-y-4 sm:space-y-8 pb-28 sm:pb-32">
      {/* Top Banner: Ringkas di HP, Lengkap di Desktop */}
      <div className="bg-[#111111] text-[#FFF8E7] rounded-[20px] sm:rounded-[24px] p-3.5 sm:p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-2 border-[#111111] shadow-[4px_4px_0_#FFD700] sm:shadow-[6px_6px_0_#FFD700]">
        <div className="flex items-center justify-between md:block">
          <div>
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <button
                type="button"
                onClick={() => {
                  setSwitchRolePinInput('');
                  setSwitchRoleError('');
                  setIsSwitchRoleModalOpen(true);
                }}
                className="cursor-pointer inline-flex items-center gap-1.5 bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] px-2.5 py-0.5 rounded-full font-sans text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition border border-[#111111]/30 shadow-xs active:scale-95"
                title="Klik untuk ganti peran staff (Owner / Kasir / Dapur)"
              >
                <span>{activeRole === 'owner' ? '👑' : activeRole === 'cashier' ? '🛒' : '🍳'}</span>
                <span>{activeRole === 'owner' ? 'Owner' : activeRole === 'cashier' ? 'Kasir Stand' : 'Kru Dapur'}</span>
                <span className="text-[9px] bg-[#111111]/15 px-1.5 py-0.2 rounded-full font-semibold">Ganti ⇄</span>
              </button>
            </div>
            <h1 className="font-hand font-bold text-[24px] sm:text-[34px] lg:text-[44px] leading-tight text-white">
              {storeConfig.brandName || 'Dapur Dulang'}
            </h1>
            <p className="font-sans text-[12px] sm:text-[13px] text-[#FFF8E7]/70 mt-0.5 hidden sm:block">
              {activeRole === 'owner'
                ? (storeConfig.brandTagline || 'Kelola menu, keuangan, gudang HPP, dan pantau operasional.')
                : activeRole === 'cashier'
                ? 'Mode Kasir POS: Input antrean, cetak struk nota, dan pantau pesanan pelanggan.'
                : 'Mode Layar Dapur (KDS): Tampilan antrean masak pesanan fresh dari wajan.'}
            </p>
          </div>

          {/* Status Live Mini Badge di HP */}
          <div className="md:hidden flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/20 text-[11px] font-sans font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                supabaseCreds.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'
              } animate-pulse`}
            />
            <span className={supabaseCreds.isConfigured ? 'text-emerald-300' : 'text-amber-300'}>
              {isSyncingCloud ? 'Sync...' : 'Live'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 border-t border-white/10 sm:border-0 sm:pt-0">
          <div className="text-right hidden md:block mr-1">
            <div className="font-sans text-[11px] uppercase tracking-wider text-white/60">
              Database Cloud
            </div>
            <div className="font-sans text-[12px] font-bold flex items-center gap-1.5 justify-end">
              <span
                className={`w-2 h-2 rounded-full ${
                  supabaseCreds.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                } animate-pulse`}
              />
              <span className={supabaseCreds.isConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                {isSyncingCloud
                  ? 'Sinkronisasi...'
                  : supabaseCreds.isConfigured
                  ? 'Realtime Auto-Sync'
                  : 'Lokal (Browser Ini)'}
              </span>
            </div>
          </div>

          {/* Quick Buttons for Subuh & Closing */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSubuhModalOpen(true)}
              className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] px-2.5 sm:px-3.5 py-1.5 rounded-full font-sans font-bold text-xs shadow-xs border border-[#111111] transition flex items-center gap-1"
              title="Kalkulator Kebutuhan Bahan Subuh"
            >
              <span>🌅</span>
              <span className="hidden xs:inline">Subuh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsClosingModalOpen(true)}
              className="cursor-pointer bg-white/15 hover:bg-white/25 text-white px-2.5 sm:px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border border-white/25 transition flex items-center gap-1"
              title="Rekap Tutup Dapur Malam"
            >
              <span>🌙</span>
              <span className="hidden xs:inline">Tutup</span>
            </button>
          </div>

          {/* Sound Notification Control */}
          <div className="flex items-center bg-white/10 p-0.5 sm:p-1 rounded-full border border-white/20">
            <button
              type="button"
              onClick={toggleSound}
              className={`cursor-pointer px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-sans font-bold text-xs transition flex items-center gap-1 ${
                soundEnabled
                  ? 'bg-[#FFD700] text-[#111111] shadow-sm'
                  : 'bg-transparent text-white/70 hover:text-white'
              }`}
              title={soundEnabled ? 'Notifikasi suara aktif' : 'Notifikasi suara mati'}
            >
              <span>{soundEnabled ? '🔔' : '🔕'}</span>
              <span className="text-[11px] sm:text-xs">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <button
              type="button"
              onClick={handleTestSound}
              className="cursor-pointer px-2 sm:px-2.5 py-1 text-white/70 hover:text-white rounded-full font-sans text-[11px] sm:text-xs transition"
              title="Tes bunyi bel notifikasi"
            >
              Tes
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer bg-white/10 hover:bg-white/20 text-white rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-sans font-bold text-[11px] sm:text-[12px] border border-white/20 transition ml-auto sm:ml-0"
          >
            Keluar ✕
          </button>
        </div>
      </div>

      {/* Floating Alert Card for Real-Time Customer Arrivals */}
      {recentAlert && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md bg-[#111111] text-[#FFF8E7] border-2 border-[#FFD700] rounded-[24px] p-5 shadow-[8px_8px_0_#111111] animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#FFD700] text-[#111111] flex items-center justify-center text-xl shrink-0 font-bold animate-bounce">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-hand font-bold text-[22px] text-[#FFD700] leading-none">
                  {recentAlert.isRepeat ? 'Pelanggan Repeat Order! 🔁' : 'Pelanggan Baru Masuk! 🎉'}
                </span>
                <button
                  type="button"
                  onClick={() => setRecentAlert(null)}
                  className="cursor-pointer text-[#FFF8E7]/60 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-full hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              <p className="font-sans text-[13px] text-white mt-1 leading-snug">
                Kak <strong className="text-[#FFD700] underline font-bold">{recentAlert.customer.name}</strong> ({recentAlert.customer.area || 'Sidoarjo'}) baru saja scan stiker kardus.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-white/10">
                <span className="font-mono text-[11px] bg-[#FFD700] text-[#111111] px-2.5 py-0.5 rounded-full font-bold">
                  {recentAlert.customer.qr_code_id}
                </span>
                <span className="font-sans text-[11px] text-[#FFF8E7]/70">
                  Pesanan: {recentAlert.customer.total_orders || 1}x
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('customers');
                    setRecentAlert(null);
                  }}
                  className="ml-auto font-sans text-xs text-[#FFD700] hover:text-white underline font-bold cursor-pointer"
                >
                  Buka Data Pelanggan →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Pills (Compact on Mobile, Full on Desktop) */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 sm:py-2 border-b border-[#111111]/10 sm:border-b-2">
        {/* Orders Tab: Shown to Owner & Cashier */}
        {(activeRole === 'owner' || activeRole === 'cashier') && (
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'orders'
                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
                : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
            }`}
          >
            <span>🛒 Antrean & Kasir</span>
            {orders.filter((o) => o.status === 'menunggu').length > 0 && (
              <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.2 rounded-full animate-pulse">
                {orders.filter((o) => o.status === 'menunggu').length} Baru
              </span>
            )}
          </button>
        )}

        {/* Menu Tab: Available to All Roles */}
        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
            activeTab === 'menu'
              ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
              : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
          }`}
        >
          <span>🍲 Stok & Menu</span>
          <span className="text-[9px] sm:text-[10px] text-[#5C3D2E]/70 font-bold">({menus.length})</span>
        </button>

        {/* Expenses: Only for Owner */}
        {activeRole === 'owner' && (
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'expenses'
                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
                : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
            }`}
          >
            <span>💰 Kas Harian</span>
            <span className="bg-[#FFD700] text-[#111111] text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {expenses.length}
            </span>
          </button>
        )}

        {/* Customers: Only for Owner */}
        {activeRole === 'owner' && (
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
                : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
            }`}
          >
            <span>👥 Pelanggan</span>
            <span className="text-[9px] sm:text-[10px] text-[#5C3D2E]/70 font-bold">({customers.length})</span>
          </button>
        )}

        {/* Inventory: Only for Owner */}
        {activeRole === 'owner' && (
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
                : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
            }`}
          >
            <span>🥩 Resep & Gudang</span>
          </button>
        )}

        {/* KDS Tab: Available to All Roles */}
        <button
          type="button"
          onClick={() => setActiveTab('kds')}
          className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
            activeTab === 'kds'
              ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
              : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
          }`}
        >
          <span>🍳 Layar Dapur (KDS)</span>
        </button>

        {/* Stickers: Convenient pill for cashier */}
        {activeRole === 'cashier' && (
          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`shrink-0 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-sans font-bold text-[11px] sm:text-[13px] border sm:border-2 cursor-pointer transition flex items-center gap-1 sm:gap-1.5 ${
              activeTab === 'stickers'
                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700]'
                : 'bg-white text-[#5C3D2E]/80 border-[#111111]/15 hover:border-[#111111]'
            }`}
          >
            <span>🏷️ Cetak Stiker QR</span>
          </button>
        )}

        {/* If user selected a secondary tab (e.g. from drawer), show it as active pill */}
        {activeTab !== 'orders' && activeTab !== 'menu' && activeTab !== 'expenses' && activeTab !== 'customers' && activeTab !== 'inventory' && activeTab !== 'kds' && (
          <div className="shrink-0 inline-flex items-center gap-1 bg-[#FFD700] text-[#111111] border sm:border-2 border-[#111111] px-2.5 sm:px-3.5 py-1 sm:py-2 rounded-full font-sans font-bold text-[11px] sm:text-xs shadow-xs sm:shadow-[2px_2px_0_#111111]">
            <span>
              {activeTab === 'stickers' && '🏷️ Cetak Stiker QR'}
              {activeTab === 'vouchers' && '🎟️ Voucher'}
              {activeTab === 'testimonials' && '💬 Ulasan'}
              {activeTab === 'stats' && '📊 Statistik'}
              {activeTab === 'settings' && '⚙️ Pengaturan & PIN'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="cursor-pointer text-xs ml-1 font-bold text-[#111111] hover:text-red-700 bg-white/40 rounded-full px-1.5"
              title="Kembali ke Kasir Utama"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Open Drawer Button */}
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="shrink-0 ml-auto bg-amber-50 sm:bg-amber-100 hover:bg-amber-200 text-amber-950 border sm:border-2 border-amber-300 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full font-sans font-bold text-[11px] sm:text-xs flex items-center gap-1 transition"
        >
          <span>⚡</span>
          <span>Menu Lain...</span>
        </button>
      </div>

      {/* TAB 1: KELOLA MENU */}
      {activeTab === 'menu' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="font-hand font-bold text-[24px] sm:text-[28px] text-[#111111] leading-none">
                Daftar Menu Dapur
              </h2>
              <p className="font-sans text-[11px] sm:text-xs text-[#5C3D2E]/70 mt-1">
                Total {menus.length} menu aktif. Di HP sentuh menu untuk edit harga, stok & ketersediaan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRefillAllStock}
                className="cursor-pointer bg-[#FFF8E7] hover:bg-[#FFEEC2] text-[#5C3D2E] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-sans font-bold text-[11px] sm:text-[12px] border-2 border-amber-400 hover:border-[#111111] transition flex items-center gap-1.5 shadow-xs"
                title="Isi ulang sisa stok porsi seluruh menu ke kuota harian masing-masing"
              >
                <span>🌅</span> Refill Kuota Pagi
              </button>
              <button
                type="button"
                onClick={handleRefillAllStock}
                className="cursor-pointer bg-emerald-50 text-emerald-800 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-sans font-bold text-[11px] sm:text-[12px] border-2 border-emerald-500/40 hover:border-emerald-600 transition flex items-center gap-1"
                title="Isi penuh kembali sisa stok seluruh menu ke kuota porsi harian masing-masing"
              >
                <span>🔄</span>
                <span>Isi Penuh Stok</span>
              </button>
              <button
                type="button"
                onClick={handleBulkSetStock}
                className="cursor-pointer bg-amber-50 text-[#5C3D2E] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-sans font-bold text-[11px] sm:text-[12px] border-2 border-amber-500/40 hover:border-[#111111] transition flex items-center gap-1"
                title="Atur kuota porsi harian untuk seluruh menu sekaligus"
              >
                <span>⚡</span>
                <span>Set Kuota Masal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const conf = window.confirm(
                    'Muat ulang seluruh menu standar Dapur Dulang (termasuk varian Gorengan Matang & Frozen Pack)?'
                  );
                  if (conf) {
                    const fresh = storageService.resetDefaultMenus();
                    onUpdateMenus(fresh);
                    onShowToast('Seluruh menu standar Dulang berhasil dimuat ulang! ✓');
                  }
                }}
                className="cursor-pointer bg-white text-[#5C3D2E] rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-sans font-bold text-[11px] sm:text-[12px] border-2 border-[#111111]/30 hover:border-[#111111] transition"
              >
                Muat Standar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingMenu(true);
                  setEditingItem(null);
                }}
                className="cursor-pointer bg-[#FFD700] text-[#111111] rounded-full px-4 sm:px-5 py-1.5 sm:py-2 font-sans font-bold text-xs sm:text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#111111] hover:brightness-105"
              >
                + Tambah Menu Baru
              </button>
            </div>
          </div>

          {/* Modal / Bottom Sheet: Tambah Menu Baru */}
          {isAddingMenu && (
            <div
              onClick={() => setIsAddingMenu(false)}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-t-[28px] sm:rounded-[24px] border-2 border-[#111111] shadow-[6px_6px_0_#FFD700] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-200"
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1 sm:hidden" />
                <div className="flex justify-between items-center pb-2 border-b border-[#111111]/10">
                  <div className="font-hand font-bold text-[24px] text-[#111111]">
                    Resep Baru Masuk Dapur 🥟
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingMenu(false)}
                    className="cursor-pointer text-sm font-bold text-gray-500 hover:text-black w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddNewMenu} className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                        Nama Menu *
                      </label>
                      <input
                        type="text"
                        required
                        value={newNama}
                        onChange={(e) => setNewNama(e.target.value)}
                        placeholder="misal: Risoles Ragout Keju Pedas"
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                        Harga Jual (Rp) *
                      </label>
                      <input
                        type="number"
                        required
                        value={newHarga}
                        onChange={(e) => setNewHarga(Number(e.target.value))}
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                        Kuota Stok Goreng Harian
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newStokHarian}
                        onChange={(e) => setNewStokHarian(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Contoh: 50 (Kosong = unlim)"
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700]"
                      />
                      <span className="text-[10px] text-[#5C3D2E]/60 mt-0.5 block">
                        Bila habis, otomatis berstatus Habis
                      </span>
                    </div>
                  </div>

                  {/* Bentuk Penyajian */}
                  <div className="bg-[#FFFDF4] p-3 rounded-[16px] border border-[#111111]/20">
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1.5">
                      🍽️ Bentuk Penyajian Produk
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'matang_only' as const, label: '🍳 Hanya Matang', desc: 'Goreng fresh' },
                        { id: 'frozen_only' as const, label: '❄️ Hanya Frozen', desc: 'Kemasan beku' },
                        { id: 'both' as const, label: '🔄 Bisa Keduanya', desc: 'Pembeli bebas pilih' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewServingType(item.id)}
                          className={`cursor-pointer p-2 rounded-[12px] text-center border-2 transition ${
                            newServingType === item.id
                              ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                              : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                          }`}
                        >
                          <div className="font-bold text-xs">{item.label}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                      Deskripsi Menu
                    </label>
                    <textarea
                      rows={2}
                      value={newDeskripsi}
                      onChange={(e) => setNewDeskripsi(e.target.value)}
                      placeholder="Ceritakan rasa gurih, isian lumer, atau cara makannya..."
                      className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700] resize-none"
                    />
                  </div>

                  {/* Foto Menu Input & Upload */}
                  <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700] space-y-3">
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#111111]">
                      Foto Menu (Opsional)
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {newFoto ? (
                        <img
                          src={newFoto}
                          alt="Preview"
                          className="w-20 h-20 rounded-[12px] object-cover border-2 border-[#111111] shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-[12px] bg-white border-2 border-dashed border-[#111111]/30 grid place-items-center text-2xl shrink-0">
                          🥟
                        </div>
                      )}

                      <div className="flex-1 w-full space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer bg-white hover:bg-gray-50 border-2 border-[#111111] text-[#111111] px-4 py-1.5 rounded-full font-sans text-xs font-bold shadow-sm transition">
                            📁 Pilih File dari HP / Laptop
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  triggerImageCrop(file, 'Atur Sisi Foto Menu Baru (1:1)', setNewFoto);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          {newFoto && (
                            <button
                              type="button"
                              onClick={() => setNewFoto('')}
                              className="cursor-pointer text-xs font-bold text-red-600 hover:underline"
                            >
                              Hapus Foto
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={newFoto}
                          onChange={(e) => setNewFoto(e.target.value)}
                          placeholder="Atau tempel link gambar (https://...)"
                          className="w-full rounded-full border border-[#111111]/30 px-3 py-1 font-sans text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
                    >
                      Simpan Menu Baru ke Toko ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingMenu(false)}
                      className="cursor-pointer px-4 py-2.5 rounded-full font-sans font-bold text-xs text-[#5C3D2E] hover:underline"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal / Bottom Sheet: Edit Menu */}
          {editingItem && (
            <div
              onClick={() => setEditingItem(null)}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-t-[28px] sm:rounded-[24px] border-2 border-[#111111] shadow-[6px_6px_0_#FFD700] w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-200"
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-1 sm:hidden" />
                <div className="flex justify-between items-center pb-2 border-b border-[#111111]/10">
                  <div className="font-hand font-bold text-[22px] sm:text-[24px] text-[#111111] flex items-center gap-2">
                    <span>✏️</span>
                    <span>Edit Menu: {editingItem.nama}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="cursor-pointer text-sm font-bold text-gray-500 hover:text-black w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveEditedMenu} className="space-y-4">
                  {/* Status Saklar: Hari Ini & Pre-order Besok */}
                  <div className="grid grid-cols-2 gap-3 bg-[#FFF8E7] p-3 rounded-[16px] border border-[#FFD700]">
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                        Ketersediaan Hari Ini
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            tersedia: !editingItem.tersedia,
                          })
                        }
                        className={`w-full py-2 px-3 rounded-full font-bold text-xs border-2 transition ${
                          editingItem.tersedia
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-red-500 text-white border-red-600'
                        }`}
                      >
                        {editingItem.tersedia ? '🟢 Tersedia' : '🔴 Habis'}
                      </button>
                    </div>
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                        Pre-Order Besok
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            tersediaBesok: editingItem.tersediaBesok === false ? true : false,
                          })
                        }
                        className={`w-full py-2 px-3 rounded-full font-bold text-xs border-2 transition ${
                          editingItem.tersediaBesok !== false
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-gray-200 text-gray-700 border-gray-400'
                        }`}
                      >
                        {editingItem.tersediaBesok !== false ? '📅 Buka' : '🔒 Tutup'}
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                        Nama Menu *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingItem.nama}
                        onChange={(e) => setEditingItem({ ...editingItem, nama: e.target.value })}
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                        Harga Jual (Rp) *
                      </label>
                      <input
                        type="number"
                        required
                        value={editingItem.harga}
                        onChange={(e) => setEditingItem({ ...editingItem, harga: Number(e.target.value) })}
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                  </div>

                  {/* Bentuk Penyajian di Edit Menu */}
                  <div className="bg-[#FFFDF4] p-3 rounded-[16px] border border-[#111111]/20">
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1.5">
                      🍽️ Bentuk Penyajian Produk
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'matang_only' as const, label: '🍳 Hanya Matang', desc: 'Goreng fresh' },
                        { id: 'frozen_only' as const, label: '❄️ Hanya Frozen', desc: 'Kemasan beku' },
                        { id: 'both' as const, label: '🔄 Bisa Keduanya', desc: 'Pembeli bebas pilih' },
                      ].map((item) => {
                        const curServing = editingItem.servingType || (editingItem.variantType === 'frozen' || editingItem.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only');
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setEditingItem({
                                ...editingItem,
                                servingType: item.id,
                                variantType: item.id === 'frozen_only' ? 'frozen' : 'matang',
                              })
                            }
                            className={`cursor-pointer p-2 rounded-[12px] text-center border-2 transition ${
                              curServing === item.id
                                ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                                : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                            }`}
                          >
                            <div className="font-bold text-xs">{item.label}</div>
                            <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kuota & Sisa Stok Controls */}
                  <div className="grid sm:grid-cols-2 gap-3 bg-[#FFFDF4] p-3 rounded-[16px] border border-[#111111]/20">
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                        Kuota Stok Harian (Porsi)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingItem.stokHarian ?? ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            stokHarian: e.target.value === '' ? null : Number(e.target.value),
                            sisaStok:
                              editingItem.sisaStok === null || editingItem.sisaStok === undefined
                                ? e.target.value === '' ? null : Number(e.target.value)
                                : editingItem.sisaStok,
                          })
                        }
                        placeholder="Kosong = Unlimited"
                        className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                        Sisa Stok Hari Ini (Porsi)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={editingItem.sisaStok ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value);
                            setEditingItem({
                              ...editingItem,
                              sisaStok: val,
                              tersedia: val !== null && val <= 0 ? false : editingItem.tersedia,
                            });
                          }}
                          placeholder="Sisa stok"
                          className="w-full rounded-full border-2 border-[#111111] px-3.5 py-2 font-sans font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = editingItem.sisaStok ?? editingItem.stokHarian ?? 0;
                            const nextVal = Math.max(0, cur - 1);
                            setEditingItem({
                              ...editingItem,
                              sisaStok: nextVal,
                              tersedia: nextVal > 0,
                            });
                          }}
                          className="cursor-pointer w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 border border-[#111111] font-bold text-sm flex items-center justify-center shrink-0"
                          title="Kurang 1 porsi"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = editingItem.sisaStok ?? 0;
                            const nextVal = cur + 1;
                            setEditingItem({
                              ...editingItem,
                              sisaStok: nextVal,
                              tersedia: true,
                            });
                          }}
                          className="cursor-pointer w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 border border-[#111111] font-bold text-sm flex items-center justify-center shrink-0"
                          title="Tambah 1 porsi"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (editingItem.stokHarian) {
                              setEditingItem({
                                ...editingItem,
                                sisaStok: editingItem.stokHarian,
                                tersedia: true,
                              });
                            }
                          }}
                          className="cursor-pointer text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                        >
                          🔄 Reset Penuh
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem({
                              ...editingItem,
                              sisaStok: 0,
                              tersedia: false,
                            });
                          }}
                          className="cursor-pointer text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 hover:bg-red-200"
                        >
                          Set Habis (0)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                      Deskripsi Menu
                    </label>
                    <textarea
                      rows={2}
                      value={editingItem.deskripsi}
                      onChange={(e) => setEditingItem({ ...editingItem, deskripsi: e.target.value })}
                      className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700] resize-none"
                    />
                  </div>

                  {/* Edit Foto Menu */}
                  <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700] space-y-3">
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#111111]">
                      Ganti Foto Menu
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {editingItem.foto ? (
                        <img
                          src={editingItem.foto}
                          alt={editingItem.nama}
                          className="w-20 h-20 rounded-[12px] object-cover border-2 border-[#111111] shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-[12px] bg-white border-2 border-dashed border-[#111111]/30 grid place-items-center text-2xl shrink-0">
                          🥟
                        </div>
                      )}

                      <div className="flex-1 w-full space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer bg-white hover:bg-gray-50 border-2 border-[#111111] text-[#111111] px-4 py-1.5 rounded-full font-sans text-xs font-bold shadow-sm transition">
                            📁 Pilih File Baru dari HP / Laptop
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && editingItem) {
                                  triggerImageCrop(file, `Atur Sisi Foto: ${editingItem.nama}`, (url) => {
                                    setEditingItem((prev) => (prev ? { ...prev, foto: url } : null));
                                  });
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                          {editingItem.foto && (
                            <button
                              type="button"
                              onClick={() => setEditingItem({ ...editingItem, foto: undefined })}
                              className="cursor-pointer text-xs font-bold text-red-600 hover:underline"
                            >
                              Hapus Foto
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editingItem.foto || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, foto: e.target.value })}
                          placeholder="Atau tempel link gambar (https://...)"
                          className="w-full rounded-full border border-[#111111]/30 px-3 py-1 font-sans text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#111111]/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-xs sm:text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
                      >
                        Simpan Perubahan ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className="cursor-pointer px-4 py-2.5 rounded-full font-sans font-bold text-xs text-[#5C3D2E] hover:underline"
                      >
                        Batal
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteItem(editingItem.id);
                        setEditingItem(null);
                      }}
                      className="cursor-pointer text-xs font-bold text-red-600 hover:text-red-800 hover:underline px-2 py-1"
                    >
                      🗑️ Hapus Menu Ini
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* FILTER BAR BENTUK PENYAJIAN & PENCARIAN MENU */}
          <div className="bg-white rounded-[20px] p-3.5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                {[
                  { id: 'all' as const, label: 'Semua Menu', count: menus.length, icon: '✨' },
                  { id: 'matang_only' as const, label: 'Hanya Matang', count: countMatangOnly, icon: '🍳' },
                  { id: 'frozen_only' as const, label: 'Hanya Frozen', count: countFrozenOnly, icon: '❄️' },
                  { id: 'both' as const, label: 'Bisa Keduanya', count: countBoth, icon: '🔄' },
                ].map((tab) => {
                  const isActive = menuServingFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMenuServingFilter(tab.id)}
                      className={`cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs transition whitespace-nowrap flex items-center gap-1.5 border active:scale-95 ${
                        isActive
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                          : 'bg-[#FFF8E7] text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          isActive ? 'bg-[#FFD700] text-[#111111]' : 'bg-black/10 text-[#111111]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="Cari nama menu..."
                  className="w-full rounded-full border-2 border-[#111111] pl-8 pr-8 py-1.5 text-xs font-sans bg-[#FFFDF4] focus:outline-none focus:border-[#FFD700]"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50">🔍</span>
                {menuSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMenuSearchQuery('')}
                    className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-black"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* EMPTY STATE JIKA FILTER KOSONG */}
          {filteredDashboardMenus.length === 0 && (
            <div className="text-center py-12 bg-white rounded-[22px] border-2 border-dashed border-[#111111]/25 p-6 space-y-2">
              <div className="text-4xl">🥟</div>
              <div className="font-bold text-sm text-[#111111]">Tidak ada menu yang sesuai kriteria ini</div>
              <p className="text-xs text-[#5C3D2E]/70 max-w-sm mx-auto">
                Silakan ganti tab filter penyajian atau hapus kata kunci pencarian.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMenuServingFilter('all');
                  setMenuSearchQuery('');
                }}
                className="mt-2 cursor-pointer bg-[#111111] text-[#FFD700] px-4 py-1.5 rounded-full font-bold text-xs shadow-xs"
              >
                Reset Filter Menu
              </button>
            </div>
          )}

          {/* MOBILE VIEW: Kotak-kotak (Grid 2 Kolom) Bersih & Ringkas Khusus Layar HP */}
          <div className="grid grid-cols-2 gap-2.5 sm:hidden">
            {filteredDashboardMenus.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  setEditingItem({ ...m });
                  setIsAddingMenu(false);
                }}
                className="cursor-pointer bg-white rounded-[18px] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0_#111111] hover:shadow-[3px_3px_0_#FFD700] transition active:scale-[0.98] flex flex-col justify-between"
              >
                <div>
                  {/* Foto Menu Kotak 1:1 */}
                  <div className="relative aspect-square w-full rounded-[14px] overflow-hidden bg-[#FFF3C7] border border-[#111111]/20">
                    {m.foto ? (
                      <img
                        src={m.foto}
                        alt={m.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-4xl">
                        🥟
                      </div>
                    )}

                    {/* Floating Status Badge (Pojok Kiri Atas) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTersedia(m.id);
                      }}
                      className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs border transition ${
                        m.tersedia
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-red-500 text-white border-red-600'
                      }`}
                      title="Sentuh untuk toggle cepat ketersediaan"
                    >
                      {m.tersedia ? '● Ready' : '✕ Habis'}
                    </button>

                    {/* Floating Stok Badge (Pojok Kanan Atas jika ada kuota) */}
                    {m.stokHarian !== undefined && m.stokHarian !== null && (
                      <span
                        className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-xs ${
                          (m.sisaStok ?? 0) <= 0
                            ? 'bg-red-600 text-white'
                            : (m.sisaStok ?? 0) <= 5
                            ? 'bg-amber-500 text-white animate-pulse'
                            : 'bg-black/75 backdrop-blur-xs text-white'
                        }`}
                      >
                        {m.sisaStok ?? m.stokHarian} pcs
                      </span>
                    )}
                  </div>

                  {/* Info Ringkas Menu */}
                  <div className="mt-2 space-y-1">
                    <h3 className="font-bold text-[13px] text-[#111111] leading-snug line-clamp-2">
                      {m.nama}
                    </h3>
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-mono font-bold text-xs text-[#5C3D2E]">
                        Rp {m.harga.toLocaleString('id-ID')}
                      </div>
                      {(() => {
                        const st = m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only');
                        if (st === 'both') {
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              🔄 Keduanya
                            </span>
                          );
                        }
                        if (st === 'frozen_only') {
                          return (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                              ❄️ Frozen
                            </span>
                          );
                        }
                        return (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            🍳 Matang
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Footer Kartu Mobile: Petunjuk Ketuk & Pre-order Besok */}
                <div className="mt-2 pt-1.5 border-t border-[#111111]/10 flex items-center justify-between text-[10px] text-[#5C3D2E]/70 font-semibold">
                  <span className="flex items-center gap-1 text-[#111111]">
                    <span>✏️</span> Atur
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${
                      m.tersediaBesok !== false
                        ? 'bg-blue-50 text-blue-900 border-blue-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}
                  >
                    {m.tersediaBesok !== false ? 'Besok Buka' : 'Besok Tutup'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP / TABLET VIEW: Tampilan List Baris Horizontal Yang Nyaman Diklik Mouse */}
          <div className="hidden sm:grid gap-4">
            {filteredDashboardMenus.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-[20px] p-5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1">
                  {m.foto ? (
                    <img
                      src={m.foto}
                      alt={m.nama}
                      className="w-16 h-16 rounded-[14px] object-cover border-2 border-[#111111] shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-[14px] bg-[#FFF3C7] border-2 border-[#111111] grid place-items-center text-2xl shrink-0">
                      🥟
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-hand font-bold text-[24px] text-[#111111]">
                        {m.nama}
                      </span>
                      <span className="bg-[#FFF3C7] text-[#111111] border border-[#111111] font-sans font-bold text-xs px-2.5 py-0.5 rounded-full">
                        Rp {m.harga.toLocaleString('id-ID')}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          m.tersedia
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.tersedia ? 'Tersedia' : 'Habis'}
                      </span>
                      {(() => {
                        const st = m.servingType || (m.variantType === 'frozen' || m.nama.toLowerCase().includes('frozen') ? 'frozen_only' : 'matang_only');
                        if (st === 'both') {
                          return (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span>🔄</span> Matang & Frozen
                            </span>
                          );
                        }
                        if (st === 'frozen_only') {
                          return (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                              <span>❄️</span> Hanya Frozen
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <span>🍳</span> Hanya Matang
                          </span>
                        );
                      })()}
                      {m.opsi && m.opsi.length > 0 && (
                        <span className="text-[11px] font-sans bg-[#FFD700]/30 text-[#111111] border border-[#111111]/30 px-2.5 py-0.5 rounded-full font-bold">
                          Opsi: {m.opsi.join(' / ')}
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-[13px] text-[#5C3D2E]/80 max-w-[70ch]">
                      {m.deskripsi}
                    </p>

                    {/* Kuota Stok Porsi Harian Controls */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-sans text-xs">
                      {m.stokHarian !== undefined && m.stokHarian !== null ? (
                        <div className="flex items-center gap-1.5 bg-[#FFF8E7] px-2.5 py-1 rounded-full border border-amber-300">
                          <span className="font-semibold text-[#5C3D2E]">Stok Hari Ini:</span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                              (m.sisaStok ?? 0) <= 0
                                ? 'bg-red-600 text-white'
                                : (m.sisaStok ?? 0) <= 5
                                ? 'bg-amber-500 text-white animate-pulse'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {m.sisaStok ?? m.stokHarian} / {m.stokHarian} porsi
                          </span>

                          {/* Quick buttons */}
                          <button
                            type="button"
                            onClick={() => handleAdjustMenuStock(m.id, -1)}
                            className="cursor-pointer w-5 h-5 rounded-full bg-white hover:bg-gray-100 border border-[#111111]/30 font-bold flex items-center justify-center text-xs"
                            title="Kurang 1 porsi"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustMenuStock(m.id, 1)}
                            className="cursor-pointer w-5 h-5 rounded-full bg-white hover:bg-gray-100 border border-[#111111]/30 font-bold flex items-center justify-center text-xs"
                            title="Tambah 1 porsi"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateMenuStock(m.id, m.stokHarian ?? null, m.stokHarian ?? null)}
                            className="cursor-pointer px-2 py-0.5 rounded-full bg-white hover:bg-[#FFEEC2] text-[#111111] border border-[#111111]/30 text-[10px] font-bold"
                            title="Isi ulang penuh sesuai kuota"
                          >
                            🔄 Penuh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateMenuStock(m.id, m.stokHarian ?? null, 0)}
                            className="cursor-pointer px-1.5 py-0.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 text-[10px] font-bold"
                            title="Set stok habis (0 porsi)"
                          >
                            Set 0
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const inputVal = window.prompt(
                              `Masukkan kuota stok goreng harian untuk "${m.nama}" (contoh: 50):`,
                              '50'
                            );
                            if (inputVal && !isNaN(Number(inputVal))) {
                              const num = Number(inputVal);
                              handleUpdateMenuStock(m.id, num, num);
                              onShowToast(`Kuota stok "${m.nama}" diset ${num} porsi! 🥟`);
                            }
                          }}
                          className="cursor-pointer text-[11px] text-[#5C3D2E]/80 hover:text-[#111111] bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full border border-gray-300 font-semibold"
                        >
                          + Pasang Kuota Porsi
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem({ ...m });
                      setIsAddingMenu(false);
                      window.scrollTo({ top: 200, behavior: 'smooth' });
                    }}
                    className="cursor-pointer px-4 py-1.5 rounded-full font-sans font-bold text-xs bg-white text-[#111111] border-2 border-[#111111] shadow-[1px_1px_0_#111111] hover:bg-gray-50"
                  >
                    ✏️ Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleTersedia(m.id)}
                    className={`cursor-pointer px-4 py-1.5 rounded-full font-sans font-bold text-xs border-2 transition ${
                      m.tersedia
                        ? 'bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200'
                        : 'bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200'
                    }`}
                  >
                    Hari Ini: {m.tersedia ? 'Tersedia' : 'Habis'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleTersediaBesok(m.id)}
                    className={`cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border-2 transition ${
                      m.tersediaBesok !== false
                        ? 'bg-blue-50 border-blue-400 text-blue-950 hover:bg-blue-100'
                        : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                    }`}
                    title="Atur ketersediaan menu ini untuk pre-order besok"
                  >
                    📅 Besok: {m.tersediaBesok !== false ? 'Buka' : 'Tutup'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(m.id)}
                    className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: KASIR & GRAFIK PENJUALAN */}
      {activeTab === 'orders' && (() => {
        const lunasOrders = orders.filter((o) => o.status === 'lunas');
        const dpOrders = orders.filter((o) => o.status === 'dp');
        const pendingOrders = orders.filter((o) => o.status === 'menunggu');
        const batalOrders = orders.filter((o) => o.status === 'batal');

        const totalOmsetLunas = lunasOrders.reduce((sum, o) => sum + o.total_price, 0) +
          dpOrders.reduce((sum, o) => sum + (o.dp_amount || 0), 0);
        const totalOmsetPending = pendingOrders.reduce((sum, o) => sum + o.total_price, 0) +
          dpOrders.reduce((sum, o) => sum + (o.remaining_amount !== undefined ? o.remaining_amount : (o.total_price - (o.dp_amount || 0))), 0);
        const totalPorsiTerjual = [...lunasOrders, ...dpOrders]
          .flatMap((o) => o.items)
          .reduce((sum, it) => sum + it.qty, 0);

        // Breakdown Metode Bayar
        const qrisOrders = lunasOrders.filter((o) => o.payment_method === 'qris');
        const tunaiOrders = lunasOrders.filter((o) => o.payment_method === 'tunai');
        const transferOrders = lunasOrders.filter((o) => o.payment_method === 'transfer');

        const qrisTotal = qrisOrders.reduce((sum, o) => sum + o.total_price, 0);
        const tunaiTotal = tunaiOrders.reduce((sum, o) => sum + o.total_price, 0);
        const transferTotal = transferOrders.reduce((sum, o) => sum + o.total_price, 0);

        // Leaderboard Menu Terlaris
        const menuSalesMap = new Map<string, { nama: string; qty: number; totalRp: number }>();
        lunasOrders.forEach((o) => {
          o.items.forEach((it) => {
            const existing = menuSalesMap.get(it.nama) || { nama: it.nama, qty: 0, totalRp: 0 };
            existing.qty += it.qty;
            existing.totalRp += it.harga * it.qty;
            menuSalesMap.set(it.nama, existing);
          });
        });

        const bestSellerList = Array.from(menuSalesMap.values()).sort((a, b) => b.qty - a.qty);
        const maxSoldQty = bestSellerList.length > 0 ? Math.max(...bestSellerList.map((m) => m.qty), 1) : 1;

        const filteredOrders = orders.filter((o) => {
          if (orderFilter !== 'all' && o.status !== orderFilter) return false;
          if (orderSearch.trim()) {
            const q = orderSearch.toLowerCase();
            const matchName = o.customer_name.toLowerCase().includes(q);
            const matchId = o.id.toLowerCase().includes(q);
            const matchItems = o.items.some((it) => it.nama.toLowerCase().includes(q));
            return matchName || matchId || matchItems;
          }
          return true;
        });

        return (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
            {/* Header Ringkas & Tombol Aksi Kasir */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div>
                <h2 className="font-hand font-bold text-2xl sm:text-[34px] text-[#111111] leading-none">
                  Antrean & Kasir Dapur
                </h2>
                <p className="font-sans text-[11px] sm:text-xs text-[#5C3D2E]/70 mt-0.5 sm:mt-1">
                  Pantau pesanan masuk secara live & konfirmasi pembayaran 1-klik.
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncingCloud(true);
                    await storageService.syncOrdersFromSupabase();
                    setOrders(storageService.getOrders());
                    setIsSyncingCloud(false);
                    onShowToast('Antrean pesanan disinkronkan! 🥟✨');
                  }}
                  className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] px-2.5 sm:px-3.5 py-2 rounded-full font-sans font-bold text-xs border sm:border-2 border-[#111111] shadow-2xs sm:shadow-[2px_2px_0_#111111] flex items-center justify-center gap-1 transition active:scale-95 shrink-0"
                  title="Tarik pesanan terbaru dari Supabase Cloud"
                >
                  <span className={isSyncingCloud ? 'animate-spin' : ''}>🔄</span>
                  <span className="hidden xs:inline">{isSyncingCloud ? 'Sync...' : 'Refresh'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickWaOpen(!isQuickWaOpen)}
                  className={`cursor-pointer px-2.5 sm:px-3.5 py-2 rounded-full font-sans font-bold text-xs border transition flex items-center justify-center gap-1 shrink-0 ${
                    isQuickWaOpen
                      ? 'bg-[#25D366] text-white border-[#111111] shadow-2xs sm:shadow-[2px_2px_0_#111111]'
                      : 'bg-white text-emerald-800 border-[#25D366] hover:bg-emerald-50'
                  }`}
                  title="Buka input ketik cepat ala WhatsApp"
                >
                  <span>💬</span>
                  <span className="hidden xs:inline">Ketik WA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingWalkInOrder(!isAddingWalkInOrder)}
                  className="cursor-pointer flex-1 sm:flex-initial bg-[#111111] text-[#FFD700] hover:brightness-110 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm border sm:border-2 border-[#111111] shadow-xs sm:shadow-[2px_2px_0_#FFD700] flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span>{isAddingWalkInOrder ? 'Tutup Kasir ✕' : '+ Kasir Walk-In 💰'}</span>
                </button>
              </div>
            </div>

            {/* RINGKASAN OMSET KASIR: 1 BARIS COMPACT STRIP (HEMAT TEMPAT DI HP) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-[#FFFDF4] rounded-[16px] sm:rounded-[18px] p-2 sm:p-4 border border-[#111111]/15 sm:border-2 sm:border-[#111111] shadow-xs sm:shadow-[3px_3px_0_#111111]">
              <div className="text-center sm:text-left border-r border-[#111111]/10 pr-1 sm:pr-3 min-w-0">
                <span className="text-[9px] sm:text-xs font-sans text-[#5C3D2E]/70 block font-bold uppercase tracking-tight truncate">
                  Omset Lunas
                </span>
                <span className="font-hand font-bold text-xs xs:text-sm sm:text-2xl text-[#111111] block leading-tight truncate">
                  Rp {totalOmsetLunas.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold hidden sm:inline">
                  ✓ {lunasOrders.length} transaksi
                </span>
              </div>
              <div className="text-center sm:text-left border-r border-[#111111]/10 px-1 sm:px-3 min-w-0">
                <span className="text-[9px] sm:text-xs font-sans text-[#5C3D2E]/70 block font-bold uppercase tracking-tight truncate">
                  Antrean Baru
                </span>
                <span className="font-hand font-bold text-xs xs:text-sm sm:text-2xl text-amber-700 block leading-tight truncate">
                  {pendingOrders.length} Order
                </span>
                <span className="text-[10px] text-amber-800 font-medium hidden sm:inline">
                  Rp {totalOmsetPending.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-center sm:text-left pl-1 sm:pl-3 min-w-0">
                <span className="text-[9px] sm:text-xs font-sans text-[#5C3D2E]/70 block font-bold uppercase tracking-tight truncate">
                  Porsi Terjual
                </span>
                <span className="font-hand font-bold text-xs xs:text-sm sm:text-2xl text-[#111111] block leading-tight truncate">
                  {totalPorsiTerjual} Porsi
                </span>
                <span className="text-[10px] text-[#5C3D2E]/70 font-medium hidden sm:inline">
                  Fresh wajan
                </span>
              </div>
            </div>

            {/* WHATSAPP NATURAL QUICK ORDER BAR (HANYA MUNCUL KETIKA DIBUKA) */}
            {isQuickWaOpen && (
              <form
                onSubmit={handleQuickWaOrder}
                className="bg-gradient-to-r from-[#DCF8C6]/90 via-[#FFFDF4] to-[#E7F8E8] border-2 border-[#25D366] rounded-[20px] p-3.5 sm:p-4 shadow-[3px_3px_0_#25D366] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                    💬
                  </div>
                  <div>
                    <h3 className="font-hand font-bold text-lg text-[#111111] leading-tight">
                      Ketik Cepat Pesanan ala WhatsApp
                    </h3>
                    <p className="font-sans text-[11px] text-[#5C3D2E]/80">
                      Contoh: <code className="bg-white px-1 py-0.5 rounded border border-[#25D366]/40 font-bold">mayo 2, rogut 3 tunai</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 grow max-w-md">
                  <input
                    type="text"
                    value={quickWaOrderText}
                    onChange={(e) => setQuickWaOrderText(e.target.value)}
                    placeholder="Contoh: mayo 2, rogut 3, piscok 2"
                    className="w-full rounded-full border-2 border-[#111111] px-3.5 py-2 font-sans text-xs focus:outline-none focus:border-[#25D366] bg-white shadow-inner font-medium"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer bg-[#25D366] text-white hover:brightness-110 px-4 py-2 rounded-full font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#111111] shrink-0 transition"
                  >
                    Proses ⚡
                  </button>
                </div>
              </form>
            )}

            {/* FORM KASIR PENJUALAN WALK-IN (IN-PLACE MODAL/CARD) */}
            {isAddingWalkInOrder && (
              <form
                onSubmit={handleSaveWalkInOrder}
                className="bg-[#FFFDF4] rounded-[24px] p-6 lg:p-7 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-5 animate-in slide-in-from-top-3 duration-300"
              >
                <div className="flex items-center justify-between border-b-2 border-[#111111]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🍳</span>
                    <h3 className="font-hand font-bold text-2xl text-[#111111]">
                      Catat Pembeli Langsung di Tempat (Walk-In)
                    </h3>
                  </div>
                  <span className="text-xs font-sans text-[#5C3D2E]/70 font-semibold">
                    Status otomatis LUNAS & langsung masuk grafik
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Nama Pembeli (Bisa pilih dari pelanggan terdaftar atau ketik baru)
                    </label>
                    <input
                      type="text"
                      list="registered-customers"
                      value={walkInCustName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWalkInCustName(val);
                        const match = customers.find((c) => c.name.toLowerCase() === val.toLowerCase());
                        if (match && match.wa) {
                          setWalkInCustWa(match.wa);
                        }
                      }}
                      placeholder="Contoh: Bu Dewi / Mas Andre"
                      className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                    />
                    <datalist id="registered-customers">
                      {customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({c.area || 'Sidoarjo'})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Nomor WhatsApp (Opsional)
                    </label>
                    <input
                      type="text"
                      value={walkInCustWa}
                      onChange={(e) => setWalkInCustWa(e.target.value)}
                      placeholder="Contoh: 08123456789"
                      className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                    />
                  </div>
                </div>

                {/* 💡 Customer Intelligence Memory Badge (Bila Nama Cocok dgn Pelanggan Terdaftar) */}
                {(() => {
                  const match = customers.find(
                    (c) =>
                      c.name.trim().toLowerCase() === walkInCustName.trim().toLowerCase() ||
                      (walkInCustWa.trim() && c.wa && c.wa.replace(/\D/g, '') === walkInCustWa.replace(/\D/g, ''))
                  );
                  if (!match || !walkInCustName.trim()) return null;
                  const lastOrder = getCustomerLastOrderDate(match);

                  return (
                    <div className="bg-gradient-to-r from-[#FFF8E7] to-[#FFEEC2] border-2 border-[#111111] rounded-[18px] p-3.5 shadow-[2px_2px_0_#111111] flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl animate-bounce">👑</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#111111]">
                              Pelanggan Dikenali: {match.name}
                            </span>
                            <span className="bg-[#111111] text-[#FFD700] text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {match.status} ({match.total_orders}x order)
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5C3D2E] mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span>
                              ❤️ Menu Favorit:{' '}
                              <strong>{match.favorite_menu || 'Belum ada data'}</strong>
                              {match.favorite_option ? ` (${match.favorite_option})` : ''}
                            </span>
                            <span>•</span>
                            <span>
                              Terakhir beli:{' '}
                              <strong>{formatRelativeTime(lastOrder)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {match.favorite_menu && (
                        <button
                          type="button"
                          onClick={() => {
                            const fav = menus.find(
                              (m) => m.nama.toLowerCase() === match.favorite_menu.toLowerCase()
                            );
                            if (fav) {
                              setWalkInSelectedMenu(fav.id);
                              if (match.favorite_option) setWalkInSelectedOpsi(match.favorite_option);
                              onShowToast(`Menu favorit ${match.name} (${fav.nama}) dipilih! 🥟`);
                            } else {
                              onShowToast(`Menu "${match.favorite_menu}" tidak ditemukan di daftar menu aktif.`);
                            }
                          }}
                          className="cursor-pointer bg-[#FFD700] hover:brightness-105 text-[#111111] border-2 border-[#111111] px-3.5 py-1.5 rounded-full font-sans font-bold text-xs flex items-center gap-1.5 shadow-[1px_1px_0_#111111] transition active:scale-95"
                        >
                          <span>+ Pilih Menu Favorit</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Pilih Menu & Tambah Item */}
                <div className="bg-white rounded-[18px] p-4 border-2 border-[#111111]/20 space-y-3">
                  <div className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111]">
                    Pilih Menu & Opsi (Optional)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <select
                        value={walkInSelectedMenu}
                        onChange={(e) => {
                          setWalkInSelectedMenu(e.target.value);
                          setWalkInSelectedOpsi('');
                        }}
                        className="w-full rounded-full border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white focus:outline-none"
                      >
                        <option value="">-- Pilih Menu Risoles / Gorengan --</option>
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nama} — Rp {m.harga.toLocaleString('id-ID')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      {(() => {
                        const selectedMenuObj = menus.find((m) => m.id === walkInSelectedMenu);
                        const opsis: string[] = selectedMenuObj?.opsi || [];
                        if (opsis.length === 0) {
                          return (
                            <div className="text-[11px] text-[#5C3D2E]/60 italic py-2">
                              Tidak ada opsi saos/varian
                            </div>
                          );
                        }
                        return (
                          <select
                            value={walkInSelectedOpsi}
                            onChange={(e) => setWalkInSelectedOpsi(e.target.value)}
                            className="w-full rounded-full border-2 border-[#111111] px-3 py-2 font-sans text-xs bg-white focus:outline-none"
                          >
                            <option value="">Pilih Opsi ({opsis.join(' / ')})</option>
                            {opsis.map((op: string) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>

                    {/* Pilihan Sajian: Matang vs Frozen */}
                    <div className="flex items-center gap-1.5 p-1 bg-white rounded-full border border-[#111111]/30">
                      <button
                        type="button"
                        onClick={() => setWalkInVariant('matang')}
                        className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-sans font-bold transition ${
                          walkInVariant === 'matang'
                            ? 'bg-[#111111] text-[#FFD700]'
                            : 'text-[#5C3D2E]'
                        }`}
                      >
                        🍳 Matang
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalkInVariant('frozen')}
                        className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-sans font-bold transition ${
                          walkInVariant === 'frozen'
                            ? 'bg-sky-600 text-white'
                            : 'text-sky-800'
                        }`}
                      >
                        ❄️ Frozen
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={walkInQty}
                        onChange={(e) => setWalkInQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 rounded-full border-2 border-[#111111] px-3 py-2 font-sans text-xs text-center font-bold"
                      />
                      <button
                        type="button"
                        onClick={handleAddWalkInItem}
                        disabled={!walkInSelectedMenu}
                        className="cursor-pointer flex-1 bg-[#FFD700] hover:bg-[#FFE033] disabled:opacity-50 text-[#111111] border-2 border-[#111111] py-2 px-3 rounded-full font-sans font-bold text-xs shadow-xs"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>

                  {/* Rincian Keranjang Walk-In */}
                  {walkInCart.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-[#111111]/10 space-y-2">
                      <div className="text-[11px] font-sans font-bold text-[#5C3D2E] uppercase">
                        Daftar Menu di Nota ({walkInCart.reduce((s, it) => s + it.qty, 0)} pcs):
                      </div>
                      <div className="space-y-1.5">
                        {walkInCart.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs font-sans bg-[#FFF8E7] px-3 py-1.5 rounded-lg border border-[#111111]/10"
                          >
                            <div>
                              <strong>{it.qty}x</strong> {it.nama}{' '}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ml-1 ${
                                  it.variantType === 'frozen'
                                    ? 'bg-sky-100 text-sky-800 border-sky-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                                }`}
                              >
                                {it.variantType === 'frozen' ? '❄️ Frozen' : '🍳 Matang'}
                              </span>
                              {it.pilihanOpsi && (
                                <span className="bg-white border border-[#111111]/20 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#5C3D2E] ml-1">
                                  {it.pilihanOpsi}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold">
                                Rp {(it.harga * it.qty).toLocaleString('id-ID')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setWalkInCart((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-[#5C3D2E]/60 italic pt-1">
                      Belum ada menu yang dimasukkan ke nota.
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Metode Pembayaran
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['tunai', 'qris'] as PaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setWalkInPaymentMethod(m)}
                          className={`cursor-pointer py-2 px-3 rounded-full font-sans font-bold text-xs border-2 text-center transition ${
                            walkInPaymentMethod === m
                              ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-[2px_2px_0_#FFD700]'
                              : 'bg-white text-[#111111] border-[#111111]/20 hover:border-[#111111]'
                          }`}
                        >
                          {m === 'tunai' && '💵 Uang Tunai'}
                          {m === 'qris' && '📱 QRIS (Semua Bank/E-Wallet)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Catatan Tambahan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={walkInNotes}
                      onChange={(e) => setWalkInNotes(e.target.value)}
                      placeholder="Contoh: Minta dibungkus terpisah"
                      className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                    />
                  </div>
                </div>

                {/* Kalkulator Uang Tunai & Kembalian */}
                {walkInPaymentMethod === 'tunai' && (() => {
                  const currentTotal = walkInCart.reduce((sum, item) => sum + item.harga * item.qty, 0);
                  const receivedNum = typeof walkInCashReceived === 'number' ? walkInCashReceived : 0;
                  const changeNum = receivedNum - currentTotal;
                  return (
                    <div className="bg-[#FFF8E7] rounded-[18px] p-4 border-2 border-amber-300 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                          💵 Uang Tunai Diterima dari Pembeli (Rp)
                        </label>
                        {walkInCashReceived !== '' && (
                          <div className="text-xs font-sans font-bold">
                            {changeNum < 0 ? (
                              <span className="text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                Kurang Rp {Math.abs(changeNum).toLocaleString('id-ID')}
                              </span>
                            ) : changeNum === 0 ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                ✓ Uang Pas
                              </span>
                            ) : (
                              <span className="text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 shadow-xs">
                                Kembalian: <strong>Rp {changeNum.toLocaleString('id-ID')}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <div className="relative flex-1 w-full">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-sans font-bold text-xs text-[#5C3D2E]">
                            Rp
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={walkInCashReceived}
                            onChange={(e) =>
                              setWalkInCashReceived(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            placeholder={currentTotal > 0 ? currentTotal.toString() : 'Masukkan nominal uang tunai'}
                            className="w-full pl-10 pr-4 py-2 rounded-full border-2 border-[#111111] font-sans font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                          />
                        </div>

                        {/* Quick Nominal Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setWalkInCashReceived(currentTotal)}
                            className="cursor-pointer px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-sans text-xs font-bold transition shadow-2xs"
                          >
                            Uang Pas
                          </button>
                          {[10000, 20000, 50000, 100000].map((presetVal) => (
                            <button
                              key={presetVal}
                              type="button"
                              onClick={() => setWalkInCashReceived(presetVal)}
                              className="cursor-pointer px-2.5 py-1.5 rounded-full bg-white hover:bg-[#FFEEC2] text-[#111111] border border-[#111111]/30 font-sans text-xs font-bold transition shadow-2xs"
                            >
                              {presetVal >= 1000 ? `${presetVal / 1000}rb` : presetVal}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* QRIS Official Barcode Box */}
                {walkInPaymentMethod === 'qris' && (() => {
                  const currentTotal = walkInCart.reduce((sum, item) => sum + item.harga * item.qty, 0);
                  return (
                    <div className="bg-[#FFFDF4] rounded-[18px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white rounded-xl border-2 border-[#111111] p-1 flex items-center justify-center shrink-0 shadow-2xs">
                            <img src="/qris-dulang.png" alt="QRIS" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1 bg-[#111111] text-[#FFD700] px-2 py-0.5 rounded-full text-[10px] font-bold">
                              <span>📱</span> QRIS RESMI
                            </span>
                            <h4 className="font-hand font-bold text-lg text-[#111111] leading-tight mt-0.5">
                              DULANG INDONESIA
                            </h4>
                            <p className="font-mono text-[11px] text-[#5C3D2E] font-bold">
                              NMID: ID1020057244342 (OVO / GPN)
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsQrisModalOpen(true)}
                          className="cursor-pointer bg-[#FFD700] hover:bg-[#111111] text-[#111111] hover:text-[#FFD700] transition px-4 py-2 rounded-full font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center justify-center gap-1.5 self-stretch sm:self-auto"
                        >
                          <span>🔍</span>
                          <span>Buka QRIS Layar Penuh</span>
                        </button>
                      </div>

                      <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-200 text-xs font-sans text-[#5C3D2E] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>Arahkan pembeli scan QRIS senilai: <strong>Rp {currentTotal.toLocaleString('id-ID')}</strong></span>
                        <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full self-start sm:self-auto">✓ Bebas Biaya Admin</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t-2 border-[#111111]/10">
                  <div className="font-sans text-sm">
                    <span className="text-[#5C3D2E]">Total Transaksi: </span>
                    <strong className="text-xl font-hand font-bold text-[#111111]">
                      Rp{' '}
                      {walkInCart
                        .reduce((sum, item) => sum + item.harga * item.qty, 0)
                        .toLocaleString('id-ID')}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingWalkInOrder(false);
                        setWalkInCart([]);
                      }}
                      className="cursor-pointer px-4 py-2 rounded-full font-sans text-xs font-bold text-[#5C3D2E] hover:underline"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={walkInCart.length === 0}
                      className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] disabled:opacity-50 text-[#111111] border-2 border-[#111111] px-6 py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm shadow-[3px_3px_0_#111111] transition"
                    >
                      Selesaikan & Simpan Transaksi (Lunas) ✓
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* DAFTAR ANTREAN TRANSAKSI & STATUS BAYAR (LANGSUNG TAMPIL DULUAN) */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="font-hand font-bold text-xl sm:text-2xl text-[#111111] leading-none">
                    Daftar Antrean Pesanan
                  </h3>
                  <p className="font-sans text-[11px] sm:text-xs text-[#5C3D2E]/70 mt-0.5">
                    Konfirmasi pembayaran langsung atau cetak struk kasir.
                  </p>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="inline-flex p-0.5 sm:p-1 bg-white border sm:border-2 border-[#111111] rounded-full shadow-2xs gap-0.5 overflow-x-auto no-scrollbar max-w-full">
                    {(['all', 'menunggu', 'dp', 'lunas', 'batal'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setOrderFilter(st)}
                        className={`cursor-pointer px-2.5 sm:px-3 py-1 rounded-full font-sans font-bold text-[11px] sm:text-xs transition shrink-0 ${
                          orderFilter === st
                            ? 'bg-[#111111] text-[#FFD700]'
                            : 'text-[#5C3D2E]/70 hover:text-[#111111]'
                        }`}
                      >
                        {st === 'all' && `Semua (${orders.length})`}
                        {st === 'menunggu' && `⏳ Menunggu (${pendingOrders.length})`}
                        {st === 'dp' && `🟡 DP (${dpOrders.length})`}
                        {st === 'lunas' && `✓ Lunas (${lunasOrders.length})`}
                        {st === 'batal' && `✕ Batal (${batalOrders.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Cari nama / ID..."
                      className="rounded-full border sm:border-2 border-[#111111] px-3.5 py-1.5 sm:py-1 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700] flex-1 sm:w-44"
                    />

                    {orders.length > 0 && activeRole === 'owner' && (
                      <button
                        type="button"
                        onClick={handleClearAllOrders}
                        className="cursor-pointer px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-sans font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition shrink-0"
                        title="Bersihkan semua pesanan uji coba / dummy"
                      >
                        🧹 <span className="hidden xs:inline">Reset Uji Coba</span><span className="xs:hidden">Reset</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Cards List */}
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-[20px] p-6 sm:p-8 text-center border-2 border-[#111111] shadow-[3px_3px_0_#111111]">
                  <p className="font-sans text-sm text-[#5C3D2E]/70">
                    Tidak ada transaksi pada filter ini.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:gap-3">
                  {filteredOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className={`bg-white rounded-[16px] sm:rounded-[20px] p-3 sm:p-5 border sm:border-2 border-[#111111] shadow-[2px_2px_0_#111111] sm:shadow-[3px_3px_0_#111111] transition-all ${
                        ord.status === 'menunggu' ? 'bg-amber-50/40 border-amber-500' : ''
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Top Meta Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#111111]/10 pb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full">
                              #{ord.id}
                            </span>
                            <span className="font-sans text-[11px] text-[#5C3D2E]/70">
                              {new Date(ord.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="font-sans text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#111111]/15 bg-white">
                              {ord.channel === 'web_wa' ? '📱 WhatsApp' : '🍳 Walk-In'}
                            </span>
                          </div>

                          {/* Status Pill */}
                          <span
                            className={`font-sans text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              ord.status === 'lunas'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : ord.status === 'dp'
                                ? 'bg-amber-100 text-amber-900 border border-amber-500 font-extrabold'
                                : ord.status === 'menunggu'
                                ? 'bg-amber-100 text-amber-900 border border-amber-400 animate-pulse'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}
                          >
                            {ord.status === 'lunas'
                              ? `✓ Lunas (${(ord.payment_method || 'tunai').toUpperCase()})`
                              : ord.status === 'dp'
                              ? `🟡 DP: Rp ${(ord.dp_amount || 0).toLocaleString('id-ID')} (Sisa: Rp ${(ord.remaining_amount !== undefined ? ord.remaining_amount : (ord.total_price - (ord.dp_amount || 0))).toLocaleString('id-ID')})`
                              : ord.status === 'menunggu'
                              ? '⏳ Menunggu Konfirmasi'
                              : '✕ Batal Beli'}
                          </span>
                        </div>

                        {/* Prominent Delivery Slot & Schedule Badge */}
                        {ord.delivery_schedule && (
                          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-600/30 text-amber-950 px-3 py-1.5 rounded-[12px] font-sans font-bold text-xs flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-sm">⏰</span>
                              <span className="text-[11px] uppercase tracking-wide text-[#5C3D2E]">Jadwal Kirim / Acara:</span>
                              <span className="bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold truncate">
                                {ord.delivery_schedule}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0 hidden xs:inline">
                              Prioritas Dapur 🔥
                            </span>
                          </div>
                        )}

                        {/* Customer Info */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-sans text-sm">
                            <strong className="text-[#111111] text-base">{ord.customer_name}</strong>
                            {ord.customer_wa && (
                              <a
                                href={`https://wa.me/${ord.customer_wa.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 underline font-semibold ml-2 hover:text-emerald-900 text-xs"
                              >
                                WA: {ord.customer_wa} ↗
                              </a>
                            )}
                            {ord.customer_qr_id && (
                              <span className="ml-1.5 font-mono text-[10px] bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full font-bold">
                                {ord.customer_qr_id}
                              </span>
                            )}
                            {ord.kitchen_status && (
                              <span className="ml-1.5 font-sans text-[10px] bg-[#111111] text-[#FFD700] px-2 py-0.5 rounded-full font-bold border border-[#FFD700]/30">
                                {ord.kitchen_status === 'sedang_goreng' && '🔥 Di Wajan'}
                                {ord.kitchen_status === 'packing' && '📦 Packing'}
                                {ord.kitchen_status === 'siap' && '🥟 Siap Ambil'}
                                {ord.kitchen_status === 'antre' && '⏳ Antre Masak'}
                                {ord.kitchen_status === 'selesai' && '✅ Selesai'}
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="font-hand font-bold text-xl sm:text-2xl text-[#111111]">
                              Rp {ord.total_price.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Breakdown */}
                        <div className="flex flex-wrap gap-1.5 font-sans text-xs">
                          {ord.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="bg-[#FFF8E7] border border-[#111111]/15 px-2 py-0.5 rounded-lg flex items-center gap-1"
                            >
                              <strong>{it.qty}x</strong> {it.nama}
                              <span
                                className={`text-[9px] font-bold px-1 rounded-sm ${
                                  it.variantType === 'frozen'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {it.variantType === 'frozen' ? '❄️' : '🍳'}
                              </span>
                              {it.pilihanOpsi && (
                                <span className="text-[#5C3D2E] font-medium ml-0.5">
                                  ({it.pilihanOpsi})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>

                        {(ord.is_gift || ord.gift_recipient) && (
                          <div className="font-sans text-xs bg-pink-50 text-pink-900 px-3 py-1.5 rounded-lg border border-pink-300 flex items-start gap-2">
                            <span className="text-base shrink-0">🎁</span>
                            <div>
                              <span className="font-bold">Pesanan Hadiah untuk:</span> Kak {ord.gift_recipient || 'Istimewa'}
                              {ord.gift_message && (
                                <span className="block text-[11px] italic text-pink-800 mt-0.5">"{ord.gift_message}"</span>
                              )}
                            </div>
                          </div>
                        )}

                        {ord.notes && (
                          <div className="font-sans text-xs bg-amber-100/60 text-[#5C3D2E] px-2.5 py-1 rounded-lg border border-amber-200/80">
                            💬 <strong>Catatan Dapur:</strong> "{ord.notes}"
                          </div>
                        )}

                        {/* Action Buttons: Clean & Ergonomic */}
                        {/* DESKTOP ACTIONS: FULL SUITE */}
                        <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#111111]/10">
                          <div className="flex flex-wrap items-center gap-1.5 grow sm:grow-0">
                            {ord.status === 'menunggu' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, 'lunas', 'qris')}
                                  className="cursor-pointer flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-sans font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-800 shadow-xs flex items-center justify-center gap-1 transition active:scale-95"
                                  title="Tandai Lunas via QRIS"
                                >
                                  <span>📱</span> Lunas QRIS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, 'lunas', 'tunai')}
                                  className="cursor-pointer flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full font-sans font-bold text-xs bg-[#FFD700] text-[#111111] hover:brightness-105 border border-[#111111] shadow-xs flex items-center justify-center gap-1 transition active:scale-95"
                                  title="Tandai Lunas via Tunai"
                                >
                                  <span>💵</span> Lunas Tunai
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(ord.id, 'lunas', 'transfer')}
                                  className="cursor-pointer px-2.5 py-1.5 rounded-full font-sans font-bold text-xs bg-white hover:bg-blue-50 text-blue-800 border border-blue-300"
                                  title="Tandai Lunas via Transfer"
                                >
                                  🏦 Transfer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDpModalOrder(ord);
                                    setDpInputNominal(Math.round(ord.total_price * 0.5));
                                  }}
                                  className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-amber-400 text-amber-950 hover:bg-amber-500 border border-amber-600 shadow-xs flex items-center justify-center gap-1 transition active:scale-95"
                                  title="Catat Pembayaran Uang Muka (DP)"
                                >
                                  <span>💵</span> Terima DP
                                </button>
                              </>
                            )}

                            {ord.status === 'dp' && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSettleOrder(ord.id, 'tunai')}
                                  className="cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-800 shadow-xs flex items-center gap-1 transition active:scale-95"
                                  title="Terima Pelunasan Sisa Tagihan"
                                >
                                  <span>✓</span> Pelunasan (Rp {(ord.remaining_amount !== undefined ? ord.remaining_amount : (ord.total_price - (ord.dp_amount || 0))).toLocaleString('id-ID')})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendDpReminderWA(ord)}
                                  className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-[#25D366] text-white hover:brightness-105 border border-emerald-800 shadow-xs flex items-center gap-1 transition"
                                  title="Kirim Konfirmasi DP & Info Sisa ke WhatsApp"
                                >
                                  <span>📲</span> WA Sisa DP
                                </button>
                              </div>
                            )}

                            {ord.status === 'lunas' && (
                              <span className="px-3 py-1 rounded-full font-sans font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                ✓ Lunas ({(ord.payment_method || 'tunai').toUpperCase()})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForReceipt(ord)}
                              className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-[#111111] text-[#FFD700] border border-[#111111] hover:brightness-110 flex items-center gap-1 transition"
                              title="Buka / Cetak Struk Kasir"
                            >
                              <span>🧾</span>
                              <span className="hidden xs:inline">Struk</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedOrderForInvoice(ord)}
                              className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-blue-900 text-white border border-blue-950 hover:bg-blue-800 flex items-center gap-1 transition"
                              title="Cetak Invoice / Kuitansi Formal A4 untuk Kantor / Instansi"
                            >
                              <span>📄</span>
                              <span className="hidden xs:inline">Invoice A4</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendInvoiceWhatsApp(ord)}
                              className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-[#25D366] text-white border border-emerald-700 hover:brightness-105 flex items-center gap-1 transition"
                              title="Kirim Tagihan / Invoice ke WhatsApp"
                            >
                              <span>📲</span>
                              <span className="hidden xs:inline">WA</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const waMsg = storageService.generateWaTrackingMessage(ord);
                                const cleanWa = (ord.customer_wa || '').replace(/\D/g, '');
                                let url = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
                                if (cleanWa) {
                                  const waNum = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
                                  url = `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`;
                                }
                                window.open(url, '_blank');
                                onShowToast(`Membuka WhatsApp untuk kirim link lacak pesanan #${ord.id}... 📱`);
                              }}
                              className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-amber-500 text-black border border-amber-600 hover:bg-amber-400 flex items-center gap-1 transition shadow-xs"
                              title="Kirim link live tracking dapur ke WA pembeli"
                            >
                              <span>🔥</span>
                              <span className="hidden xs:inline">Resi Live</span>
                            </button>

                            {ord.status === 'menunggu' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(ord.id, 'batal')}
                                className="cursor-pointer px-2 py-1.5 rounded-full font-sans font-bold text-xs bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 transition"
                                title="Tandai pesanan batal"
                              >
                                ✕
                              </button>
                            )}

                            {activeRole === 'owner' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(ord.id)}
                                className="cursor-pointer text-gray-400 hover:text-red-500 p-1.5 text-xs"
                                title="Hapus riwayat pesanan ini"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MOBILE SMART ACTION BAR (SUPER CLEAN, ERGONOMIC, NO BUTTON SOUP) */}
                        <div className="flex sm:hidden items-center justify-between gap-1.5 pt-2 border-t border-[#111111]/10">
                          {ord.status === 'menunggu' && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(ord.id, 'lunas', 'tunai')}
                                className="cursor-pointer flex-1 py-2 px-2.5 rounded-full font-sans font-bold text-xs bg-[#FFD700] text-[#111111] border border-[#111111] shadow-xs flex items-center justify-center gap-1 active:scale-95"
                              >
                                <span>💵</span> Tunai
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(ord.id, 'lunas', 'qris')}
                                className="cursor-pointer flex-1 py-2 px-2.5 rounded-full font-sans font-bold text-xs bg-emerald-600 text-white border border-emerald-800 shadow-xs flex items-center justify-center gap-1 active:scale-95"
                              >
                                <span>📱</span> QRIS
                              </button>
                            </div>
                          )}

                          {ord.status === 'dp' && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleSettleOrder(ord.id, 'tunai')}
                                className="cursor-pointer flex-1 py-2 px-2.5 rounded-full font-sans font-bold text-xs bg-emerald-600 text-white border border-emerald-800 shadow-xs flex items-center justify-center gap-1 active:scale-95 truncate"
                              >
                                <span>✓</span> Lunasi (Rp {(ord.remaining_amount !== undefined ? ord.remaining_amount : (ord.total_price - (ord.dp_amount || 0))).toLocaleString('id-ID')})
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendDpReminderWA(ord)}
                                className="cursor-pointer px-2.5 py-2 rounded-full font-sans font-bold text-xs bg-[#25D366] text-white border border-emerald-800 shadow-xs flex items-center justify-center gap-1 active:scale-95 shrink-0"
                                title="Kirim WA Sisa DP"
                              >
                                <span>📲</span> WA
                              </button>
                            </div>
                          )}

                          {ord.status === 'lunas' && (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="font-sans font-bold text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full truncate">
                                ✓ {(ord.payment_method || 'tunai').toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForReceipt(ord)}
                                className="cursor-pointer px-3 py-1.5 rounded-full font-sans font-bold text-xs bg-[#111111] text-[#FFD700] border border-[#111111] flex items-center gap-1 active:scale-95 ml-auto"
                              >
                                <span>🧾</span> Struk
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendInvoiceWhatsApp(ord)}
                                className="cursor-pointer px-2.5 py-1.5 rounded-full font-sans font-bold text-xs bg-[#25D366] text-white border border-emerald-700 flex items-center gap-1 active:scale-95"
                              >
                                <span>📲</span> WA
                              </button>
                            </div>
                          )}

                          {ord.status === 'batal' && (
                            <div className="flex items-center gap-1.5 flex-1">
                              <span className="font-sans font-bold text-[11px] text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                                ✕ Batal Beli
                              </span>
                            </div>
                          )}

                          {/* Quick Action Drawer Trigger on Mobile */}
                          <button
                            type="button"
                            onClick={() => setMobileActionOrder(ord)}
                            className="cursor-pointer w-9 h-9 rounded-full bg-gray-100 hover:bg-[#FFD700] text-[#111111] border border-[#111111]/25 font-bold flex items-center justify-center transition active:scale-95 shrink-0 text-xs shadow-2xs"
                            title="Opsi aksi lengkap pesanan ini"
                          >
                            •••
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACCORDION: GRAFIK & ANALISIS PENJUALAN DAPUR (TIDAK MENGHALANGI ANTREAN) */}
            <div className="bg-white rounded-[22px] border-2 border-[#111111] shadow-[3px_3px_0_#111111] overflow-hidden mt-6">
              <button
                type="button"
                onClick={() => setIsChartsExpanded(!isChartsExpanded)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left font-sans font-bold text-sm bg-gradient-to-r from-amber-50 to-white hover:bg-amber-100/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📊</span>
                  <div>
                    <span className="font-hand font-bold text-xl text-[#111111] block leading-tight">
                      Grafik Menu Best Seller & Analisis Omset
                    </span>
                    <span className="font-sans text-[11px] text-[#5C3D2E]/70 font-normal">
                      Peringkat menu terlaris & rincian pembayaran (QRIS/Tunai/Transfer)
                    </span>
                  </div>
                </div>
                <span className="text-xs bg-[#FFD700] text-[#111111] px-3 py-1 rounded-full font-bold border border-[#111111]/30 shrink-0">
                  {isChartsExpanded ? 'Tutup ▲' : 'Buka Grafik ▼'}
                </span>
              </button>

              {isChartsExpanded && (
                <div className="p-4 sm:p-6 border-t-2 border-[#111111]/10 space-y-6 animate-in slide-in-from-top-2 duration-200">
                  {/* Detailed Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-[#FFF8E7] rounded-[18px] p-4 border border-[#111111]/20">
                      <span className="text-[11px] font-sans font-bold uppercase text-[#5C3D2E]/70 block">
                        Omset Terbayar (Lunas)
                      </span>
                      <div className="font-hand font-bold text-2xl text-[#111111] mt-1">
                        Rp {totalOmsetLunas.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] font-sans text-emerald-700 font-bold mt-1">
                        ✓ {lunasOrders.length} transaksi selesai
                      </div>
                    </div>

                    <div className="bg-[#FFF8E7] rounded-[18px] p-4 border border-[#111111]/20">
                      <span className="text-[11px] font-sans font-bold uppercase text-[#5C3D2E]/70 block">
                        Porsi Risoles Terjual
                      </span>
                      <div className="font-hand font-bold text-2xl text-[#111111] mt-1">
                        {totalPorsiTerjual} Porsi
                      </div>
                      <div className="text-[11px] font-sans text-[#5C3D2E]/80 mt-1">
                        Digoreng fresh di wajan panas
                      </div>
                    </div>

                    <div className="bg-[#FFF8E7] rounded-[18px] p-4 border border-[#111111]/20">
                      <span className="text-[11px] font-sans font-bold uppercase text-[#5C3D2E]/70 block">
                        Menunggu Pembayaran
                      </span>
                      <div className="font-hand font-bold text-2xl text-[#111111] mt-1">
                        {pendingOrders.length} Order
                      </div>
                      <div className="text-[11px] font-sans text-amber-700 font-bold mt-1">
                        Rp {totalOmsetPending.toLocaleString('id-ID')} butuh konfirmasi
                      </div>
                    </div>

                    <div className="bg-[#FFFDF4] rounded-[18px] p-4 border border-[#111111]/20 space-y-1">
                      <span className="text-[11px] font-sans font-bold uppercase text-[#5C3D2E]/70 block mb-1">
                        Breakdown Pembayaran
                      </span>
                      <div className="flex justify-between text-xs font-sans">
                        <span>📱 QRIS:</span>
                        <strong>Rp {qrisTotal.toLocaleString('id-ID')} ({qrisOrders.length}x)</strong>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span>💵 Tunai:</span>
                        <strong>Rp {tunaiTotal.toLocaleString('id-ID')} ({tunaiOrders.length}x)</strong>
                      </div>
                      <div className="flex justify-between text-xs font-sans">
                        <span>🏦 Transfer:</span>
                        <strong>Rp {transferTotal.toLocaleString('id-ID')} ({transferOrders.length}x)</strong>
                      </div>
                    </div>
                  </div>

                  {/* VISUAL GRAFIK PENJUALAN & LEADERBOARD BEST SELLER */}
                  <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
                    {/* Leaderboard Menu Terlaris Bar Chart */}
                    <div className="bg-[#FFFDF4] rounded-[20px] p-5 border-2 border-[#111111]/15 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-hand font-bold text-xl text-[#111111] leading-none">
                            🏆 Menu Paling Laris (Best Seller)
                          </h4>
                          <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                            Peringkat menu berdasarkan total porsi terbayar lunas.
                          </p>
                        </div>
                        <span className="font-sans text-xs font-bold bg-[#FFD700] px-3 py-1 rounded-full border border-[#111111]">
                          {bestSellerList.length} Menu
                        </span>
                      </div>

                      {bestSellerList.length === 0 ? (
                        <div className="text-center py-6 font-sans text-xs text-[#5C3D2E]/60 italic">
                          Belum ada data penjualan lunas. Begitu pesanan ditandai lunas, grafik akan langsung muncul di sini!
                        </div>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {bestSellerList.map((item, idx) => {
                            const pct = Math.round((item.qty / maxSoldQty) * 100);
                            const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return (
                              <div key={item.nama} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-sans">
                                  <span className="font-bold text-[#111111] flex items-center gap-1.5">
                                    <span className="w-5 text-center">{rankBadge}</span>
                                    <span>{item.nama}</span>
                                  </span>
                                  <span className="text-[#5C3D2E]">
                                    <strong>{item.qty} porsi</strong> • Rp {item.totalRp.toLocaleString('id-ID')}
                                  </span>
                                </div>
                                <div className="w-full bg-[#FFF8E7] rounded-full h-3.5 overflow-hidden border border-[#111111]/20 p-0.5">
                                  <div
                                    className="bg-gradient-to-r from-[#FFD700] via-amber-400 to-[#FFD700] h-full rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max(pct, 6)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Perbandingan Metode Pembayaran */}
                    <div className="bg-[#FFFDF4] rounded-[20px] p-5 border-2 border-[#111111]/15 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="font-hand font-bold text-xl text-[#111111] leading-none">
                          💳 Sebaran Metode Bayar
                        </h4>
                        <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                          Pelanggan paling suka bayar pakai apa?
                        </p>

                        <div className="mt-4 space-y-3 font-sans text-xs">
                          {/* QRIS */}
                          <div>
                            <div className="flex justify-between font-bold mb-1">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                📱 QRIS
                              </span>
                              <span>{totalOmsetLunas > 0 ? Math.round((qrisTotal / totalOmsetLunas) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-[#111111]/20">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                                style={{ width: `${totalOmsetLunas > 0 ? (qrisTotal / totalOmsetLunas) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Tunai */}
                          <div>
                            <div className="flex justify-between font-bold mb-1">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                                💵 Tunai
                              </span>
                              <span>{totalOmsetLunas > 0 ? Math.round((tunaiTotal / totalOmsetLunas) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-[#111111]/20">
                              <div
                                className="bg-amber-400 h-full rounded-full transition-all duration-700"
                                style={{ width: `${totalOmsetLunas > 0 ? (tunaiTotal / totalOmsetLunas) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Transfer */}
                          <div>
                            <div className="flex justify-between font-bold mb-1">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                🏦 Transfer Bank
                              </span>
                              <span>{totalOmsetLunas > 0 ? Math.round((transferTotal / totalOmsetLunas) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-[#111111]/20">
                              <div
                                className="bg-blue-500 h-full rounded-full transition-all duration-700"
                                style={{ width: `${totalOmsetLunas > 0 ? (transferTotal / totalOmsetLunas) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FFF8E7] rounded-[14px] border border-[#FFD700] text-[11px] font-sans text-[#5C3D2E]">
                        💡 <strong>Tips Dapur:</strong> Setiap kali pesanan lunas, sistem otomatis mencatat menu & saos terfavorit pembeli!
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: BUKU KAS & PROFIT BERSIH DAPUR */}
      {activeTab === 'expenses' && (() => {
        const paidOrders = orders.filter((o) => o.status === 'lunas');
        const dpOrdersList = orders.filter((o) => o.status === 'dp');
        const totalOmsetKotor = paidOrders.reduce((sum, o) => sum + o.total_price, 0) +
          dpOrdersList.reduce((sum, o) => sum + (o.dp_amount || 0), 0);
        const totalBelanjaDapur = expenses.reduce((sum, e) => sum + e.nominal, 0);
        const netProfit = totalOmsetKotor - totalBelanjaDapur;
        const netProfitMargin = totalOmsetKotor > 0 ? ((netProfit / totalOmsetKotor) * 100).toFixed(1) : '0';

        const categoryLabels: Record<ExpenseCategory, { label: string; icon: string; bg: string }> = {
          bahan_baku: { label: 'Bahan Baku & Isian', icon: '🥚', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
          operasional: { label: 'Operasional & Gas', icon: '⚡', bg: 'bg-blue-100 text-blue-900 border-blue-300' },
          kemasan: { label: 'Kemasan & Dus Box', icon: '📦', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
          lainnya: { label: 'Lain-lain', icon: '🏷️', bg: 'bg-purple-100 text-purple-900 border-purple-300' },
        };

        const expenseByCategory = {
          bahan_baku: expenses.filter((e) => e.kategori === 'bahan_baku').reduce((s, e) => s + e.nominal, 0),
          operasional: expenses.filter((e) => e.kategori === 'operasional').reduce((s, e) => s + e.nominal, 0),
          kemasan: expenses.filter((e) => e.kategori === 'kemasan').reduce((s, e) => s + e.nominal, 0),
          lainnya: expenses.filter((e) => e.kategori === 'lainnya').reduce((s, e) => s + e.nominal, 0),
        };

        const filteredExpenses = expenses.filter((e) => {
          const matchCat = expenseCategoryFilter === 'all' || e.kategori === expenseCategoryFilter;
          const matchSearch =
            e.nama_item.toLowerCase().includes(expenseSearch.toLowerCase()) ||
            (e.catatan && e.catatan.toLowerCase().includes(expenseSearch.toLowerCase()));
          return matchCat && matchSearch;
        });

        return (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span>📉</span> Buku Kas Dapur & Analisa Profit
                </div>
                <h2 className="font-hand font-bold text-[34px] leading-none text-[#111111]">
                  Buku Kas & Laba Bersih Dapur Dulang
                </h2>
                <p className="font-sans text-xs sm:text-sm text-[#5C3D2E]/80 mt-1">
                  Catat belanja minyak, telur, daging, dan gas elpiji. Hitung keuntungan bersih dapur secara otomatis & transparan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="cursor-pointer bg-[#25D366] hover:bg-[#20ba59] text-white font-sans font-bold px-4 py-2.5 rounded-full text-xs border-2 border-[#111111] shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5 active:translate-y-0.5"
                  title="Rekap tutup dapur malam & kirim otomatis ke WA Owner"
                >
                  <span>🌙</span>
                  <span>Tutup Dapur & Kirim Rekap WA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(!isAddingExpense)}
                  className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 font-sans font-bold px-4 py-2.5 rounded-full text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] transition flex items-center gap-1.5"
                >
                  <span>{isAddingExpense ? 'Tutup Form ✕' : '+ Catat Pengeluaran Baru'}</span>
                </button>
              </div>
            </div>

            {/* P&L METRIC CARDS (2x2 GRID ON MOBILE, 4 COLS ON DESKTOP) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* Omset Penjualan Kotor */}
              <div className="bg-white rounded-[18px] sm:rounded-[22px] p-3.5 sm:p-5 border sm:border-2 border-[#111111] shadow-xs sm:shadow-[3px_3px_0_#111111] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5C3D2E]/80 truncate">
                    Omset Lunas
                  </span>
                  <span className="text-base sm:text-xl">💰</span>
                </div>
                <div className="font-hand font-bold text-lg xs:text-xl sm:text-3xl lg:text-4xl text-[#111111] mt-1 sm:mt-2 truncate">
                  Rp {totalOmsetKotor.toLocaleString('id-ID')}
                </div>
                <div className="font-sans text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 sm:mt-1 truncate">
                  ✓ {paidOrders.length} transaksi
                </div>
              </div>

              {/* Total Belanja Dapur */}
              <div className="bg-white rounded-[18px] sm:rounded-[22px] p-3.5 sm:p-5 border sm:border-2 border-[#111111] shadow-xs sm:shadow-[3px_3px_0_#111111] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5C3D2E]/80 truncate">
                    Total Belanja
                  </span>
                  <span className="text-base sm:text-xl">🛒</span>
                </div>
                <div className="font-hand font-bold text-lg xs:text-xl sm:text-3xl lg:text-4xl text-red-600 mt-1 sm:mt-2 truncate">
                  Rp {totalBelanjaDapur.toLocaleString('id-ID')}
                </div>
                <div className="font-sans text-[10px] sm:text-[11px] text-[#5C3D2E]/70 font-semibold mt-0.5 sm:mt-1 truncate">
                  {expenses.length} pos belanja
                </div>
              </div>

              {/* Laba Bersih Dapur */}
              <div
                className={`rounded-[18px] sm:rounded-[22px] p-3.5 sm:p-5 border sm:border-2 border-[#111111] shadow-xs sm:shadow-[4px_4px_0_#111111] relative overflow-hidden ${
                  netProfit >= 0 ? 'bg-[#FFD700]' : 'bg-red-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#111111] truncate">
                    Laba Bersih
                  </span>
                  <span className="text-base sm:text-xl">{netProfit >= 0 ? '🚀' : '⚠️'}</span>
                </div>
                <div className="font-hand font-bold text-lg xs:text-xl sm:text-3xl lg:text-4xl text-[#111111] mt-1 sm:mt-2 truncate">
                  {netProfit < 0 ? '-' : ''}Rp {Math.abs(netProfit).toLocaleString('id-ID')}
                </div>
                <div className="font-sans text-[10px] sm:text-[11px] font-bold text-[#111111]/85 mt-0.5 sm:mt-1 truncate">
                  {netProfit >= 0 ? '✨ Surplus Untung' : '⚠️ Melebihi omset'}
                </div>
              </div>

              {/* Margin Laba Bersih */}
              <div className="bg-[#111111] text-[#FFF8E7] rounded-[18px] sm:rounded-[22px] p-3.5 sm:p-5 border sm:border-2 border-[#111111] shadow-xs sm:shadow-[3px_3px_0_#FFD700] relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#FFD700] truncate">
                    Margin Profit
                  </span>
                  <span className="text-base sm:text-xl">📊</span>
                </div>
                <div className="font-hand font-bold text-lg xs:text-xl sm:text-3xl lg:text-4xl text-[#FFD700] mt-1 sm:mt-2 truncate">
                  {netProfitMargin}%
                </div>
                <div className="font-sans text-[10px] sm:text-[11px] text-white/70 font-semibold mt-0.5 sm:mt-1 truncate">
                  Rasio keuntungan
                </div>
              </div>
            </div>

            {/* BREAKDOWN PER KATEGORI BELANJA */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { cat: 'bahan_baku' as ExpenseCategory, name: 'Bahan Baku & Isian', total: expenseByCategory.bahan_baku, icon: '🥚' },
                { cat: 'operasional' as ExpenseCategory, name: 'Operasional & Gas', total: expenseByCategory.operasional, icon: '⚡' },
                { cat: 'kemasan' as ExpenseCategory, name: 'Dus & Kemasan', total: expenseByCategory.kemasan, icon: '📦' },
                { cat: 'lainnya' as ExpenseCategory, name: 'Lain-lain / Transport', total: expenseByCategory.lainnya, icon: '🏷️' },
              ].map((b) => (
                <div
                  key={b.cat}
                  onClick={() => setExpenseCategoryFilter(expenseCategoryFilter === b.cat ? 'all' : b.cat)}
                  className={`p-3.5 rounded-[16px] border-2 cursor-pointer transition ${
                    expenseCategoryFilter === b.cat
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-sm'
                      : 'bg-white text-[#111111] border-[#111111]/15 hover:border-[#111111]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans font-bold flex items-center gap-1">
                      <span>{b.icon}</span>
                      <span className="truncate">{b.name}</span>
                    </span>
                  </div>
                  <div className="font-hand font-bold text-xl mt-1">
                    Rp {b.total.toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>

            {/* FORM INPUT PENGELUARAN (COLLAPSIBLE / ALWAYS ACCESSIBLE) */}
            {isAddingExpense && (
              <div className="bg-[#FFFDF4] rounded-[24px] p-6 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#111111]/15">
                  <div className="font-hand font-bold text-2xl text-[#111111]">
                    Catat Belanja Bahan / Operasional
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="w-8 h-8 rounded-full bg-white border border-[#111111] flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E] block mb-2">
                    ⚡ Tombol Cepat Belanja Pasar (1-Klik Isi):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {expensePresets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyExpensePreset(p)}
                        className="cursor-pointer bg-white hover:bg-[#FFD700] text-[#111111] border border-[#111111]/30 hover:border-[#111111] px-3 py-1.5 rounded-full text-xs font-sans font-semibold transition shadow-xs"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Form Fields */}
                <form onSubmit={handleAddExpense} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                        Tanggal Belanja:
                      </label>
                      <input
                        type="date"
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                        Kategori Belanja:
                      </label>
                      <select
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                        className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white"
                      >
                        <option value="bahan_baku">🥚 Bahan Baku (Minyak, Telur, Daging, Mayo, Tepung)</option>
                        <option value="operasional">⚡ Operasional & Gas (Elpiji 3kg, Listrik, Es)</option>
                        <option value="kemasan">📦 Kemasan & Dus (Kardus Box Dulang, Mika, Stiker)</option>
                        <option value="lainnya">🏷️ Lain-lain (Transportasi, Kebersihan, Sabun)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                        Nominal Biaya (Rp):
                      </label>
                      <input
                        type="number"
                        min="100"
                        step="500"
                        value={expNominal}
                        onChange={(e) => setExpNominal(e.target.value ? Number(e.target.value) : '')}
                        placeholder="Contoh: 38000"
                        className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                        Nama Barang / Keterangan Belanja:
                      </label>
                      <input
                        type="text"
                        value={expItemName}
                        onChange={(e) => setExpItemName(e.target.value)}
                        placeholder="Contoh: Minyak Goreng Bimoli 2L (2 pcs)"
                        className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                        Catatan Tambahan (Opsional):
                      </label>
                      <input
                        type="text"
                        value={expNotes}
                        onChange={(e) => setExpNotes(e.target.value)}
                        placeholder="Contoh: Beli di Pasar Larangan Sidoarjo"
                        className="w-full rounded-[14px] border-2 border-[#111111] px-3.5 py-2 font-sans text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingExpense(false)}
                      className="cursor-pointer bg-white text-[#5C3D2E] px-4 py-2 rounded-full font-sans font-bold text-xs border border-[#111111]/30 hover:bg-gray-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="cursor-pointer bg-[#111111] text-[#FFD700] px-6 py-2 rounded-full font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
                    >
                      + Simpan ke Buku Kas 📉
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TABEL / DAFTAR RIWAYAT PENGELUARAN */}
            <div className="bg-white rounded-[24px] p-6 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-4">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]/10">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-sans text-xs font-bold text-[#5C3D2E] mr-1">
                    Filter:
                  </span>
                  {[
                    { id: 'all', label: 'Semua' },
                    { id: 'bahan_baku', label: '🥚 Bahan Baku' },
                    { id: 'operasional', label: '⚡ Operasional' },
                    { id: 'kemasan', label: '📦 Kemasan' },
                    { id: 'lainnya', label: '🏷️ Lainnya' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setExpenseCategoryFilter(f.id as any)}
                      className={`cursor-pointer px-3 py-1 rounded-full font-sans font-bold text-xs border transition ${
                        expenseCategoryFilter === f.id
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                          : 'bg-white text-[#5C3D2E] border-[#111111]/20 hover:border-[#111111]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    placeholder="Cari item belanja..."
                    className="w-full rounded-full border border-[#111111]/30 px-3.5 py-1.5 font-sans text-xs focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              {/* Expense List */}
              {filteredExpenses.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-4xl">🧾</div>
                  <h3 className="font-hand font-bold text-xl text-[#111111]">
                    Belum ada catatan pengeluaran
                  </h3>
                  <p className="font-sans text-xs text-[#5C3D2E]/70 max-w-sm mx-auto">
                    {expenseSearch
                      ? 'Tidak ada pengeluaran yang cocok dengan kata kunci pencarian.'
                      : 'Klik "+ Catat Pengeluaran Baru" untuk mulai mencatat belanja bahan dapur.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#111111]/10">
                  {filteredExpenses.map((exp) => {
                    const badge = categoryLabels[exp.kategori] || categoryLabels.lainnya;
                    return (
                      <div
                        key={exp.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFFDF4]/80 px-2 rounded-[14px] transition"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FFD700]/30 border border-[#111111]/20 flex items-center justify-center text-lg shrink-0">
                            {badge.icon}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-sans font-bold text-sm text-[#111111]">
                                {exp.nama_item}
                              </span>
                              <span
                                className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-[#5C3D2E]/75 mt-0.5">
                              <span>📅 {exp.tanggal}</span>
                              {exp.catatan && (
                                <>
                                  <span>•</span>
                                  <span className="italic">💬 "{exp.catatan}"</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-hand font-bold text-xl text-red-600 block">
                              -Rp {exp.nominal.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id, exp.nama_item)}
                            className="cursor-pointer text-gray-400 hover:text-red-600 p-1.5 text-xs rounded-full hover:bg-red-50 transition"
                            title="Hapus catatan pengeluaran ini"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB: GUDANG BAHAN BAKU & RESEP HPP OTOMATIS */}
      {activeTab === 'inventory' && (
        <RecipeInventoryTab
          menus={menus}
          onShowToast={onShowToast}
          onRefreshExpenses={() => setExpenses(storageService.getExpenses())}
        />
      )}

      {/* TAB: LAYAR DAPUR & ANTREAN GORENG (KDS) */}
      {activeTab === 'kds' && (
        <KitchenDisplaySystem onShowToast={onShowToast} />
      )}

      {/* TAB 2: PENGATURAN TOKO & KEAMANAN */}
      {activeTab === 'settings' && (
        <div className="space-y-8">
          {/* SECTION 1: IDENTITAS USAHA & WHITE-LABEL BRAND (Prioritas 3) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                🏷️ Identitas Toko & White-Label
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Identitas Brand & Format Struk Kasir
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Kustomisasi nama usaha, slogan, nomor WhatsApp, dan format struk kasir agar cocok untuk usaha gorengan, kafe, resto, atau bakery Anda.
              </p>
            </div>

            <form onSubmit={handleSaveBrandIdentity} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Nama Usaha */}
                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Nama Brand / Toko / Usaha *
                  </label>
                  <input
                    type="text"
                    required
                    value={localConfig.brandName || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, brandName: e.target.value })}
                    placeholder="Contoh: Dulang Indonesia / Kopi Senja / Resto Barokah"
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-sans font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                {/* Tipe Bisnis */}
                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Tipe Bidang Usaha Kuliner
                  </label>
                  <select
                    value={localConfig.businessType || 'gorengan'}
                    onChange={(e) => setLocalConfig({ ...localConfig, businessType: e.target.value as any })}
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-sans font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="gorengan">🥟 Gorengan & Risoles / Camilan</option>
                    <option value="cafe">☕ Kafe / Coffee Shop & Minuman</option>
                    <option value="resto">🍽️ Restoran / Rumah Makan / Warung</option>
                    <option value="bakery">🍞 Bakery / Toko Roti & Kue</option>
                    <option value="umum">📦 Usaha Kuliner & Dagang Umum</option>
                  </select>
                </div>

                {/* Slogan */}
                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Slogan / Tagline Brand
                  </label>
                  <input
                    type="text"
                    value={localConfig.brandTagline || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, brandTagline: e.target.value })}
                    placeholder="Contoh: Dibuat dengan wajan panas & tulisan tangan"
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-sans text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                {/* WhatsApp Utama */}
                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Nomor WhatsApp Utama Usaha *
                  </label>
                  <input
                    type="text"
                    required
                    value={localConfig.brandPhone || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, brandPhone: e.target.value })}
                    placeholder="087703397035"
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-mono font-bold text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                {/* Alamat Dapur Utama / Lokasi Pengambilan (Fleksibel Cabang) */}
                <div className="sm:col-span-2">
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Alamat Dapur Utama / Lokasi Pengambilan (Fleksibel jika Ada Cabang)
                  </label>
                  <input
                    type="text"
                    value={localConfig.pickupAddressNote || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, pickupAddressNote: e.target.value })}
                    placeholder="Contoh: Dapur Dulang - Sedati, Sidoarjo"
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-sans text-sm bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                  <p className="font-sans text-[11px] text-[#5C3D2E]/70 mt-1">
                    Alamat ini otomatis tercetak di header struk kasir thermal, invoice resmi, dan petunjuk ambil mandiri bagi pembeli.
                  </p>
                </div>
              </div>

              {/* Catatan Kaki Struk Kasir */}
              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  Catatan Kaki Struk Kasir (Footer Note pada Struk Thermal & Invoice)
                </label>
                <textarea
                  rows={2}
                  value={localConfig.receiptFooterNote || ''}
                  onChange={(e) => setLocalConfig({ ...localConfig, receiptFooterNote: e.target.value })}
                  placeholder="Matur suwun sanget sampun jajan! Hangatkan kembali bila perlu yaa 🙏✨"
                  className="w-full rounded-[14px] border-2 border-[#111111] p-3 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700] resize-none"
                />
                <p className="font-sans text-[11px] text-[#5C3D2E]/70 mt-1">
                  Teks ini otomatis tercetak di bagian paling bawah struk printer thermal 58mm/80mm dan invoice resmi A4.
                </p>
              </div>

              {/* Tombol Simpan */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5 transition"
                >
                  Simpan Identitas Usaha ✓
                </button>
              </div>
            </form>
          </div>

          {/* SECTION ZERO: STATUS OPERASIONAL DAPUR & POP-UP TUTUP */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                  🪧 Status Operasional Dapur
                </div>
                <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                  Status Dapur & Pop-up Tutup
                </h2>
                <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                  Atur apakah dapur sedang buka atau libur goreng. Jika tutup, web pembeli akan memunculkan pop-up unik dan banner pengumuman.
                </p>
              </div>

              {/* Toggle Quick Status */}
              <div className="shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleStoreClosed(!localConfig.isStoreClosed)}
                  className={`cursor-pointer px-5 py-2.5 rounded-full font-sans font-bold text-xs border-2 shadow-[2px_2px_0_#111111] transition-all flex items-center gap-2 ${
                    localConfig.isStoreClosed
                      ? 'bg-red-500 text-white border-[#111111] hover:bg-red-600'
                      : 'bg-emerald-500 text-white border-[#111111] hover:bg-emerald-600'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span>
                    {localConfig.isStoreClosed
                      ? '🔴 DAPUR SEDANG TUTUP (LIBUR GORENG)'
                      : '🟢 DAPUR SEDANG BUKA (NORMAL)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Status Indicator Box */}
            <div
              className={`rounded-[20px] p-5 border-2 border-[#111111] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                localConfig.isStoreClosed
                  ? 'bg-[#FFD700]/30 shadow-[3px_3px_0_#111111]'
                  : 'bg-emerald-50 border-emerald-300'
              }`}
            >
              <div className="space-y-1">
                <div className="font-sans font-bold text-sm text-[#111111] flex items-center gap-2">
                  <span className="text-xl">{localConfig.isStoreClosed ? '💤' : '🍳'}</span>
                  <span>
                    {localConfig.isStoreClosed
                      ? 'Pop-up "Libur Goreng" sedang aktif di halaman pembeli'
                      : 'Dapur aktif jualan normal. Pop-up tutup tidak muncul.'}
                  </span>
                </div>
                <p className="font-sans text-xs text-[#5C3D2E]/80">
                  {localConfig.isStoreClosed
                    ? 'Pengunjung yang membuka web dulangin akan disambut kartu pop-up lucu dan banner atas.'
                    : 'Klik tombol di kanan untuk menyetel libur goreng ketika wajan sedang istirahat.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowClosedPreview(true)}
                  className="cursor-pointer bg-white text-[#111111] hover:bg-[#FFF8E7] border-2 border-[#111111] px-4 py-2 rounded-full font-sans font-bold text-xs shadow-sm flex items-center gap-1.5"
                  title="Lihat bagaimana pop-up ini tampil di mata pembeli"
                >
                  <span>👀</span> Pratinjau / Tes Lihat Pop-up
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStoreClosed(!localConfig.isStoreClosed)}
                  className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 border-2 border-[#111111] px-4 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#FFD700]"
                >
                  {localConfig.isStoreClosed ? 'Buka Dapur Lagi 🍳' : 'Tutup / Libur Goreng 💤'}
                </button>
              </div>
            </div>

            {/* Custom Closed Quote Editor Form */}
            <form onSubmit={handleSaveClosedReason} className="space-y-3 pt-2">
              <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80">
                Kalimat Pop-up Unik (Bisa Diedit Suka-Suka):
              </label>
              <textarea
                rows={2}
                value={
                  localConfig.closedReason ??
                  'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia'
                }
                onChange={(e) => setLocalConfig({ ...localConfig, closedReason: e.target.value })}
                placeholder="Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia"
                className="w-full rounded-[16px] border-2 border-[#111111] p-3.5 font-hand font-bold text-lg text-[#111111] bg-white focus:outline-none focus:border-[#FFD700] shadow-sm resize-none"
              />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="font-sans text-[11px] text-[#5C3D2E]/70 italic">
                  💡 Tips: Kalimat ini yang dibaca pembeli saat pop-up muncul di layar mereka.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocalConfig({
                        ...localConfig,
                        closedReason:
                          'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia',
                      });
                    }}
                    className="cursor-pointer text-xs font-sans text-[#5C3D2E] hover:underline px-3 py-1"
                  >
                    Reset Kalimat Bawaan
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-5 py-2 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
                  >
                    Simpan Kalimat Tutup ✓
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* SECTION 3A: STATUS KLOTER GORENG & PRE-ORDER MENU BESOK */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                🍳 Kloter & Pre-Order
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Status Kloter Goreng & Menu Besok
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Atur badge kloter aktif yang sedang digoreng hari ini, serta buka/tutup slot pesanan pre-order untuk besok.
              </p>
            </div>

            <form onSubmit={handleSaveKloterConfig} className="space-y-6">
              {/* Status Kloter Hari Ini */}
              <div className="bg-[#FFF8E7] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-hand font-bold text-lg text-[#111111]">
                    Badge Kloter Goreng Hari Ini
                  </label>
                  <span className="text-[11px] font-sans font-bold text-[#C84B31] bg-[#FFD700]/30 px-2.5 py-0.5 rounded-full border border-[#111111]/20">
                    Live di Landing Page
                  </span>
                </div>
                <input
                  type="text"
                  value={localConfig.activeKloter || ''}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, activeKloter: e.target.value })
                  }
                  placeholder="Contoh: Kloter Siang (13.00) • Sedang Digoreng Panas 🔥"
                  className="w-full bg-white border-2 border-[#111111] rounded-[14px] px-4 py-2.5 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-sans text-[#5C3D2E]/70 font-semibold">Pilihan Cepat:</span>
                  {[
                    'Kloter Pagi (10.00) • Baru Matang Hangat 🍳',
                    'Kloter Siang (13.00) • Sedang Digoreng Panas 🔥',
                    'Kloter Sore (16.00) • Sesi Goreng Terakhir 🌅',
                    'Semua Kloter Hari Ini Habis • Buka Pre-Order Besok 🥟',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, activeKloter: preset })}
                      className="cursor-pointer text-[11px] font-sans bg-white hover:bg-[#FFEEC2] text-[#111111] px-2.5 py-1 rounded-full border border-[#111111]/30 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pre-Order Besok Switch & Note */}
              <div className="bg-[#EBF4FF] rounded-[20px] p-5 border-2 border-blue-900/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-hand font-bold text-lg text-[#111111]">
                      Slot Pre-Order Menu Besok
                    </h3>
                    <p className="font-sans text-xs text-blue-950/70">
                      Izinkan pembeli memesan risoles untuk dikirim/diambil besok subuh/siang.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalConfig({
                        ...localConfig,
                        isTomorrowOrderOpen: !localConfig.isTomorrowOrderOpen,
                      })
                    }
                    className={`cursor-pointer px-4 py-1.5 rounded-full font-sans font-bold text-xs border-2 shadow-[2px_2px_0_#111111] transition ${
                      localConfig.isTomorrowOrderOpen !== false
                        ? 'bg-emerald-400 text-emerald-950 border-[#111111]'
                        : 'bg-rose-200 text-rose-950 border-[#111111]'
                    }`}
                  >
                    {localConfig.isTomorrowOrderOpen !== false ? '✓ Pre-Order DIBUKA' : '✗ Pre-Order DITUTUP'}
                  </button>
                </div>

                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Catatan / Pesan Pre-Order untuk Pembeli
                  </label>
                  <textarea
                    rows={2}
                    value={localConfig.tomorrowOrderNote || ''}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, tomorrowOrderNote: e.target.value })
                    }
                    placeholder="Contoh: Amankan kuota risoles besok! Digulung & digoreng fresh besok subuh khusus pesananmu."
                    className="w-full bg-white border-2 border-[#111111] rounded-[14px] p-3 font-sans text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="font-sans text-[11px] text-blue-950/60 mt-1">
                    💡 Tips: Ketersediaan masing-masing menu untuk besok juga bisa diaktifkan/dinonaktifkan langsung di tab "Daftar Menu" dengan tombol biru 📅 Besok.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5 transition"
                >
                  Simpan Status Kloter & Pre-Order ✓
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3B: KURIR PRIBADI & PENGIRIMAN DAPUR SIDOARJO (Fitur Pasif & Fleksibel) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                  🛵 Pengiriman & Kurir Sidoarjo
                </div>
                <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                  Kurir Pribadi / Ongkir Sidoarjo
                </h2>
                <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                  Atur apakah opsi kurir dapur dimunculkan di keranjang belanja pembeli. Jika dinonaktifkan (pasif), pembeli hanya akan melihat opsi Ambil Mandiri di Dapur.
                </p>
              </div>

              {/* Toggle Kurir Switch */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setLocalConfig({
                      ...localConfig,
                      enableDeliveryOption: !localConfig.enableDeliveryOption,
                    })
                  }
                  className={`cursor-pointer px-5 py-2.5 rounded-full font-sans font-bold text-xs border-2 shadow-[2px_2px_0_#111111] transition-all flex items-center gap-2 ${
                    localConfig.enableDeliveryOption
                      ? 'bg-emerald-500 text-white border-[#111111] hover:bg-emerald-600'
                      : 'bg-zinc-200 text-zinc-700 border-[#111111]/30 hover:bg-zinc-300'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${localConfig.enableDeliveryOption ? 'bg-white animate-pulse' : 'bg-zinc-400'}`} />
                  <span>
                    {localConfig.enableDeliveryOption
                      ? '🟢 OPSI KURIR AKTIF'
                      : '⚪ OPSI KURIR NONAKTIF (AMBIL DI TEMPAT)'}
                  </span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDeliveryConfig} className="space-y-6">
              {/* Pickup Address & Instructions */}
              <div className="bg-[#FFF8E7] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-3">
                <label className="block font-hand font-bold text-lg text-[#111111]">
                  Catatan Lokasi Pengambilan Mandiri (Pick-Up Dapur)
                </label>
                <input
                  type="text"
                  value={localConfig.pickupAddressNote || ''}
                  onChange={(e) =>
                    setLocalConfig({ ...localConfig, pickupAddressNote: e.target.value })
                  }
                  placeholder="Contoh: Dapur Dulang Indonesia (Fresh langsung dari wajan panas)"
                  className="w-full bg-white border-2 border-[#111111] rounded-[14px] px-4 py-2.5 font-sans text-xs focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
                <p className="font-sans text-[11px] text-[#5C3D2E]/70">
                  Teks ini muncul di opsi "Ambil Sendiri di Dapur" pada keranjang pembeli.
                </p>
              </div>

              {/* Delivery Rates per District */}
              <div className="bg-[#F8FAFC] rounded-[20px] p-5 border-2 border-slate-300 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-hand font-bold text-lg text-[#111111]">
                      Daftar Ongkir Kecamatan Sidoarjo
                    </h3>
                    <p className="font-sans text-xs text-slate-600">
                      Sesuaikan tarif ongkir kurir dapur per kecamatan di Sidoarjo sesuai jarak dari dapurmu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalConfig({
                        ...localConfig,
                        deliveryRates: { ...DEFAULT_SIDOARJO_DELIVERY_RATES },
                      });
                      onShowToast('Tarif ongkir dikembalikan ke standar Sidoarjo! 🛵');
                    }}
                    className="cursor-pointer text-xs font-sans text-[#5C3D2E] hover:underline bg-white px-3 py-1 rounded-full border border-slate-300"
                  >
                    Reset Tarif Standar
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(localConfig.deliveryRates || DEFAULT_SIDOARJO_DELIVERY_RATES).map(([district, rate]) => (
                    <div
                      key={district}
                      className="bg-white rounded-[14px] p-3 border border-[#111111]/20 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <span className="font-sans font-medium text-xs text-[#111111] truncate">
                        Kec. {district}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-sans text-slate-500">Rp</span>
                        <input
                          type="number"
                          step="1000"
                          value={rate}
                          onChange={(e) => {
                            const newRates = { ...(localConfig.deliveryRates || DEFAULT_SIDOARJO_DELIVERY_RATES) };
                            newRates[district] = Number(e.target.value) || 0;
                            setLocalConfig({ ...localConfig, deliveryRates: newRates });
                          }}
                          className="w-20 bg-slate-50 border border-slate-300 rounded-[8px] px-2 py-1 font-mono text-xs font-bold text-right focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5 transition"
                >
                  Simpan Pengaturan Kurir & Ongkir ✓
                </button>
              </div>
            </form>
          </div>

          {/* SECTION A: GANTI FOTO UTAMA & SLIDESHOW */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                📸 Foto Banner Utama & Slideshow
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Foto Utama Web & Slideshow
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Foto ini yang tampil di kartu polaroid utama bagian atas halaman depan pembeli. Bisa unggah 1 foto atau beberapa foto (otomatis jadi slideshow halus bergantian).
              </p>
            </div>

            {(() => {
              const currentList: string[] = (localConfig.heroImages && localConfig.heroImages.length > 0)
                ? localConfig.heroImages
                : (localConfig.heroImage && localConfig.heroImage !== '/dulang-logo.png')
                ? [localConfig.heroImage]
                : [];

              return (
                <div className="space-y-4">
                  <div className="bg-[#FFF8E7] rounded-[20px] p-4 border-2 border-[#111111] polaroid-shadow space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111]">
                        Galeri Foto Aktif ({currentList.length} Foto)
                      </span>
                      {currentList.length > 1 && (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                          ✨ Mode Slideshow Otomatis Aktif
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {currentList.map((photoUrl, pIdx) => (
                        <div key={pIdx} className="relative aspect-[4/3] rounded-[14px] overflow-hidden bg-white border-2 border-[#111111] shadow-xs group">
                          <img src={photoUrl} alt={`Foto ${pIdx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute top-1.5 left-1.5 bg-black/70 text-[#FFD700] text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                            #{pIdx + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextList = currentList.filter((_, i) => i !== pIdx);
                              const updated = {
                                ...localConfig,
                                heroImages: nextList,
                                heroImage: nextList[0] || '/dulang-logo.png',
                              };
                              setLocalConfig(updated);
                              onUpdateStoreConfig(updated);
                              storageService.saveStoreConfig(updated);
                              onShowToast('Foto berhasil dihapus dari slideshow!');
                            }}
                            className="cursor-pointer absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shadow-md hover:bg-red-700 transition"
                            title="Hapus foto ini"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {currentList.length === 0 && (
                        <div className="col-span-full py-8 text-center bg-white rounded-[14px] border-2 border-dashed border-[#111111]/20">
                          <div className="w-16 h-16 bg-[#111111] rounded-full grid place-items-center mx-auto shadow-sm">
                            <img src="/dulang-logo.png" alt="Logo" className="w-12 h-12 object-contain" />
                          </div>
                          <div className="font-hand font-bold text-sm text-[#111111] mt-2">
                            Masih Menggunakan Logo Dulang Default
                          </div>
                          <p className="text-[11px] text-[#5C3D2E]/70 mt-0.5">
                            Belum ada foto yang diunggah. Silakan klik tombol di bawah untuk menambah foto risoles menggoda.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#111111]/10">
                      <label className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 border-2 border-[#111111] px-4 py-2 rounded-full font-sans text-xs font-bold shadow-[2px_2px_0_#111111] transition flex items-center gap-1.5">
                        <span>📁</span>
                        <span>{currentList.length > 0 ? '+ Tambah Foto ke Slideshow' : 'Unggah Foto Pertama'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              triggerImageCrop(file, 'Atur Sisi Foto Banner Utama Toko', (url) => {
                                const nextList = [...currentList, url];
                                const updated = {
                                  ...localConfig,
                                  heroImages: nextList,
                                  heroImage: nextList[0] || url,
                                };
                                setLocalConfig(updated);
                                onUpdateStoreConfig(updated);
                                storageService.saveStoreConfig(updated);
                                onShowToast('Foto berhasil ditambahkan ke slideshow! 📸');
                              });
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>

                      {currentList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...localConfig,
                              heroImages: [],
                              heroImage: '/dulang-logo.png',
                            };
                            setLocalConfig(updated);
                            onUpdateStoreConfig(updated);
                            storageService.saveStoreConfig(updated);
                            onShowToast('Kembali ke Logo Dulang asli!');
                          }}
                          className="cursor-pointer bg-white text-[#5C3D2E] hover:text-[#111111] border border-[#111111]/30 px-3.5 py-2 rounded-full font-sans text-xs font-bold transition"
                        >
                          Reset ke Logo Asli
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Paste URL directly */}
                  <div className="p-3.5 bg-white rounded-[16px] border border-[#111111]/20 space-y-2">
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70">
                      Atau Tempel Link URL Foto Baru:
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="new-hero-url-input"
                        type="text"
                        placeholder="https://... tempel URL gambar di sini"
                        className="flex-1 rounded-full border-2 border-[#111111] px-4 py-1.5 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('new-hero-url-input') as HTMLInputElement | null;
                          if (!input || !input.value.trim()) return;
                          const url = input.value.trim();
                          const nextList = [...currentList, url];
                          const updated = {
                            ...localConfig,
                            heroImages: nextList,
                            heroImage: nextList[0] || url,
                          };
                          setLocalConfig(updated);
                          onUpdateStoreConfig(updated);
                          storageService.saveStoreConfig(updated);
                          input.value = '';
                          onShowToast('Foto URL berhasil ditambahkan ke slideshow! ✓');
                        }}
                        className="cursor-pointer bg-[#111111] text-[#FFD700] px-4 py-1.5 rounded-full font-sans text-xs font-bold border-2 border-[#111111]"
                      >
                        + Tambahkan
                      </button>
                    </div>
                  </div>

                  {/* Preset Rekomendasi Foto Risol Siap Pakai */}
                  <div className="p-3.5 bg-[#FFFDF4] rounded-[16px] border border-[#111111]/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                        ⚡ Rekomendasi Foto Risol Siap Pakai (1-Klik Tambah):
                      </label>
                      <span className="text-[10px] text-[#5C3D2E]/70 font-sans hidden sm:inline">
                        Pilihan foto estetik & menggoda
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          title: '🥟 Risol Mayo Keemasan',
                          url: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=800&q=80',
                        },
                        {
                          title: '🥐 Pastry Renyah Hangat',
                          url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
                        },
                        {
                          title: '🥖 Aneka Gorengan Renyah',
                          url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
                        },
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            if (currentList.includes(preset.url)) {
                              onShowToast('Foto ini sudah ada di galeri slideshow!');
                              return;
                            }
                            const nextList = [...currentList, preset.url];
                            const updated = {
                              ...localConfig,
                              heroImages: nextList,
                              heroImage: nextList[0] || preset.url,
                            };
                            setLocalConfig(updated);
                            onUpdateStoreConfig(updated);
                            storageService.saveStoreConfig(updated);
                            onShowToast(`Foto "${preset.title}" ditambahkan ke slideshow! 📸`);
                          }}
                          className="cursor-pointer bg-white hover:bg-[#FFD700] text-[#111111] p-2.5 rounded-[12px] border border-[#111111]/20 hover:border-[#111111] text-left text-xs font-sans font-semibold transition shadow-xs flex items-center justify-between group"
                        >
                          <span className="truncate pr-1">{preset.title}</span>
                          <span className="text-[10px] font-bold bg-[#111111] text-[#FFD700] px-2 py-0.5 rounded-full shrink-0 group-hover:scale-105 transition">
                            + Pasang
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SECTION B: GANTI JAM BUKA & JADWAL */}
          <form
            onSubmit={handleSaveStoreConfig}
            className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                ⏰ Jam Operasional & Jadwal Dapur
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Ganti Jam Buka
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Atur jam buka ringkas dan 4 kartu rutinitas dapur yang tampil di web.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                  Jam Buka Ringkas (Header & Footer)
                </label>
                <input
                  type="text"
                  value={localConfig.jamBukaTeks}
                  onChange={(e) => setLocalConfig({ ...localConfig, jamBukaTeks: e.target.value })}
                  placeholder="misal: 10.00 - 19.30 (kalo habis ya tutup duluan)"
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700]"
                />
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                  Jam Buka Otomatis (WIB)
                </label>
                <input
                  type="time"
                  value={localConfig.openHour || '10:00'}
                  onChange={(e) => setLocalConfig({ ...localConfig, openHour: e.target.value })}
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm font-bold focus:outline-none focus:border-[#FFD700]"
                />
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                  Jam Tutup Otomatis (WIB)
                </label>
                <input
                  type="time"
                  value={localConfig.closeHour || '20:00'}
                  onChange={(e) => setLocalConfig({ ...localConfig, closeHour: e.target.value })}
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm font-bold focus:outline-none focus:border-[#FFD700]"
                />
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                  Min. Order Snack Box (Box)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={localConfig.snackBoxMinOrder || 10}
                  onChange={(e) => setLocalConfig({ ...localConfig, snackBoxMinOrder: Math.max(1, parseInt(e.target.value, 10) || 10) })}
                  className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm font-bold focus:outline-none focus:border-[#FFD700]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#FFF8E7] p-3 rounded-[16px] border border-[#111111]/20">
              <input
                type="checkbox"
                id="autoHoursToggle"
                checked={localConfig.autoOperatingHours ?? true}
                onChange={(e) => setLocalConfig({ ...localConfig, autoOperatingHours: e.target.checked })}
                className="w-4 h-4 accent-[#111111] cursor-pointer"
              />
              <label htmlFor="autoHoursToggle" className="text-xs font-sans font-bold text-[#111111] cursor-pointer">
                Aktifkan Buka / Tutup Otomatis sesuai Jam (Jika di luar jam buka, pembeli otomatis diarahkan ke Pre-Order Besok)
              </label>
            </div>

            <div>
              <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/70 mb-1">
                Catatan Sub-Badge Hero (Di Bawah Best Seller)
              </label>
              <input
                type="text"
                value={localConfig.heroHeadlineSub || ''}
                onChange={(e) => setLocalConfig({ ...localConfig, heroHeadlineSub: e.target.value })}
                placeholder="misal: digoreng jam 10 pagi, habis jam 8 malem"
                className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-sm focus:outline-none focus:border-[#FFD700]"
              />
            </div>

            {/* 4 Jadwal Sesi */}
            <div className="space-y-3 pt-2">
              <label className="block font-sans text-[12px] font-bold uppercase tracking-wider text-[#111111]">
                4 Kartu Rutinitas Dapur Harian:
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                {localConfig.schedules.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-[16px] bg-[#FFF8E7] border-2 border-[#111111]/20 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                        Sesi {idx + 1}:
                      </span>
                      <input
                        type="text"
                        value={item.jam}
                        onChange={(e) => {
                          const updatedSchedules = [...localConfig.schedules];
                          updatedSchedules[idx] = { ...item, jam: e.target.value };
                          setLocalConfig({ ...localConfig, schedules: updatedSchedules });
                        }}
                        className="w-24 rounded-full border border-[#111111] px-3 py-1 font-sans text-xs font-bold text-center bg-white"
                        placeholder="03.00"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={item.teks}
                      onChange={(e) => {
                        const updatedSchedules = [...localConfig.schedules];
                        updatedSchedules[idx] = { ...item, teks: e.target.value };
                        setLocalConfig({ ...localConfig, schedules: updatedSchedules });
                      }}
                      className="w-full rounded-[10px] border border-[#111111]/30 p-2 font-sans text-xs bg-white resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
            >
              Simpan Jadwal & Jam Buka ✓
            </button>
          </form>

          {/* SECTION C: GANTI PASSWORD PEMILIK */}
          <form
            onSubmit={handleSavePin}
            className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4"
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                🔐 Keamanan & Akses Dapur
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Ganti Password / PIN Pemilik
              </h2>
              {activePin !== 'dulang2020' ? (
                <div className="mt-2 bg-emerald-50 border border-emerald-300 rounded-[14px] p-3.5 text-emerald-900 text-xs font-sans space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[13px] text-emerald-800">
                    <span>✅</span> Password Pribadi Sedang Aktif
                  </div>
                  <p className="text-emerald-700">
                    Kode bawaan lama <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-bold">dulang2020</code> sudah <strong>HANGUS</strong> dan tidak bisa dipakai siapa pun lagi.
                  </p>
                </div>
              ) : (
                <div className="mt-2 bg-amber-50 border border-amber-300 rounded-[14px] p-3.5 text-amber-950 text-xs font-sans space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[13px] text-amber-900">
                    <span>⚠️</span> Masih Menggunakan Kode Bawaan Sementara
                  </div>
                  <p className="text-amber-800">
                    Segera masukkan kata sandi rahasia pribadimu di bawah ini agar akses dapur terkunci aman hanya untukmu.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3 max-w-lg pt-1">
              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  1. Masukkan Password/PIN Lama *
                </label>
                <input
                  type="password"
                  required
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="Ketik password lama (bawaan: dulang2020)..."
                  className="w-full rounded-full border-2 border-[#111111] px-5 py-2.5 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700] bg-white shadow-sm"
                />
              </div>

              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  2. Buat Password/PIN Baru *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Password rahasia baru (minimal 4 karakter)..."
                  className="w-full rounded-full border-2 border-[#111111] px-5 py-2.5 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700] bg-white shadow-sm"
                />
              </div>

              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  3. Konfirmasi Password Baru *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Ulangi password rahasia baru..."
                  className="w-full rounded-full border-2 border-[#111111] px-5 py-2.5 font-sans font-bold text-sm focus:outline-none focus:border-[#FFD700] bg-white shadow-sm"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full sm:w-auto cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 shrink-0"
                >
                  Simpan & Hash Password Baru 🔐
                </button>
              </div>
            </div>
          </form>

          {/* SECTION C-STAFF: PENGATURAN MULTI-PIN KARYAWAN (Kasir & Dapur) */}
          <form
            onSubmit={handleSaveStaffPins}
            className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                👥 Multi-PIN Hak Akses Staff
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                PIN Kasir Stand & Kru Dapur (KDS)
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Atur PIN khusus untuk karyawan tanpa memberikan akses ke laba bersih harian, HPP resep rahasia, atau tombol hapus pesanan.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* PIN Kasir */}
              <div className="bg-[#FFF8E7] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-hand font-bold text-lg text-[#111111]">
                    <span>🛒</span> PIN Kasir Stand
                  </div>
                  <span className="text-[10px] font-sans font-bold bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full border border-[#111111]/20">
                    Kasir POS
                  </span>
                </div>
                <p className="font-sans text-xs text-[#5C3D2E]/80">
                  Kasir hanya bisa input antrean, cetak struk nota, dan update status pesanan. Laporan kas keuangan & resep disembunyikan.
                </p>
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    PIN Kasir Baru (Min. 3 Digit):
                  </label>
                  <input
                    type="text"
                    value={localConfig.cashierPin || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, cashierPin: e.target.value })}
                    placeholder="1234"
                    className="w-full rounded-[12px] border-2 border-[#111111] px-4 py-2 font-mono font-bold text-base bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div className="text-[11px] font-sans text-[#5C3D2E]/70">
                  Default sistem: <strong className="font-mono">1234</strong>
                </div>
              </div>

              {/* PIN Dapur */}
              <div className="bg-[#FFF8E7] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-hand font-bold text-lg text-[#111111]">
                    <span>🍳</span> PIN Layar Dapur (KDS)
                  </div>
                  <span className="text-[10px] font-sans font-bold bg-[#111111] text-[#FFD700] px-2 py-0.5 rounded-full border border-[#FFD700]/40">
                    KDS Only
                  </span>
                </div>
                <p className="font-sans text-xs text-[#5C3D2E]/80">
                  Kru dapur hanya melihat antrean masak Kitchen Display System tanpa menu kasir dan tanpa laporan buku kas.
                </p>
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    PIN Dapur Baru (Min. 3 Digit):
                  </label>
                  <input
                    type="text"
                    value={localConfig.kitchenPin || ''}
                    onChange={(e) => setLocalConfig({ ...localConfig, kitchenPin: e.target.value })}
                    placeholder="0000"
                    className="w-full rounded-[12px] border-2 border-[#111111] px-4 py-2 font-mono font-bold text-base bg-white focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
                <div className="text-[11px] font-sans text-[#5C3D2E]/70">
                  Default sistem: <strong className="font-mono">0000</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5 transition"
              >
                Simpan PIN Kasir & Dapur ✓
              </button>
            </div>
          </form>

          {/* SECTION C2: AUDIT LOG & RIWAYAT KEAMANAN DAPUR (Poin 27) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                  🛡️ Audit & Monitoring Keamanan
                </div>
                <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                  Riwayat Aktivitas & Keamanan Dapur
                </h2>
                <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                  Mencatat seluruh rekam jejak login berhasil, percobaan salah, lockout anti brute-force, dan pergantian password.
                </p>
              </div>

              {securityLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bersihkan riwayat catatan audit keamanan?')) {
                      clearSecurityAuditLogs();
                      setSecurityLogs([]);
                      onShowToast('Log audit keamanan dibersihkan.');
                    }
                  }}
                  className="cursor-pointer text-xs font-sans text-red-600 hover:underline px-3 py-1 bg-red-50 border border-red-200 rounded-full shrink-0 self-start sm:self-center"
                >
                  Bersihkan Log
                </button>
              )}
            </div>

            {securityLogs.length === 0 ? (
              <div className="bg-[#FFFDF4] rounded-[18px] p-5 border border-[#111111]/20 text-center text-xs font-sans text-[#5C3D2E]/70">
                Belum ada catatan aktivitas keamanan yang terekam. Sistem siap memantau aktivitas dapur Anda.
              </div>
            ) : (
              <div className="border-2 border-[#111111]/20 rounded-[18px] overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="bg-[#FFF8E7] border-b-2 border-[#111111]/20 font-bold text-[#111111] sticky top-0">
                    <tr>
                      <th className="p-3">Waktu</th>
                      <th className="p-3">Aktivitas</th>
                      <th className="p-3">Keterangan</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#111111]/10 bg-white">
                    {securityLogs.slice(0, 15).map((log) => {
                      const dateObj = new Date(log.timestamp);
                      const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                      return (
                        <tr key={log.id} className="hover:bg-amber-50/50">
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {dateStr}, {timeStr}
                          </td>
                          <td className="p-3 font-bold text-[#111111] whitespace-nowrap">
                            {log.action === 'LOGIN_SUCCESS' && '🟢 Login Berhasil'}
                            {log.action === 'LOGIN_FAILED' && '🔴 Login Gagal'}
                            {log.action === 'LOCKOUT_TRIGGERED' && '⛔ Lockout 10 Menit'}
                            {log.action === 'PIN_CHANGED' && '🔐 PIN Diganti'}
                            {log.action === 'BACKUP_EXPORTED' && '💾 Ekspor Cadangan'}
                            {log.action === 'BACKUP_RESTORED' && '⚠️ Pemulihan Data'}
                          </td>
                          <td className="p-3 text-[#5C3D2E]">{log.details}</td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.severity === 'ALERT'
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : log.severity === 'WARN'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {log.severity}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION D: KONEKSI DATABASE CLOUD (SUPABASE) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                🌐 Database Cloud Antar-Perangkat
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Sinkronisasi Cloud Supabase
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/80 mt-1 leading-relaxed">
                Hubungkan ke Supabase (Database Cloud Gratis) agar ketika pembeli scan QR di HP mereka, datanya <strong>otomatis langsung muncul di layar dapur tim secara realtime</strong> tanpa perlu chat WA terlebih dahulu.
              </p>
            </div>

            {supabaseCreds.isConfigured ? (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-[18px] p-4 text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-sm text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Supabase Cloud Aktif & Terhubung
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectSupabase}
                    className="cursor-pointer text-xs font-bold text-red-600 hover:underline px-3 py-1 bg-white border border-red-200 rounded-full"
                  >
                    Putuskan Koneksi
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-700 truncate">
                  Endpoint: {supabaseCreds.url}
                </div>
                <p className="text-[11px] text-emerald-700">
                  Data pelanggan dari scan barcode di HP mana pun akan otomatis tersinkronisasi ke dashboard ini.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveSupabaseConfig} className="space-y-3 pt-1">
                <div className="bg-amber-50 border border-amber-300 rounded-[16px] p-3.5 text-xs text-amber-900 leading-relaxed">
                  📌 <b>Saat ini:</b> Masih menggunakan <b>LocalStorage (Memori Browser)</b>. Data di HP pembeli belum otomatis terbang ke laptop tanpa bantuan pesan WhatsApp. Untuk mengaktifkan sync otomatis, tempel kunci Supabase di bawah ini:
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Supabase Project URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={inputDbUrl}
                      onChange={(e) => setInputDbUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                      Supabase Anon Public Key *
                    </label>
                    <input
                      type="password"
                      required
                      value={inputDbKey}
                      onChange={(e) => setInputDbKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 flex items-center gap-2"
                >
                  <span>🚀</span> Hubungkan Cloud Supabase
                </button>
              </form>
            )}
          </div>

          {/* SECTION E: PASANG APLIKASI DI HP ANDROID (PWA / APK PEMILIK) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2">
                  📱 Aplikasi Mobile (PWA / APK)
                </div>
                <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                  Pasang Aplikasi Dapur di HP Android
                </h2>
                <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                  Pasang langsung ke layar utama HP kamu agar bisa diakses cepat satu sentuhan seperti aplikasi APK resmi tanpa mengetik URL lagi.
                </p>
              </div>

              {isAppInstalled ? (
                <span className="self-start sm:self-auto bg-emerald-100 text-emerald-800 border-2 border-emerald-500 font-sans font-bold text-xs px-3.5 py-1.5 rounded-full shadow-xs">
                  ✓ Terpasang di HP
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallPWA}
                  className="self-start sm:self-auto cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 active:scale-[0.98] border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] rounded-full px-5 py-2.5 font-sans font-bold text-xs flex items-center gap-2 transition"
                >
                  <span>📲</span>
                  <span>Pasang Aplikasi Sekarang</span>
                </button>
              )}
            </div>

            {/* Panduan 2 Langkah Mudah */}
            <div className="bg-[#FFF8E7] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <span className="font-sans font-bold text-xs uppercase tracking-wider text-[#111111]">
                  Panduan Pasang di HP (Hanya 1 Menit)
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Android */}
                <div className="bg-white rounded-[16px] p-4 border border-[#111111]/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-sans font-bold text-[#111111]">
                    <span>🤖</span>
                    <span>Untuk HP Android (Chrome / Samsung Internet):</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs font-sans text-[#5C3D2E] space-y-1.5 leading-relaxed">
                    <li>Buka halaman ini lewat browser <strong>Google Chrome</strong> di HP.</li>
                    <li>Tekan ikon <strong>titik tiga (⋮)</strong> di pojok kanan atas browser.</li>
                    <li>Pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Instal Aplikasi"</strong>.</li>
                    <li>Selesai! Ikon Dulang Indonesia akan muncul di beranda HP kamu.</li>
                  </ol>
                </div>

                {/* iPhone */}
                <div className="bg-white rounded-[16px] p-4 border border-[#111111]/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-sans font-bold text-[#111111]">
                    <span>🍎</span>
                    <span>Untuk iPhone / iPad (Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs font-sans text-[#5C3D2E] space-y-1.5 leading-relaxed">
                    <li>Buka halaman ini lewat browser <strong>Safari</strong>.</li>
                    <li>Tekan tombol <strong>Bagikan / Share</strong> (ikon kotak panah ke atas di bilah bawah).</li>
                    <li>Geser ke bawah, lalu tekan <strong>"Add to Home Screen (Tambah ke Layar Utama)"</strong>.</li>
                    <li>Tekan <strong>Tambah (Add)</strong> di pojok kanan atas.</li>
                  </ol>
                </div>
              </div>

              <div className="bg-[#FFD700]/20 rounded-[14px] p-3 border border-[#FFD700]/60 flex items-center justify-between text-xs font-sans text-[#5C3D2E]">
                <span>
                  ✨ <strong>Keunggulan Aplikasi PWA:</strong> Tidak memakan memori HP, loading super kencang, layar bersih tanpa bilah URL browser, dan otomatis terupdate saat dapur buka!
                </span>
              </div>
            </div>
          </div>

          {/* SECTION F: ZONA PEMBERSIHAN & RESET DATA DAPUR (KHUSUS PEMILIK) */}
          <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-red-500/40 shadow-[4px_4px_0_#ef4444] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2 border border-red-300">
                  🛡️ Area Terproteksi Pemilik
                </div>
                <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                  Pembersihan & Reset Data Dapur (Zero Mock Data)
                </h2>
                <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                  Gunakan fitur ini jika dapur Dulang siap melayani pembeli riil dan ingin menghapus riwayat pelanggan simulasi/percobaan (demo). Data resep menu, foto produk, jam buka, dan konfigurasi toko tetap aman 100%.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700]/60">
                <div className="text-xs font-sans text-[#5C3D2E]/70">Pelanggan Terdaftar:</div>
                <div className="font-hand font-bold text-2xl text-[#111111] mt-0.5">
                  {customers.length} Orang
                </div>
                <div className="text-[11px] font-sans mt-1">
                  {customers.length === 0 ? (
                    <span className="text-emerald-700 font-bold">🟢 Bersih (Dapur Riil)</span>
                  ) : customers.some((c) => c.id.startsWith('cust-')) ? (
                    <span className="text-amber-700 font-bold">🟡 Ada Data Demo</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">🟢 Pelanggan Riil</span>
                  )}
                </div>
              </div>

              <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700]/60">
                <div className="text-xs font-sans text-[#5C3D2E]/70">Transaksi Penjualan:</div>
                <div className="font-hand font-bold text-2xl text-[#111111] mt-0.5">
                  {orders.length} Order
                </div>
                <div className="text-[11px] font-sans mt-1">
                  <span className="text-emerald-700 font-bold">📊 Tercatat di Kasir</span>
                </div>
              </div>

              <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700]/60">
                <div className="text-xs font-sans text-[#5C3D2E]/70">Ulasan Pelanggan:</div>
                <div className="font-hand font-bold text-2xl text-[#111111] mt-0.5">
                  {testimonials.length} Ulasan
                </div>
                <div className="text-[11px] font-sans mt-1">
                  <span className="text-emerald-700 font-bold">💬 Testimoni Web</span>
                </div>
              </div>

              <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700]/60">
                <div className="text-xs font-sans text-[#5C3D2E]/70">Kupon & Voucher:</div>
                <div className="font-hand font-bold text-2xl text-[#111111] mt-0.5">
                  {vouchers.length} Kupon
                </div>
                <div className="text-[11px] font-sans mt-1">
                  <span className="text-emerald-700 font-bold">🟢 Siap promosi</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const confirmClean = window.confirm(
                    '⚠️ KONFIRMASI PEMBERSIHAN DATA:\n\nApakah Anda yakin ingin membersihkan seluruh data riwayat transaksi, pelanggan percobaan, dan catatan pengeluaran?\n\n• Seluruh MENU, HARGA, & FOTO tetap AMAN 100%.\n\nKlik OK untuk membersihkan.'
                  );
                  if (confirmClean) {
                    storageService.clearAllDemoData();
                    setCustomers([]);
                    setOrders([]);
                    setExpenses([]);
                    setTestimonials([]);
                    onShowToast('🧹 Riwayat transaksi & percobaan berhasil dibersihkan! Dapur siap melayani transaksi riil.');
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white rounded-full px-5 py-2.5 font-sans font-bold text-xs border-2 border-red-800 shadow-[2px_2px_0_#991b1b] cursor-pointer flex items-center gap-2 transition"
              >
                <span>🧹</span> Bersihkan Riwayat Transaksi & Pelanggan Percobaan
              </button>
            </div>

            {/* Backup & Restore Data Dapur Offline */}
            <div className="bg-[#FFFDF4] rounded-[20px] p-5 border-2 border-[#111111]/20 space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💾</span>
                    <h3 className="font-hand font-bold text-2xl text-[#111111]">
                      Backup & Pulihkan Database Dapur (.json)
                    </h3>
                  </div>
                  <p className="font-sans text-xs text-[#5C3D2E]/80 mt-1 max-w-2xl leading-relaxed">
                    Amankan seluruh riwayat transaksi penjualan kasir, data pelanggan setia, resep menu, kupon diskon, dan ulasan ke dalam 1 file .json. Anda bisa menyimpan file ini di Google Drive, flashdisk, atau kirim ke WhatsApp agar data dapur tidak hilang jika ganti HP atau ganti browser.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="cursor-pointer bg-[#111111] hover:bg-[#222222] text-[#FFD700] rounded-full px-5 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] flex items-center gap-2 transition active:translate-y-0.5"
                >
                  <span>📥</span> Unduh Backup Database (.json)
                </button>

                <label className="cursor-pointer bg-white hover:bg-gray-50 text-[#111111] rounded-full px-5 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center gap-2 transition">
                  <span>📂</span> Pulihkan Data dari File Backup (.json)
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                </label>
              </div>

              <div className="text-[11px] font-sans text-[#5C3D2E]/70 bg-white p-3 rounded-[12px] border border-[#111111]/10">
                🔒 <strong>100% Offline-First & Aman:</strong> File backup disimpan langsung di perangkat HP/Laptop Anda sendiri, tidak dikirim ke server luar mana pun tanpa izin Anda.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PELANGGAN SETIA */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="font-hand font-bold text-[28px] text-[#111111] leading-none">
                Daftar Pelanggan Dikenali (Smart QR)
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Total {customers.length} pelanggan terdata dalam sistem Dulang Indonesia.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomerSegmentFilter('all')}
                className={`cursor-pointer px-3 py-1.5 rounded-full font-sans text-xs font-bold transition border ${
                  customerSegmentFilter === 'all'
                    ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                    : 'bg-white text-[#111111] border-[#111111]/30 hover:border-[#111111]'
                }`}
              >
                Semua ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerSegmentFilter('sultan')}
                className={`cursor-pointer px-3 py-1.5 rounded-full font-sans text-xs font-bold transition border ${
                  customerSegmentFilter === 'sultan'
                    ? 'bg-[#111111] text-[#FFD700] border-[#111111] shadow-xs'
                    : 'bg-white text-[#111111] border-[#111111]/30 hover:border-[#111111]'
                }`}
              >
                👑 Sultan ({customers.filter((c) => c.status === 'Sultan Dulang').length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerSegmentFilter('setia')}
                className={`cursor-pointer px-3 py-1.5 rounded-full font-sans text-xs font-bold transition border ${
                  customerSegmentFilter === 'setia'
                    ? 'bg-[#FFD700] text-[#111111] border-[#111111] shadow-xs'
                    : 'bg-[#FFF8E7] text-[#111111] border-[#111111]/30 hover:border-[#111111]'
                }`}
              >
                ⭐ Setia ({customers.filter((c) => c.status === 'Setia').length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerSegmentFilter('dormant')}
                className={`cursor-pointer px-3 py-1.5 rounded-full font-sans text-xs font-bold transition border ${
                  customerSegmentFilter === 'dormant'
                    ? 'bg-amber-800 text-white border-amber-900 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-600'
                }`}
                title="Pelanggan yang belum order/scan lagi lebih dari 14 hari"
              >
                💤 Perlu Disapa &gt;14 Hari ({customers.filter(isDormantCust).length})
              </button>
            </div>
          </div>

          {/* 7. CRM Ulang Tahun: Tanggal & Bulan Lahir (Tanpa Tahun) */}
          {(() => {
            const today = new Date();
            const curDay = today.getDate();
            const curMonth = today.getMonth() + 1;
            const bdayToday = customers.filter(
              (c) => c.birth_day === curDay && c.birth_month === curMonth
            );
            const bdayThisMonth = customers.filter(
              (c) => c.birth_month === curMonth && !(c.birth_day === curDay && c.birth_month === curMonth)
            );

            return (
              <div className="space-y-3">
                {bdayToday.length > 0 && (
                  <div className="bg-gradient-to-r from-[#FFD700] via-[#FFEEC2] to-[#FFD700] rounded-[24px] p-5 lg:p-6 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl animate-bounce">🎂</span>
                      <div>
                        <h3 className="font-hand font-bold text-2xl text-[#111111] leading-tight">
                          Ada {bdayToday.length} Pelanggan Dulang Ulang Tahun Hari Ini! 🎉
                        </h3>
                        <p className="font-sans text-xs text-[#5C3D2E]">
                          Kirim traktiran & kupon potongan Rp 10.000 atas nama Tim Dulang Indonesia.
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {bdayToday.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white rounded-[16px] p-3.5 border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-sans font-bold text-sm text-[#111111]">
                                Kak {c.name}
                              </span>
                              <span className="text-[10px] font-sans font-bold bg-[#FFD700] px-2 py-0.5 rounded-full border border-[#111111]/30">
                                {c.status}
                              </span>
                            </div>
                            <span className="text-xs font-sans text-[#5C3D2E]/70 block mt-0.5">
                              Favorit: {c.favorite_menu} ({c.total_orders}x order)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSendBirthdayGreeting(c)}
                            className="cursor-pointer w-full bg-[#111111] text-[#FFD700] hover:brightness-110 rounded-full py-2 px-3 font-sans font-bold text-xs border border-[#111111] flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                          >
                            <span>🎂</span>
                            <span>Kirim Traktiran & Kupon Ultah WA</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bdayThisMonth.length > 0 && (
                  <div className="bg-[#FFFDF4] rounded-[20px] p-4 border-2 border-[#111111]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎈</span>
                        <h4 className="font-hand font-bold text-lg text-[#111111]">
                          Menyusul Ulang Tahun Bulan Ini ({MONTHS_INDONESIA.find((m) => m.value === curMonth)?.label}) ({bdayThisMonth.length} Pelanggan)
                        </h4>
                      </div>
                      <span className="text-[11px] font-sans text-[#5C3D2E]/70 hidden sm:inline">
                        Kirim traktiran lebih awal agar mereka pesan untuk momen spesialnya
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {bdayThisMonth.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white rounded-[14px] p-3 border border-[#111111]/20 flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-sans font-bold text-xs text-[#111111] truncate block">
                              Kak {c.name}
                            </span>
                            <span className="text-[11px] font-sans text-[#5C3D2E]/70 block">
                              Tgl {c.birth_day} {MONTHS_INDONESIA.find((m) => m.value === c.birth_month)?.label} • {c.favorite_menu}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendBirthdayGreeting(c)}
                            className="cursor-pointer shrink-0 bg-amber-100 hover:bg-[#FFD700] text-amber-950 px-2.5 py-1.5 rounded-full font-sans font-bold text-[11px] border border-amber-300 transition flex items-center gap-1"
                            title="Kirim traktiran & kupon ulang tahun via WA"
                          >
                            <span>🎂</span>
                            <span>Traktir WA</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Action & Sync Status Banner */}
          <div className="bg-[#FFFDF4] rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-sans font-bold text-xs text-[#111111] flex items-center gap-1.5">
                <span>💡</span>
                <span>
                  {supabaseCreds.isConfigured
                    ? '⚡ Realtime Auto-Sync Aktif: Begitu ada pelanggan baru scan barcode dari HP, data langsung masuk ke layar ini & berbunyi ting-dong tanpa perlu refresh!'
                    : 'Mode Penyimpanan: Lokal Browser. Hubungkan Supabase di tab Pengaturan agar scan dari HP otomatis masuk ke sini.'}
                </span>
              </div>
              <p className="font-sans text-[11px] text-[#5C3D2E]/70">
                Data pelanggan otomatis di-update secara live setiap detik. Autofill repeat order siap digunakan.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={reloadCustomers}
                className="cursor-pointer bg-white hover:bg-gray-50 border-2 border-[#111111] px-4 py-1.5 rounded-full font-sans font-bold text-xs text-[#111111] transition shadow-sm flex items-center gap-1.5"
                title="Segarkan data terbaru"
              >
                <span>🔄</span> Segarkan
              </button>

              <button
                type="button"
                onClick={() => setIsAddingCustomer(!isAddingCustomer)}
                className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 border-2 border-[#111111] px-4 py-1.5 rounded-full font-sans font-bold text-xs transition shadow-[2px_2px_0_#111111] flex items-center gap-1.5"
              >
                <span>{isAddingCustomer ? '✕' : '+'}</span>
                <span>{isAddingCustomer ? 'Tutup Form' : 'Catat Pelanggan'}</span>
              </button>
            </div>
          </div>

          {/* Form Tambah Pelanggan Manual */}
          {isAddingCustomer && (
            <form
              onSubmit={handleAddNewCustomer}
              className="bg-white rounded-[20px] p-6 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#111111]/10">
                <div className="font-hand font-bold text-[24px] text-[#111111]">
                  Catat Pelanggan Baru ke Database
                </div>
                <span className="font-sans text-[11px] text-[#5C3D2E]/70">
                  Untuk pembeli dari WhatsApp / Offline
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    ID Stiker Dus *
                  </label>
                  <input
                    type="text"
                    value={custQrId}
                    onChange={(e) => setCustQrId(e.target.value.toUpperCase())}
                    placeholder="misal: DULANG-055"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono font-bold text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                  <span className="font-sans text-[10px] text-[#5C3D2E]/60 mt-0.5 block">
                    Kosongkan untuk auto-generate ID
                  </span>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="misal: Kak Maya"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={custWa}
                    onChange={(e) => setCustWa(e.target.value)}
                    placeholder="081234567890"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-mono font-bold text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    1. Kota / Kabupaten *
                  </label>
                  <select
                    value={custCity}
                    onChange={(e) => handleCustCityChange(e.target.value)}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                  >
                    {INDONESIA_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    2. Kecamatan *
                  </label>
                  <select
                    value={custDistrict}
                    onChange={(e) => setCustDistrict(e.target.value)}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                  >
                    {(CITY_DISTRICTS[custCity] || []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    3. Kelurahan / Desa
                  </label>
                  <input
                    type="text"
                    value={custVillage}
                    onChange={(e) => setCustVillage(e.target.value)}
                    placeholder="misal: Sidokare / Pucang"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    4. Nama Jalan, No. Rumah, RT/RW, & Patokan *
                  </label>
                  <input
                    type="text"
                    required
                    value={custStreetDetail}
                    onChange={(e) => setCustStreetDetail(e.target.value)}
                    placeholder="Nama jalan, nomor rumah, perumahan / patokan..."
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Menu Favorit
                  </label>
                  <select
                    value={custMenu}
                    onChange={(e) => setCustMenu(e.target.value)}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.nama}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tanggal & Bulan Lahir Pelanggan */}
              <div className="bg-[#FFF8E7] rounded-[16px] p-3.5 border border-[#111111]/20 space-y-1">
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                  🎂 Tanggal & Bulan Lahir (Tanpa Tahun Demi Privasi)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={custBirthDay}
                    onChange={(e) => setCustBirthDay(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs bg-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="">Pilih Tanggal (1-31)</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Tanggal {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={custBirthMonth}
                    onChange={(e) => setCustBirthMonth(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans font-bold text-xs bg-white focus:outline-none focus:border-[#FFD700]"
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

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-6 py-2.5 font-sans font-bold text-[13px] border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110"
                >
                  Simpan ke Data Pembeli ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomer(false)}
                  className="w-full sm:w-auto cursor-pointer px-4 py-2.5 rounded-full font-sans font-bold text-xs text-[#5C3D2E] hover:underline"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {(() => {
            const filteredCustList = customers.filter((c) => {
              if (customerSegmentFilter === 'sultan') return c.status === 'Sultan Dulang';
              if (customerSegmentFilter === 'setia') return c.status === 'Setia';
              if (customerSegmentFilter === 'dormant') return isDormantCust(c);
              return true;
            });

            return (
              <>
                {/* MOBILE VIEW: KARTU BERSIH & RINGKAS KHUSUS HP (TIDAK PENUH SESAK) */}
                <div className="block md:hidden space-y-3">
                  {filteredCustList.length === 0 ? (
                    <div className="bg-white rounded-[20px] p-8 border-2 border-[#111111] text-center text-xs text-[#5C3D2E]/70 font-sans shadow-[3px_3px_0_#111111]">
                      Tidak ada data pelanggan untuk filter ini.
                    </div>
                  ) : (
                    filteredCustList.map((c) => {
                      const isNewHighlight = highlightedCustId === c.id || highlightedCustId === c.qr_code_id;
                      return (
                        <div
                          key={c.id}
                          className={`bg-white rounded-[20px] p-4 border-2 border-[#111111] shadow-[3px_3px_0_#111111] space-y-3 transition-colors ${
                            isNewHighlight ? 'bg-[#FFD700]/25 ring-2 ring-[#FFD700]' : ''
                          }`}
                        >
                          {/* Header Kartu: Inisial, Nama, ID Stiker, Tier Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div
                              onClick={() => setViewingCustDetail(c)}
                              className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-full bg-[#111111] text-[#FFD700] flex items-center justify-center font-hand font-bold text-lg shrink-0 border border-[#111111] group-hover:scale-105 transition">
                                {c.name ? c.name.charAt(0).toUpperCase() : 'D'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-sans font-bold text-sm text-[#111111] group-hover:text-amber-800 transition truncate">
                                    {c.name}
                                  </span>
                                  {isNewHighlight && <span className="text-xs">✨ Baru</span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#5C3D2E]/75">
                                  <span className="bg-[#FFF8E7] px-1.5 py-0.2 rounded border border-[#111111]/20 font-bold">
                                    {c.qr_code_id}
                                  </span>
                                  <span>•</span>
                                  <span>+{c.wa}</span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                c.status === 'Sultan Dulang'
                                  ? 'bg-[#111111] text-[#FFD700]'
                                  : c.status === 'Setia'
                                  ? 'bg-[#FFD700] text-[#111111]'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>

                          {/* Badge Notifikasi / Tag Status */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {c.birth_day && c.birth_month && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                                <span>🎂</span>
                                <span>
                                  {c.birth_day} {MONTHS_INDONESIA.find((m) => m.value === c.birth_month)?.label}
                                </span>
                              </span>
                            )}
                            {c.last_greeted_at && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                                <span>💬</span>
                                <span>Disapa {c.last_greeted_at}</span>
                              </span>
                            )}
                            {isDormantCust(c) && !c.last_greeted_at && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                <span>💤</span>
                                <span>&gt;14 hr pasif</span>
                              </span>
                            )}
                          </div>

                          {/* Ringkasan Belanja & Selera Favorit (Ketuk Kartu untuk Lihat Detail Lengkap) */}
                          <div
                            onClick={() => setViewingCustDetail(c)}
                            className="cursor-pointer bg-[#FFFDF4] hover:bg-[#FFF9E6] rounded-[14px] p-3 border border-[#111111]/15 space-y-2 text-xs transition active:scale-[0.99]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[#5C3D2E]/80 font-medium">Total Belanja:</span>
                              <div className="text-right">
                                <span className="font-sans font-bold text-[#111111]">
                                  Rp {(c.total_spent || 0).toLocaleString('id-ID')}
                                </span>
                                <span className="text-[10px] text-[#5C3D2E]/70 ml-1.5">
                                  ({c.total_orders}x order • {formatRelativeTime(getCustomerLastOrderDate(c))})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-[#111111]/10">
                              <span className="text-[#5C3D2E]/80 font-medium shrink-0">Favorit:</span>
                              <div className="text-right">
                                <span className="font-bold text-[#111111]">🥟 {c.favorite_menu || '-'}</span>
                                {c.favorite_option && (
                                  <span className="block text-[10px] font-bold text-amber-900 mt-0.5">
                                    🌶️ Opsi: {c.favorite_option}
                                  </span>
                                )}
                              </div>
                            </div>

                            {c.notes && (
                              <div className="text-[11px] text-gray-600 italic bg-white p-2 rounded-[10px] border border-[#111111]/10 truncate">
                                📝 "{c.notes}"
                              </div>
                            )}

                            <div className="pt-1 flex items-center justify-between text-[11px] text-[#5C3D2E]/80 border-t border-[#111111]/10">
                              <span className="truncate max-w-[200px]">📍 {c.address || c.area || '-'}</span>
                              <span className="font-bold text-amber-900 flex items-center gap-0.5 shrink-0">
                                Detail & Memory →
                              </span>
                            </div>
                          </div>

                          {/* Tombol Aksi Cepat Ramah Jempol */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#111111]/10">
                            <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSendFriendlyGreeting(c)}
                                className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition"
                              >
                                <span>💬</span> Sapa WA
                              </button>
                              {c.birth_day && c.birth_month && (
                                <button
                                  type="button"
                                  onClick={() => handleSendBirthdayGreeting(c)}
                                  className="cursor-pointer bg-gradient-to-r from-amber-200 to-amber-300 text-amber-950 border border-amber-400 px-2.5 py-1.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition"
                                >
                                  <span>🎂</span> Ultah
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyCourierReceipt(c)}
                                className="cursor-pointer bg-[#FFD700] text-[#111111] border border-[#111111] px-2.5 py-1.5 rounded-full text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition"
                              >
                                <span>📋</span> Resi
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCustNotes({
                                    id: c.id,
                                    name: c.name,
                                    notes: c.notes || '',
                                    favorite_option: c.favorite_option || '',
                                  })
                                }
                                className="cursor-pointer bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition"
                              >
                                + Selera
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(c.id, c.name)}
                              className="cursor-pointer text-red-500 hover:text-red-700 p-1.5 text-xs font-bold rounded-full hover:bg-red-50 transition"
                              title="Hapus data pelanggan"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* DESKTOP VIEW: TABEL LEBAR LENGKAP KHUSUS LAYAR LEBAR / LAPTOP */}
                <div className="hidden md:block bg-white rounded-[20px] border-2 border-[#111111] shadow-[4px_4px_0_#111111] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-sans text-[13px]">
                      <thead className="bg-[#111111] text-[#FFF8E7] text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">ID Stiker</th>
                          <th className="py-3 px-4">Nama Pelanggan</th>
                          <th className="py-3 px-4">Nomor WA</th>
                          <th className="py-3 px-4">Alamat & Wilayah</th>
                          <th className="py-3 px-4">Selera & Langganan (Si A Sukanya Apa?)</th>
                          <th className="py-3 px-4">Total Belanja</th>
                          <th className="py-3 px-4 text-center">Order</th>
                          <th className="py-3 px-4">Loyalty Tier</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111111]/10">
                        {filteredCustList.map((c) => {
                          const isNewHighlight = highlightedCustId === c.id || highlightedCustId === c.qr_code_id;
                          return (
                            <tr
                              key={c.id}
                              className={`transition-colors duration-700 ${
                                isNewHighlight
                                  ? 'bg-[#FFD700]/30 font-semibold ring-2 ring-[#FFD700]'
                                  : 'hover:bg-[#FFF8E7]/50'
                              }`}
                            >
                              <td className="py-3 px-4 font-mono font-bold text-[#111111]">
                                <div className="flex items-center gap-1.5">
                                  {isNewHighlight && <span className="text-xs animate-ping">✨</span>}
                                  <span>{c.qr_code_id}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-bold text-[#111111]">
                                <div
                                  onClick={() => setViewingCustDetail(c)}
                                  className="cursor-pointer hover:underline hover:text-amber-800 transition"
                                  title="Klik untuk lihat detail lengkap pelanggan"
                                >
                                  {c.name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                  {c.birth_day && c.birth_month && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                                      <span>🎂</span>
                                      <span>
                                        {c.birth_day}{' '}
                                        {MONTHS_INDONESIA.find((m) => m.value === c.birth_month)?.label}
                                      </span>
                                    </span>
                                  )}
                                  {c.last_greeted_at && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300"
                                      title={`Terakhir disapa via WA: ${c.last_greeted_at}`}
                                    >
                                      <span>💬</span>
                                      <span>Disapa {c.last_greeted_at}</span>
                                    </span>
                                  )}
                                  {isDormantCust(c) && !c.last_greeted_at && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300"
                                      title="Belum pernah pesan / scan lagi > 14 hari"
                                    >
                                      <span>💤</span>
                                      <span>&gt;14 hr pasif</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs">
                                +{c.wa}
                              </td>
                              <td className="py-3 px-4 max-w-[200px] truncate" title={c.address}>
                                {c.address} <span className="text-[#5C3D2E]/60 text-xs block">({c.area})</span>
                              </td>
                              {/* SELERA PELANGGAN: SI A SUKANYA APA */}
                              <td className="py-3 px-4 max-w-[240px]">
                                <div className="font-medium text-[#111111] flex items-center gap-1">
                                  <span>🥟</span>
                                  <span>{c.favorite_menu}</span>
                                </div>
                                {c.favorite_option && (
                                  <span className="inline-block bg-[#FFF8E7] text-[#5C3D2E] text-[10px] font-bold px-2 py-0.5 rounded border border-[#111111]/20 mt-1">
                                    🌶️ Opsi: {c.favorite_option}
                                  </span>
                                )}
                                {c.notes && (
                                  <div className="text-[11px] text-gray-500 italic mt-1 truncate" title={c.notes}>
                                    📝 "{c.notes}"
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingCustNotes({
                                      id: c.id,
                                      name: c.name,
                                      notes: c.notes || '',
                                      favorite_option: c.favorite_option || '',
                                    })
                                  }
                                  className="cursor-pointer text-[10px] font-bold text-amber-900 underline hover:text-amber-700 block mt-1"
                                >
                                  + Catat Selera Dapur
                                </button>
                              </td>
                              {/* TOTAL BELANJA */}
                              <td className="py-3 px-4 font-bold text-[#111111] whitespace-nowrap">
                                Rp {(c.total_spent || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="font-bold text-[#111111]">{c.total_orders}x</div>
                                <div
                                  className="text-[10px] text-[#5C3D2E]/75 font-semibold whitespace-nowrap mt-0.5"
                                  title={`Terakhir transaksi: ${getCustomerLastOrderDate(c) || '-'}`}
                                >
                                  {formatRelativeTime(getCustomerLastOrderDate(c))}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    c.status === 'Sultan Dulang'
                                      ? 'bg-[#111111] text-[#FFD700]'
                                      : c.status === 'Setia'
                                      ? 'bg-[#FFD700] text-[#111111]'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCustDetail(c)}
                                    className="cursor-pointer bg-white hover:bg-gray-100 text-[#111111] border border-[#111111]/30 px-2 py-1 rounded-full text-[11px] font-bold shadow-xs transition"
                                    title="Buka detail lengkap & memory belanja"
                                  >
                                    Detail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendlyGreeting(c)}
                                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1 transition"
                                    title="Kirim sapaan hangat Dapur Dulang & tawarkan menu favorit via WA (Manual 1-by-1)"
                                  >
                                    <span>💬</span> Sapa WA
                                  </button>
                                  {c.birth_day && c.birth_month && (
                                    <button
                                      type="button"
                                      onClick={() => handleSendBirthdayGreeting(c)}
                                      className="cursor-pointer bg-gradient-to-r from-amber-200 to-amber-300 hover:brightness-105 text-amber-950 border border-amber-400 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1"
                                      title="Kirim ucapan & kupon ulang tahun via WA"
                                    >
                                      <span>🎂</span> Ultah
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCourierReceipt(c)}
                                    className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 border border-[#111111] px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1"
                                    title="Salin alamat & format pengiriman untuk kurir Grab/Gojek"
                                  >
                                    <span>📋</span> Resi Kurir
                                  </button>
                                  <a
                                    href={`https://wa.me/${c.wa.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold"
                                    title="Buka Chat WhatsApp"
                                  >
                                    WA
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-bold cursor-pointer"
                                    title="Hapus data pelanggan ini"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCustList.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-[#5C3D2E]/70 font-sans text-xs">
                              Tidak ada data pelanggan untuk kategori ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MODAL DETAIL LENGKAP & MEMORY BELANJA PELANGGAN (UNTUK MOBILE CARD & DESKTOP KLIK) */}
                {viewingCustDetail && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-white rounded-[24px] max-w-lg w-full p-5 sm:p-6 border-2 border-[#111111] shadow-[6px_6px_0_#111111] space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                      {/* Modal Header */}
                      <div className="flex items-start justify-between border-b-2 border-[#111111]/10 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[#111111] text-[#FFD700] flex items-center justify-center font-hand font-bold text-2xl border-2 border-[#111111] shadow-xs">
                            {viewingCustDetail.name ? viewingCustDetail.name.charAt(0).toUpperCase() : 'D'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-hand font-bold text-2xl text-[#111111] leading-none">
                                Kak {viewingCustDetail.name}
                              </h3>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  viewingCustDetail.status === 'Sultan Dulang'
                                    ? 'bg-[#111111] text-[#FFD700]'
                                    : viewingCustDetail.status === 'Setia'
                                    ? 'bg-[#FFD700] text-[#111111]'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {viewingCustDetail.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono text-[#5C3D2E]/80 mt-1">
                              <span className="bg-[#FFF8E7] px-2 py-0.5 rounded border border-[#111111]/20 font-bold">
                                ID: {viewingCustDetail.qr_code_id}
                              </span>
                              <span>•</span>
                              <span>+{viewingCustDetail.wa}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingCustDetail(null)}
                          className="cursor-pointer text-gray-400 hover:text-black font-bold text-lg p-1"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Memory Transaksi & Langganan */}
                      <div className="bg-[#FFFDF4] rounded-[18px] p-4 border border-[#111111]/15 space-y-3">
                        <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E] block">
                          📊 Memory Belanja & Riwayat Terakhir:
                        </span>
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="bg-white p-2.5 rounded-[12px] border border-[#111111]/10">
                            <span className="text-[#5C3D2E]/70 text-[10px] block">Total Belanjaan</span>
                            <span className="font-sans font-bold text-[#111111] text-sm">
                              Rp {(viewingCustDetail.total_spent || 0).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-[12px] border border-[#111111]/10">
                            <span className="text-[#5C3D2E]/70 text-[10px] block">Frekuensi Order</span>
                            <span className="font-sans font-bold text-[#111111] text-sm">
                              {viewingCustDetail.total_orders || 0}x Pesanan
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-[12px] border border-[#111111]/10 col-span-2">
                            <span className="text-[#5C3D2E]/70 text-[10px] block">Terakhir Transaksi</span>
                            <div className="flex items-center justify-between">
                              <span className="font-sans font-semibold text-[#111111]">
                                {formatRelativeTime(getCustomerLastOrderDate(viewingCustDetail))}
                              </span>
                              <span className="text-[11px] text-[#5C3D2E]/60">
                                {getCustomerLastOrderDate(viewingCustDetail) || 'Belum ada transaksi'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Selera Pelanggan (Si A Sukanya Apa?) */}
                      <div className="bg-[#FFF8E7] rounded-[18px] p-4 border border-[#FFD700] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#5C3D2E]">
                            🥟 Selera Dapur & Menu Favorit:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustNotes({
                                id: viewingCustDetail.id,
                                name: viewingCustDetail.name,
                                notes: viewingCustDetail.notes || '',
                                favorite_option: viewingCustDetail.favorite_option || '',
                              });
                            }}
                            className="cursor-pointer text-[11px] font-bold text-amber-900 underline hover:text-amber-700"
                          >
                            ✏️ Edit Selera
                          </button>
                        </div>

                        <div className="bg-white rounded-[14px] p-3 border border-[#111111]/10 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#5C3D2E]/70">Menu Favorit:</span>
                            <span className="font-bold text-[#111111]">
                              🥟 {viewingCustDetail.favorite_menu || '-'}
                            </span>
                          </div>
                          {viewingCustDetail.favorite_option && (
                            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                              <span className="text-[#5C3D2E]/70">Opsi / Saos Favorit:</span>
                              <span className="font-bold text-amber-900">
                                🌶️ {viewingCustDetail.favorite_option}
                              </span>
                            </div>
                          )}
                          {viewingCustDetail.notes ? (
                            <div className="pt-1.5 border-t border-gray-100 text-[11px] text-gray-700 italic">
                              📝 "{viewingCustDetail.notes}"
                            </div>
                          ) : (
                            <div className="pt-1.5 border-t border-gray-100 text-[11px] text-gray-400 italic">
                              Belum ada catatan selera dapur khusus.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info Kontak & Pengiriman */}
                      <div className="bg-white rounded-[18px] p-3.5 border border-[#111111]/15 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#5C3D2E]/70">Ulang Tahun:</span>
                          <span className="font-semibold text-[#111111]">
                            {viewingCustDetail.birth_day && viewingCustDetail.birth_month
                              ? `🎂 ${viewingCustDetail.birth_day} ${MONTHS_INDONESIA.find((m) => m.value === viewingCustDetail.birth_month)?.label}`
                              : 'Belum diisi'}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-gray-100">
                          <span className="text-[#5C3D2E]/70 shrink-0">Alamat Kirim:</span>
                          <span className="font-semibold text-[#111111] text-right">
                            {viewingCustDetail.address
                              ? `${viewingCustDetail.address} (${viewingCustDetail.area || '-'})`
                              : viewingCustDetail.area || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons inside Modal */}
                      <div className="space-y-2 pt-2 border-t border-[#111111]/10">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendFriendlyGreeting(viewingCustDetail)}
                            className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white rounded-full py-2.5 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                          >
                            <span>💬</span> Sapa Hangat WA
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCourierReceipt(viewingCustDetail)}
                            className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border border-[#111111] rounded-full py-2.5 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                          >
                            <span>📋</span> Salin Resi Kurir
                          </button>
                        </div>

                        {viewingCustDetail.birth_day && viewingCustDetail.birth_month && (
                          <button
                            type="button"
                            onClick={() => handleSendBirthdayGreeting(viewingCustDetail)}
                            className="cursor-pointer w-full bg-gradient-to-r from-amber-200 to-amber-300 text-amber-950 border border-amber-400 rounded-full py-2 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                          >
                            <span>🎂</span> Kirim Ucapan & Kupon Ultah WA
                          </button>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <a
                            href={`https://wa.me/${viewingCustDetail.wa.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1"
                          >
                            <span>📱</span> Buka Chat WA Langsung
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const c = viewingCustDetail;
                              setViewingCustDetail(null);
                              handleDeleteCustomer(c.id, c.name);
                            }}
                            className="cursor-pointer text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                          >
                            Hapus Pelanggan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* MODAL CATAT SELERA PELANGGAN (SI A SUKANYA APA) */}
          {editingCustNotes && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[24px] max-w-md w-full p-6 border-2 border-[#111111] shadow-[6px_6px_0_#111111] space-y-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b-2 border-[#111111]/10 pb-3">
                  <div>
                    <span className="text-[10px] font-sans font-bold uppercase bg-[#FFD700] px-2 py-0.5 rounded-full border border-[#111111]">
                      Customer Intelligence
                    </span>
                    <h3 className="font-hand font-bold text-2xl text-[#111111] mt-1">
                      Catat Selera: Kak {editingCustNotes.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCustNotes(null)}
                    className="cursor-pointer text-gray-400 hover:text-black font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Opsi / Saos Favorit Langganan
                  </label>
                  <input
                    type="text"
                    value={editingCustNotes.favorite_option}
                    onChange={(e) =>
                      setEditingCustNotes({ ...editingCustNotes, favorite_option: e.target.value })
                    }
                    placeholder="misal: Saos Pedas / cabai aja / jangan pedas"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Catatan Rahasia Dapur (Selera Khusus)
                  </label>
                  <textarea
                    rows={3}
                    value={editingCustNotes.notes}
                    onChange={(e) =>
                      setEditingCustNotes({ ...editingCustNotes, notes: e.target.value })
                    }
                    placeholder="misal: Suka gorengan yang baru mateng dari wajan, minta saos sambal 2 bungkus..."
                    className="w-full rounded-[16px] border-2 border-[#111111] p-3 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#111111]/10">
                  <button
                    type="button"
                    onClick={() => setEditingCustNotes(null)}
                    className="cursor-pointer px-4 py-2 rounded-full font-sans text-xs font-bold text-[#5C3D2E] hover:underline"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomerNotes}
                    className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] border-2 border-[#111111] px-5 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111]"
                  >
                    Simpan Selera Pelanggan ✓
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: KELOLA ULASAN / TESTIMONI PELANGGAN */}
      {activeTab === 'testimonials' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-2 border border-[#111111]/20">
                <span>💬 Manajemen Pendapat Pelanggan</span>
              </div>
              <h2 className="font-hand font-bold text-[32px] sm:text-[36px] text-[#111111] leading-none">
                Ulasan & Cerita Sobat Dulang
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Pilih ulasan mana yang boleh tampil di halaman depan. Tambahkan chat manis pelanggan WhatsApp ke web dengan mudah!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingTesti(!isAddingTesti)}
              className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 px-5 py-2.5 rounded-full font-sans font-bold text-xs sm:text-sm border-2 border-[#111111] shadow-[3px_3px_0_#FFD700] flex items-center justify-center gap-2 shrink-0 transition"
            >
              <span>{isAddingTesti ? 'Tutup Form Ulasan ✕' : '+ Tambah Ulasan dari Chat Pelanggan 💬'}</span>
            </button>
          </div>

          {/* Form Tambah Testimoni */}
          {isAddingTesti && (
            <form
              onSubmit={handleSaveNewTestimonial}
              className="bg-[#FFFDF4] rounded-[24px] p-6 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-4 animate-in slide-in-from-top-3 duration-300"
            >
              <h3 className="font-hand font-bold text-2xl text-[#111111]">
                Catat Ulasan / Pesan Hangat Baru
              </h3>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Nama Pelanggan *
                  </label>
                  <input
                    type="text"
                    required
                    value={testiCustName}
                    onChange={(e) => setTestiCustName(e.target.value)}
                    placeholder="misal: Mbak Ririn"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Asal Wilayah
                  </label>
                  <input
                    type="text"
                    value={testiArea}
                    onChange={(e) => setTestiArea(e.target.value)}
                    placeholder="misal: Taman Pinang Sidoarjo"
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                    Menu Favorit
                  </label>
                  <select
                    value={testiMenu}
                    onChange={(e) => setTestiMenu(e.target.value)}
                    className="w-full rounded-full border-2 border-[#111111] px-4 py-2 font-sans text-xs bg-white focus:outline-none"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.nama}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                  Rating Bintang
                </label>
                <div className="flex gap-2">
                  {[5, 4, 3].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setTestiRating(star)}
                      className={`cursor-pointer px-3 py-1 rounded-full font-sans font-bold text-xs border transition ${
                        testiRating === star
                          ? 'bg-[#FFD700] text-[#111111] border-[#111111]'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      {'★'.repeat(star)} ({star} Bintang)
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E]/80 mb-1">
                  Isi Pendapat / Cerita Pelanggan *
                </label>
                <textarea
                  required
                  rows={3}
                  value={testiComment}
                  onChange={(e) => setTestiComment(e.target.value)}
                  placeholder="Paste chat hangat dari pembeli WhatsApp di sini..."
                  className="w-full rounded-[16px] border-2 border-[#111111] p-3 font-sans text-xs focus:outline-none focus:border-[#FFD700] bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 border-2 border-[#111111] px-6 py-2 rounded-full font-sans font-bold text-xs shadow-[2px_2px_0_#111111]"
                >
                  Simpan & Aktifkan di Web Depan ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingTesti(false)}
                  className="cursor-pointer text-xs font-sans font-bold text-[#5C3D2E] hover:underline px-3 py-2"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Testimonials Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className={`bg-white rounded-[22px] p-5 border-2 border-[#111111] shadow-[3px_3px_0_#111111] flex flex-col justify-between space-y-4 relative ${
                  !t.is_active ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex text-amber-500 text-sm">
                      {Array.from({ length: t.rating || 5 }).map((_, i) => (
                        <span key={i}>★</span>
                      ))}
                    </div>
                    <span
                      className={`text-[10px] font-bold font-sans px-2.5 py-0.5 rounded-full border uppercase ${
                        t.is_active
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}
                    >
                      {t.is_active ? '🟢 Tampil di Depan' : '⏸️ Disembunyikan'}
                    </span>
                  </div>

                  <p className="font-hand text-[19px] leading-snug text-[#111111] italic">
                    "{t.comment}"
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 font-sans text-xs">
                    {t.favorite_menu && (
                      <span className="bg-[#FFF8E7] border border-[#111111]/20 px-2 py-0.5 rounded-full text-[11px] font-bold text-[#5C3D2E]">
                        🥟 {t.favorite_menu}
                      </span>
                    )}
                    <span className="text-gray-400">•</span>
                    <span className="text-[#5C3D2E]/70 font-semibold">{t.area}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#111111]/10 flex items-center justify-between">
                  <div className="font-sans text-xs">
                    <strong className="text-[#111111] block">{t.customer_name}</strong>
                    <span className="text-[10px] text-gray-500">
                      {new Date(t.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleTestimonial(t.id)}
                      className={`cursor-pointer px-3 py-1 rounded-full font-sans font-bold text-[11px] border transition ${
                        t.is_active
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {t.is_active ? 'Sembunyikan' : 'Tampilkan'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteTestimonial(t.id, t.customer_name)}
                      className="cursor-pointer text-gray-400 hover:text-red-500 p-1 text-xs"
                      title="Hapus ulasan ini"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: KELOLA KUPON & VOUCHER DISKON (Step 6) */}
      {activeTab === 'vouchers' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#FFD700] text-[#111111] px-3 py-0.5 rounded-full font-sans text-[11px] font-bold uppercase tracking-wider mb-1">
                🎟️ Sistem Voucher Unik
              </div>
              <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
                Kupon Diskon & Voucher Beranak
              </h2>
              <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
                Buat voucher personal dengan nama pembeli, tentukan bonus tersembunyi (tiket rahasia), dan bagikan langsung lewat WhatsApp.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-white border border-[#111111] rounded-full font-sans text-xs font-bold shadow-sm">
                Total: {vouchers.length}
              </span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-950 border border-emerald-400 rounded-full font-sans text-xs font-bold shadow-sm">
                Aktif: {vouchers.filter((v) => !v.isUsed).length}
              </span>
              <span className="px-3 py-1 bg-gray-100 border border-[#111111]/30 rounded-full font-sans text-xs font-bold">
                Terpakai: {vouchers.filter((v) => v.isUsed).length}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!isAddingVoucher) {
                    generateVoucherCode(vRecipient || 'SAHABAT');
                  }
                  setIsAddingVoucher(!isAddingVoucher);
                }}
                className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 border-2 border-[#111111] px-4 py-1.5 rounded-full font-sans font-bold text-xs transition shadow-[2px_2px_0_#111111] flex items-center gap-1.5"
              >
                <span>{isAddingVoucher ? '✕' : '+'}</span>
                <span>{isAddingVoucher ? 'Tutup Form' : 'Buat Voucher Baru'}</span>
              </button>
            </div>
          </div>

          {/* Form Buat Voucher Baru */}
          {isAddingVoucher && (
            <div className="bg-[#FFF8E7] rounded-[24px] p-6 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-5 animate-in slide-in-from-top duration-200">
              <div className="flex justify-between items-center border-b border-[#111111]/15 pb-3">
                <div>
                  <h3 className="font-hand font-bold text-2xl text-[#111111]">
                    Buat Voucher Personal Baru
                  </h3>
                  <p className="font-sans text-xs text-[#5C3D2E]/70 mt-0.5">
                    Format Rekomendasi: [NAMA]-[KATA]-[KODE]
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingVoucher(false)}
                  className="cursor-pointer text-xs font-sans text-[#5C3D2E] hover:underline"
                >
                  Tutup ✕
                </button>
              </div>

              <form onSubmit={handleCreateVoucher} className="space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Nama Penerima */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                      Nama Pelanggan / Penerima *
                    </label>
                    <input
                      type="text"
                      required
                      value={vRecipient}
                      onChange={(e) => {
                        setVRecipient(e.target.value);
                        if (!vCode || vCode.includes('-')) {
                          generateVoucherCode(e.target.value);
                        }
                      }}
                      placeholder="misal: Amanda / Budi"
                      className="w-full bg-white border-2 border-[#111111] rounded-full px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Kode Voucher */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                        Kode Voucher *
                      </label>
                      <button
                        type="button"
                        onClick={() => generateVoucherCode(vRecipient)}
                        className="cursor-pointer text-[10px] text-amber-900 font-bold hover:underline"
                      >
                        Acak Ulang 🎲
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={vCode}
                      onChange={(e) => setVCode(e.target.value.toUpperCase())}
                      placeholder="AMANDA-LUMER-24"
                      className="w-full uppercase font-mono font-bold text-xs bg-white border-2 border-[#111111] rounded-full px-4 py-2 focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Tipe Diskon */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                      Tipe Diskon
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVDiscountType('nominal')}
                        className={`cursor-pointer py-2 rounded-full font-sans font-bold text-xs border-2 text-center transition ${
                          vDiscountType === 'nominal'
                            ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                            : 'bg-white text-[#111111] border-[#111111]/30'
                        }`}
                      >
                        Nominal (Rp)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVDiscountType('percent')}
                        className={`cursor-pointer py-2 rounded-full font-sans font-bold text-xs border-2 text-center transition ${
                          vDiscountType === 'percent'
                            ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                            : 'bg-white text-[#111111] border-[#111111]/30'
                        }`}
                      >
                        Persen (%)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  {/* Nilai Diskon */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                      Nilai Potongan {vDiscountType === 'nominal' ? '(Rupiah)' : '(%)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={vDiscountValue}
                      onChange={(e) => setVDiscountValue(Number(e.target.value))}
                      className="w-full bg-white border-2 border-[#111111] rounded-full px-4 py-2 font-sans font-bold text-xs focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Minimal Order */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                      Minimal Belanja (Rp, 0 = Bebas)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={vMinOrder}
                      onChange={(e) => setVMinOrder(Number(e.target.value))}
                      className="w-full bg-white border-2 border-[#111111] rounded-full px-4 py-2 font-sans font-bold text-xs focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>

                  {/* Deskripsi Singkat */}
                  <div>
                    <label className="block font-sans text-[11px] font-bold uppercase text-[#5C3D2E] mb-1">
                      Alasan / Keterangan Traktiran
                    </label>
                    <input
                      type="text"
                      value={vDescription}
                      onChange={(e) => setVDescription(e.target.value)}
                      placeholder="Traktiran Spesial Sobat Dulang"
                      className="w-full bg-white border-2 border-[#111111] rounded-full px-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>
                </div>

                {/* Voucher Beranak (Tiket Rahasia / Child Voucher) */}
                <div className="bg-white rounded-[20px] p-4 border-2 border-[#111111] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={vHasChild}
                        onChange={(e) => setVHasChild(e.target.checked)}
                        className="w-4 h-4 accent-[#111111] rounded cursor-pointer"
                      />
                      <span className="font-sans font-bold text-xs text-[#111111] flex items-center gap-1.5">
                        <span>🎁</span>
                        <span>Aktifkan "Voucher Beranak" (Tiket Bonus Rahasia)</span>
                      </span>
                    </label>
                    <span className="text-[10px] font-sans text-[#5C3D2E]/70 bg-amber-100 px-2 py-0.5 rounded-full">
                      Memicu repeat order!
                    </span>
                  </div>

                  {vHasChild && (
                    <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-[#111111]/10">
                      <div>
                        <label className="block font-sans text-[10px] font-bold uppercase text-[#5C3D2E] mb-1">
                          Judul Tiket Rahasia
                        </label>
                        <input
                          type="text"
                          value={vChildTitle}
                          onChange={(e) => setVChildTitle(e.target.value)}
                          placeholder="Tiket Emas Dapur"
                          className="w-full bg-[#FFF8E7] border border-[#111111]/40 rounded-full px-3 py-1.5 font-sans text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-[10px] font-bold uppercase text-[#5C3D2E] mb-1">
                          Bonus / Perk yang Didapat
                        </label>
                        <input
                          type="text"
                          value={vChildPerk}
                          onChange={(e) => setVChildPerk(e.target.value)}
                          placeholder="Gratis 2 Risoles Rogout"
                          className="w-full bg-[#FFF8E7] border border-[#111111]/40 rounded-full px-3 py-1.5 font-sans text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-[10px] font-bold uppercase text-[#5C3D2E] mb-1">
                          Syarat Pemakaian Tiket
                        </label>
                        <input
                          type="text"
                          value={vChildCondition}
                          onChange={(e) => setVChildCondition(e.target.value)}
                          placeholder="Untuk order berikutnya min. 3 box dalam 7 hari"
                          className="w-full bg-[#FFF8E7] border border-[#111111]/40 rounded-full px-3 py-1.5 font-sans text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingVoucher(false)}
                    className="cursor-pointer bg-white text-[#111111] hover:bg-gray-100 rounded-full px-5 py-2 font-sans font-bold text-xs border border-[#111111]/30"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer bg-[#111111] text-[#FFD700] hover:brightness-110 rounded-full px-6 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700]"
                  >
                    Simpan & Terbitkan Voucher ✓
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
                placeholder="Cari kode atau nama penerima..."
                className="w-full bg-white border-2 border-[#111111] rounded-full pl-9 pr-4 py-2 font-sans text-xs focus:outline-none focus:border-[#FFD700]"
              />
              <span className="absolute left-3 top-2.5 text-xs text-[#5C3D2E]/60">🔍</span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {(['all', 'active', 'used'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setVoucherFilter(filter)}
                  className={`cursor-pointer px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border transition ${
                    voucherFilter === filter
                      ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                      : 'bg-white text-[#5C3D2E]/70 border-[#111111]/20 hover:border-[#111111]'
                  }`}
                >
                  {filter === 'all' ? 'Semua' : filter === 'active' ? 'Belum Dipakai' : 'Sudah Digunakan'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel / Kartu Voucher */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVouchers.map((v) => (
              <div
                key={v.code}
                className={`rounded-[20px] p-5 border-2 border-[#111111] space-y-3 transition flex flex-col justify-between ${
                  v.isUsed
                    ? 'bg-gray-100/70 opacity-75 border-gray-400'
                    : 'bg-white shadow-[4px_4px_0_#111111] hover:shadow-[6px_6px_0_#111111]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#111111]/10">
                    <span className="font-mono font-bold text-sm tracking-wider text-[#111111] bg-[#FFD700]/30 px-2.5 py-0.5 rounded-full border border-[#111111]/20">
                      {v.code}
                    </span>
                    <span
                      className={`text-[10px] font-sans font-bold uppercase px-2 py-0.5 rounded-full border ${
                        v.isUsed
                          ? 'bg-gray-200 text-gray-700 border-gray-400'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                      }`}
                    >
                      {v.isUsed ? 'Sudah Dipakai' : 'Aktif ✓'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="font-sans font-bold text-base text-[#111111]">
                      Kak {v.recipientName}
                    </div>
                    <div className="font-sans text-xs text-[#5C3D2E]">
                      Potongan:{' '}
                      <strong className="text-emerald-700 font-bold">
                        {v.discountType === 'nominal'
                          ? `Rp ${v.discountValue.toLocaleString('id-ID')}`
                          : `${v.discountValue}%`}
                      </strong>{' '}
                      {v.minOrder > 0 ? `(Min. Rp ${v.minOrder.toLocaleString('id-ID')})` : '(Tanpa Min)'}
                    </div>
                    {v.description && (
                      <p className="font-sans text-[11px] text-[#5C3D2E]/70 italic">
                        "{v.description}"
                      </p>
                    )}
                  </div>

                  {v.childVoucher && (
                    <div className="mt-3 bg-[#FFF8E7] rounded-[14px] p-2.5 border border-[#111111]/20 space-y-1">
                      <span className="font-sans font-bold text-[10px] text-[#C84B31] uppercase flex items-center gap-1">
                        <span>🎁</span> Voucher Beranak:
                      </span>
                      <p className="font-sans text-[11px] font-bold text-[#111111]">
                        {v.childVoucher.perk}
                      </p>
                      <p className="font-sans text-[10px] text-[#5C3D2E]/80">
                        {v.childVoucher.condition}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#111111]/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyVoucherWhatsApp(v)}
                    className="cursor-pointer bg-[#FFD700] text-[#111111] hover:brightness-105 px-3 py-1.5 rounded-full font-sans font-bold text-[11px] border border-[#111111] shadow-xs flex items-center gap-1"
                    title="Salin pesan ajakan WA untuk pelanggan"
                  >
                    <span>📋</span> Salin WA
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleVoucherUsed(v)}
                      className={`cursor-pointer px-2.5 py-1 rounded-full text-[11px] font-sans font-bold border ${
                        v.isUsed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                      title={v.isUsed ? 'Aktifkan kembali' : 'Tandai sudah digunakan'}
                    >
                      {v.isUsed ? 'Aktifkan' : 'Set Terpakai'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVoucher(v.code)}
                      className="cursor-pointer text-rose-600 hover:text-rose-800 p-1 text-xs"
                      title="Hapus voucher"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredVouchers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-[24px] border-2 border-dashed border-[#111111]/20">
              <span className="text-4xl block mb-2">🎟️</span>
              <p className="font-sans font-bold text-sm text-[#111111]">
                Belum ada voucher yang cocok dengan filter.
              </p>
              <p className="font-sans text-xs text-[#5C3D2E]/60 mt-1">
                Klik tombol "+ Buat Voucher Baru" di atas untuk membuat voucher perdana!
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: KLASTER WILAYAH PENGIRIMAN */}
      {activeTab === 'stats' && (
        <div className="bg-white rounded-[24px] p-6 lg:p-8 border-2 border-[#111111] shadow-[4px_4px_0_#111111] space-y-6">
          <div>
            <h2 className="font-hand font-bold text-[30px] text-[#111111] leading-none">
              Sebaran Klaster Pelanggan (Sidoarjo, Surabaya & Sekitarnya)
            </h2>
            <p className="font-sans text-xs text-[#5C3D2E]/70 mt-1">
              Data teragregasi dari alamat yang diinput pelanggan saat pertama kali scan stiker dus.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {areaCounts
              .filter((a) => a.count > 0)
              .map((item) => (
                <div key={item.area} className="space-y-1">
                  <div className="flex justify-between font-sans text-[12px] font-bold">
                    <span>{item.area}</span>
                    <span>{item.count} pelanggan</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden border border-[#111111]/10">
                    <div
                      className="h-full bg-[#111111] rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-[#FFF8E7] rounded-[16px] p-4 border border-[#FFD700] font-sans text-xs text-[#5C3D2E] leading-relaxed">
            💡 <b>Insight Dapur:</b> Pelanggan terbanyak saat ini terkonsentrasi di wilayah{' '}
            <b>{areaCounts[0]?.area || 'Sidoarjo Kota'}</b>. Cocok untuk promo ongkir khusus atau pengiriman rombongan batch sore!
          </div>
        </div>
      )}

      {/* TAB 6: CETAK STIKER DUS (INTEGRATED) */}
      {activeTab === 'stickers' && (
        <div className="pt-1">
          <StickerGeneratorView
            onShowToast={onShowToast}
            onNavigateToScan={(qrId) => {
              window.open(`/?scan=${qrId}`, '_blank');
            }}
          />
        </div>
      )}

      {/* Pop-up Preview Modal for Owner */}
      <StoreClosedModal
        isOpen={showClosedPreview}
        config={localConfig}
        onClose={() => setShowClosedPreview(false)}
      />

      {/* Interactive Image Cropper & Auto-Compressor Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        title={cropTitle}
        onConfirm={(croppedUrl) => {
          if (cropCallbackRef.current) {
            cropCallbackRef.current(croppedUrl);
          }
          setCropModalOpen(false);
          setCropImageSrc(null);
          cropCallbackRef.current = null;
        }}
        onCancel={() => {
          setCropModalOpen(false);
          setCropImageSrc(null);
          cropCallbackRef.current = null;
        }}
      />

      {/* MODAL NOTA / STRUK DIGITAL & THERMAL PRINT */}
      {selectedOrderForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] max-w-md w-full border-2 border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#111111] text-[#FFD700] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <span className="font-hand font-bold text-xl text-white">Struk & Nota Kasir Dapur</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForReceipt(null)}
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
                    <span className="font-bold">#{selectedOrderForReceipt.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>
                      {new Date(selectedOrderForReceipt.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-bold truncate max-w-[150px]">{selectedOrderForReceipt.customer_name}</span>
                  </div>
                  {selectedOrderForReceipt.customer_wa && (
                    <div className="flex justify-between text-[10px]">
                      <span>WhatsApp:</span>
                      <span>+{selectedOrderForReceipt.customer_wa}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="font-bold uppercase">{selectedOrderForReceipt.payment_method || 'TUNAI'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layanan:</span>
                    <span className="font-bold">
                      {selectedOrderForReceipt.delivery_method === 'delivery'
                        ? '🛵 ANTAR KURIR'
                        : '🍳 AMBIL DI DAPUR'}
                    </span>
                  </div>
                  {selectedOrderForReceipt.delivery_method === 'delivery' ? (
                    <div className="pt-1 text-[10px] text-gray-800 bg-amber-50/70 p-1.5 rounded border border-amber-200/80 mt-0.5">
                      <div className="font-bold flex justify-between text-amber-950">
                        <span>Tujuan Pengantaran:</span>
                        <span>{selectedOrderForReceipt.shipping_district ? `Kec. ${selectedOrderForReceipt.shipping_district}` : 'Sidoarjo'}</span>
                      </div>
                      {selectedOrderForReceipt.notes && (
                        <div className="text-gray-700 italic break-words mt-0.5 font-sans text-[10px]">
                          {selectedOrderForReceipt.notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Lokasi Ambil:</span>
                      <span className="truncate max-w-[170px]">{storeConfig.pickupAddressNote || 'Sedati, Sidoarjo'}</span>
                    </div>
                  )}
                </div>

                {/* Gift Order Banner in Thermal Receipt */}
                {(selectedOrderForReceipt.is_gift || selectedOrderForReceipt.gift_recipient) && (
                  <div className="py-2 border-b border-dashed border-gray-400 text-[11px] bg-pink-50 p-2 my-1 rounded text-center">
                    <div className="font-bold text-pink-900">🎁 PESANAN KHUSUS HADIAH 🎁</div>
                    <div className="mt-0.5 text-gray-900">
                      <strong>Untuk:</strong> {selectedOrderForReceipt.gift_recipient}
                    </div>
                    {selectedOrderForReceipt.gift_message && (
                      <div className="mt-0.5 text-[10px] italic text-gray-700">
                        "{selectedOrderForReceipt.gift_message}"
                      </div>
                    )}
                  </div>
                )}

                {/* Items List */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1.5 text-[11px]">
                  {selectedOrderForReceipt.items.map((it, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between">
                        <span>
                          <strong>{it.qty}x</strong> {it.nama}
                        </span>
                        <span className="font-bold">Rp {(it.harga * it.qty).toLocaleString('id-ID')}</span>
                      </div>
                      {it.pilihanOpsi && (
                        <div className="text-[10px] text-gray-700 pl-3 font-semibold">
                          {it.qty > 1 ? `↳ Semua ${it.pilihanOpsi} (${it.qty} pcs)` : `↳ ${it.pilihanOpsi}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Totals & Cash Calculation */}
                <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
                  {selectedOrderForReceipt.shipping_cost !== undefined && selectedOrderForReceipt.shipping_cost > 0 && (
                    <div className="flex justify-between text-gray-600 text-[10px]">
                      <span>Ongkir Kurir ({selectedOrderForReceipt.shipping_district || 'Sidoarjo'}):</span>
                      <span>Rp {selectedOrderForReceipt.shipping_cost.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>Rp {selectedOrderForReceipt.total_price.toLocaleString('id-ID')}</span>
                  </div>
                  {selectedOrderForReceipt.payment_method === 'tunai' && selectedOrderForReceipt.cash_received !== undefined && (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Tunai Diterima:</span>
                        <span>Rp {selectedOrderForReceipt.cash_received.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 font-bold">
                        <span>Kembalian:</span>
                        <span>Rp {(selectedOrderForReceipt.cash_change || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </>
                  )}
                  <div className="text-[10px] text-center text-emerald-700 font-bold pt-1">
                    *** LUNAS ***
                  </div>
                </div>

                {/* Footer Quote */}
                <div className="text-center pt-2 text-[10px] text-gray-600 space-y-0.5">
                  <div>{storeConfig.receiptFooterNote || 'Matur suwun sanget sampun jajan! Hangatkan kembali bila perlu yaa 🙏✨'}</div>
                </div>
              </div>
            </div>

            {/* Print CSS for Thermal Printer */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #thermal-receipt-area, #thermal-receipt-area * {
                  visibility: visible !important;
                }
                #thermal-receipt-area {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: ${receiptPaperWidth === '58mm' ? '58mm' : '80mm'} !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 2mm 3mm !important;
                  border: none !important;
                  box-shadow: none !important;
                  font-family: monospace !important;
                  font-size: 11px !important;
                  line-height: 1.2 !important;
                  background: white !important;
                  color: black !important;
                }
              }
            `}</style>

            {/* Action Buttons */}
            <div className="p-4 bg-white border-t border-[#111111]/15 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleShareReceiptToWA(selectedOrderForReceipt)}
                  className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white rounded-full py-2.5 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:translate-y-0.5"
                >
                  <span>📲</span> Kirim Struk Lunas WA
                </button>

                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="cursor-pointer bg-[#111111] hover:bg-[#222222] text-[#FFD700] rounded-full py-2.5 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-[2px_2px_0_#FFD700] transition active:translate-y-0.5"
                >
                  <span>🖨️</span> Cetak Thermal
                </button>
              </div>

              {/* 1-Tap Kirim Rincian Tagihan & Rekening / QRIS ke WA */}
              <button
                type="button"
                onClick={() => handleSendInvoiceWhatsApp(selectedOrderForReceipt)}
                className="w-full cursor-pointer bg-[#25D366] hover:bg-[#20ba59] text-white rounded-full py-2.5 px-3 font-sans font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:translate-y-0.5"
              >
                <span>💳</span> Kirim Rincian Tagihan & Rekening / QRIS ke WA
              </button>

              <button
                type="button"
                onClick={() => setSelectedOrderForReceipt(null)}
                className="w-full cursor-pointer py-2 rounded-full font-sans text-xs text-gray-500 hover:text-black font-semibold"
              >
                Tutup Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE & KUITANSI RESMI A4 MODAL */}
      <InvoiceA4Modal
        order={selectedOrderForInvoice}
        onClose={() => setSelectedOrderForInvoice(null)}
        storeConfig={storeConfig}
        onShowToast={onShowToast}
      />

      {/* MODAL GANTI PERAN / SWITCH STAFF ROLE (Priority 2) */}
      {isSwitchRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] max-w-md w-full border-2 border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#111111] text-[#FFD700] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <div>
                  <h3 className="font-hand font-bold text-xl text-white leading-tight">
                    Ganti Peran Akses Cockpit
                  </h3>
                  <p className="font-sans text-[11px] text-[#FFD700]/90">
                    Beralih antara Owner, Kasir Stand, dan Kru Dapur
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSwitchRoleModalOpen(false);
                  setSwitchRolePinInput('');
                  setSwitchRoleError('');
                }}
                className="cursor-pointer text-white/70 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Active Role Banner */}
              <div className="bg-[#FFF8E7] rounded-[16px] p-3.5 border border-[#111111]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C3D2E]/70 font-sans block">
                    Peran Aktif Saat Ini:
                  </span>
                  <div className="font-sans font-bold text-sm text-[#111111] flex items-center gap-1.5 mt-0.5">
                    <span>{activeRole === 'owner' ? '👑' : activeRole === 'cashier' ? '🛒' : '🍳'}</span>
                    <span>
                      {activeRole === 'owner'
                        ? 'Pemilik Usaha (Owner)'
                        : activeRole === 'cashier'
                        ? 'Kasir Stand POS'
                        : 'Kru Dapur (KDS)'}
                    </span>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Aktif
                </span>
              </div>

              {/* Roles Description Cards */}
              <div className="space-y-2 text-xs font-sans">
                <div
                  onClick={() => setSwitchRolePinInput('')}
                  className={`p-3 rounded-[14px] border-2 transition cursor-pointer flex items-start gap-2.5 ${
                    activeRole === 'owner'
                      ? 'border-[#FFD700] bg-[#FFFDF4]'
                      : 'border-[#111111]/15 hover:border-[#111111]/40 bg-white'
                  }`}
                >
                  <span className="text-xl">👑</span>
                  <div className="flex-1">
                    <div className="font-bold text-[#111111] flex items-center justify-between">
                      <span>Owner (Pemilik Usaha)</span>
                      <span className="text-[10px] text-gray-500 font-mono">PIN Khusus Owner</span>
                    </div>
                    <p className="text-[11px] text-[#5C3D2E]/75 mt-0.5">
                      Akses tak terbatas: Buku kas laba bersih, HPP resep rahasia, audit log, & hapus data.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setSwitchRolePinInput(localConfig.cashierPin || '1234')}
                  className={`p-3 rounded-[14px] border-2 transition cursor-pointer flex items-start gap-2.5 ${
                    activeRole === 'cashier'
                      ? 'border-[#FFD700] bg-[#FFFDF4]'
                      : 'border-[#111111]/15 hover:border-[#111111]/40 bg-white'
                  }`}
                >
                  <span className="text-xl">🛒</span>
                  <div className="flex-1">
                    <div className="font-bold text-[#111111] flex items-center justify-between">
                      <span>Kasir Stand POS</span>
                      <span className="text-[10px] text-blue-600 font-mono font-bold">
                        PIN: {localConfig.cashierPin || '1234'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5C3D2E]/75 mt-0.5">
                      Input order walk-in, cetak struk thermal/invoice, cek stok menu. Laba bersih & hapus order terkunci.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setSwitchRolePinInput(localConfig.kitchenPin || '0000')}
                  className={`p-3 rounded-[14px] border-2 transition cursor-pointer flex items-start gap-2.5 ${
                    activeRole === 'kitchen'
                      ? 'border-[#FFD700] bg-[#FFFDF4]'
                      : 'border-[#111111]/15 hover:border-[#111111]/40 bg-white'
                  }`}
                >
                  <span className="text-xl">🍳</span>
                  <div className="flex-1">
                    <div className="font-bold text-[#111111] flex items-center justify-between">
                      <span>Kru Dapur (Layar KDS)</span>
                      <span className="text-[10px] text-blue-600 font-mono font-bold">
                        PIN: {localConfig.kitchenPin || '0000'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5C3D2E]/75 mt-0.5">
                      Layar monitor antrean goreng tanpa distraksi, murni antrean masak fresh dari wajan.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Input PIN */}
              <form onSubmit={handleSwitchRoleSubmit} className="space-y-3 pt-2 border-t border-[#111111]/10">
                <div>
                  <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                    Masukkan PIN Peran yang Dituju:
                  </label>
                  <input
                    type="password"
                    autoFocus
                    required
                    value={switchRolePinInput}
                    onChange={(e) => {
                      setSwitchRolePinInput(e.target.value);
                      if (switchRoleError) setSwitchRoleError('');
                    }}
                    placeholder="Ketik PIN..."
                    className="w-full rounded-[14px] border-2 border-[#111111] px-4 py-2.5 font-mono font-bold text-center text-lg bg-white focus:outline-none focus:border-[#FFD700] shadow-sm tracking-widest"
                  />
                  {switchRoleError && (
                    <p className="text-red-600 font-sans text-xs mt-1 font-semibold text-center">
                      {switchRoleError}
                    </p>
                  )}
                </div>

                {/* Quick Fill Buttons for ease of test / operator use */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-sans">
                  <span className="text-gray-500">Isi cepat:</span>
                  <button
                    type="button"
                    onClick={() => setSwitchRolePinInput(localConfig.cashierPin || '1234')}
                    className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-[#5C3D2E] px-2 py-0.5 rounded-full border border-amber-200 font-mono"
                  >
                    Kasir ({localConfig.cashierPin || '1234'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwitchRolePinInput(localConfig.kitchenPin || '0000')}
                    className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-[#5C3D2E] px-2 py-0.5 rounded-full border border-amber-200 font-mono"
                  >
                    Dapur ({localConfig.kitchenPin || '0000'})
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSwitchRoleModalOpen(false);
                      setSwitchRolePinInput('');
                      setSwitchRoleError('');
                    }}
                    className="cursor-pointer px-4 py-2 rounded-full font-sans font-bold text-xs text-gray-600 hover:text-black border border-gray-300"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSwitchingRoleLoading}
                    className="cursor-pointer bg-[#111111] text-[#FFD700] rounded-full px-5 py-2.5 font-sans font-bold text-xs border-2 border-[#111111] shadow-[2px_2px_0_#FFD700] hover:brightness-110 disabled:opacity-50"
                  >
                    {isSwitchingRoleLoading ? 'Memverifikasi...' : 'Verifikasi & Ganti Peran ✓'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATAT UANG MUKA (DP) PESANAN */}
      {dpModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[24px] max-w-sm w-full border-2 border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#111111] text-[#FFD700] px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💵</span>
                <span className="font-hand font-bold text-lg text-white">Catat Uang Muka (DP)</span>
              </div>
              <button
                type="button"
                onClick={() => setDpModalOrder(null)}
                className="cursor-pointer text-white/70 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDP} className="p-5 space-y-4">
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-xs text-[#5C3D2E] space-y-1">
                <div className="flex justify-between font-medium">
                  <span>No. Pesanan:</span>
                  <span className="font-bold text-[#111111]">#{dpModalOrder.id}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Nama Pemesan:</span>
                  <span className="font-bold text-[#111111]">{dpModalOrder.customer_name}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#111111] border-t border-amber-300 pt-1 mt-1">
                  <span>Total Tagihan:</span>
                  <span className="text-emerald-800">Rp {dpModalOrder.total_price.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div>
                <label className="block font-sans text-xs font-bold text-[#111111] mb-1">
                  Nominal DP Masuk (Rp):
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  max={dpModalOrder.total_price}
                  value={dpInputNominal}
                  onChange={(e) => setDpInputNominal(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-white border-2 border-[#111111] rounded-[12px] px-3.5 py-2 font-mono font-bold text-base text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
                
                {/* Pilihan Cepat Persentase / Nominal */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-[#5C3D2E] font-semibold">Cepat:</span>
                  {[
                    { label: '30%', val: Math.round(dpModalOrder.total_price * 0.3) },
                    { label: '50%', val: Math.round(dpModalOrder.total_price * 0.5) },
                    { label: 'Rp 50rb', val: 50000 },
                    { label: 'Rp 100rb', val: 100000 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDpInputNominal(p.val)}
                      className="cursor-pointer text-[10px] font-sans font-bold bg-gray-100 hover:bg-[#FFD700] text-[#111111] px-2 py-0.5 rounded-full border border-gray-300 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sisa Tagihan Preview */}
              {Number(dpInputNominal) > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-xs flex justify-between items-center font-bold">
                  <span className="text-emerald-900">Sisa Pelunasan:</span>
                  <span className="text-rose-700 font-mono text-sm">
                    Rp {Math.max(0, dpModalOrder.total_price - Number(dpInputNominal)).toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Metode Pembayaran DP */}
              <div>
                <label className="block font-sans text-xs font-bold text-[#5C3D2E] mb-1">
                  Metode Bayar DP:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['transfer', 'qris', 'tunai'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDpPaymentMethod(m)}
                      className={`cursor-pointer py-1.5 px-2 rounded-lg font-sans font-bold text-xs border text-center transition uppercase ${
                        dpPaymentMethod === m
                          ? 'bg-[#111111] text-[#FFD700] border-[#111111]'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDpModalOrder(null)}
                  className="cursor-pointer flex-1 py-2 rounded-full font-sans font-bold text-xs border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer flex-1 py-2 rounded-full font-sans font-bold text-xs bg-[#FFD700] text-[#111111] border-2 border-[#111111] shadow-xs hover:brightness-105 transition"
                >
                  Simpan DP 💵
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KALKULATOR KEBUTUHAN BAHAN SUBUH MODAL */}
      <SubuhCalculatorModal
        isOpen={isSubuhModalOpen}
        onClose={() => setIsSubuhModalOpen(false)}
        menus={menus}
        onShowToast={onShowToast}
        onExpenseAdded={() => setExpenses(storageService.getExpenses())}
      />

      {/* REKAP TUTUP DAPUR MALAM MODAL */}
      <KitchenClosingModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        orders={orders}
        expenses={expenses}
        storeConfig={storeConfig}
        onShowToast={onShowToast}
      />

      {/* QRIS FULLSCREEN MODAL FOR CASHIER & CUSTOMERS */}
      {isQrisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] border-3 border-[#111111] shadow-[8px_8px_0_#111111] max-w-sm w-full p-5 sm:p-6 text-center relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsQrisModalOpen(false)}
              className="cursor-pointer absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-gray-100 hover:bg-[#FFD700] text-[#111111] border-2 border-[#111111] font-bold text-sm flex items-center justify-center transition"
            >
              ✕
            </button>
            <div className="inline-flex items-center gap-1.5 bg-[#111111] text-[#FFD700] px-3 py-0.5 rounded-full text-[11px] font-bold mb-2">
              <span>📱</span>
              <span>QRIS STANDAR NASIONAL (GPN)</span>
            </div>
            <h3 className="font-hand font-bold text-2xl text-[#111111]">
              DULANG INDONESIA
            </h3>
            <p className="font-mono text-xs text-[#5C3D2E] font-bold mt-0.5">
              NMID: ID1020057244342
            </p>

            <div className="my-3 p-2 bg-[#FFFDF4] rounded-[20px] border-2 border-[#111111] shadow-inner inline-block">
              <img
                src="/qris-dulang.png"
                alt="QRIS DULANG INDONESIA"
                className="w-64 max-h-[380px] h-auto mx-auto rounded-xl object-contain"
              />
            </div>

            <p className="font-sans text-[11px] text-[#5C3D2E]/85">
              Mendukung semua M-Banking & E-Wallet<br />
              <span className="text-[10px] text-gray-500 font-medium">Dicetak oleh: OVO • Bebas Biaya Admin</span>
            </p>

            <div className="mt-4 flex gap-2">
              <a
                href="/qris-dulang.png"
                download="QRIS-Dulang-Indonesia.png"
                className="flex-1 py-2.5 rounded-full bg-[#111111] text-[#FFD700] hover:bg-[#FFD700] hover:text-[#111111] font-sans font-bold text-xs border-2 border-[#111111] transition flex items-center justify-center gap-1.5 shadow-[2px_2px_0_#111111]"
              >
                <span>📥</span>
                <span>Unduh Gambar</span>
              </a>
              <button
                type="button"
                onClick={() => setIsQrisModalOpen(false)}
                className="cursor-pointer px-4 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#111111] font-sans font-bold text-xs border border-[#111111]/30 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE SMART ORDER ACTION DRAWER (PROGRESSIVE DISCLOSURE FOR CASHIER) */}
      {mobileActionOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-[#FFFDF4] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border-t-3 sm:border-3 border-[#111111] shadow-[0_-8px_24px_rgba(0,0,0,0.3)] sm:shadow-[8px_8px_0_#111111] p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/15">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs bg-[#111111] text-[#FFD700] px-2.5 py-0.5 rounded-full">
                    #{mobileActionOrder.id}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    mobileActionOrder.status === 'lunas'
                      ? 'bg-emerald-100 text-emerald-800'
                      : mobileActionOrder.status === 'dp'
                      ? 'bg-amber-100 text-amber-900'
                      : mobileActionOrder.status === 'menunggu'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {mobileActionOrder.status === 'lunas' ? 'Lunas' : mobileActionOrder.status === 'dp' ? 'DP' : mobileActionOrder.status === 'menunggu' ? 'Menunggu' : 'Batal'}
                  </span>
                </div>
                <h3 className="font-hand font-bold text-xl text-[#111111] mt-1 leading-tight">
                  Kak {mobileActionOrder.customer_name}
                </h3>
                <span className="font-sans font-bold text-sm text-[#111111]">
                  Total: Rp {mobileActionOrder.total_price.toLocaleString('id-ID')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileActionOrder(null)}
                className="cursor-pointer w-8 h-8 rounded-full bg-white text-[#111111] border-2 border-[#111111] font-bold text-sm flex items-center justify-center hover:bg-[#FFD700]"
              >
                ✕
              </button>
            </div>

            {/* Action Buttons List */}
            <div className="space-y-2">
              <div className="font-sans font-bold text-[11px] uppercase tracking-wider text-[#5C3D2E]/70 px-1">
                Cetak & WhatsApp
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ord = mobileActionOrder;
                    setMobileActionOrder(null);
                    setSelectedOrderForReceipt(ord);
                  }}
                  className="cursor-pointer p-3 rounded-2xl bg-white border-2 border-[#111111] shadow-[2px_2px_0_#111111] flex items-center gap-2 hover:bg-[#FFF8E7] transition active:scale-95 text-left"
                >
                  <span className="text-xl">🧾</span>
                  <div>
                    <div className="font-sans font-bold text-xs text-[#111111]">Struk Thermal</div>
                    <div className="text-[10px] text-[#5C3D2E]/70">58mm / 80mm</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ord = mobileActionOrder;
                    setMobileActionOrder(null);
                    handleSendInvoiceWhatsApp(ord);
                  }}
                  className="cursor-pointer p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-600 shadow-[2px_2px_0_#059669] flex items-center gap-2 hover:bg-emerald-100 transition active:scale-95 text-left"
                >
                  <span className="text-xl">📲</span>
                  <div>
                    <div className="font-sans font-bold text-xs text-emerald-900">Tagihan WA</div>
                    <div className="text-[10px] text-emerald-700">Kirim ke nomor</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ord = mobileActionOrder;
                    setMobileActionOrder(null);
                    setSelectedOrderForInvoice(ord);
                  }}
                  className="cursor-pointer p-3 rounded-2xl bg-white border-2 border-blue-900 shadow-[2px_2px_0_#1e3a8a] flex items-center gap-2 hover:bg-blue-50 transition active:scale-95 text-left"
                >
                  <span className="text-xl">📄</span>
                  <div>
                    <div className="font-sans font-bold text-xs text-blue-950">Invoice A4</div>
                    <div className="text-[10px] text-blue-800">Formal Instansi</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ord = mobileActionOrder;
                    setMobileActionOrder(null);
                    const waMsg = storageService.generateWaTrackingMessage(ord);
                    const cleanWa = (ord.customer_wa || '').replace(/\D/g, '');
                    let url = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
                    if (cleanWa) {
                      const waNum = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
                      url = `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`;
                    }
                    window.open(url, '_blank');
                    onShowToast(`Membuka WhatsApp link live tracking pesanan #${ord.id}... 📱`);
                  }}
                  className="cursor-pointer p-3 rounded-2xl bg-amber-50 border-2 border-amber-600 shadow-[2px_2px_0_#d97706] flex items-center gap-2 hover:bg-amber-100 transition active:scale-95 text-left"
                >
                  <span className="text-xl">🔥</span>
                  <div>
                    <div className="font-sans font-bold text-xs text-amber-950">Resi Live WA</div>
                    <div className="text-[10px] text-amber-800">Lacak masak</div>
                  </div>
                </button>
              </div>

              {/* Status & Payment Actions */}
              {mobileActionOrder.status === 'menunggu' && (
                <>
                  <div className="font-sans font-bold text-[11px] uppercase tracking-wider text-[#5C3D2E]/70 px-1 pt-2">
                    Metode Pembayaran
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const id = mobileActionOrder.id;
                        setMobileActionOrder(null);
                        handleUpdateOrderStatus(id, 'lunas', 'transfer');
                      }}
                      className="cursor-pointer p-3 rounded-2xl bg-white border-2 border-blue-600 shadow-xs flex items-center gap-2 hover:bg-blue-50 text-left"
                    >
                      <span className="text-xl">🏦</span>
                      <div>
                        <div className="font-sans font-bold text-xs text-blue-900">Transfer Bank</div>
                        <div className="text-[10px] text-blue-700">Tandai lunas</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const ord = mobileActionOrder;
                        setMobileActionOrder(null);
                        setDpModalOrder(ord);
                        setDpInputNominal(Math.round(ord.total_price * 0.5));
                      }}
                      className="cursor-pointer p-3 rounded-2xl bg-amber-400 border-2 border-amber-600 shadow-xs flex items-center gap-2 hover:brightness-105 text-left"
                    >
                      <span className="text-xl">💵</span>
                      <div>
                        <div className="font-sans font-bold text-xs text-amber-950">Terima DP</div>
                        <div className="text-[10px] text-amber-900">Uang Muka</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {mobileActionOrder.status === 'dp' && (
                <>
                  <div className="font-sans font-bold text-[11px] uppercase tracking-wider text-[#5C3D2E]/70 px-1 pt-2">
                    Pelunasan Sisa DP
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const id = mobileActionOrder.id;
                        setMobileActionOrder(null);
                        handleSettleOrder(id, 'qris');
                      }}
                      className="cursor-pointer p-3 rounded-2xl bg-white border-2 border-emerald-600 shadow-xs flex items-center gap-2 hover:bg-emerald-50 text-left"
                    >
                      <span className="text-xl">📱</span>
                      <div>
                        <div className="font-sans font-bold text-xs text-emerald-900">Lunas via QRIS</div>
                        <div className="text-[10px] text-emerald-700">Pelunasan digital</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const id = mobileActionOrder.id;
                        setMobileActionOrder(null);
                        handleSettleOrder(id, 'transfer');
                      }}
                      className="cursor-pointer p-3 rounded-2xl bg-white border-2 border-blue-600 shadow-xs flex items-center gap-2 hover:bg-blue-50 text-left"
                    >
                      <span className="text-xl">🏦</span>
                      <div>
                        <div className="font-sans font-bold text-xs text-blue-900">Lunas Transfer</div>
                        <div className="text-[10px] text-blue-700">BCA / Mandiri / BRI</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Batalkan & Hapus */}
              <div className="pt-2 border-t border-[#111111]/10 flex items-center gap-2">
                {mobileActionOrder.status === 'menunggu' && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = mobileActionOrder.id;
                      setMobileActionOrder(null);
                      handleUpdateOrderStatus(id, 'batal');
                    }}
                    className="cursor-pointer flex-1 py-2.5 rounded-full font-sans font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition"
                  >
                    ✕ Batalkan Pesanan
                  </button>
                )}

                {activeRole === 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = mobileActionOrder.id;
                      setMobileActionOrder(null);
                      handleDeleteOrder(id);
                    }}
                    className="cursor-pointer flex-1 py-2.5 rounded-full font-sans font-bold text-xs bg-gray-100 hover:bg-red-50 text-red-600 border border-gray-300 hover:border-red-300 transition"
                  >
                    🗑️ Hapus Pesanan
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileActionOrder(null)}
              className="cursor-pointer w-full py-2.5 rounded-full bg-white hover:bg-gray-100 text-[#111111] font-sans font-bold text-xs border-2 border-[#111111] transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MENU DAPUR LAINNYA (SLIDE-UP DRAWER FOR PROGRESSIVE DISCLOSURE) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-[#FFFDF4] w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border-3 border-[#111111] shadow-[8px_8px_0_#111111] p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/15">
              <div>
                <span className="font-sans text-[11px] font-bold uppercase text-[#5C3D2E]">
                  Alat Manajerial & Fitur Dapur
                </span>
                <h3 className="font-hand font-bold text-2xl text-[#111111] leading-none">
                  Menu Dapur Lainnya
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="cursor-pointer w-8 h-8 rounded-full bg-white text-[#111111] border-2 border-[#111111] font-bold text-sm flex items-center justify-center hover:bg-[#FFD700]"
              >
                ✕
              </button>
            </div>

            {/* Grid of Secondary Management Tools */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Quick Switch Role Pill in Drawer */}
              <div className="col-span-2 bg-[#FFF8E7] p-3 rounded-[16px] border border-[#111111]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#5C3D2E]/70 font-bold block uppercase">Peran Aktif:</span>
                  <span className="font-sans font-bold text-xs text-[#111111]">
                    {activeRole === 'owner' ? '👑 Owner (Pemilik)' : activeRole === 'cashier' ? '🛒 Kasir Stand POS' : '🍳 Kru Dapur (KDS)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    setSwitchRolePinInput('');
                    setSwitchRoleError('');
                    setIsSwitchRoleModalOpen(true);
                  }}
                  className="cursor-pointer bg-[#FFD700] hover:bg-[#FFE033] text-[#111111] px-3 py-1 rounded-full font-sans font-bold text-xs border border-[#111111] shadow-xs active:scale-95"
                >
                  Ganti Peran ⇄
                </button>
              </div>

              {/* Kelola Menu: All Roles */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('menu');
                  setIsMobileDrawerOpen(false);
                }}
                className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                  activeTab === 'menu'
                    ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                    : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                }`}
              >
                <div className="text-xl mb-1">🍲</div>
                <div className="font-sans font-bold text-xs">Kelola Menu</div>
                <div className="text-[10px] opacity-75">Harga & stok porsi</div>
              </button>

              {/* Layar Dapur (KDS): All Roles */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('kds');
                  setIsMobileDrawerOpen(false);
                }}
                className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                  activeTab === 'kds'
                    ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                    : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                }`}
              >
                <div className="text-xl mb-1">🍳</div>
                <div className="font-sans font-bold text-xs">Layar Dapur (KDS)</div>
                <div className="text-[10px] opacity-75">Antrean goreng real-time</div>
              </button>

              {/* Cetak Stiker QR: Owner & Cashier */}
              {(activeRole === 'owner' || activeRole === 'cashier') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('stickers');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'stickers'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">🏷️</div>
                  <div className="font-sans font-bold text-xs">Cetak Stiker QR</div>
                  <div className="text-[10px] opacity-75">Stiker dus risoles</div>
                </button>
              )}

              {/* Pelanggan: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('customers');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'customers'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">👥</div>
                  <div className="font-sans font-bold text-xs">Pelanggan Setia</div>
                  <div className="text-[10px] opacity-75">Smart QR & Riwayat</div>
                </button>
              )}

              {/* Resep & Gudang: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('inventory');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'inventory'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">🥩</div>
                  <div className="font-sans font-bold text-xs">Resep & Gudang Bahan</div>
                  <div className="text-[10px] opacity-75">Stok bahan & HPP cuan</div>
                </button>
              )}

              {/* Kalkulator Subuh: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSubuhModalOpen(true);
                    setIsMobileDrawerOpen(false);
                  }}
                  className="p-3 bg-[#FFD700] rounded-[16px] border-2 border-[#111111] shadow-[2px_2px_0_#111111] hover:brightness-105 text-left transition cursor-pointer"
                >
                  <div className="text-xl mb-1">🌅</div>
                  <div className="font-sans font-bold text-xs text-[#111111]">Kalkulator Subuh</div>
                  <div className="text-[10px] text-[#111111]/80">Belanja pasar & resep</div>
                </button>
              )}

              {/* Tutup Dapur Malam: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsClosingModalOpen(true);
                    setIsMobileDrawerOpen(false);
                  }}
                  className="p-3 bg-[#111111] text-[#FFF8E7] rounded-[16px] border-2 border-[#FFD700] shadow-[2px_2px_0_#FFD700] hover:brightness-110 text-left transition cursor-pointer"
                >
                  <div className="text-xl mb-1">🌙</div>
                  <div className="font-sans font-bold text-xs text-[#FFD700]">Tutup Dapur Malam</div>
                  <div className="text-[10px] text-white/70">Rekap omzet & WA</div>
                </button>
              )}

              {/* Voucher: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('vouchers');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'vouchers'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">🎟️</div>
                  <div className="font-sans font-bold text-xs">Kupon & Voucher</div>
                  <div className="text-[10px] opacity-75">Promo diskon unik</div>
                </button>
              )}

              {/* Ulasan Testimoni: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('testimonials');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'testimonials'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">💬</div>
                  <div className="font-sans font-bold text-xs">Ulasan Pelanggan</div>
                  <div className="text-[10px] opacity-75">Testimoni depan</div>
                </button>
              )}

              {/* Statistik Tren: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('stats');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'stats'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">📊</div>
                  <div className="font-sans font-bold text-xs">Statistik Tren</div>
                  <div className="text-[10px] opacity-75">Grafik penjualan</div>
                </button>
              )}

              {/* Keamanan & PIN: Owner Only */}
              {activeRole === 'owner' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`p-3 rounded-[16px] border-2 border-[#111111] text-left transition cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-[#111111] text-[#FFD700] shadow-[2px_2px_0_#FFD700]'
                      : 'bg-white text-[#111111] shadow-[2px_2px_0_#111111] hover:bg-[#FFF8E7]'
                  }`}
                >
                  <div className="text-xl mb-1">🔐</div>
                  <div className="font-sans font-bold text-xs">Keamanan & PIN</div>
                  <div className="text-[10px] opacity-75">Identitas, Brand & PIN</div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KITCHEN COCKPIT BOTTOM NAVIGATION BAR (FIXED AT BOTTOM FOR MOBILE & APKS) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#111111] text-[#FFF8E7] border-t-2 border-[#FFD700] px-2 py-1.5 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.35)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {/* Tab 1: Kasir & Antrean (Owner & Cashier) */}
          {(activeRole === 'owner' || activeRole === 'cashier') && (
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                activeTab === 'orders' ? 'text-[#FFD700] font-bold scale-105' : 'text-white/70 hover:text-white'
              }`}
            >
              <div className="relative text-xl">
                <span>🛒</span>
                {orders.filter((o) => o.status === 'menunggu').length > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                    {orders.filter((o) => o.status === 'menunggu').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-sans">Kasir</span>
            </button>
          )}

          {/* Tab 2: Layar Dapur (KDS) (All Roles) */}
          <button
            type="button"
            onClick={() => setActiveTab('kds')}
            className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'kds' ? 'text-[#FFD700] font-bold scale-105' : 'text-white/70 hover:text-white'
            }`}
          >
            <div className="text-xl">
              <span>🍳</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-sans">Dapur</span>
          </button>

          {/* Tab 3: Stok & Menu (All Roles) */}
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
              activeTab === 'menu' ? 'text-[#FFD700] font-bold scale-105' : 'text-white/70 hover:text-white'
            }`}
          >
            <div className="text-xl">
              <span>🍲</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-sans">Menu</span>
          </button>

          {/* Tab 4: Kas Harian (Owner Only) / Cetak Stiker (Cashier) */}
          {activeRole === 'owner' && (
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                activeTab === 'expenses' ? 'text-[#FFD700] font-bold scale-105' : 'text-white/70 hover:text-white'
              }`}
            >
              <div className="text-xl">
                <span>💰</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-sans">Kas</span>
            </button>
          )}

          {activeRole === 'cashier' && (
            <button
              type="button"
              onClick={() => setActiveTab('stickers')}
              className={`cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
                activeTab === 'stickers' ? 'text-[#FFD700] font-bold scale-105' : 'text-white/70 hover:text-white'
              }`}
            >
              <div className="text-xl">
                <span>🏷️</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-sans">Stiker</span>
            </button>
          )}

          {/* Tab 5: Menu Dapur Lainnya (Drawer Toggle for Owner & Cashier) or Quick Switch for Kitchen */}
          {activeRole === 'kitchen' ? (
            <button
              type="button"
              onClick={() => {
                setSwitchRolePinInput('');
                setSwitchRoleError('');
                setIsSwitchRoleModalOpen(true);
              }}
              className="cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-white/70 hover:text-[#FFD700] transition"
            >
              <div className="text-xl">
                <span>🔄</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-sans">Ganti</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="cursor-pointer flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-white/70 hover:text-[#FFD700] transition"
            >
              <div className="text-xl">
                <span>⚡</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-sans">Lainnya</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
