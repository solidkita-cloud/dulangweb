export type LoyaltyTier = 'Baru' | 'Setia' | 'Sultan Dulang';

export interface MenuItem {
  id: string;
  nama: string;
  harga: number;
  deskripsi: string;
  foto?: string;
  tersedia: boolean;
  tersediaBesok?: boolean;
  kloterBadge?: string;
  opsi?: string[];
  stokHarian?: number | null;
  sisaStok?: number | null;
  variantType?: 'matang' | 'frozen';
  servingType?: 'matang_only' | 'frozen_only' | 'both';
}

export interface Customer {
  id: string;
  qr_code_id: string;
  name: string;
  wa: string;
  address: string;
  area: string;
  city?: string;
  district?: string;
  village?: string;
  street_detail?: string;
  favorite_menu: string;
  favorite_option?: string;
  total_orders: number;
  total_spent?: number;
  status: LoyaltyTier;
  consent_at: string;
  first_scan_at: string;
  last_scan_at: string;
  birth_day?: number; // 1-31 (Hari lahir)
  birth_month?: number; // 1-12 (Bulan lahir - TANPA TAHUN demi privasi)
  notes?: string;
  last_greeted_at?: string; // Tanggal terakhir disapa via WA (YYYY-MM-DD)
  last_order_at?: string; // Tanggal & waktu transaksi terakhir (ISO string)
}

export interface QRCodeRecord {
  id: string;
  hmac: string;
  status: 'unused' | 'claimed' | 'revoked';
  print_batch: string;
  created_at: string;
}

export interface CartItem {
  item: MenuItem;
  qty: number;
  isTomorrowOrder?: boolean;
  pilihanOpsi?: string;
  variantType?: 'matang' | 'frozen';
}

export interface ScanLog {
  id: string;
  qr_code_id: string;
  customer_id?: string;
  scanned_at: string;
  ip_hash: string;
  action: 'view' | 'menu' | 'order' | 'claim';
  meta?: Record<string, any>;
}

export interface ScheduleItem {
  jam: string;
  teks: string;
  rot?: string;
}

export type StaffRole = 'owner' | 'cashier' | 'kitchen';

export interface StoreConfig {
  heroImage: string;
  heroImages?: string[];
  heroHeadlineSub?: string;
  jamBukaTeks: string;
  schedules: ScheduleItem[];
  ownerPin: string;
  cashierPin?: string;       // Default: '1234'
  kitchenPin?: string;       // Default: '0000'
  brandName?: string;        // Default: 'Dulang Indonesia'
  brandTagline?: string;     // Default: 'Dibuat dengan wajan panas & tulisan tangan'
  brandLogo?: string;        // Default: '/dulang-logo.png'
  brandPhone?: string;       // Default: '087703397035'
  businessType?: 'gorengan' | 'cafe' | 'resto' | 'bakery' | 'umum';
  receiptFooterNote?: string; // Default: 'Matur suwun sanget sampun jajan! Hangatkan kembali bila perlu yaa 🙏✨'
  isStoreClosed?: boolean;
  closedReason?: string;
  autoOperatingHours?: boolean; // Default true: otomatis buka/tutup sesuai jam
  openHour?: string;            // Default: '10:00'
  closeHour?: string;           // Default: '20:00'
  snackBoxMinOrder?: number;    // Default: 10
  activeKloter?: string;
  isTomorrowOrderOpen?: boolean;
  tomorrowOrderNote?: string;
  enableDeliveryOption?: boolean; // Pasif / Aktif kapan-kapan
  pickupAddressNote?: string;
  deliveryRates?: Record<string, number>;
  bankBCA?: string;
  bankMandiri?: string;
  qrisTeks?: string;
  qrisNmid?: string;
  qrisImage?: string;
  gofoodCommissionPercent?: number;     // Default: 20%
  shopeefoodCommissionPercent?: number; // Default: 20%
  grabfoodCommissionPercent?: number;   // Default: 20%
}

export interface ChildVoucherPerk {
  title: string;       // e.g. "Tiket Rahasia Dapur: Bonus 2 Risoles Rogout"
  perk: string;        // e.g. "Gratis 2 Risoles Rogout Hangat"
  condition: string;   // e.g. "Untuk pesanan berikutnya min. 3 box dalam 7 hari"
  unlockCode: string;  // e.g. "AMANDA-BONUS-ROGOUT"
}

export interface GoldenTicketRecord {
  id: string;
  parentCode: string;
  title: string;
  perk: string;
  unlockCode: string;
  condition: string;
  recipientName: string;
  unlockedAt: string;
  isClaimed: boolean;
}

export interface Voucher {
  code: string;        // e.g. "AMANDA-LUMER-24"
  recipientName: string; // e.g. "Amanda"
  discountType: 'nominal' | 'percent';
  discountValue: number; // e.g. 10000 or 15
  minOrder: number;    // e.g. 40000 (0 jika tanpa min)
  description?: string;
  isUsed: boolean;
  usedAt?: string;
  usedByWa?: string;
  childVoucher?: ChildVoucherPerk;
  createdAt: string;
  expiredAt?: string;
}

// --- SISTEM PENCATATAN PENJUALAN & KASIR DAPUR ---
export type PaymentMethod = 'tunai' | 'qris' | 'transfer';
export type OrderStatus = 'menunggu' | 'dp' | 'lunas' | 'batal';
export type KitchenCookingStatus = 'antre' | 'sedang_goreng' | 'packing' | 'siap' | 'selesai';

export interface OrderItem {
  menu_id: string;
  nama: string;
  harga: number;
  qty: number;
  pilihanOpsi?: string;
  variantType?: 'matang' | 'frozen';
}

export interface OrderRecord {
  id: string;
  customer_name: string;
  customer_wa?: string;
  customer_qr_id?: string;
  items: OrderItem[];
  total_price: number;
  dp_amount?: number;
  remaining_amount?: number;
  delivery_schedule?: string;
  delivery_slot?: string;
  notes?: string;
  payment_method?: PaymentMethod;
  status: OrderStatus;
  created_at: string;
  completed_at?: string;
  channel: 'web_wa' | 'walk_in' | 'gofood' | 'shopeefood' | 'grabfood';
  external_order_id?: string;            // Nomor ID/Resi GoFood/ShopeeFood (e.g. GF-104)
  platform_commission_percent?: number;  // Persentase komisi bagi hasil (e.g. 20)
  platform_commission_amount?: number;   // Nominal potongan platform (e.g. 6000)
  net_platform_payout?: number;          // Nominal bersih yang cair ke rekening resto (e.g. 24000)
  cash_received?: number;
  cash_change?: number;
  delivery_method?: 'pickup' | 'delivery';
  shipping_cost?: number;
  shipping_district?: string;
  ingredients_deducted?: boolean;
  kitchen_status?: KitchenCookingStatus;
  cooking_started_at?: string;
  cooking_completed_at?: string;
  is_gift?: boolean;
  gift_recipient?: string;
  gift_message?: string;
  cashier_name?: string;         // Nama petugas kasir yang melayani transaksi (e.g. 'Siti')
  print_count?: number;          // Frekuensi cetak struk (1 = asli, >= 2 = cetak ulang/reprint)
  last_printed_at?: string;      // Waktu terakhir struk dicetak
  cancellation_reason?: string;  // Alasan pembatalan/void nota (e.g. 'Salah input menu')
  cancelled_by?: string;         // Nama kasir/owner yang membatalkan nota
  cancelled_at?: string;         // Waktu pembatalan
}

// --- SISTEM SHIFT KASIR & SERAH TERIMA LACI ---
export interface CashierShift {
  id: string;                    // ID Shift unik (e.g. 'SHIFT-1794275033')
  cashier_name: string;          // Nama petugas kasir (e.g. 'Siti')
  started_at: string;            // Waktu buka shift (ISO string)
  ended_at?: string;             // Waktu tutup shift (ISO string)
  status: 'open' | 'closed';
  opening_cash_float: number;    // Modal awal uang kembalian di laci (e.g. 100000)
  expected_drawer_cash?: number; // Uang tunai yang seharusnya ada di laci menurut sistem
  actual_drawer_cash?: number;   // Uang fisik di laci yang dihitung saat tutup shift
  cash_difference?: number;      // Selisih fisik vs sistem (0 = PAS, >0 = LEBIH, <0 = KURANG)
  drawer_expenses: number;       // Total pengeluaran laci dadakan (petty cash) selama shift
  total_orders_count: number;    // Total jumlah transaksi sukses pada shift ini
  total_revenue: number;         // Total omzet bruto shift ini
  cash_revenue: number;          // Total uang masuk tunai
  non_cash_revenue: number;      // Total uang masuk non-tunai (QRIS / Transfer)
  notes?: string;
}

// --- PENDAPAT / TESTIMONI PELANGGAN (COLLAPSIBLE / ACCORDION) ---
export interface CustomerTestimonial {
  id: string;
  customer_name: string;
  area: string;
  comment: string;
  favorite_menu?: string;
  created_at: string;
  is_active: boolean;
  rating?: number;
}

// --- SISTEM PENGELUARAN & PROFIT BERSIH DAPUR (BUKU KAS) ---
export type ExpenseCategory = 'bahan_baku' | 'operasional' | 'kemasan' | 'lainnya';

export interface ExpenseRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  kategori: ExpenseCategory;
  nama_item: string;
  nominal: number;
  catatan?: string;
  created_at: string;
  source?: 'kas_laci' | 'rekening_owner'; // Sumber dana pengeluaran
  cashier_name?: string;                 // Kasir pencatat jika dari kas laci
}

// --- PAKET SNACK BOX / HAJATAN / ARISAN BUILDER ---
export type SnackBoxType = 'mini_2' | 'standar_3' | 'lengkap_4';
export type SnackBoxDrink = 'none' | 'mineral' | 'teh';

export interface SnackBoxOrder {
  boxType: SnackBoxType;
  boxName: string;
  items: string[];
  withDrink: SnackBoxDrink;
  pricePerBox: number;
  qtyBox: number;
  subtotal: number;
  discountAmount: number;
  bonusBoxes: number;
  totalPrice: number;
  eventDate: string;
  eventTime: string;
  customLabel?: string;
  notes?: string;
}

// --- DATABASE BACKUP EXPORT & IMPORT (OFFLINE-FIRST) ---
export interface DulangDatabaseBackup {
  version: string;
  exported_at: string;
  app_name: string;
  menus: MenuItem[];
  customers: Customer[];
  orders: OrderRecord[];
  testimonials: CustomerTestimonial[];
  vouchers: Voucher[];
  storeConfig: StoreConfig;
  expenses?: ExpenseRecord[];
  pantryIngredients?: PantryIngredient[];
  menuRecipes?: MenuRecipe[];
  kitchenRecaps?: KitchenClosingRecap[];
  subuhPlans?: SubuhPrepPlan[];
  stockMovements?: StockMovementRecord[];
}
// --- KALKULATOR KEBUTUHAN BAHAN SUBUH (PREP-COOK CALCULATOR) ---
export interface SubuhPrepIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: 'isian' | 'kulit' | 'panir_minyak' | 'kemasan';
  estPrice: number;
  checked?: boolean;
}

export interface SubuhPrepPlan {
  id: string;
  targetDate: string;
  items: { menuId: string; name: string; targetPcs: number }[];
  ingredients: SubuhPrepIngredient[];
  totalEstBudget: number;
  notes?: string;
  createdAt: string;
}

// --- REKAP TUTUP DAPUR MALAM (END-OF-DAY KITCHEN RECAP) ---
export interface KitchenClosingRecap {
  id: string;
  recapDate: string; // YYYY-MM-DD
  closedAt: string;  // ISO string
  totalOrders: number;
  totalPortions: number;
  portionsMatang: number;
  portionsFrozen: number;
  grossRevenue: number;
  cashRevenue: number;
  nonCashRevenue: number;
  dpRevenue?: number;
  pendingReceivables?: number;
  totalCashFlowIn?: number;
  totalExpenses: number;
  netProfit: number;
  topSellingItems: { name: string; qty: number }[];
  tomorrowPreOrdersCount: number;
  notes?: string;
  // Rekonsiliasi Laci Kasir (Cash Drawer Float & Reconciliation)
  openingCashFloat?: number;
  cashExpensesFromDrawer?: number;
  expectedDrawerCash?: number;
  actualDrawerCash?: number;
  cashDifference?: number;
  depositToOwner?: number;
}

// --- GUDANG BAHAN BAKU & RESEP HPP OTOMATIS (COGS / RECIPE COSTING) ---
export type IngredientCategory = 'kulit' | 'isian' | 'panir_minyak' | 'kemasan';

export interface PantryIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: string;               // 'kg', 'butir', 'liter', 'pack', 'pcs', 'kotak'
  currentStock: number;       // e.g. 5.5
  minStock: number;           // warning threshold, e.g. 2
  costPerUnit: number;        // harga beli per unit (e.g. 12000 / kg)
  updatedAt?: string;
}

export interface RecipeItemComponent {
  ingredientId: string;       // references PantryIngredient.id
  ingredientName: string;
  amountPerPcs: number;       // kebutuhan per 1 butir risoles dalam satuan bahan
  unit: string;
}

export interface MenuRecipe {
  menuId: string;             // references MenuItem.id
  menuName: string;
  components: RecipeItemComponent[];
  calculatedHpp: number;      // total HPP / biaya bahan per 1 butir
  updatedAt?: string;
}

// --- KARTU STOK & LOG PERGERAKAN BAHAN BAKU (INVENTORY MOVEMENT LEDGER) ---
export type StockMovementType = 'masuk' | 'keluar' | 'penyesuaian';

export interface StockMovementRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: StockMovementType;
  amount: number;             // e.g. 5 (masuk), 0.25 (keluar)
  unit: string;
  previousStock: number;
  newStock: number;
  createdAt: string;          // ISO date
  note?: string;              // e.g. "Pesanan #ORD-20261108-1234 (3x Risol Mayo)" or "Restock belanja pasar"
  orderId?: string;
  expenseId?: string;
}
