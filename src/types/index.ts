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
  channel: 'web_wa' | 'walk_in';
  cash_received?: number;
  cash_change?: number;
  delivery_method?: 'pickup' | 'delivery';
  shipping_cost?: number;
  shipping_district?: string;
  ingredients_deducted?: boolean;
  kitchen_status?: KitchenCookingStatus;
  cooking_started_at?: string;
  cooking_completed_at?: string;
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
