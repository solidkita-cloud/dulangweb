import {
  MenuItem,
  Customer,
  QRCodeRecord,
  StoreConfig,
  Voucher,
  OrderRecord,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  CustomerTestimonial,
  DulangDatabaseBackup,
  ExpenseRecord,
  GoldenTicketRecord,
  SubuhPrepPlan,
  KitchenClosingRecap,
} from '../types';
import {
  DEFAULT_MENUS,
  INITIAL_CUSTOMERS,
  DEFAULT_STORE_CONFIG,
  DEFAULT_VOUCHERS,
  DEFAULT_ORDERS,
  DEFAULT_TESTIMONIALS,
} from '../lib/constants';
import { getSupabaseClient } from '../lib/supabase';
import {
  isOwnerSessionValid,
  createOwnerSession,
  clearOwnerSession,
  hashPassword,
  verifyPassword,
} from '../lib/security';

const STORAGE_KEYS = {
  MENUS: 'dulang_menus_v3',
  CUSTOMERS: 'dulang_customers',
  QR_CODES: 'dulang_qr_codes',
  OWNER_TOKEN: 'dulang_owner_authenticated',
  VOUCHERS: 'dulang_vouchers',
  ORDERS: 'dulang_orders_v1',
  TESTIMONIALS: 'dulang_testimonials_v1',
  EXPENSES: 'dulang_expenses_v1',
  ACTIVE_CUSTOMER_QR: 'dulang_active_customer_qr',
  GOLDEN_TICKETS: 'dulang_golden_tickets_v1',
  SUBUH_PLANS: 'dulang_subuh_plans_v1',
  KITCHEN_RECAPS: 'dulang_kitchen_recaps_v1',
};

export const DEFAULT_EXPENSES: ExpenseRecord[] = [];

export const storageService = {
  // --- MENU MANAGEMENT ---
  getMenus(): MenuItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENUS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read menus from localStorage:', e);
    }
    localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(DEFAULT_MENUS));
    return DEFAULT_MENUS;
  },

  resetDefaultMenus(): MenuItem[] {
    try {
      localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(DEFAULT_MENUS));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
      }
    } catch (e) {
      console.error('Failed to reset menus:', e);
    }
    return DEFAULT_MENUS;
  },

  async saveMenus(menus: MenuItem[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(menus));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
      }
      const client = getSupabaseClient();
      if (client) {
        await client.from('menus').upsert(menus);
      }
    } catch (e) {
      console.error('Failed to save menus:', e);
    }
  },

  updateMenuStock(menuId: string, stokHarian: number | null, sisaStok: number | null): MenuItem | null {
    const menus = this.getMenus();
    const idx = menus.findIndex((m) => m.id === menuId);
    if (idx < 0) return null;

    const existing = menus[idx];
    const isSoldOut = sisaStok !== null && sisaStok !== undefined && sisaStok <= 0;
    const updated: MenuItem = {
      ...existing,
      stokHarian,
      sisaStok,
      tersedia: isSoldOut ? false : existing.tersedia,
    };
    menus[idx] = updated;
    this.saveMenus(menus);
    return updated;
  },

  refillAllMenuStock(): void {
    const menus = this.getMenus();
    const updated = menus.map((m) => {
      if (m.stokHarian !== undefined && m.stokHarian !== null) {
        return {
          ...m,
          sisaStok: m.stokHarian,
          tersedia: true,
        };
      }
      return m;
    });
    this.saveMenus(updated);
  },

  deductStockForOrder(orderItems: { menu_id?: string; nama: string; qty: number }[]): void {
    const menus = this.getMenus();
    let hasChanges = false;

    orderItems.forEach((item) => {
      const idx = menus.findIndex(
        (m) => (item.menu_id && m.id === item.menu_id) || m.nama.toLowerCase() === item.nama.toLowerCase()
      );
      if (idx >= 0) {
        const m = menus[idx];
        if (m.sisaStok !== undefined && m.sisaStok !== null) {
          const newSisa = Math.max(0, m.sisaStok - item.qty);
          menus[idx] = {
            ...m,
            sisaStok: newSisa,
            tersedia: newSisa > 0 ? m.tersedia : false,
          };
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      this.saveMenus(menus);
    }
  },

  /**
   * Parse natural stock update text (from WhatsApp or Web quick bar) and mirror to all menus
   */
  parseAndUpdateStock(rawText: string): {
    success: boolean;
    message: string;
    targetPeriod: string;
    updatedCount: number;
    menus: MenuItem[];
  } {
    const menus = this.getMenus();
    const lower = rawText.toLowerCase();

    // 1. Detect target period / date
    let targetPeriod = 'Hari Ini';
    const dateMatch = rawText.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
    if (dateMatch) {
      targetPeriod = dateMatch[1];
    } else if (lower.includes('besok') || lower.includes('tomorrow')) {
      targetPeriod = 'Besok';
    }

    const isTomorrow = targetPeriod === 'Besok';

    // 2. Check for bulk "ready semua stok X semua" / "stok X semua" / "ready X semua"
    const bulkMatch =
      lower.match(/(?:ready\s+semua\s+stok|stok\s+hari\s+ini\s+ready|ready\s+semua|stok)\s+(\d+)\s+semua/i) ||
      lower.match(/semua\s+(?:stok\s+)?(\d+)/i) ||
      lower.match(/ready\s+semua\s+stok\s+(\d+)/i);

    if (bulkMatch) {
      const bulkQty = parseInt(bulkMatch[1], 10);
      const updatedMenus = menus.map((m) => {
        return {
          ...m,
          stokHarian: bulkQty,
          sisaStok: bulkQty,
          tersedia: bulkQty > 0,
          tersediaBesok: isTomorrow ? bulkQty > 0 : m.tersediaBesok,
        };
      });

      this.saveMenus(updatedMenus);

      return {
        success: true,
        targetPeriod,
        updatedCount: updatedMenus.length,
        menus: updatedMenus,
        message: `🌱 *UPDATE STOK BERHASIL DITERAPKAN!*
🏢 _Dulang Indonesia - Sidoarjo_
📅 _Periode: ${targetPeriod}_
━━━━━━━━━━━━━━━━━━━━━
✓ Seluruh ${updatedMenus.length} menu disetel *${bulkQty} pcs/pack* (${bulkQty > 0 ? 'READY' : 'HABIS'})
━━━━━━━━━━━━━━━━━━━━━
🔄 *Status:* Tersinkronisasi dua arah ke Layar Kasir DULANG-3 & WA Bot!
💡 _Ketik "menu" untuk melihat daftar menu aktif._`,
      };
    }

    // 3. Itemized parsing
    const zeroOthers =
      lower.includes('lainnya 0') ||
      lower.includes('lain 0') ||
      lower.includes('sisanya 0') ||
      lower.includes('lainnya habis');
    const updatedIds = new Set<string>();
    const details: { name: string; qty: number }[] = [];

    // Helper to find best matching menu
    const matchMenu = (term: string): MenuItem | undefined => {
      const cleanTerm = term.trim().toLowerCase();
      // Frozen variants first
      if (
        cleanTerm.includes('mayo frozen5') ||
        cleanTerm.includes('mayo frozen 5') ||
        cleanTerm.includes('frozen5 mayo') ||
        cleanTerm.includes('frozen 5 mayo')
      ) {
        return menus.find((m) => m.nama.toLowerCase().includes('mayo') && m.nama.toLowerCase().includes('5'));
      }
      if (
        cleanTerm.includes('rogut frozen5') ||
        cleanTerm.includes('rogut frozen 5') ||
        cleanTerm.includes('frozen5 rogut') ||
        cleanTerm.includes('frozen 5 rogut')
      ) {
        return menus.find((m) => m.nama.toLowerCase().includes('rogut') && m.nama.toLowerCase().includes('5'));
      }
      if (cleanTerm.includes('kebab frozen') || cleanTerm.includes('frozen kebab')) {
        return menus.find((m) => m.nama.toLowerCase().includes('kebab') && m.variantType === 'frozen');
      }
      if (cleanTerm.includes('mayo frozen10') || cleanTerm.includes('mayo frozen 10')) {
        return menus.find((m) => m.nama.toLowerCase().includes('mayo') && m.nama.toLowerCase().includes('10'));
      }
      if (cleanTerm.includes('rogut frozen10') || cleanTerm.includes('rogut frozen 10')) {
        return menus.find((m) => m.nama.toLowerCase().includes('rogut') && m.nama.toLowerCase().includes('10'));
      }
      if (cleanTerm.includes('risol mayo') || cleanTerm.includes('mayo')) {
        return menus.find((m) => m.nama.toLowerCase() === 'risol mayo');
      }
      if (cleanTerm.includes('risol rogut') || cleanTerm.includes('rogut')) {
        return menus.find((m) => m.nama.toLowerCase() === 'risol rogut');
      }
      if (cleanTerm.includes('kebab')) {
        return menus.find((m) => m.nama.toLowerCase() === 'kebab' && m.variantType !== 'frozen');
      }
      if (cleanTerm.includes('burger')) {
        return menus.find((m) => m.nama.toLowerCase().includes('burger'));
      }
      if (cleanTerm.includes('lumpia')) {
        return menus.find((m) => m.nama.toLowerCase().includes('lumpia'));
      }
      if (cleanTerm.includes('piscok') || cleanTerm.includes('pisang coklat')) {
        return menus.find((m) => m.nama.toLowerCase().includes('pisang') || m.nama.toLowerCase().includes('piscok'));
      }
      if (cleanTerm.includes('tahu')) {
        return menus.find((m) => m.nama.toLowerCase().includes('tahu'));
      }
      if (cleanTerm.includes('ote')) {
        return menus.find((m) => m.nama.toLowerCase().includes('ote'));
      }
      return menus.find((m) => m.nama.toLowerCase().includes(cleanTerm));
    };

    // Split text by comma or newline
    const chunks = rawText.split(/[,;\n]/);
    for (const chunk of chunks) {
      let trimmed = chunk.trim();
      // Strip 'update stok' and optional date at the start of any chunk
      trimmed = trimmed.replace(/^update\s+stok\s*(?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)?/i, '').trim();
      trimmed = trimmed.replace(/^stok\s*(?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)?[:=]?/i, '').trim();

      if (!trimmed) continue;
      const lowerTrimmed = trimmed.toLowerCase();
      if (
        lowerTrimmed === 'lainnya 0' ||
        lowerTrimmed === 'lain 0' ||
        lowerTrimmed === 'sisanya 0' ||
        lowerTrimmed === 'lainnya habis' ||
        lowerTrimmed === 'sisanya habis'
      ) {
        continue;
      }

      const match = trimmed.match(/(.+?)\s*[:=]?\s*(\d+)\s*(?:pcs|biji|pack|box)?$/i);
      if (match) {
        const itemTerm = match[1].trim();
        const qty = parseInt(match[2], 10);
        const menuObj = matchMenu(itemTerm);
        if (menuObj) {
          updatedIds.add(menuObj.id);
          details.push({ name: menuObj.nama, qty });
        }
      } else if (lowerTrimmed.includes('habis') || lowerTrimmed.includes('kosong')) {
        const itemTerm = trimmed.replace(/habis|kosong/gi, '').trim();
        const menuObj = matchMenu(itemTerm);
        if (menuObj) {
          updatedIds.add(menuObj.id);
          details.push({ name: menuObj.nama, qty: 0 });
        }
      }
    }

    if (details.length === 0 && !zeroOthers) {
      return {
        success: false,
        targetPeriod,
        updatedCount: 0,
        menus,
        message: 'Format tidak dikenali. Contoh: "Update stok Risol Mayo 30, Rogut 30, Burger 10, Kebab Frozen 0, lainnya 0"',
      };
    }

    const updatedMenus = menus.map((m) => {
      const matchDetail = details.find((d) => d.name === m.nama);
      if (matchDetail) {
        return {
          ...m,
          stokHarian: matchDetail.qty,
          sisaStok: matchDetail.qty,
          tersedia: matchDetail.qty > 0,
          tersediaBesok: isTomorrow ? matchDetail.qty > 0 : m.tersediaBesok,
        };
      } else if (zeroOthers) {
        return {
          ...m,
          stokHarian: 0,
          sisaStok: 0,
          tersedia: false,
          tersediaBesok: isTomorrow ? false : m.tersediaBesok,
        };
      }
      return m;
    });

    this.saveMenus(updatedMenus);

    // Build friendly report lines
    const lines = details.map(
      (d) => `${d.qty > 0 ? '✓' : '❌'} *${d.name}:* ${d.qty} pcs (${d.qty > 0 ? 'Ready' : 'HABIS'})`
    );
    if (zeroOthers) {
      lines.push('❌ *Menu Lainnya:* 0 (HABIS / Non-Aktif)');
    }

    const reportMsg = `🌱 *UPDATE STOK BERHASIL DITERAPKAN!*
🏢 _Dulang Indonesia - Sidoarjo_
📅 _Periode: ${targetPeriod}_
━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n')}
━━━━━━━━━━━━━━━━━━━━━
🔄 *Status:* Tersinkronisasi dua arah ke Layar Kasir DULANG-3 & WA Bot!
💡 _Bot WA otomatis menolak pesanan menu yang habis & memotong sisa stok jika laku._`;

    return {
      success: true,
      targetPeriod,
      updatedCount: details.length,
      menus: updatedMenus,
      message: reportMsg,
    };
  },

  // --- CUSTOMER MANAGEMENT ---
  getCustomers(): Customer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read customers from localStorage:', e);
    }
    return INITIAL_CUSTOMERS;
  },

  clearCustomers(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_customers_updated'));
      }
    } catch (e) {
      console.error('Failed to clear customers:', e);
    }
  },

  resetDemoCustomers(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_customers_updated'));
      }
    } catch (e) {
      console.error('Failed to reset demo customers:', e);
    }
  },

  async fetchCustomersFromCloud(): Promise<Customer[]> {
    const client = getSupabaseClient();
    if (!client) return this.getCustomers();

    try {
      const { data, error } = await client
        .from('customers')
        .select('*')
        .order('last_scan_at', { ascending: false });

      if (!error && data && Array.isArray(data) && data.length > 0) {
        const local = this.getCustomers();
        const map = new Map<string, Customer>();
        data.forEach((c: Customer) => map.set(c.qr_code_id.toUpperCase(), c));
        local.forEach((c) => {
          if (!map.has(c.qr_code_id.toUpperCase())) {
            map.set(c.qr_code_id.toUpperCase(), c);
          }
        });
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('dulang_customers_updated'));
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed to fetch customers from Supabase:', e);
    }
    return this.getCustomers();
  },

  subscribeToCustomers(
    onCustomerChange: (customer: Customer, eventType: 'INSERT' | 'UPDATE') => void
  ): () => void {
    const client = getSupabaseClient();
    if (!client) return () => {};

    try {
      const channel = client
        .channel('realtime_dulang_customers')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'customers',
          },
          (payload) => {
            if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
              const cust = payload.new as Customer;
              const current = storageService.getCustomers();
              const cleanQr = cust.qr_code_id ? cust.qr_code_id.toUpperCase() : '';
              const existingIdx = current.findIndex(
                (c) => (cleanQr && c.qr_code_id.toUpperCase() === cleanQr) || c.id === cust.id
              );
              let updatedList: Customer[];
              if (existingIdx >= 0) {
                updatedList = [...current];
                updatedList[existingIdx] = cust;
              } else {
                updatedList = [cust, ...current];
              }
              localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedList));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('dulang_customers_updated'));
              }
              onCustomerChange(cust, payload.eventType as 'INSERT' | 'UPDATE');
            }
          }
        )
        .subscribe((status) => {
          console.log('[Dulang Realtime] Subscription status:', status);
        });

      return () => {
        try {
          client.removeChannel(channel);
        } catch (e) {
          console.warn('Error removing realtime channel:', e);
        }
      };
    } catch (e) {
      console.warn('Realtime subscription error:', e);
      return () => {};
    }
  },

  getCustomerByQR(qrId: string): Customer | null {
    const customers = this.getCustomers();
    const cleanId = qrId.trim().toUpperCase();
    return customers.find((c) => c.qr_code_id.toUpperCase() === cleanId) || null;
  },

  async saveCustomer(customerData: Omit<Customer, 'id' | 'total_orders' | 'status' | 'first_scan_at' | 'last_scan_at'> & {
    id?: string;
    total_orders?: number;
  }): Promise<Customer> {
    const customers = this.getCustomers();
    const cleanQrId = customerData.qr_code_id.trim().toUpperCase();
    const existing = customers.find((c) => c.qr_code_id.toUpperCase() === cleanQrId);
    const now = new Date().toISOString();

    let updated: Customer;

    if (existing) {
      const orders = (customerData.total_orders ?? existing.total_orders) + 1;
      const status = orders >= 5 ? 'Sultan Dulang' : orders >= 2 ? 'Setia' : 'Baru';

      updated = {
        ...existing,
        ...customerData,
        id: existing.id,
        qr_code_id: cleanQrId,
        total_orders: orders,
        status,
        last_scan_at: now,
      };

      const newList = customers.map((c) => (c.qr_code_id.toUpperCase() === cleanQrId ? updated : c));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(newList));
    } else {
      const orders = 1;
      const status = 'Baru';

      updated = {
        ...customerData,
        id: customerData.id || `cust-${Date.now()}`,
        qr_code_id: cleanQrId,
        total_orders: orders,
        status,
        first_scan_at: now,
        last_scan_at: now,
        consent_at: customerData.consent_at || now,
      };

      const newList = [updated, ...customers];
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(newList));
    }

    // Trigger local update event so any active view refreshes instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_customers_updated'));
    }

    // Cloud sync to Supabase if configured
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('customers').upsert(updated);
      } catch (err) {
        console.warn('Supabase customer sync skipped:', err);
      }
    }

    return updated;
  },

  async repeatOrder(qrId: string): Promise<Customer | null> {
    const customer = this.getCustomerByQR(qrId);
    if (!customer) return null;
    return this.saveCustomer({
      ...customer,
      total_orders: customer.total_orders,
    });
  },

  deleteCustomer(id: string): void {
    const customers = this.getCustomers().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_customers_updated'));
    }

    const client = getSupabaseClient();
    if (client) {
      client.from('customers').delete().eq('id', id).then();
    }
  },

  saveCustomers(customers: Customer[]): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_customers_updated'));
    }
  },

  // --- QR CODES MANAGEMENT ---
  getQRCodes(): QRCodeRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QR_CODES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read QR codes from localStorage:', e);
    }
    return [
      { id: 'DULANG-042', hmac: 'a8b9c1d2e3f40516', status: 'claimed', print_batch: 'BATCH-001', created_at: new Date().toISOString() },
      { id: 'DULANG-015', hmac: 'b1c2d3e4f5061728', status: 'claimed', print_batch: 'BATCH-001', created_at: new Date().toISOString() },
      { id: 'DULANG-088', hmac: 'c3d4e5f607182930', status: 'claimed', print_batch: 'BATCH-001', created_at: new Date().toISOString() },
      { id: 'DULANG-A7K9P2XQ', hmac: '7f9e8d7c6b5a4321', status: 'unused', print_batch: 'BATCH-002', created_at: new Date().toISOString() },
      { id: 'DULANG-4B2Z8L1M', hmac: '12345678abcdef01', status: 'unused', print_batch: 'BATCH-002', created_at: new Date().toISOString() },
    ];
  },

  async saveQRCodes(records: QRCodeRecord[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.QR_CODES, JSON.stringify(records));
      const client = getSupabaseClient();
      if (client) {
        await client.from('qr_codes').upsert(records);
      }
    } catch (e) {
      console.error('Failed to save QR codes:', e);
    }
  },

  // --- OWNER AUTHENTICATION STATE & PIN ---
  isOwnerAuthenticated(): boolean {
    return isOwnerSessionValid() || localStorage.getItem(STORAGE_KEYS.OWNER_TOKEN) === 'true';
  },

  setOwnerAuthenticated(val: boolean): void {
    if (val) {
      createOwnerSession();
      localStorage.setItem(STORAGE_KEYS.OWNER_TOKEN, 'true');
    } else {
      clearOwnerSession();
      localStorage.removeItem(STORAGE_KEYS.OWNER_TOKEN);
    }
  },

  getOwnerPin(): string {
    const saved = localStorage.getItem('dulang_owner_pin');
    return saved || 'dulang2020';
  },

  async saveOwnerPin(newPin: string): Promise<void> {
    const clean = newPin.trim();
    const hashed = await hashPassword(clean);
    localStorage.setItem('dulang_owner_pin', hashed);
  },

  async verifyOwnerPin(inputPin: string): Promise<boolean> {
    const stored = this.getOwnerPin();
    return verifyPassword(inputPin, stored);
  },

  // --- STORE CONFIG (HERO IMAGE, SCHEDULE, ETC) ---
  getStoreConfig(): StoreConfig {
    try {
      const data = localStorage.getItem('dulang_store_config');
      if (data) {
        const parsed = JSON.parse(data);
        return { ...DEFAULT_STORE_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to read store config from localStorage:', e);
    }
    return DEFAULT_STORE_CONFIG;
  },

  saveStoreConfig(config: StoreConfig): void {
    try {
      localStorage.setItem('dulang_store_config', JSON.stringify(config));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_store_config_updated'));
      }
    } catch (e) {
      console.error('Failed to save store config:', e);
    }
  },

  // --- VOUCHER & KUPON DISKON MANAGEMENT ---
  getVouchers(): Voucher[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VOUCHERS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read vouchers from localStorage:', e);
    }
    return DEFAULT_VOUCHERS;
  },

  clearVouchers(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_vouchers_updated'));
      }
    } catch (e) {
      console.error('Failed to clear vouchers:', e);
    }
  },

  resetDemoVouchers(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(DEFAULT_VOUCHERS));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_vouchers_updated'));
      }
    } catch (e) {
      console.error('Failed to reset demo vouchers:', e);
    }
  },

  // --- METODE PEMBERSIHAN DATA KHUSUS SISI PEMILIK (OWNER ONLY) ---
  clearAllDemoData(): void {
    this.clearCustomers();
    this.clearOrders();
    this.clearExpenses();
    this.clearTestimonials();
    this.clearVouchers();
  },

  purgeDemoDataOnce(): void {
    try {
      const flagKey = 'dulang_demo_purged_v3';
      if (typeof window !== 'undefined' && localStorage.getItem(flagKey)) return;

      const orders = this.getOrders().filter(
        (o) => !o.id.startsWith('ORD-10') && !o.id.startsWith('ORD-DEMO')
      );
      this.saveOrders(orders);

      const customers = this.getCustomers().filter(
        (c) => !c.id.startsWith('cust-') && !c.id.startsWith('DEMO-')
      );
      this.saveCustomers(customers);

      const expenses = this.getExpenses().filter(
        (e) => !e.id.startsWith('EXP-0') && !e.id.startsWith('EXP-DEMO')
      );
      this.saveExpenses(expenses);

      const testimonials = this.getTestimonials().filter(
        (t) => !t.id.startsWith('testi-')
      );
      this.saveTestimonials(testimonials);

      const vouchers = this.getVouchers().filter(
        (v) => !v.code.startsWith('DULANG') && !v.code.startsWith('SEGERA') && !v.code.startsWith('SERBU')
      );
      this.saveVouchers(vouchers);

      if (typeof window !== 'undefined') {
        localStorage.setItem(flagKey, 'true');
      }
    } catch (e) {
      console.warn('Failed to purge demo data:', e);
    }
  },

  resetAllDemoData(): void {
    this.resetDemoCustomers();
    this.resetDemoVouchers();
    this.resetDemoOrders();
    this.resetDemoTestimonials();
    this.resetDemoExpenses();
  },

  async saveVouchers(vouchers: Voucher[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_vouchers_updated'));
      }
      const client = getSupabaseClient();
      if (client) {
        await client.from('vouchers').upsert(vouchers);
      }
    } catch (e) {
      console.error('Failed to save vouchers:', e);
    }
  },

  async saveVoucher(voucher: Voucher): Promise<void> {
    const list = this.getVouchers();
    const cleanCode = voucher.code.trim().toUpperCase();
    const idx = list.findIndex((v) => v.code.toUpperCase() === cleanCode);
    const updatedVoucher = { ...voucher, code: cleanCode };
    let updatedList: Voucher[];
    if (idx >= 0) {
      updatedList = [...list];
      updatedList[idx] = updatedVoucher;
    } else {
      updatedList = [updatedVoucher, ...list];
    }
    await this.saveVouchers(updatedList);
  },

  async deleteVoucher(code: string): Promise<void> {
    const list = this.getVouchers();
    const cleanCode = code.trim().toUpperCase();
    const updated = list.filter((v) => v.code.toUpperCase() !== cleanCode);
    await this.saveVouchers(updated);
  },

  findVoucher(code: string): Voucher | undefined {
    const list = this.getVouchers();
    const cleanCode = code.trim().toUpperCase();
    return list.find((v) => v.code.toUpperCase() === cleanCode);
  },

  validateVoucher(
    code: string,
    subtotal: number
  ): {
    valid: boolean;
    reason?: 'not_found' | 'used' | 'min_order' | 'expired';
    message: string;
    discountAmount: number;
    voucher?: Voucher;
  } {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return {
        valid: false,
        reason: 'not_found',
        message: 'Silakan masukkan kode voucher terlebih dahulu yaa 😊',
        discountAmount: 0,
      };
    }

    const voucher = this.findVoucher(cleanCode);
    if (!voucher) {
      return {
        valid: false,
        reason: 'not_found',
        message: `Ups! Kode voucher "${cleanCode}" belum terdaftar di dapur nih. Cek kembali ejaan hurufnya ya, Kak! 😊`,
        discountAmount: 0,
      };
    }

    if (voucher.isUsed) {
      return {
        valid: false,
        reason: 'used',
        message: `Voucher "${cleanCode}" sudah pernah dipakai sebelumnya. Mau ngobrol sama Tim Dulang Indonesia buat traktiran lain? 💬`,
        discountAmount: 0,
        voucher,
      };
    }

    if (voucher.expiredAt && new Date(voucher.expiredAt) < new Date()) {
      return {
        valid: false,
        reason: 'expired',
        message: `Masa berlaku voucher "${cleanCode}" sudah lewat nih. Yuk chat Tim Dulang buat kode promo teranyar! 🥟`,
        discountAmount: 0,
        voucher,
      };
    }

    if (subtotal < voucher.minOrder) {
      return {
        valid: false,
        reason: 'min_order',
        message: `Sedikit lagi! Voucher ini bisa dipakai dengan minimal belanja Rp ${voucher.minOrder.toLocaleString('id-ID')} (pesananmu saat ini Rp ${subtotal.toLocaleString('id-ID')}). Tambah 1 menu favorit lagi yuk!`,
        discountAmount: 0,
        voucher,
      };
    }

    let discountAmount = 0;
    if (voucher.discountType === 'nominal') {
      discountAmount = Math.min(voucher.discountValue, subtotal);
    } else {
      discountAmount = Math.round((subtotal * voucher.discountValue) / 100);
    }

    return {
      valid: true,
      message: `Voucher aktif! Selamat menikmati potongan Rp ${discountAmount.toLocaleString('id-ID')} dari Tim Dulang Indonesia ✨`,
      discountAmount,
      voucher,
    };
  },

  async markVoucherUsed(code: string, customerWa?: string): Promise<{ childPerkUnlocked?: any; childCode?: string }> {
    const list = this.getVouchers();
    const cleanCode = code.trim().toUpperCase();
    const idx = list.findIndex((v) => v.code.toUpperCase() === cleanCode);
    let childPerkUnlocked: any;
    let childCode: string | undefined;

    if (idx >= 0) {
      const parent = list[idx];
      const updatedList = [...list];
      updatedList[idx] = {
        ...parent,
        isUsed: true,
        usedAt: new Date().toISOString(),
        usedByWa: customerWa,
      };
      await this.saveVouchers(updatedList);

      // Otomatis "Voucher Beranak": Jika voucher memiliki childVoucher perk, aktifkan child voucher & simpan Golden Ticket
      if (parent.childVoucher) {
        childCode = (parent.childVoucher.unlockCode || `${parent.code}-BONUS`).trim().toUpperCase();
        childPerkUnlocked = parent.childVoucher;

        // 1. Simpan voucher anak ke daftar voucher aktif
        await this.saveVoucher({
          code: childCode,
          recipientName: parent.recipientName,
          discountType: 'nominal',
          discountValue: 10000,
          minOrder: 30000,
          description: `${parent.childVoucher.title} (${parent.childVoucher.perk})`,
          isUsed: false,
          createdAt: new Date().toISOString(),
        });

        // 2. Catat ke Golden Tickets pembeli
        this.saveGoldenTicket({
          id: `TICKET-${Date.now()}`,
          parentCode: parent.code,
          title: parent.childVoucher.title,
          perk: parent.childVoucher.perk,
          unlockCode: childCode,
          condition: parent.childVoucher.condition,
          recipientName: parent.recipientName,
          unlockedAt: new Date().toISOString(),
          isClaimed: false,
        });
      }
    }

    return { childPerkUnlocked, childCode };
  },

  // --- GOLDEN TICKET / VOUCHER BERANAK METHODS ---
  getGoldenTickets(): GoldenTicketRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GOLDEN_TICKETS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read golden tickets:', e);
    }
    return [];
  },

  saveGoldenTicket(ticket: GoldenTicketRecord): void {
    const list = this.getGoldenTickets();
    const updated = [ticket, ...list.filter((t) => t.id !== ticket.id)];
    try {
      localStorage.setItem(STORAGE_KEYS.GOLDEN_TICKETS, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_golden_tickets_updated'));
      }
    } catch (e) {
      console.error('Failed to save golden ticket:', e);
    }
  },

  claimGoldenTicket(id: string): void {
    const list = this.getGoldenTickets();
    const updated = list.map((t) => (t.id === id ? { ...t, isClaimed: true } : t));
    try {
      localStorage.setItem(STORAGE_KEYS.GOLDEN_TICKETS, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_golden_tickets_updated'));
      }
    } catch (e) {
      console.error('Failed to claim golden ticket:', e);
    }
  },

  // --- BIRTHDAY RECOGNITION METHODS ---
  getCustomersWithBirthdayThisMonth(targetMonth?: number): Customer[] {
    const month = targetMonth !== undefined ? targetMonth : new Date().getMonth() + 1; // 1-12
    const customers = this.getCustomers();
    return customers.filter((c) => c.birth_month === month);
  },

  getCustomersWithBirthdayToday(): Customer[] {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const customers = this.getCustomers();
    return customers.filter((c) => c.birth_month === month && c.birth_day === day);
  },

  // --- ORDER & SALES TRANSACTIONS (PENCATATAN KASIR DAPUR) ---
  getOrders(): OrderRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read orders from localStorage:', e);
    }
    return DEFAULT_ORDERS;
  },

  saveOrders(orders: OrderRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
      }
    } catch (e) {
      console.error('Failed to save orders:', e);
    }
  },

  addOrder(orderData: Omit<OrderRecord, 'id' | 'created_at'>): OrderRecord {
    const list = this.getOrders();
    const newOrder: OrderRecord = {
      ...orderData,
      id: `ORD-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newOrder, ...list];
    this.saveOrders(updated);

    // Kurangi kuota stok porsi otomatis jika item menu memiliki kuota
    if (newOrder.items && newOrder.items.length > 0) {
      this.deductStockForOrder(newOrder.items);
    }

    return newOrder;
  },

  /**
   * Terima dan catat pesanan otomatis dari WhatsApp Bot / Bridge
   */
  addOrderFromWhatsApp(waData: {
    orderId?: string;
    customerName?: string;
    customerPhone?: string;
    items?: { name: string; price: number; qty: number; variant?: 'matang' | 'frozen' }[];
    total?: number;
    method?: string;
    deliveryType?: 'PICKUP' | 'DELIVERY';
    area?: string;
    ongkir?: number;
    rawText?: string;
  }): OrderRecord {
    const list = this.getOrders();
    if (waData.orderId) {
      const existing = list.find((o) => o.id === waData.orderId);
      if (existing) return existing;
    }

    const currentMenus = this.getMenus();
    const orderItems: OrderItem[] = (waData.items || []).map((i) => {
      const matched = currentMenus.find((m) => m.nama.toLowerCase().includes(i.name.toLowerCase()));
      return {
        menu_id: matched ? matched.id : `menu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nama: i.name,
        harga: i.price,
        qty: i.qty,
        variantType: i.variant || (i.name.toLowerCase().includes('frozen') ? 'frozen' : 'matang'),
      };
    });

    const meth = (waData.method || '').toLowerCase();
    const isTransfer = meth.includes('transfer') || meth.includes('bca');
    const isQris = meth.includes('qris');
    const payMethod: PaymentMethod = isQris ? 'qris' : (isTransfer ? 'transfer' : 'tunai');

    const newOrder: OrderRecord = {
      id: waData.orderId || `ORD-${Date.now().toString().slice(-4)}`,
      customer_name: waData.customerName || 'Pelanggan WhatsApp',
      customer_wa: waData.customerPhone || '6289999990001',
      items: orderItems,
      total_price: waData.total || orderItems.reduce((acc, it) => acc + (it.harga * it.qty), 0),
      status: 'menunggu',
      payment_method: payMethod,
      channel: 'web_wa',
      delivery_method: waData.deliveryType === 'DELIVERY' ? 'delivery' : 'pickup',
      shipping_district: waData.area || (waData.deliveryType === 'DELIVERY' ? 'Sidoarjo' : 'Dapur Dulang'),
      shipping_cost: waData.ongkir || 0,
      notes: `Pesanan via WhatsApp: ${waData.rawText || (waData.deliveryType === 'DELIVERY' ? `Kirim ke ${waData.area}` : 'Ambil Sendiri di Dapur')}`,
      created_at: new Date().toISOString(),
    };

    const updated = [newOrder, ...list];
    this.saveOrders(updated);

    if (newOrder.items && newOrder.items.length > 0) {
      this.deductStockForOrder(newOrder.items);
    }

    return newOrder;
  },

  /**
   * Parse natural order string (e.g. "mayo 2, rogut 3, piscok 2") and save as OrderRecord!
   * Built-in NLU with typo & slang tolerance for DULANG-3
   */
  parseAndAddNaturalOrder(
    rawText: string,
    options: {
      customerName?: string;
      customerWa?: string;
      channel?: 'web_wa' | 'walk_in';
      status?: OrderStatus;
      paymentMethod?: PaymentMethod;
      deliveryMethod?: 'pickup' | 'delivery';
      shippingDistrict?: string;
      shippingCost?: number;
    } = {}
  ): { success: boolean; order?: OrderRecord; message: string; itemsParsed: { nama: string; qty: number; harga: number; subtotal: number }[] } {
    const slangMap: Record<string, string> = {
      myo: 'mayo',
      rgt: 'rogut',
      pcok: 'piscok',
      krm: 'kirim',
      hrg: 'harga',
      brp: 'berapa',
      brapa: 'berapa',
      ap: 'apa',
      aj: 'aja',
      skrg: 'sekarang',
      bs: 'bisa',
      blm: 'belum',
      sdh: 'sudah',
      uda: 'sudah',
      udh: 'sudah',
      dmana: 'dimana',
      bwt: 'buat',
      ta: 'kah',
    };

    const cleaned = rawText.toLowerCase().replace(/[?!]/g, ' ');
    const normalized = cleaned
      .split(/\s+/)
      .map((w) => {
        const trailingComma = w.endsWith(',') ? ',' : '';
        const cleanW = w.replace(/,/g, '');
        const mapped = slangMap[cleanW] || cleanW;
        return mapped + trailingComma;
      })
      .join(' ');

    const lower = normalized.toLowerCase();
    const menus = this.getMenus();

    // 1. Detect Payment Method
    let payMethod: PaymentMethod = options.paymentMethod || 'tunai';
    if (lower.includes('qris')) payMethod = 'qris';
    else if (lower.includes('transfer') || lower.includes('bca') || lower.includes('mandiri')) payMethod = 'transfer';
    else if (lower.includes('tunai') || lower.includes('cash') || lower.includes('cod')) payMethod = 'tunai';

    // 2. Detect Delivery Method & Destination
    let delivMethod: 'pickup' | 'delivery' = options.deliveryMethod || 'pickup';
    let district: string | undefined = options.shippingDistrict;
    let shippingCost: number = options.shippingCost || 0;

    if (lower.includes('kirim') || lower.includes('delivery') || lower.includes('waru') || lower.includes('buduran') || lower.includes('taman') || lower.includes('sidoarjo') || lower.includes('candi') || lower.includes('gedangan')) {
      delivMethod = 'delivery';
      if (lower.includes('waru')) { district = 'Waru'; shippingCost = 12000; }
      else if (lower.includes('buduran')) { district = 'Buduran'; shippingCost = 8000; }
      else if (lower.includes('taman')) { district = 'Taman'; shippingCost = 12000; }
      else if (lower.includes('candi')) { district = 'Candi'; shippingCost = 10000; }
      else if (lower.includes('gedangan')) { district = 'Gedangan'; shippingCost = 10000; }
      else { district = 'Sidoarjo Kota'; shippingCost = 8000; }
    } else if (lower.includes('ambil') || lower.includes('pickup') || lower.includes('dapur')) {
      delivMethod = 'pickup';
      district = 'Ambil Sendiri di Dapur';
      shippingCost = 0;
    }

    // 3. Parse Clauses
    const cleanClausesText = lower
      .replace(/\bpesan\b|\bmau\b|\border\b|\blaku\b|\bterjual\b|\btunai\b|\bcash\b|\bqris\b|\btransfer\b|\bambil\b|\bdelivery\b|\bkirim\b/gi, '')
      .replace(/\bwaru\b|\bbuduran\b|\btaman\b|\bsidoarjo\b|\bcandi\b|\bgedangan\b/gi, '');

    const clauses = cleanClausesText.split(/,|\bdan\b|\+/i).map((s) => s.trim()).filter(Boolean);
    const parsedItems: { menu_id: string; nama: string; qty: number; harga: number; subtotal: number; pilihanOpsi?: string; variantType?: 'matang' | 'frozen' }[] = [];
    let lastMenu: MenuItem | null = null;

    for (const clause of clauses) {
      let bestMenu: MenuItem | null = null;
      let qty = 1;
      let note = '';
      const numMatch = clause.match(/\b(\d+)\s*(?:pack|box|pcs|biji|buah|porsi)?\b/);
      if (numMatch) qty = parseInt(numMatch[1], 10);

      const isFrozen = clause.includes('frozen') || clause.includes('beku');
      const isPedas = clause.includes('pedas') || clause.includes('pedes');
      const isOri = clause.includes('ori') || clause.includes('original');

      if (isPedas) note = 'Pedas';
      else if (isOri) note = 'Original';

      // Match against menus
      for (const m of menus) {
        const mLower = m.nama.toLowerCase();
        // Check tokens
        const tokens = mLower.replace(/[()]/g, '').split(' ').filter((w) => w.length > 2);
        if (tokens.some((t) => clause.includes(t))) {
          bestMenu = m;
          lastMenu = m;
          break;
        }
      }

      // Inherit if only variant specified
      if (!bestMenu && lastMenu && (isPedas || isOri || isFrozen)) {
        bestMenu = lastMenu;
      }

      if (bestMenu) {
        const sub = qty * bestMenu.harga;
        parsedItems.push({
          menu_id: bestMenu.id,
          nama: `${bestMenu.nama}${note ? ` (${note})` : ''}`,
          qty,
          harga: bestMenu.harga,
          subtotal: sub,
          pilihanOpsi: note || undefined,
          variantType: isFrozen ? 'frozen' : 'matang',
        });
      }
    }

    if (parsedItems.length === 0) {
      return {
        success: false,
        message: 'Tidak ada item menu yang terdeteksi dari teks pesanan.',
        itemsParsed: [],
      };
    }

    // Aggregate identical items
    const aggregatedMap = new Map<string, { menu_id: string; nama: string; qty: number; harga: number; subtotal: number; pilihanOpsi?: string; variantType?: 'matang' | 'frozen' }>();
    for (const it of parsedItems) {
      if (aggregatedMap.has(it.nama)) {
        const prev = aggregatedMap.get(it.nama)!;
        prev.qty += it.qty;
        prev.subtotal += it.subtotal;
      } else {
        aggregatedMap.set(it.nama, { ...it });
      }
    }
    const finalItems = Array.from(aggregatedMap.values());
    const itemsTotal = finalItems.reduce((acc, it) => acc + it.subtotal, 0);
    const grandTotal = itemsTotal + shippingCost;

    const newOrderData: Omit<OrderRecord, 'id' | 'created_at'> = {
      customer_name: options.customerName || 'Pelanggan WhatsApp',
      customer_wa: options.customerWa,
      items: finalItems.map((fi) => ({
        menu_id: fi.menu_id,
        nama: fi.nama,
        harga: fi.harga,
        qty: fi.qty,
        pilihanOpsi: fi.pilihanOpsi,
        variantType: fi.variantType,
      })),
      total_price: grandTotal,
      payment_method: payMethod,
      status: options.status || 'lunas',
      completed_at: (options.status || 'lunas') === 'lunas' ? new Date().toISOString() : undefined,
      channel: options.channel || 'web_wa',
      delivery_method: delivMethod,
      shipping_cost: shippingCost > 0 ? shippingCost : undefined,
      shipping_district: district,
      notes: `Input Cepat WA: "${rawText}"`,
    };

    const createdOrder = this.addOrder(newOrderData);
    this.updateCustomerIntelligence(createdOrder);

    return {
      success: true,
      order: createdOrder,
      message: `Pesanan #${createdOrder.id} berhasil dicatat! (${finalItems.map((i) => `${i.qty}x ${i.nama}`).join(', ')}) Total: Rp ${grandTotal.toLocaleString('id-ID')}`,
      itemsParsed: finalItems,
    };
  },

  updateOrderStatus(orderId: string, status: OrderStatus, paymentMethod?: PaymentMethod): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const existing = list[idx];
    const updatedOrder: OrderRecord = {
      ...existing,
      status,
      payment_method: paymentMethod || existing.payment_method,
      completed_at: status === 'lunas' ? new Date().toISOString() : existing.completed_at,
    };

    const updatedList = [...list];
    updatedList[idx] = updatedOrder;
    this.saveOrders(updatedList);

    // Jika berstatus lunas, otomatis mutakhirkan profil preferensi pelanggan (si A sukanya apa)
    if (status === 'lunas' && updatedOrder.customer_name) {
      this.updateCustomerIntelligence(updatedOrder);
    }
    return updatedOrder;
  },

  updateCustomerIntelligence(order: OrderRecord): void {
    try {
      const customers = this.getCustomers();
      const cleanQr = order.customer_qr_id ? order.customer_qr_id.toUpperCase() : '';
      const cleanWa = order.customer_wa ? order.customer_wa.replace(/\D/g, '') : '';
      const cleanName = order.customer_name.trim().toLowerCase();

      let custIdx = customers.findIndex(
        (c) =>
          (cleanQr && c.qr_code_id.toUpperCase() === cleanQr) ||
          (cleanWa && c.wa && c.wa.replace(/\D/g, '') === cleanWa) ||
          (c.name.trim().toLowerCase() === cleanName)
      );

      // Hitung dari seluruh pesanan yang sudah lunas milik pelanggan ini
      const allOrders = this.getOrders().filter((o) => o.status === 'lunas');
      const custOrders = allOrders.filter(
        (o) =>
          (cleanQr && o.customer_qr_id && o.customer_qr_id.toUpperCase() === cleanQr) ||
          (cleanWa && o.customer_wa && o.customer_wa.replace(/\D/g, '') === cleanWa) ||
          (o.customer_name.trim().toLowerCase() === cleanName)
      );

      const menuCounts: Record<string, number> = {};
      const optionCounts: Record<string, number> = {};
      let totalSpent = 0;

      custOrders.forEach((o) => {
        totalSpent += o.total_price || 0;
        o.items.forEach((it) => {
          menuCounts[it.nama] = (menuCounts[it.nama] || 0) + it.qty;
          if (it.pilihanOpsi) {
            optionCounts[it.pilihanOpsi] = (optionCounts[it.pilihanOpsi] || 0) + it.qty;
          }
        });
      });

      const topMenu = Object.entries(menuCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const topOption = Object.entries(optionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      if (custIdx >= 0) {
        const cust = customers[custIdx];
        const updatedCust: Customer = {
          ...cust,
          total_orders: Math.max(cust.total_orders, custOrders.length),
          total_spent: totalSpent,
          favorite_menu: topMenu || cust.favorite_menu,
          favorite_option: topOption || cust.favorite_option,
          status: custOrders.length >= 5 ? 'Sultan Dulang' : custOrders.length >= 2 ? 'Setia' : 'Baru',
        };
        const updatedList = [...customers];
        updatedList[custIdx] = updatedCust;
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedList));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('dulang_customers_updated'));
        }
      }
    } catch (e) {
      console.warn('Failed to update customer intelligence:', e);
    }
  },

  clearOrders(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
      }
    } catch (e) {
      console.error('Failed to clear orders:', e);
    }
  },

  resetDemoOrders(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
      }
    } catch (e) {
      console.error('Failed to reset demo orders:', e);
    }
  },

  // --- CUSTOMER TESTIMONIALS (PENDAPAT PELANGGAN) ---
  getTestimonials(): CustomerTestimonial[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TESTIMONIALS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read testimonials from localStorage:', e);
    }
    return DEFAULT_TESTIMONIALS;
  },

  saveTestimonials(testimonials: CustomerTestimonial[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(testimonials));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
      }
    } catch (e) {
      console.error('Failed to save testimonials:', e);
    }
  },

  addTestimonial(data: Omit<CustomerTestimonial, 'id' | 'created_at'>): CustomerTestimonial {
    const list = this.getTestimonials();
    const newTesti: CustomerTestimonial = {
      ...data,
      id: `testi-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newTesti, ...list];
    this.saveTestimonials(updated);
    return newTesti;
  },

  toggleTestimonial(id: string): CustomerTestimonial | null {
    const list = this.getTestimonials();
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    const toggled = { ...list[idx], is_active: !list[idx].is_active };
    list[idx] = toggled;
    this.saveTestimonials(list);
    return toggled;
  },

  deleteTestimonial(id: string): void {
    const list = this.getTestimonials();
    const updated = list.filter((t) => t.id !== id);
    this.saveTestimonials(updated);
  },

  clearTestimonials(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
      }
    } catch (e) {
      console.error('Failed to clear testimonials:', e);
    }
  },

  resetDemoTestimonials(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(DEFAULT_TESTIMONIALS));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
      }
    } catch (e) {
      console.error('Failed to reset demo testimonials:', e);
    }
  },

  // --- CUSTOMER RECOGNITION (SMART BARCODE) ---
  getActiveCustomerQR(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_CUSTOMER_QR);
    } catch {
      return null;
    }
  },

  setActiveCustomerQR(qrId: string | null): void {
    try {
      if (qrId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CUSTOMER_QR, qrId.toUpperCase().trim());
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CUSTOMER_QR);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_active_customer_updated'));
      }
    } catch (e) {
      console.warn('Failed to set active customer QR:', e);
    }
  },

  getRecognizedCustomer(): Customer | null {
    const activeQr = this.getActiveCustomerQR();
    if (!activeQr) return null;
    return this.getCustomerByQR(activeQr);
  },

  // --- EXPENSES & PROFIT BERSIH (BUKU KAS DAPUR) ---
  getExpenses(): ExpenseRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read expenses from localStorage:', e);
    }
    return DEFAULT_EXPENSES;
  },

  saveExpenses(expenses: ExpenseRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_expenses_updated'));
      }
    } catch (e) {
      console.error('Failed to save expenses:', e);
    }
  },

  addExpense(data: Omit<ExpenseRecord, 'id' | 'created_at'>): ExpenseRecord {
    const list = this.getExpenses();
    const newExp: ExpenseRecord = {
      ...data,
      id: `EXP-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newExp, ...list];
    this.saveExpenses(updated);
    return newExp;
  },

  deleteExpense(id: string): void {
    const list = this.getExpenses();
    const updated = list.filter((e) => e.id !== id);
    this.saveExpenses(updated);
  },

  clearExpenses(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_expenses_updated'));
      }
    } catch (e) {
      console.error('Failed to clear expenses:', e);
    }
  },

  resetDemoExpenses(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(DEFAULT_EXPENSES));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_expenses_updated'));
      }
    } catch (e) {
      console.error('Failed to reset demo expenses:', e);
    }
  },

  // --- BACKUP & RESTORE DATABASE OFFLINE (.JSON) ---
  exportDatabaseBackup(): DulangDatabaseBackup {
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      app_name: 'Dapur Dulang Indonesia',
      menus: this.getMenus(),
      customers: this.getCustomers(),
      orders: this.getOrders(),
      testimonials: this.getTestimonials(),
      vouchers: this.getVouchers(),
      storeConfig: this.getStoreConfig(),
      expenses: this.getExpenses(),
    };
  },

  importDatabaseBackup(backup: any): { success: boolean; message: string } {
    try {
      if (!backup || typeof backup !== 'object') {
        return { success: false, message: 'Format berkas JSON tidak valid.' };
      }

      if (Array.isArray(backup.menus)) {
        localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(backup.menus));
      }
      if (Array.isArray(backup.customers)) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(backup.customers));
      }
      if (Array.isArray(backup.orders)) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(backup.orders));
      }
      if (Array.isArray(backup.testimonials)) {
        localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(backup.testimonials));
      }
      if (Array.isArray(backup.vouchers)) {
        localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(backup.vouchers));
      }
      if (backup.storeConfig && typeof backup.storeConfig === 'object') {
        localStorage.setItem('dulang_store_config', JSON.stringify(backup.storeConfig));
      }
      if (Array.isArray(backup.expenses)) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(backup.expenses));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
        window.dispatchEvent(new Event('dulang_customers_updated'));
        window.dispatchEvent(new Event('dulang_orders_updated'));
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
        window.dispatchEvent(new Event('dulang_vouchers_updated'));
        window.dispatchEvent(new Event('dulang_store_config_updated'));
        window.dispatchEvent(new Event('dulang_expenses_updated'));
      }

      const totalOrders = Array.isArray(backup.orders) ? backup.orders.length : 0;
      const totalCust = Array.isArray(backup.customers) ? backup.customers.length : 0;
      return {
        success: true,
        message: `Database berhasil dipulihkan! (${totalOrders} riwayat pesanan, ${totalCust} data pelanggan).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal memulihkan database: ${err?.message || 'Terjadi kesalahan sistem'}`,
      };
    }
  },

  // --- KALKULATOR KEBUTUHAN BAHAN SUBUH ---
  getSubuhPlans(): SubuhPrepPlan[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUBUH_PLANS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read subuh plans:', e);
    }
    return [];
  },

  saveSubuhPlan(plan: SubuhPrepPlan): void {
    const plans = this.getSubuhPlans();
    const existingIdx = plans.findIndex((p) => p.id === plan.id || p.targetDate === plan.targetDate);
    if (existingIdx >= 0) {
      plans[existingIdx] = plan;
    } else {
      plans.unshift(plan);
    }
    localStorage.setItem(STORAGE_KEYS.SUBUH_PLANS, JSON.stringify(plans));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_subuh_plans_updated'));
    }
  },

  // --- REKAP TUTUP DAPUR MALAM ---
  getKitchenRecaps(): KitchenClosingRecap[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.KITCHEN_RECAPS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read kitchen recaps:', e);
    }
    return [];
  },

  saveKitchenRecap(recap: KitchenClosingRecap): void {
    const recaps = this.getKitchenRecaps();
    const existingIdx = recaps.findIndex((r) => r.id === recap.id || r.recapDate === recap.recapDate);
    if (existingIdx >= 0) {
      recaps[existingIdx] = recap;
    } else {
      recaps.unshift(recap);
    }
    localStorage.setItem(STORAGE_KEYS.KITCHEN_RECAPS, JSON.stringify(recaps));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_kitchen_recaps_updated'));
    }
  },
};

