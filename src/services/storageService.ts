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
  PantryIngredient,
  MenuRecipe,
  KitchenCookingStatus,
  StaffRole,
  StockMovementRecord,
  CashierShift,
  CashierLeaderboardEntry,
} from '../types';
import {
  DEFAULT_MENUS,
  INITIAL_CUSTOMERS,
  DEFAULT_STORE_CONFIG,
  DEFAULT_VOUCHERS,
  DEFAULT_ORDERS,
  DEFAULT_TESTIMONIALS,
  BRAND,
} from '../lib/constants';
import {
  DEFAULT_PANTRY_INGREDIENTS,
  DEFAULT_MENU_RECIPES,
  calculateRecipeHpp,
} from '../lib/defaultRecipes';
import { getSupabaseClient } from '../lib/supabase';
import {
  isOwnerSessionValid,
  createOwnerSession,
  clearOwnerSession,
  getOwnerSessionRole,
  hashPassword,
  verifyPassword,
  DEFAULT_AUTH_HASHES,
  LEGACY_DEFAULT_OWNER_SHA256,
  isHashFormat,
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
  PANTRY_INGREDIENTS: 'dulang_pantry_ingredients_v1',
  MENU_RECIPES: 'dulang_menu_recipes_v1',
  STOCK_MOVEMENTS: 'dulang_stock_movements_v1',
  ACTIVE_SHIFT: 'dulang_active_shift_v1',
  SHIFT_HISTORY: 'dulang_shift_history_v1',
};

const AUTH_HASHES_KEY = 'dulang_auth_hashes_v1';
const DELETED_MENU_IDS_KEY = 'dulang_deleted_menu_ids';
const SYS_STORE_CONFIG_ID = 'sys_store_config';
const SYS_AUTH_META_ID = 'sys_auth_meta';
const SYS_PUBLIC_TESTIMONIALS_ID = 'sys_public_testimonials';

export interface AuthHashesRecord {
  ownerHash: string;
  cashierHash: string;
  kitchenHash: string;
  isDefaultOwnerPin: boolean;
  updatedAt: string;
}

export function sanitizeStoreConfig<T extends Record<string, any>>(cfg: T): Omit<T, 'ownerPin' | 'cashierPin' | 'kitchenPin'> {
  const clean: Record<string, any> = { ...(cfg || {}) };
  delete clean.ownerPin;
  delete clean.cashierPin;
  delete clean.kitchenPin;
  return clean as Omit<T, 'ownerPin' | 'cashierPin' | 'kitchenPin'>;
}

function isSystemOrLegacyMenuId(id?: string): boolean {
  if (!id) return true;
  return id.startsWith('sys_') || id.startsWith('cof-') || id.startsWith('dnt-');
}

const DULANG_MENU_META_PREFIX = '<!--DULANG_MENU_META:';
const DULANG_MENU_META_SUFFIX = '-->';

export interface MenuPackedMeta {
  stokHarian?: number | null;
  sisaStok?: number | null;
  servingType?: 'matang_only' | 'frozen_only' | 'both';
  variantType?: 'matang' | 'frozen';
  tersediaBesok?: boolean;
  kloterBadge?: string;
  opsi?: string[];
  sortOrder?: number;
  deleted?: boolean;
}

export function packMenuDescription(cleanDesc: string | null | undefined, meta: MenuPackedMeta): string {
  const base = (cleanDesc || '').trim();
  const stripped = base.replace(/<!--DULANG_MENU_META:[\s\S]*?-->/g, '').trim();

  const cleanMeta: Record<string, any> = {};
  if (meta.stokHarian !== undefined) cleanMeta.sh = meta.stokHarian;
  if (meta.sisaStok !== undefined) cleanMeta.ss = meta.sisaStok;
  if (meta.servingType) cleanMeta.st = meta.servingType;
  if (meta.variantType) cleanMeta.vt = meta.variantType;
  if (meta.tersediaBesok !== undefined) cleanMeta.tb = meta.tersediaBesok;
  if (meta.kloterBadge) cleanMeta.kb = meta.kloterBadge;
  if (Array.isArray(meta.opsi) && meta.opsi.length > 0) cleanMeta.op = meta.opsi;
  if (meta.sortOrder !== undefined && Number.isFinite(meta.sortOrder)) cleanMeta.so = meta.sortOrder;
  if (meta.deleted) cleanMeta.del = true;

  if (Object.keys(cleanMeta).length === 0) return stripped;
  const jsonStr = JSON.stringify(cleanMeta);
  return stripped
    ? `${stripped}\n${DULANG_MENU_META_PREFIX}${jsonStr}${DULANG_MENU_META_SUFFIX}`
    : `${DULANG_MENU_META_PREFIX}${jsonStr}${DULANG_MENU_META_SUFFIX}`;
}

export function unpackMenuDescription(rawDesc: string | null | undefined): {
  cleanDesc: string;
  meta: MenuPackedMeta;
} {
  if (!rawDesc) return { cleanDesc: '', meta: {} };
  const match = rawDesc.match(/<!--DULANG_MENU_META:([\s\S]*?)-->/);
  const cleanDesc = rawDesc.replace(/<!--DULANG_MENU_META:[\s\S]*?-->/g, '').trim();
  if (!match) return { cleanDesc, meta: {} };
  try {
    const parsed = JSON.parse(match[1]);
    const meta: MenuPackedMeta = {};
    if ('sh' in parsed) meta.stokHarian = parsed.sh === null ? null : Number(parsed.sh);
    if ('ss' in parsed) meta.sisaStok = parsed.ss === null ? null : Number(parsed.ss);
    if (parsed.st) meta.servingType = parsed.st;
    if (parsed.vt) meta.variantType = parsed.vt;
    if ('tb' in parsed) meta.tersediaBesok = Boolean(parsed.tb);
    if (parsed.kb) meta.kloterBadge = parsed.kb;
    if (Array.isArray(parsed.op)) meta.opsi = parsed.op;
    if (parsed.so !== undefined && Number.isFinite(Number(parsed.so))) meta.sortOrder = Number(parsed.so);
    if (parsed.del) meta.deleted = true;
    return { cleanDesc, meta };
  } catch {
    return { cleanDesc, meta: {} };
  }
}

export function buildOrderPackedNotes(order: {
  notes?: string;
  kitchen_status?: KitchenCookingStatus;
  cooking_started_at?: string;
  cooking_completed_at?: string;
  delivery_schedule?: string;
  delivery_slot?: string;
  dp_amount?: number;
  remaining_amount?: number;
  cashier_name?: string;
  print_count?: number;
  last_printed_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
}): string {
  return packOrderNotes(order.notes, {
    kitchen_status: order.kitchen_status,
    cooking_started_at: order.cooking_started_at,
    cooking_completed_at: order.cooking_completed_at,
    delivery_schedule: order.delivery_schedule,
    delivery_slot: order.delivery_slot,
    dp_amount: order.dp_amount,
    remaining_amount: order.remaining_amount,
    cashier_name: order.cashier_name,
    print_count: order.print_count,
    last_printed_at: order.last_printed_at,
    cancellation_reason: order.cancellation_reason,
    cancelled_by: order.cancelled_by,
    cancelled_at: order.cancelled_at,
  });
}

export const DEFAULT_EXPENSES: ExpenseRecord[] = [];

const DULANG_META_PREFIX = '<!--DULANG_META:';
const DULANG_META_SUFFIX = '-->';

export interface OrderPackedMeta {
  kitchen_status?: KitchenCookingStatus;
  cooking_started_at?: string;
  cooking_completed_at?: string;
  delivery_schedule?: string;
  delivery_slot?: string;
  dp_amount?: number;
  remaining_amount?: number;
  cashier_name?: string;
  print_count?: number;
  last_printed_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
}

export function packOrderNotes(cleanNotes: string | null | undefined, meta: OrderPackedMeta): string {
  const base = (cleanNotes || '').trim();
  const stripped = base.replace(/<!--DULANG_META:[\s\S]*?-->/g, '').trim();

  const cleanMeta: Record<string, any> = {};
  if (meta.kitchen_status) cleanMeta.k = meta.kitchen_status;
  if (meta.cooking_started_at) cleanMeta.ks = meta.cooking_started_at;
  if (meta.cooking_completed_at) cleanMeta.kc = meta.cooking_completed_at;
  if (meta.delivery_schedule) cleanMeta.ds = meta.delivery_schedule;
  if (meta.delivery_slot) cleanMeta.slot = meta.delivery_slot;
  if (meta.dp_amount !== undefined && meta.dp_amount > 0) cleanMeta.dp = meta.dp_amount;
  if (meta.remaining_amount !== undefined) cleanMeta.rem = meta.remaining_amount;
  if (meta.cashier_name) cleanMeta.cn = meta.cashier_name;
  if (meta.print_count !== undefined && meta.print_count > 0) cleanMeta.pc = meta.print_count;
  if (meta.last_printed_at) cleanMeta.lpa = meta.last_printed_at;
  if (meta.cancellation_reason) cleanMeta.cr = meta.cancellation_reason;
  if (meta.cancelled_by) cleanMeta.cb = meta.cancelled_by;
  if (meta.cancelled_at) cleanMeta.ca = meta.cancelled_at;

  if (Object.keys(cleanMeta).length === 0) {
    return stripped;
  }

  const jsonStr = JSON.stringify(cleanMeta);
  return stripped ? `${stripped}\n${DULANG_META_PREFIX}${jsonStr}${DULANG_META_SUFFIX}` : `${DULANG_META_PREFIX}${jsonStr}${DULANG_META_SUFFIX}`;
}

export function unpackOrderNotes(rawNotes: string | null | undefined): { cleanNotes: string; meta: OrderPackedMeta } {
  if (!rawNotes) {
    return { cleanNotes: '', meta: {} };
  }
  const match = rawNotes.match(/<!--DULANG_META:([\s\S]*?)-->/);
  const cleanNotes = rawNotes.replace(/<!--DULANG_META:[\s\S]*?-->/g, '').trim();
  if (!match) {
    return { cleanNotes, meta: {} };
  }
  try {
    const parsed = JSON.parse(match[1]);
    const meta: OrderPackedMeta = {};
    if (parsed.k) meta.kitchen_status = parsed.k;
    if (parsed.ks) meta.cooking_started_at = parsed.ks;
    if (parsed.kc) meta.cooking_completed_at = parsed.kc;
    if (parsed.ds) meta.delivery_schedule = parsed.ds;
    if (parsed.slot) meta.delivery_slot = parsed.slot;
    if (parsed.dp !== undefined) meta.dp_amount = Number(parsed.dp);
    if (parsed.rem !== undefined) meta.remaining_amount = Number(parsed.rem);
    if (parsed.cn) meta.cashier_name = parsed.cn;
    if (parsed.pc !== undefined) meta.print_count = Number(parsed.pc);
    if (parsed.lpa) meta.last_printed_at = parsed.lpa;
    if (parsed.cr) meta.cancellation_reason = parsed.cr;
    if (parsed.cb) meta.cancelled_by = parsed.cb;
    if (parsed.ca) meta.cancelled_at = parsed.ca;
    return { cleanNotes, meta };
  } catch {
    return { cleanNotes, meta: {} };
  }
}

export const storageService = {
  // --- MENU MANAGEMENT ---
  getDeletedMenuIds(): Set<string> {
    const ids = new Set<string>();
    try {
      const raw = localStorage.getItem(DELETED_MENU_IDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach((id) => id && ids.add(String(id)));
      }
      const cfgRaw = localStorage.getItem('dulang_store_config');
      if (cfgRaw) {
        const cfg = JSON.parse(cfgRaw);
        if (Array.isArray(cfg?.deletedMenuIds)) {
          cfg.deletedMenuIds.forEach((id: any) => id && ids.add(String(id)));
        }
      }
    } catch {
      // ignore
    }
    return ids;
  },

  getMenus(): MenuItem[] {
    const deletedIds = this.getDeletedMenuIds();
    const normalizeMenuItem = (raw: MenuItem): { item: MenuItem; changed: boolean } => {
      let changed = false;
      const unpacked = unpackMenuDescription(raw.deskripsi);
      const descClean = unpacked.cleanDesc;
      if (descClean !== (raw.deskripsi || '').trim()) {
        changed = true;
      }

      const name = (raw.nama || '').toLowerCase();
      let st = raw.servingType || unpacked.meta.servingType;
      if (!st) {
        if (raw.variantType === 'frozen' || name.includes('frozen') || name.includes('beku')) {
          st = 'frozen_only';
        } else if (name.includes('risol') && !name.includes('frozen')) {
          st = 'both';
        } else {
          st = 'matang_only';
        }
        changed = true;
      } else if (
        st === 'matang_only' &&
        (raw.id === 'menu-1' ||
          raw.id === 'menu-2' ||
          (name.includes('risol') && !name.includes('frozen') && !name.includes('pack') && !name.includes('isi')))
      ) {
        st = 'both';
        changed = true;
      }

      const defMatch = DEFAULT_MENUS.find((dm) => dm.id === raw.id);
      const defaultStokHarian = defMatch?.stokHarian ?? null;
      let stokHarian =
        raw.stokHarian !== undefined
          ? raw.stokHarian
          : unpacked.meta.stokHarian !== undefined
          ? unpacked.meta.stokHarian
          : undefined;
      let sisaStok =
        raw.sisaStok !== undefined
          ? raw.sisaStok
          : unpacked.meta.sisaStok !== undefined
          ? unpacked.meta.sisaStok
          : undefined;

      if ((stokHarian === undefined || stokHarian === null) && defaultStokHarian !== null) {
        stokHarian = defaultStokHarian;
        if (sisaStok === undefined || sisaStok === null) {
          sisaStok = defaultStokHarian;
        }
        changed = true;
      }

      return {
        item: {
          ...raw,
          deskripsi: descClean,
          servingType: st,
          variantType: raw.variantType || unpacked.meta.variantType || (st === 'frozen_only' ? 'frozen' : 'matang'),
          tersediaBesok: raw.tersediaBesok ?? unpacked.meta.tersediaBesok ?? defMatch?.tersediaBesok,
          kloterBadge: raw.kloterBadge ?? unpacked.meta.kloterBadge ?? defMatch?.kloterBadge,
          opsi: raw.opsi ?? unpacked.meta.opsi ?? defMatch?.opsi,
          stokHarian: stokHarian ?? null,
          sisaStok: sisaStok ?? null,
        },
        changed,
      };
    };

    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENUS);
      if (data !== null) {
        let parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          let hasChanges = false;
          // Hapus row sistem / legacy & tombstone
          const filtered = parsed.filter(
            (m: any) => m && !isSystemOrLegacyMenuId(m.id) && !deletedIds.has(m.id)
          );
          if (filtered.length !== parsed.length) {
            parsed = filtered;
            hasChanges = true;
          }

          const existingIds = new Set(parsed.map((m: any) => m.id));
          const missingDefaults = DEFAULT_MENUS.filter(
            (dm) => !existingIds.has(dm.id) && !deletedIds.has(dm.id)
          );

          if (missingDefaults.length > 0 && parsed.length > 0) {
            parsed = [...parsed, ...missingDefaults];
            hasChanges = true;
          }

          if (parsed.length === 0 && deletedIds.size === 0) {
            const freshDefaults = DEFAULT_MENUS;
            localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(freshDefaults));
            return freshDefaults;
          }

          const processed = parsed.map((m: MenuItem) => {
            const norm = normalizeMenuItem(m);
            if (norm.changed) hasChanges = true;
            return norm.item;
          });

          if (hasChanges) {
            localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(processed));
          }
          return processed;
        }
      }
    } catch (e) {
      console.warn('Failed to read menus from localStorage:', e);
    }
    const fallbackMenus = DEFAULT_MENUS.filter((dm) => !deletedIds.has(dm.id));
    localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(fallbackMenus));
    return fallbackMenus;
  },

  async resetDefaultMenus(): Promise<MenuItem[]> {
    try {
      localStorage.setItem(DELETED_MENU_IDS_KEY, JSON.stringify([]));
      const cfg = this.getStoreConfig();
      if (Array.isArray(cfg.deletedMenuIds) && cfg.deletedMenuIds.length > 0) {
        await this.saveStoreConfig({ ...cfg, deletedMenuIds: [] });
      }
      await this.saveMenus(DEFAULT_MENUS);
    } catch (e) {
      console.error('Failed to reset menus:', e);
    }
    return DEFAULT_MENUS;
  },

  async saveMenus(menus: MenuItem[]): Promise<void> {
    try {
      const cleanMenus = (menus || []).filter((m) => m && !isSystemOrLegacyMenuId(m.id));
      localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(cleanMenus));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
      }
      const client = getSupabaseClient();
      if (client && cleanMenus.length > 0) {
        const dbMenus = cleanMenus.map((m, idx) => ({
          id: m.id,
          nama: m.nama,
          harga: m.harga,
          deskripsi: packMenuDescription(m.deskripsi, {
            stokHarian: m.stokHarian ?? null,
            sisaStok: m.sisaStok ?? null,
            servingType: m.servingType,
            variantType: m.variantType,
            tersediaBesok: m.tersediaBesok,
            kloterBadge: m.kloterBadge,
            opsi: m.opsi,
            sortOrder: idx,
          }),
          foto: m.foto || '',
          tersedia: m.tersedia !== false,
        }));
        const { error } = await client.from('menus').upsert(dbMenus);
        if (error) {
          console.warn('Supabase menus upsert note:', error.message);
        }
      }
    } catch (e) {
      console.error('Failed to save menus:', e);
    }
  },

  async deleteMenuItem(menuId: string): Promise<void> {
    try {
      const current = this.getMenus();
      const target = current.find((m) => m.id === menuId);
      const updated = current.filter((m) => m.id !== menuId);

      // Simpan tombstone lokal + di StoreConfig cloud agar HP lain/Incognito ikut menyembunyikan menu terhapus
      const deletedSet = this.getDeletedMenuIds();
      deletedSet.add(menuId);
      const deletedArr = Array.from(deletedSet);
      localStorage.setItem(DELETED_MENU_IDS_KEY, JSON.stringify(deletedArr));

      localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
      }

      const cfg = this.getStoreConfig();
      const cfgDeleted = Array.from(new Set([...(cfg.deletedMenuIds || []), menuId]));
      await this.saveStoreConfig({ ...cfg, deletedMenuIds: cfgDeleted });

      const client = getSupabaseClient();
      if (client) {
        // Tandai deleted di deskripsi (jika RLS blok DELETE) sekaligus coba DELETE fisik
        try {
          await client
            .from('menus')
            .update({
              tersedia: false,
              deskripsi: packMenuDescription(target?.deskripsi || '', { deleted: true }),
            })
            .eq('id', menuId);
        } catch {}
        try {
          await client.from('menus').delete().eq('id', menuId);
        } catch {}
      }
    } catch (e) {
      console.error('Failed to delete menu item:', e);
    }
  },

  async syncMenusFromSupabase(): Promise<MenuItem[]> {
    try {
      const client = getSupabaseClient();
      if (!client) return this.getMenus();

      const { data, error } = await client
        .from('menus')
        .select('id, nama, harga, deskripsi, foto, tersedia');
      if (error || !data || data.length === 0) return this.getMenus();

      const deletedIds = this.getDeletedMenuIds();
      const currentMenus = this.getMenus();
      const defaultOrderMap = new Map<string, number>(
        DEFAULT_MENUS.map((dm, idx) => [dm.id, idx])
      );

      type MenuWithOrder = { item: MenuItem; sortKey: number };
      const syncedList: MenuWithOrder[] = [];
      const seenIds = new Set<string>();

      for (const r of data as any[]) {
        if (!r?.id || isSystemOrLegacyMenuId(r.id) || deletedIds.has(r.id)) continue;
        const { cleanDesc, meta } = unpackMenuDescription(r.deskripsi);
        if (meta.deleted) {
          deletedIds.add(r.id);
          continue;
        }

        const local = currentMenus.find((m) => m.id === r.id);
        const defMatch = DEFAULT_MENUS.find((dm) => dm.id === r.id);
        const nameLower = String(r.nama || local?.nama || '').toLowerCase();

        const servingType =
          meta.servingType ||
          local?.servingType ||
          defMatch?.servingType ||
          (nameLower.includes('frozen') || nameLower.includes('beku')
            ? 'frozen_only'
            : nameLower.includes('risol') && !nameLower.includes('frozen')
            ? 'both'
            : 'matang_only');

        const variantType =
          meta.variantType ||
          local?.variantType ||
          defMatch?.variantType ||
          (servingType === 'frozen_only' ? 'frozen' : 'matang');

        const stokHarian =
          meta.stokHarian !== undefined
            ? meta.stokHarian
            : local?.stokHarian !== undefined
            ? local.stokHarian
            : defMatch?.stokHarian ?? null;

        const sisaStok =
          meta.sisaStok !== undefined
            ? meta.sisaStok
            : local?.sisaStok !== undefined
            ? local.sisaStok
            : defMatch?.sisaStok ?? null;

        const mergedItem: MenuItem = {
          id: r.id,
          nama: r.nama ?? local?.nama ?? 'Menu Dulang',
          harga: Number(r.harga ?? local?.harga ?? 0),
          deskripsi: cleanDesc || local?.deskripsi || defMatch?.deskripsi || '',
          foto: r.foto || local?.foto || '',
          tersedia: r.tersedia !== false,
          tersediaBesok: meta.tersediaBesok ?? local?.tersediaBesok ?? defMatch?.tersediaBesok,
          kloterBadge: meta.kloterBadge ?? local?.kloterBadge ?? defMatch?.kloterBadge,
          opsi: meta.opsi ?? local?.opsi ?? defMatch?.opsi,
          stokHarian,
          sisaStok,
          servingType,
          variantType,
        };

        const sortKey =
          meta.sortOrder !== undefined
            ? meta.sortOrder
            : defaultOrderMap.has(r.id)
            ? (defaultOrderMap.get(r.id) as number)
            : 10000;

        syncedList.push({ item: mergedItem, sortKey });
        seenIds.add(r.id);
      }

      // Jika Supabase mengembalikan menu aktif, perlakukan cloud sebagai otoritatif
      // Pertahankan item lokal yang belum ada di cloud hanya jika baru dibuat (< 15 detik) agar item yang dihapus tidak bangkit lagi
      if (syncedList.length > 0) {
        const nowMs = Date.now();
        for (const local of currentMenus) {
          if (!seenIds.has(local.id) && !deletedIds.has(local.id) && !isSystemOrLegacyMenuId(local.id)) {
            const tsMatch = local.id.match(/^menu-(\d{12,15})$/);
            const isBrandNewLocal = tsMatch ? nowMs - Number(tsMatch[1]) < 15_000 : false;
            if (isBrandNewLocal) {
              syncedList.push({
                item: local,
                sortKey: 20000,
              });
            }
          }
        }
      } else {
        for (const local of currentMenus) {
          if (!seenIds.has(local.id) && !deletedIds.has(local.id) && !isSystemOrLegacyMenuId(local.id)) {
            syncedList.push({
              item: local,
              sortKey: defaultOrderMap.has(local.id) ? (defaultOrderMap.get(local.id) as number) : 20000,
            });
          }
        }
      }

      syncedList.sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.item.id.localeCompare(b.item.id);
      });

      const finalMerged = syncedList.map((entry) => entry.item);

      localStorage.setItem(DELETED_MENU_IDS_KEY, JSON.stringify(Array.from(deletedIds)));
      localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(finalMerged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
      }
      return finalMerged;
    } catch (err) {
      console.warn('Failed to sync menus from Supabase:', err);
      return this.getMenus();
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

  deductStockForOrder(orderItems: { menu_id?: string; nama: string; qty: number; pilihanOpsi?: string }[]): void {
    const menus = this.getMenus();
    let hasChanges = false;

    // Helper untuk memotong stok pada 1 menu item
    const deductFromMenu = (menuIdentifier: string, qtyToDeduct: number) => {
      const cleanIdent = menuIdentifier.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
      const idx = menus.findIndex((m) => {
        if (m.id && m.id.toLowerCase() === menuIdentifier.toLowerCase()) return true;
        const mClean = m.nama.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
        return mClean === cleanIdent || m.nama.toLowerCase() === cleanIdent;
      });

      if (idx >= 0) {
        const m = menus[idx];
        if (m.sisaStok !== undefined && m.sisaStok !== null) {
          const newSisa = Math.max(0, m.sisaStok - qtyToDeduct);
          menus[idx] = {
            ...m,
            sisaStok: newSisa,
            tersedia: newSisa > 0 ? m.tersedia : false,
          };
          hasChanges = true;
        }
      }
    };

    orderItems.forEach((item) => {
      const lowerName = item.nama.toLowerCase();
      const isSnackBox =
        (item.menu_id && item.menu_id.startsWith('snack_box')) ||
        lowerName.includes('snack box');

      if (isSnackBox) {
        // Jika snack box: potong stok masing-masing gorengan di dalam dus
        // Pilihan opsi biasanya berisi format: "Isi: Risol Mayo + Risol Rogut + Lumpia Sayur..."
        const boxQty = item.qty || 1;
        const searchPool = `${item.pilihanOpsi || ''} ${item.nama}`.toLowerCase();
        menus.forEach((m) => {
          const cleanMenuName = m.nama.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
          if (searchPool.includes(cleanMenuName)) {
            deductFromMenu(m.id, boxQty);
          }
        });
      } else {
        // Menu reguler (matang / frozen)
        deductFromMenu(item.menu_id || item.nama, item.qty);
      }
    });

    if (hasChanges) {
      this.saveMenus(menus);
    }
  },

  restoreStockForOrder(orderItems: { menu_id?: string; nama: string; qty: number; pilihanOpsi?: string }[]): void {
    const menus = this.getMenus();
    let hasChanges = false;

    // Helper untuk mengembalikan stok pada 1 menu item
    const restoreToMenu = (menuIdentifier: string, qtyToRestore: number) => {
      const cleanIdent = menuIdentifier.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
      const idx = menus.findIndex((m) => {
        if (m.id && m.id.toLowerCase() === menuIdentifier.toLowerCase()) return true;
        const mClean = m.nama.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
        return mClean === cleanIdent || m.nama.toLowerCase() === cleanIdent;
      });

      if (idx >= 0) {
        const m = menus[idx];
        if (m.sisaStok !== undefined && m.sisaStok !== null) {
          const maxCap = m.stokHarian !== null && m.stokHarian !== undefined ? m.stokHarian : 9999;
          const newSisa = Math.min(maxCap, m.sisaStok + qtyToRestore);
          menus[idx] = {
            ...m,
            sisaStok: newSisa,
            tersedia: newSisa > 0 ? true : m.tersedia,
          };
          hasChanges = true;
        }
      }
    };

    orderItems.forEach((item) => {
      const lowerName = item.nama.toLowerCase();
      const isSnackBox =
        (item.menu_id && item.menu_id.startsWith('snack_box')) ||
        lowerName.includes('snack box');

      if (isSnackBox) {
        const boxQty = item.qty || 1;
        const searchPool = `${item.pilihanOpsi || ''} ${item.nama}`.toLowerCase();
        menus.forEach((m) => {
          const cleanMenuName = m.nama.toLowerCase().replace(/\s*\(.*\)/g, '').trim();
          if (searchPool.includes(cleanMenuName)) {
            restoreToMenu(m.id, boxQty);
          }
        });
      } else {
        restoreToMenu(item.menu_id || item.nama, item.qty);
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

      if (!error && Array.isArray(data)) {
        let deletedCustIds = new Set<string>();
        try {
          const delRaw = localStorage.getItem('dulang_deleted_customer_ids') || '[]';
          const parsedDel = JSON.parse(delRaw);
          if (Array.isArray(parsedDel)) deletedCustIds = new Set(parsedDel.map(String));
        } catch {}

        const map = new Map<string, Customer>();
        data.forEach((c: Customer) => {
          if (c?.id && !deletedCustIds.has(c.id) && c.qr_code_id) {
            map.set(c.qr_code_id.toUpperCase(), c);
          }
        });

        // Pertahankan pelanggan lokal yang baru saja dibuat (< 15 detik) agar tidak hilang sebelum cloud selesai sinkron
        const nowMs = Date.now();
        const local = this.getCustomers();
        local.forEach((c) => {
          if (!c?.qr_code_id) return;
          const qrKey = c.qr_code_id.toUpperCase();
          if (map.has(qrKey) || deletedCustIds.has(c.id)) return;
          const ts = new Date(c.first_scan_at || c.last_scan_at || 0).getTime();
          if (Number.isFinite(ts) && nowMs - ts < 15_000 && !c.id.startsWith('DEMO-')) {
            map.set(qrKey, c);
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

  async deleteCustomer(id: string): Promise<void> {
    const customers = this.getCustomers().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

    try {
      const delRaw = localStorage.getItem('dulang_deleted_customer_ids') || '[]';
      const delIds: string[] = JSON.parse(delRaw);
      if (!delIds.includes(id)) {
        delIds.push(id);
        if (delIds.length > 300) delIds.shift();
        localStorage.setItem('dulang_deleted_customer_ids', JSON.stringify(delIds));
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_customers_updated'));
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('customers').delete().eq('id', id);
      } catch (e) {
        console.warn('Failed to delete customer from Supabase:', e);
      }
    }
  },

  saveCustomers(customers: Customer[]): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_customers_updated'));
    }
  },

  markCustomerGreeted(customerId: string): void {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx < 0) return;

    const today = new Date().toISOString().split('T')[0];
    const updated = {
      ...customers[idx],
      last_greeted_at: today,
    };
    const newList = [...customers];
    newList[idx] = updated;
    this.saveCustomers(newList);

    const client = getSupabaseClient();
    if (client) {
      client.from('customers').update({ last_greeted_at: today }).eq('id', customerId).then();
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

  // --- OWNER AUTHENTICATION STATE & CRYPTOGRAPHIC AUTH META ---
  isOwnerAuthenticated(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS.OWNER_TOKEN);
    } catch {}
    return isOwnerSessionValid();
  },

  setOwnerAuthenticated(val: boolean, role: StaffRole = 'owner'): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.OWNER_TOKEN);
    } catch {}
    if (val) {
      createOwnerSession(role);
      this.setStaffRole(role);
    } else {
      clearOwnerSession();
      this.setStaffRole('cashier');
    }
  },

  getLocalAuthHashes(): AuthHashesRecord {
    const fallback: AuthHashesRecord = {
      ownerHash: DEFAULT_AUTH_HASHES.ownerHash,
      cashierHash: DEFAULT_AUTH_HASHES.cashierHash,
      kitchenHash: DEFAULT_AUTH_HASHES.kitchenHash,
      isDefaultOwnerPin: true,
      updatedAt: '1970-01-01T00:00:00.000Z',
    };
    try {
      const raw = localStorage.getItem(AUTH_HASHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ownerHash: isHashFormat(parsed.ownerHash) ? parsed.ownerHash : fallback.ownerHash,
            cashierHash: isHashFormat(parsed.cashierHash) ? parsed.cashierHash : fallback.cashierHash,
            kitchenHash: isHashFormat(parsed.kitchenHash) ? parsed.kitchenHash : fallback.kitchenHash,
            isDefaultOwnerPin:
              typeof parsed.isDefaultOwnerPin === 'boolean'
                ? parsed.isDefaultOwnerPin
                : String(parsed.ownerHash || '').toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256 ||
                  parsed.ownerHash === DEFAULT_AUTH_HASHES.ownerHash,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
          };
        }
      }
      const legacyOwner = localStorage.getItem('dulang_owner_pin');
      if (legacyOwner && isHashFormat(legacyOwner)) {
        return {
          ...fallback,
          ownerHash: legacyOwner,
          isDefaultOwnerPin: legacyOwner.toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256,
        };
      }
    } catch (e) {
      console.warn('Failed to read local auth hashes:', e);
    }
    return fallback;
  },

  saveLocalAuthHashes(record: AuthHashesRecord): void {
    try {
      localStorage.setItem(AUTH_HASHES_KEY, JSON.stringify(record));
      if (isHashFormat(record.ownerHash)) {
        localStorage.removeItem('dulang_owner_pin');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_auth_meta_updated'));
      }
    } catch (e) {
      console.error('Failed to save local auth hashes:', e);
    }
  },

  async migrateLegacyLocalAuthIfAny(): Promise<AuthHashesRecord> {
    const rec = this.getLocalAuthHashes();
    let changed = false;

    try {
      const legacyOwner = localStorage.getItem('dulang_owner_pin');
      if (legacyOwner && legacyOwner.trim()) {
        if (isHashFormat(legacyOwner)) {
          if (rec.ownerHash !== legacyOwner.trim()) {
            rec.ownerHash = legacyOwner.trim();
            rec.isDefaultOwnerPin = legacyOwner.trim().toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256;
            changed = true;
          }
        } else {
          const matchesDefault = await verifyPassword(legacyOwner.trim(), LEGACY_DEFAULT_OWNER_SHA256);
          rec.ownerHash = matchesDefault ? DEFAULT_AUTH_HASHES.ownerHash : await hashPassword(legacyOwner.trim());
          rec.isDefaultOwnerPin = matchesDefault;
          changed = true;
        }
        rec.updatedAt = new Date().toISOString();
        localStorage.removeItem('dulang_owner_pin');
      }

      const rawCfg = localStorage.getItem('dulang_store_config');
      if (rawCfg) {
        const parsedCfg = JSON.parse(rawCfg);
        if (parsedCfg && typeof parsedCfg === 'object' && ('ownerPin' in parsedCfg || 'cashierPin' in parsedCfg || 'kitchenPin' in parsedCfg)) {
          if (typeof parsedCfg.ownerPin === 'string' && parsedCfg.ownerPin.trim()) {
            const p = parsedCfg.ownerPin.trim();
            if (isHashFormat(p)) {
              rec.ownerHash = p;
              rec.isDefaultOwnerPin = p.toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256;
            } else {
              const matchesDefault = await verifyPassword(p, LEGACY_DEFAULT_OWNER_SHA256);
              rec.ownerHash = matchesDefault ? DEFAULT_AUTH_HASHES.ownerHash : await hashPassword(p);
              rec.isDefaultOwnerPin = matchesDefault;
            }
            changed = true;
          }
          if (typeof parsedCfg.cashierPin === 'string' && parsedCfg.cashierPin.trim()) {
            const cp = parsedCfg.cashierPin.trim();
            rec.cashierHash = isHashFormat(cp) ? cp : await hashPassword(cp);
            changed = true;
          }
          if (typeof parsedCfg.kitchenPin === 'string' && parsedCfg.kitchenPin.trim()) {
            const kp = parsedCfg.kitchenPin.trim();
            rec.kitchenHash = isHashFormat(kp) ? kp : await hashPassword(kp);
            changed = true;
          }
          if (changed) {
            rec.updatedAt = new Date().toISOString();
          }
          const cleanCfg = sanitizeStoreConfig(parsedCfg);
          localStorage.setItem('dulang_store_config', JSON.stringify(cleanCfg));
        }
      }

      if (changed) {
        this.saveLocalAuthHashes(rec);
      }
    } catch (e) {
      console.warn('Legacy local auth migration note:', e);
    }

    return rec;
  },

  async pushAuthMetaToSupabase(record: AuthHashesRecord): Promise<void> {
    try {
      const client = getSupabaseClient();
      if (!client) return;
      await client.from('menus').upsert({
        id: SYS_AUTH_META_ID,
        nama: 'SYSTEM_AUTH_META',
        harga: 0,
        deskripsi: JSON.stringify(record),
        tersedia: false,
      });
    } catch (e) {
      console.warn('Failed to push auth meta to Supabase:', e);
    }
  },

  async syncAuthMetaFromSupabase(): Promise<AuthHashesRecord> {
    const local = await this.migrateLegacyLocalAuthIfAny();
    try {
      const client = getSupabaseClient();
      if (!client) return local;

      const { data, error } = await client
        .from('menus')
        .select('deskripsi')
        .eq('id', SYS_AUTH_META_ID)
        .single();

      if (!error && data?.deskripsi) {
        const parsed = JSON.parse(data.deskripsi);
        if (parsed && typeof parsed === 'object') {
          const remote: AuthHashesRecord = {
            ownerHash: isHashFormat(parsed.ownerHash) ? parsed.ownerHash : local.ownerHash,
            cashierHash: isHashFormat(parsed.cashierHash) ? parsed.cashierHash : local.cashierHash,
            kitchenHash: isHashFormat(parsed.kitchenHash) ? parsed.kitchenHash : local.kitchenHash,
            isDefaultOwnerPin:
              typeof parsed.isDefaultOwnerPin === 'boolean'
                ? parsed.isDefaultOwnerPin
                : String(parsed.ownerHash || '').toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256 ||
                  parsed.ownerHash === DEFAULT_AUTH_HASHES.ownerHash,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
          };

          const localTime = new Date(local.updatedAt || 0).getTime();
          const remoteTime = new Date(remote.updatedAt || 0).getTime();
          if (remoteTime >= localTime || local.updatedAt === '1970-01-01T00:00:00.000Z') {
            this.saveLocalAuthHashes(remote);
            return remote;
          } else {
            await this.pushAuthMetaToSupabase(local);
            return local;
          }
        }
      } else if (error?.code === 'PGRST116') {
        await this.pushAuthMetaToSupabase(local);
      }
    } catch (err) {
      console.warn('Failed to sync auth meta from Supabase:', err);
    }
    return local;
  },

  async isDefaultOwnerPinActive(): Promise<boolean> {
    const rec = await this.migrateLegacyLocalAuthIfAny();
    return Boolean(
      rec.isDefaultOwnerPin ||
        rec.ownerHash === DEFAULT_AUTH_HASHES.ownerHash ||
        rec.ownerHash.toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256
    );
  },

  async saveOwnerPin(newPin: string): Promise<void> {
    const clean = newPin.trim();
    if (clean.length < 6) {
      throw new Error('Password pemilik minimal 6 karakter.');
    }
    const current = await this.migrateLegacyLocalAuthIfAny();
    const sameAsCashier = await verifyPassword(clean, current.cashierHash);
    const sameAsKitchen = await verifyPassword(clean, current.kitchenHash);
    if (sameAsCashier || sameAsKitchen) {
      throw new Error('Password Pemilik tidak boleh sama dengan PIN Kasir atau PIN Dapur.');
    }

    const hashed = await hashPassword(clean);
    const updated: AuthHashesRecord = {
      ...current,
      ownerHash: hashed,
      isDefaultOwnerPin: false,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalAuthHashes(updated);
    await this.pushAuthMetaToSupabase(updated);
  },

  async saveStaffPins(params: {
    ownerPassword: string;
    newCashierPin?: string;
    newKitchenPin?: string;
  }): Promise<{ success: boolean; message: string }> {
    const ownerOk = await this.verifyOwnerPin(params.ownerPassword || '');
    if (!ownerOk) {
      return { success: false, message: 'Password Pemilik tidak cocok!' };
    }

    const newCashier = params.newCashierPin?.trim();
    const newKitchen = params.newKitchenPin?.trim();
    if (!newCashier && !newKitchen) {
      return { success: false, message: 'Masukkan minimal satu PIN baru (Kasir atau Dapur).' };
    }
    if ((newCashier && newCashier.length < 4) || (newKitchen && newKitchen.length < 4)) {
      return { success: false, message: 'PIN Kasir dan PIN Dapur minimal 4 karakter.' };
    }
    if (newCashier && newKitchen && newCashier === newKitchen) {
      return { success: false, message: 'PIN Kasir dan PIN Dapur harus berbeda.' };
    }

    const current = this.getLocalAuthHashes();
    if (newCashier) {
      if (await verifyPassword(newCashier, current.ownerHash)) {
        return { success: false, message: 'PIN Kasir tidak boleh sama dengan Password Pemilik.' };
      }
      if (!newKitchen && (await verifyPassword(newCashier, current.kitchenHash))) {
        return { success: false, message: 'PIN Kasir tidak boleh sama dengan PIN Dapur yang sedang aktif.' };
      }
    }
    if (newKitchen) {
      if (await verifyPassword(newKitchen, current.ownerHash)) {
        return { success: false, message: 'PIN Dapur tidak boleh sama dengan Password Pemilik.' };
      }
      if (!newCashier && (await verifyPassword(newKitchen, current.cashierHash))) {
        return { success: false, message: 'PIN Dapur tidak boleh sama dengan PIN Kasir yang sedang aktif.' };
      }
    }

    const updated: AuthHashesRecord = {
      ...current,
      cashierHash: newCashier ? await hashPassword(newCashier) : current.cashierHash,
      kitchenHash: newKitchen ? await hashPassword(newKitchen) : current.kitchenHash,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalAuthHashes(updated);
    await this.pushAuthMetaToSupabase(updated);

    return {
      success: true,
      message: 'PIN akses Kasir Stand & Kru Dapur (KDS) berhasil diperbarui & diamankan!',
    };
  },

  async verifyOwnerPin(inputPin: string): Promise<boolean> {
    const clean = inputPin.trim();
    if (!clean) return false;
    let rec = await this.migrateLegacyLocalAuthIfAny();
    let matched = await verifyPassword(clean, rec.ownerHash);

    if (!matched) {
      rec = await this.syncAuthMetaFromSupabase();
      matched = await verifyPassword(clean, rec.ownerHash);
    }

    if (matched && !rec.ownerHash.startsWith('pbkdf2_v1$')) {
      const wasDefaultLegacy = rec.ownerHash.toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256;
      const upgraded: AuthHashesRecord = {
        ...rec,
        ownerHash: await hashPassword(clean),
        isDefaultOwnerPin: wasDefaultLegacy,
        updatedAt: new Date().toISOString(),
      };
      this.saveLocalAuthHashes(upgraded);
      await this.pushAuthMetaToSupabase(upgraded);
    }

    return matched;
  },

  // --- STAFF ROLE & MULTI-PIN ACCESS CONTROL ---
  getStaffRole(): StaffRole {
    try {
      if (!this.isOwnerAuthenticated()) {
        return 'cashier';
      }
      const sessionRole = getOwnerSessionRole();
      if (sessionRole === 'owner' || sessionRole === 'cashier' || sessionRole === 'kitchen') {
        return sessionRole;
      }
      const saved = localStorage.getItem('dulang_staff_role');
      if (saved === 'cashier' || saved === 'kitchen') {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to read staff role:', e);
    }
    return 'cashier';
  },

  setStaffRole(role: StaffRole): void {
    try {
      const sessionRole = getOwnerSessionRole();
      const safeRole: StaffRole =
        role === 'owner' && (!this.isOwnerAuthenticated() || sessionRole !== 'owner')
          ? sessionRole || 'cashier'
          : role;
      localStorage.setItem('dulang_staff_role', safeRole);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dulang_staff_role_updated', { detail: { role: safeRole } }));
      }
    } catch (e) {
      console.error('Failed to set staff role:', e);
    }
  },

  async verifyCashierPin(inputPin: string): Promise<boolean> {
    const clean = inputPin.trim();
    if (!clean) return false;
    let rec = await this.migrateLegacyLocalAuthIfAny();
    let matched = await verifyPassword(clean, rec.cashierHash);
    if (!matched) {
      rec = await this.syncAuthMetaFromSupabase();
      matched = await verifyPassword(clean, rec.cashierHash);
    }
    return matched;
  },

  async verifyKitchenPin(inputPin: string): Promise<boolean> {
    const clean = inputPin.trim();
    if (!clean) return false;
    let rec = await this.migrateLegacyLocalAuthIfAny();
    let matched = await verifyPassword(clean, rec.kitchenHash);
    if (!matched) {
      rec = await this.syncAuthMetaFromSupabase();
      matched = await verifyPassword(clean, rec.kitchenHash);
    }
    return matched;
  },

  async verifyAnyPin(inputPin: string): Promise<{ success: boolean; role: StaffRole; label: string }> {
    const clean = inputPin.trim();
    if (!clean) return { success: false, role: 'cashier', label: '' };

    const checkWithRecord = async (rec: AuthHashesRecord): Promise<{ success: boolean; role: StaffRole; label: string } | null> => {
      if (await verifyPassword(clean, rec.ownerHash)) {
        if (!rec.ownerHash.startsWith('pbkdf2_v1$')) {
          const wasDefaultLegacy = rec.ownerHash.toLowerCase() === LEGACY_DEFAULT_OWNER_SHA256;
          const upgraded: AuthHashesRecord = {
            ...rec,
            ownerHash: await hashPassword(clean),
            isDefaultOwnerPin: wasDefaultLegacy,
            updatedAt: new Date().toISOString(),
          };
          this.saveLocalAuthHashes(upgraded);
          await this.pushAuthMetaToSupabase(upgraded);
        }
        return { success: true, role: 'owner', label: '👑 Pemilik Usaha (Owner)' };
      }
      if (await verifyPassword(clean, rec.cashierHash)) {
        return { success: true, role: 'cashier', label: '🛒 Kasir Stand' };
      }
      if (await verifyPassword(clean, rec.kitchenHash)) {
        return { success: true, role: 'kitchen', label: '🍳 Kru Dapur (KDS)' };
      }
      return null;
    };

    const localRec = await this.migrateLegacyLocalAuthIfAny();
    const localHit = await checkWithRecord(localRec);
    if (localHit) return localHit;

    const syncedRec = await this.syncAuthMetaFromSupabase();
    const syncedHit = await checkWithRecord(syncedRec);
    if (syncedHit) return syncedHit;

    return { success: false, role: 'cashier', label: '' };
  },

  // --- STORE CONFIG (HERO IMAGE, SCHEDULE, ETC) ---
  getStoreConfig(): StoreConfig {
    try {
      const data = localStorage.getItem('dulang_store_config');
      if (data) {
        const parsed = JSON.parse(data);
        // Migrasi aman otomatis jika browser masih menyimpan alamat dummy Diponegoro / Pagerwojo
        if (parsed.pickupAddressNote && (parsed.pickupAddressNote.includes('Diponegoro') || parsed.pickupAddressNote.includes('Pagerwojo'))) {
          parsed.pickupAddressNote = DEFAULT_STORE_CONFIG.pickupAddressNote;
        }
        return sanitizeStoreConfig({ ...DEFAULT_STORE_CONFIG, ...parsed }) as StoreConfig;
      }
    } catch (e) {
      console.warn('Failed to read store config from localStorage:', e);
    }
    return sanitizeStoreConfig(DEFAULT_STORE_CONFIG) as StoreConfig;
  },

  async syncStoreConfigFromSupabase(): Promise<StoreConfig> {
    try {
      const client = getSupabaseClient();
      if (!client) return this.getStoreConfig();

      const { data, error } = await client
        .from('menus')
        .select('deskripsi')
        .eq('id', SYS_STORE_CONFIG_ID)
        .single();

      if (!error && data?.deskripsi) {
        try {
          const remoteRaw = JSON.parse(data.deskripsi);
          const remoteConfig = sanitizeStoreConfig(remoteRaw);
          const current = this.getStoreConfig();

          const localDeleted = this.getDeletedMenuIds();
          if (Array.isArray(remoteConfig.deletedMenuIds)) {
            remoteConfig.deletedMenuIds.forEach((id: any) => id && localDeleted.add(String(id)));
          }
          const unionDeleted = Array.from(localDeleted);
          localStorage.setItem(DELETED_MENU_IDS_KEY, JSON.stringify(unionDeleted));

          const merged: StoreConfig = sanitizeStoreConfig({
            ...current,
            ...remoteConfig,
            deletedMenuIds: unionDeleted,
          }) as StoreConfig;

          localStorage.setItem('dulang_store_config', JSON.stringify(merged));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('dulang_store_config_updated'));
          }
          return merged;
        } catch (e) {
          console.warn('Failed to parse remote store config:', e);
        }
      }
    } catch (err) {
      console.warn('Failed to sync store config from Supabase:', err);
    }
    return this.getStoreConfig();
  },

  async saveStoreConfig(config: StoreConfig): Promise<void> {
    try {
      const localDeleted = this.getDeletedMenuIds();
      const deletedList = Array.from(
        new Set([...Array.from(localDeleted), ...(Array.isArray(config.deletedMenuIds) ? config.deletedMenuIds : [])])
      );
      localStorage.setItem(DELETED_MENU_IDS_KEY, JSON.stringify(deletedList));

      const cleanConfig = sanitizeStoreConfig({
        ...config,
        deletedMenuIds: deletedList,
      }) as StoreConfig;

      localStorage.setItem('dulang_store_config', JSON.stringify(cleanConfig));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_store_config_updated'));
      }

      // Sync ke Supabase Cloud agar langsung terupdate di seluruh HP pembeli & kasir
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('menus')
          .upsert({
            id: SYS_STORE_CONFIG_ID,
            nama: 'SYSTEM_STORE_CONFIG',
            harga: 0,
            deskripsi: JSON.stringify(cleanConfig),
            tersedia: true,
          });
        if (error) {
          console.warn('Supabase store config upsert note:', error.message);
        }
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
  async clearAllDemoData(): Promise<void> {
    this.clearCustomers();
    await this.clearOrders();
    this.clearExpenses();
    await this.saveTestimonials([]);
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

      // JANGAN hapus pelanggan riil (mis. cust-1790405359692); hanya hapus data contoh DEMO-* atau ID contoh 1-3 digit
      const customers = this.getCustomers().filter(
        (c) => !c.id.startsWith('DEMO-') && !/^cust-[1-9]\d{0,3}$/.test(c.id)
      );
      this.saveCustomers(customers);

      const expenses = this.getExpenses().filter(
        (e) => !e.id.startsWith('EXP-0') && !e.id.startsWith('EXP-DEMO')
      );
      this.saveExpenses(expenses);

      const rawTestimonials = this.getTestimonials();
      const filteredTestimonials = rawTestimonials.filter(
        (t) => !t.id.startsWith('testi-demo-') && !['testi-1', 'testi-2', 'testi-3', 'testi-4'].includes(t.id)
      );
      if (filteredTestimonials.length !== rawTestimonials.length) {
        localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(filteredTestimonials));
      }

      const demoVoucherCodes = new Set(['DULANG10', 'SEGERA', 'SERBU50', 'DULANGDEMO']);
      const vouchers = this.getVouchers().filter(
        (v) => !demoVoucherCodes.has(v.code.toUpperCase())
      );
      localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));

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
    let deletedUpper = new Set<string>();
    try {
      const delRaw = localStorage.getItem('dulang_deleted_order_ids');
      if (delRaw) {
        const arr = JSON.parse(delRaw);
        if (Array.isArray(arr)) {
          deletedUpper = new Set(arr.map((x) => String(x).toUpperCase()));
        }
      }
    } catch {}

    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data !== null) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (o) =>
              o &&
              String(o.status || '').toLowerCase() !== 'dihapus' &&
              !deletedUpper.has(String(o.id || '').toUpperCase())
          );
        }
      }
    } catch (e) {
      console.warn('Failed to read orders from localStorage:', e);
    }
    return DEFAULT_ORDERS;
  },

  async syncOrdersFromSupabase(): Promise<OrderRecord[]> {
    try {
      const client = getSupabaseClient();
      if (!client) return this.getOrders();

      const { data, error } = await client
        .from('orders')
        .select('*')
        .neq('status', 'dihapus')
        .order('created_at', { ascending: false });

      if (error || !data) return this.getOrders();

      const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
      let deletedIds: Set<string>;
      try {
        deletedIds = new Set(JSON.parse(deletedRaw));
      } catch {
        deletedIds = new Set();
      }

      const localOrders = this.getOrders();
      const localById = new Map<string, OrderRecord>();
      localOrders.forEach((o) => {
        if (!deletedIds.has(o.id) && o.status !== ('dihapus' as any)) {
          localById.set(o.id, o);
        }
      });

      const KITCHEN_STAGE_WEIGHT: Record<string, number> = {
        antre: 1,
        sedang_goreng: 2,
        packing: 3,
        siap: 4,
        selesai: 5,
      };

      const map = new Map<string, OrderRecord>();

      // Perlakukan daftar Supabase sebagai otoritatif untuk pesanan yang belum dihapus
      (data as any[]).forEach((r: any) => {
        if (!r?.id) return;
        if (r.status === 'dihapus') {
          deletedIds.add(r.id);
          return;
        }
        if (deletedIds.has(r.id)) return;

        const { cleanNotes, meta } = unpackOrderNotes(r.notes);
        const existingLocal = localById.get(r.id);

        const remoteKitchen = (r.kitchen_status as KitchenCookingStatus) || meta.kitchen_status;
        let finalKitchen = remoteKitchen;
        let finalCookingStarted = r.cooking_started_at || meta.cooking_started_at;
        let finalCookingCompleted = r.cooking_completed_at || meta.cooking_completed_at;

        if (existingLocal?.kitchen_status) {
          const localWeight = KITCHEN_STAGE_WEIGHT[existingLocal.kitchen_status] || 0;
          const remoteWeight = KITCHEN_STAGE_WEIGHT[remoteKitchen || ''] || 0;
          if (localWeight > remoteWeight) {
            finalKitchen = existingLocal.kitchen_status;
            finalCookingStarted = existingLocal.cooking_started_at || finalCookingStarted;
            finalCookingCompleted = existingLocal.cooking_completed_at || finalCookingCompleted;
          }
        }

        const remoteStatus = (r.status as OrderStatus) || 'menunggu';
        let finalStatus = remoteStatus;
        let finalCompletedAt = r.completed_at || undefined;
        if (existingLocal?.status === 'lunas' && remoteStatus !== 'lunas' && remoteStatus !== 'batal') {
          finalStatus = 'lunas';
          finalCompletedAt = existingLocal.completed_at || new Date().toISOString();
        }

        map.set(r.id, {
          id: r.id,
          customer_name: r.customer_name || 'Pelanggan Web',
          customer_wa: r.customer_wa || undefined,
          customer_qr_id: r.customer_qr_id || undefined,
          items: Array.isArray(r.items) ? r.items : [],
          total_price: Number(r.total_price || 0),
          payment_method: (r.payment_method as PaymentMethod) || 'tunai',
          status: finalStatus,
          delivery_method: r.delivery_method === 'delivery' ? 'delivery' : 'pickup',
          shipping_cost: Number(r.shipping_cost || 0),
          shipping_district: r.shipping_district || undefined,
          delivery_schedule: r.delivery_schedule || meta.delivery_schedule || undefined,
          delivery_slot: r.delivery_slot || meta.delivery_slot || undefined,
          dp_amount: r.dp_amount ? Number(r.dp_amount) : meta.dp_amount,
          remaining_amount:
            r.remaining_amount !== undefined && r.remaining_amount !== null
              ? Number(r.remaining_amount)
              : meta.remaining_amount,
          channel: r.channel || 'web_wa',
          notes: cleanNotes || undefined,
          kitchen_status: finalKitchen,
          cooking_started_at: finalCookingStarted,
          cooking_completed_at: finalCookingCompleted,
          cashier_name: r.cashier_name || meta.cashier_name,
          print_count:
            r.print_count !== undefined && r.print_count !== null ? Number(r.print_count) : meta.print_count,
          last_printed_at: r.last_printed_at || meta.last_printed_at,
          cancellation_reason: r.cancellation_reason || meta.cancellation_reason,
          cancelled_by: r.cancelled_by || meta.cancelled_by,
          cancelled_at: r.cancelled_at || meta.cancelled_at,
          created_at: r.created_at || new Date().toISOString(),
          completed_at: finalCompletedAt,
        });
      });

      // Hanya pertahankan order lokal yang sangat baru (< 15 detik) yang mungkin masih antre kirim ke cloud
      const nowMs = Date.now();
      localOrders.forEach((o) => {
        if (!o?.id || map.has(o.id) || deletedIds.has(o.id) || o.status === ('dihapus' as any)) return;
        const createdMs = new Date(o.created_at || 0).getTime();
        if (Number.isFinite(createdMs) && nowMs - createdMs < 15_000) {
          map.set(o.id, o);
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      localStorage.setItem('dulang_deleted_order_ids', JSON.stringify(Array.from(deletedIds).slice(-300)));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(merged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
        window.dispatchEvent(new Event('dulang_kitchen_updated'));
      }
      return merged;
    } catch (err) {
      console.warn('Failed to sync orders from Supabase:', err);
      return this.getOrders();
    }
  },

  async fetchOrderById(orderId: string): Promise<OrderRecord | null> {
    try {
      const cleanId = orderId.trim();
      if (!cleanId) return null;

      let deletedIds = new Set<string>();
      try {
        const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
        const arr = JSON.parse(deletedRaw);
        if (Array.isArray(arr)) deletedIds = new Set(arr.map((x) => String(x).toUpperCase()));
      } catch {}

      if (deletedIds.has(cleanId.toUpperCase())) {
        const cleanedLocal = this.getOrders().filter((o) => o.id.toUpperCase() !== cleanId.toUpperCase());
        this.saveOrders(cleanedLocal);
        return null;
      }

      const localList = this.getOrders();
      const local = localList.find((o) => o.id.toUpperCase() === cleanId.toUpperCase());

      const client = getSupabaseClient();
      if (!client) return local || null;

      const { data, error } = await client
        .from('orders')
        .select('*')
        .ilike('id', cleanId)
        .maybeSingle();

      if (error) return local || null;

      if (!data) {
        if (local) {
          const ageMs = Date.now() - new Date(local.created_at || 0).getTime();
          if (ageMs >= 15_000) {
            this.saveOrders(localList.filter((o) => o.id.toUpperCase() !== cleanId.toUpperCase()));
            return null;
          }
          return local;
        }
        return null;
      }

      if (data.status === 'dihapus') {
        try {
          const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
          const delArr: string[] = JSON.parse(deletedRaw);
          if (!delArr.includes(data.id)) {
            delArr.push(data.id);
            localStorage.setItem('dulang_deleted_order_ids', JSON.stringify(delArr.slice(-300)));
          }
        } catch {}
        this.saveOrders(localList.filter((o) => o.id.toUpperCase() !== data.id.toUpperCase()));
        return null;
      }

      const { cleanNotes, meta } = unpackOrderNotes(data.notes);
      const remoteKitchen = (data.kitchen_status as KitchenCookingStatus) || meta.kitchen_status;

      const KITCHEN_STAGE_WEIGHT: Record<string, number> = {
        antre: 1,
        sedang_goreng: 2,
        packing: 3,
        siap: 4,
        selesai: 5,
      };

      let finalKitchen = remoteKitchen;
      if (local?.kitchen_status) {
        const localWeight = KITCHEN_STAGE_WEIGHT[local.kitchen_status] || 0;
        const remoteWeight = KITCHEN_STAGE_WEIGHT[remoteKitchen || ''] || 0;
        if (localWeight > remoteWeight) finalKitchen = local.kitchen_status;
      }

      const fetchedOrder: OrderRecord = {
        id: data.id,
        customer_name: data.customer_name || 'Pelanggan Web',
        customer_wa: data.customer_wa || undefined,
        customer_qr_id: data.customer_qr_id || undefined,
        items: Array.isArray(data.items) ? data.items : [],
        total_price: Number(data.total_price || 0),
        payment_method: (data.payment_method as PaymentMethod) || 'tunai',
        status: (data.status as OrderStatus) || (local?.status || 'menunggu'),
        delivery_method: data.delivery_method === 'delivery' ? 'delivery' : 'pickup',
        shipping_cost: Number(data.shipping_cost || 0),
        shipping_district: data.shipping_district || undefined,
        delivery_schedule: data.delivery_schedule || meta.delivery_schedule || undefined,
        delivery_slot: data.delivery_slot || meta.delivery_slot || undefined,
        dp_amount: data.dp_amount ? Number(data.dp_amount) : meta.dp_amount,
        remaining_amount:
          data.remaining_amount !== undefined && data.remaining_amount !== null
            ? Number(data.remaining_amount)
            : meta.remaining_amount,
        channel: data.channel || 'web_wa',
        notes: cleanNotes || undefined,
        kitchen_status: finalKitchen,
        cooking_started_at: data.cooking_started_at || meta.cooking_started_at || local?.cooking_started_at,
        cooking_completed_at: data.cooking_completed_at || meta.cooking_completed_at || local?.cooking_completed_at,
        cashier_name: data.cashier_name || meta.cashier_name || local?.cashier_name,
        print_count:
          data.print_count !== undefined && data.print_count !== null
            ? Number(data.print_count)
            : meta.print_count ?? local?.print_count,
        last_printed_at: data.last_printed_at || meta.last_printed_at || local?.last_printed_at,
        cancellation_reason: data.cancellation_reason || meta.cancellation_reason || local?.cancellation_reason,
        cancelled_by: data.cancelled_by || meta.cancelled_by || local?.cancelled_by,
        cancelled_at: data.cancelled_at || meta.cancelled_at || local?.cancelled_at,
        created_at: data.created_at || new Date().toISOString(),
        completed_at: data.completed_at || local?.completed_at,
      };

      const existingIdx = localList.findIndex((o) => o.id.toUpperCase() === fetchedOrder.id.toUpperCase());
      let updatedList: OrderRecord[];
      if (existingIdx >= 0) {
        updatedList = [...localList];
        updatedList[existingIdx] = fetchedOrder;
      } else {
        updatedList = [fetchedOrder, ...localList];
      }
      this.saveOrders(updatedList);

      return fetchedOrder;
    } catch (err) {
      console.warn('Failed to fetch order by ID:', err);
      return this.getOrders().find((o) => o.id.toUpperCase() === orderId.trim().toUpperCase()) || null;
    }
  },

  saveOrders(orders: OrderRecord[]): void {
    try {
      let deletedUpper = new Set<string>();
      try {
        const delRaw = localStorage.getItem('dulang_deleted_order_ids');
        if (delRaw) {
          const arr = JSON.parse(delRaw);
          if (Array.isArray(arr)) {
            deletedUpper = new Set(arr.map((x) => String(x).toUpperCase()));
          }
        }
      } catch {}

      const cleanOrders = (orders || []).filter(
        (o) =>
          o &&
          String(o.status || '').toLowerCase() !== 'dihapus' &&
          !deletedUpper.has(String(o.id || '').toUpperCase())
      );
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(cleanOrders));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
      }
    } catch (e) {
      console.error('Failed to save orders:', e);
    }
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const orders = this.getOrders();
      const target = orders.find((o) => o.id === orderId);
      if (target && target.status !== 'batal' && target.items && target.items.length > 0) {
        this.restoreStockForOrder(target.items);
      }
      const list = orders.filter((o) => o.id !== orderId);
      this.saveOrders(list);

      // Catat ID ke daftar tombstone agar sinkronisasi cloud tidak memunculkannya lagi
      try {
        const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
        const deletedIds: string[] = JSON.parse(deletedRaw);
        if (!deletedIds.includes(orderId)) {
          deletedIds.push(orderId);
          if (deletedIds.length > 300) deletedIds.shift();
          localStorage.setItem('dulang_deleted_order_ids', JSON.stringify(deletedIds));
        }
      } catch (err) {
        console.warn('Failed to store deleted order ID:', err);
      }

      // Tandai status='dihapus' (jika RLS memblok DELETE fisik) sekaligus coba hapus permanen dari Supabase Cloud
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('orders').update({ status: 'dihapus' }).eq('id', orderId);
        } catch (err) {
          console.warn('Failed to soft-delete order in Supabase:', err);
        }
        try {
          await client.from('orders').delete().eq('id', orderId);
        } catch (err) {
          console.warn('Failed to delete order from Supabase:', err);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dulang_kitchen_updated', { detail: { orderId, deleted: true } }));
        window.dispatchEvent(new Event('dulang_orders_updated'));
      }

      return true;
    } catch (e) {
      console.error('Failed to delete order:', e);
      return false;
    }
  },

  addOrder(
    orderData: Omit<OrderRecord, 'id' | 'created_at'> & { id?: string; created_at?: string }
  ): OrderRecord {
    const list = this.getOrders();
    let candidateId = orderData.id || `ORD-${Date.now().toString().slice(-4)}`;
    if (!orderData.id && list.some((o) => o.id === candidateId)) {
      candidateId = `ORD-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 9)}`;
    }
    const newOrder: OrderRecord = {
      ...orderData,
      id: candidateId,
      created_at: orderData.created_at || new Date().toISOString(),
      kitchen_status: orderData.kitchen_status || 'antre',
    };
    const updated = [newOrder, ...list.filter((o) => o.id !== newOrder.id)];
    this.saveOrders(updated);

    // Kurangi kuota stok porsi otomatis jika item menu memiliki kuota
    if (newOrder.items && newOrder.items.length > 0) {
      this.deductStockForOrder(newOrder.items);
    }

    // Auto-sync order baru ke Supabase Cloud
    try {
      const client = getSupabaseClient();
      if (client) {
        const packedNotes = buildOrderPackedNotes(newOrder);

        client
          .from('orders')
          .upsert(
            {
              id: newOrder.id,
              customer_name: newOrder.customer_name,
              customer_wa: newOrder.customer_wa || null,
              customer_qr_id: newOrder.customer_qr_id || null,
              items: newOrder.items,
              total_price: newOrder.total_price,
              payment_method: newOrder.payment_method || 'tunai',
              status: newOrder.status || 'menunggu',
              delivery_method: newOrder.delivery_method || 'pickup',
              shipping_cost: newOrder.shipping_cost || 0,
              shipping_district: newOrder.shipping_district || null,
              channel: newOrder.channel || 'web_wa',
              notes: packedNotes || null,
              created_at: newOrder.created_at,
              completed_at: newOrder.completed_at || null,
            },
            { onConflict: 'id' }
          )
          .then(({ error }: any) => {
            if (error) {
              console.warn('Supabase order upload note:', error.message);
            }
          });
      }
    } catch (err) {
      console.warn('Supabase order sync error:', err);
    }

    return newOrder;
  },

  /**
   * Terima dan catat pesanan multi-channel dari GoFood, ShopeeFood, GrabFood
   */
  ingestExternalOrder(data: {
    channel: 'gofood' | 'shopeefood' | 'grabfood';
    externalOrderId: string;
    customerName?: string;
    items: { menuId?: string; nama: string; qty: number; harga: number; pilihanOpsi?: string; variantType?: 'matang' | 'frozen' }[];
    totalPrice?: number;
    notes?: string;
  }): OrderRecord {
    const list = this.getOrders();
    const existing = list.find((o) => o.external_order_id === data.externalOrderId);
    if (existing) {
      return existing;
    }

    const cfg = this.getStoreConfig();
    let commissionPercent = 20;
    if (data.channel === 'gofood') commissionPercent = cfg.gofoodCommissionPercent ?? 20;
    else if (data.channel === 'shopeefood') commissionPercent = cfg.shopeefoodCommissionPercent ?? 20;
    else if (data.channel === 'grabfood') commissionPercent = cfg.grabfoodCommissionPercent ?? 20;

    const calcTotal = data.totalPrice || data.items.reduce((sum, it) => sum + (it.harga * it.qty), 0);
    const commissionAmount = Math.round((calcTotal * commissionPercent) / 100);
    const netPayout = calcTotal - commissionAmount;

    const channelPrefix = data.channel === 'gofood' ? 'GoFood' : data.channel === 'shopeefood' ? 'ShopeeFood' : 'GrabFood';
    const fallbackCustName = data.customerName || `Pelanggan ${channelPrefix} (${data.externalOrderId})`;

    return this.addOrder({
      customer_name: fallbackCustName,
      items: data.items.map((it) => ({
        menu_id: it.menuId || 'custom',
        nama: it.nama,
        harga: it.harga,
        qty: it.qty,
        pilihanOpsi: it.pilihanOpsi,
        variantType: it.variantType || 'matang',
      })),
      total_price: calcTotal,
      payment_method: 'transfer',
      status: 'lunas',
      channel: data.channel,
      delivery_method: 'pickup',
      external_order_id: data.externalOrderId,
      platform_commission_percent: commissionPercent,
      platform_commission_amount: commissionAmount,
      net_platform_payout: netPayout,
      kitchen_status: 'antre',
      notes: data.notes || `Pesanan ${channelPrefix} #${data.externalOrderId}`,
    });
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
      kitchen_status: 'antre',
      notes: `Pesanan via WhatsApp: ${waData.rawText || (waData.deliveryType === 'DELIVERY' ? `Kirim ke ${waData.area}` : 'Ambil Sendiri di Dapur')}`,
      created_at: new Date().toISOString(),
    };

    const updated = [newOrder, ...list];
    this.saveOrders(updated);

    if (newOrder.items && newOrder.items.length > 0) {
      this.deductStockForOrder(newOrder.items);
    }

    try {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('orders')
          .upsert(
            {
              id: newOrder.id,
              customer_name: newOrder.customer_name,
              customer_wa: newOrder.customer_wa || null,
              items: newOrder.items,
              total_price: newOrder.total_price,
              payment_method: newOrder.payment_method,
              status: newOrder.status,
              delivery_method: newOrder.delivery_method,
              shipping_cost: newOrder.shipping_cost || 0,
              shipping_district: newOrder.shipping_district || null,
              channel: newOrder.channel,
              notes: buildOrderPackedNotes(newOrder) || null,
              created_at: newOrder.created_at,
            },
            { onConflict: 'id' }
          )
          .then(() => {}, () => {});
      }
    } catch (err) {
      console.warn('Supabase WA order sync error:', err);
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

  updateOrderDP(orderId: string, dpAmount: number, paymentMethod?: PaymentMethod): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const existing = list[idx];
    const cleanDp = Math.max(0, Math.min(dpAmount, existing.total_price));
    const remaining = Math.max(0, existing.total_price - cleanDp);
    const updatedOrder: OrderRecord = {
      ...existing,
      status: 'dp',
      dp_amount: cleanDp,
      remaining_amount: remaining,
      payment_method: paymentMethod || existing.payment_method || 'transfer',
    };

    const updatedList = [...list];
    updatedList[idx] = updatedOrder;
    this.saveOrders(updatedList);

    // Sync status perubahan ke Supabase Cloud
    try {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('orders')
          .update({
            status: 'dp',
            payment_method: updatedOrder.payment_method,
            notes: buildOrderPackedNotes(updatedOrder),
          })
          .eq('id', orderId)
          .then();
      }
    } catch (e) {
      console.warn('Update order DP to Supabase error:', e);
    }

    return updatedOrder;
  },

  updateOrderStatus(orderId: string, status: OrderStatus, paymentMethod?: PaymentMethod): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const existing = list[idx];

    // Otomatisasi pengembalian/pemotongan stok saat status order batal atau diaktifkan kembali
    if (status === 'batal' && existing.status !== 'batal') {
      if (existing.items && existing.items.length > 0) {
        this.restoreStockForOrder(existing.items);
      }
    } else if (existing.status === 'batal' && status !== 'batal') {
      if (existing.items && existing.items.length > 0) {
        this.deductStockForOrder(existing.items);
      }
    }

    const updatedOrder: OrderRecord = {
      ...existing,
      status,
      payment_method: paymentMethod || existing.payment_method,
      remaining_amount: status === 'lunas' ? 0 : existing.remaining_amount,
      completed_at: status === 'lunas' ? new Date().toISOString() : existing.completed_at,
    };

    const updatedList = [...list];
    updatedList[idx] = updatedOrder;
    this.saveOrders(updatedList);

    const packedNotes = buildOrderPackedNotes(updatedOrder);

    // Sync status perubahan ke Supabase Cloud
    try {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('orders')
          .update({
            status: updatedOrder.status,
            payment_method: updatedOrder.payment_method,
            completed_at: updatedOrder.completed_at || null,
            notes: packedNotes,
          })
          .eq('id', orderId)
          .then();
      }
    } catch (e) {
      console.warn('Update order to Supabase error:', e);
    }

    // Jika berstatus lunas, otomatis mutakhirkan profil preferensi pelanggan & potong stok bahan baku
    if (status === 'lunas') {
      if (updatedOrder.customer_name) {
        this.updateCustomerIntelligence(updatedOrder);
      }
      this.deductIngredientsForOrder(updatedOrder);
    }
    return updatedOrder;
  },

  updateKitchenCookingStatus(orderId: string, kitchenStatus: KitchenCookingStatus): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;

    const existing = list[idx];
    const now = new Date().toISOString();
    const updatedOrder: OrderRecord = {
      ...existing,
      kitchen_status: kitchenStatus,
      cooking_started_at:
        kitchenStatus === 'sedang_goreng' && !existing.cooking_started_at ? now : existing.cooking_started_at,
      cooking_completed_at:
        (kitchenStatus === 'siap' || kitchenStatus === 'selesai') && !existing.cooking_completed_at
          ? now
          : existing.cooking_completed_at,
    };

    const updatedList = [...list];
    updatedList[idx] = updatedOrder;
    this.saveOrders(updatedList);

    const packedNotes = buildOrderPackedNotes(updatedOrder);

    // Sync status perubahan ke Supabase Cloud jika aktif
    try {
      const client = getSupabaseClient();
      if (client) {
        // 1. Selalu perbarui 'notes' (memuat metadata terenkapsulasi yang dijamin sukses tanpa migrasi DDL)
        client
          .from('orders')
          .update({
            notes: packedNotes,
            ...(kitchenStatus === 'selesai' ? { completed_at: now } : {}),
          })
          .eq('id', orderId)
          .then(
            () => {
              // 2. Jika kolom kitchen_status sudah ada di Supabase, update juga secara native
              client
                .from('orders')
                .update({
                  kitchen_status: updatedOrder.kitchen_status,
                  cooking_started_at: updatedOrder.cooking_started_at || null,
                  cooking_completed_at: updatedOrder.cooking_completed_at || null,
                })
                .eq('id', orderId)
                .then(
                  () => {},
                  () => {}
                );
            },
            (err: any) => {
              console.warn('Update order notes to Supabase error:', err);
            }
          );
      }
    } catch (e) {
      console.warn('Update order kitchen_status to Supabase error:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dulang_kitchen_updated', {
          detail: { order: updatedOrder, kitchenStatus },
        })
      );
    }

    return updatedOrder;
  },

  // --- CATAT CETAK ULANG STRUK (REPRINT AUDIT) ---
  incrementOrderPrintCount(orderId: string): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;
    const current = list[idx];
    const currentCount = current.print_count || 0;
    const updated: OrderRecord = {
      ...current,
      print_count: currentCount + 1,
      last_printed_at: new Date().toISOString(),
    };
    const updatedList = [...list];
    updatedList[idx] = updated;
    this.saveOrders(updatedList);

    try {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('orders')
          .update({
            notes: buildOrderPackedNotes(updated),
          })
          .eq('id', orderId)
          .then(() => {}, () => {});
      }
    } catch (e) {
      console.warn('Sync print count to Supabase error:', e);
    }

    return updated;
  },

  // --- PEMBATALAN NOTA (VOID ORDER WITH AUDIT) ---
  voidOrder(orderId: string, reason: string, cancelledBy?: string): OrderRecord | null {
    const list = this.getOrders();
    const idx = list.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;
    const current = list[idx];
    const activeShift = this.getActiveShift();
    const cName = cancelledBy || activeShift?.cashier_name || 'Kasir Stand';
    const now = new Date().toISOString();

    const updated: OrderRecord = {
      ...current,
      status: 'batal',
      cancellation_reason: reason.trim(),
      cancelled_by: cName,
      cancelled_at: now,
    };
    const updatedList = [...list];
    updatedList[idx] = updated;
    this.saveOrders(updatedList);

    // Kembalikan stok menu jika pesanan sebelumnya aktif
    if (current.items && current.items.length > 0 && current.status !== 'batal') {
      try {
        const menus = this.getMenus();
        current.items.forEach((item) => {
          const mIdx = menus.findIndex((m) => m.id === item.menu_id || m.nama === item.nama);
          if (mIdx >= 0 && menus[mIdx].sisaStok !== null && menus[mIdx].sisaStok !== undefined) {
            menus[mIdx].sisaStok = (menus[mIdx].sisaStok || 0) + item.qty;
            if ((menus[mIdx].sisaStok || 0) > 0) {
              menus[mIdx].tersedia = true;
            }
          }
        });
        this.saveMenus(menus);
      } catch (e) {
        console.warn('Failed to restore menu stock on void:', e);
      }
    }

    try {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('orders')
          .update({
            status: 'batal',
            notes: buildOrderPackedNotes(updated),
          })
          .eq('id', orderId)
          .then(() => {}, () => {});
      }
    } catch (e) {
      console.warn('Sync void order to Supabase error:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dulang_order_voided', { detail: { order: updated } }));
    }
    return updated;
  },

  getKitchenOrders(): OrderRecord[] {
    const orders = this.getOrders();
    // Kembalikan semua pesanan yang bukan berstatus batal
    return orders.filter((o) => o.status !== 'batal');
  },

  generateTrackingUrl(orderId: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://dulangweb.vercel.app';
    return `${origin}/?track=${orderId}`;
  },

  generateWaTrackingMessage(order: OrderRecord): string {
    const trackingUrl = this.generateTrackingUrl(order.id);
    const kStatus = order.kitchen_status || 'antre';

    const itemsSummary = (order.items || [])
      .map((i) => `• ${i.qty}x ${i.nama} (${i.variantType === 'frozen' ? '❄️ Frozen' : '🔥 Matang'})`)
      .join('\n');

    if (kStatus === 'sedang_goreng') {
      return `*DAPUR DULANG UPDATE* 🔥
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*!
Wajan menyala! Pesanan *#${order.id}* saat ini:
👉 *Sedang Digoreng Hangat di Wajan Dulang 🔥*
Kulit risoles digoreng keemasan hingga renyah krispi & mayonya meleleh lumer.

*Rincian Menu:*
${itemsSummary}

📍 *Pantau proses wajan live di sini:*
${trackingUrl}

_Dapur Dulang Indonesia - Dibuat dengan wajan panas & tulisan tangan_`;
    }

    if (kStatus === 'packing') {
      return `*DAPUR DULANG UPDATE* 📦
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*!
Risoles sudah matang keemasan! Pesanan *#${order.id}* saat ini:
👉 *Sedang Ditiriskan & Masuk Dus Kemasan Cantik 📦*

*Rincian Menu:*
${itemsSummary}

📍 *Pantau kesiapan pesananmu di sini:*
${trackingUrl}

_Sebentar lagi siap diambil / diantar kurir yaa! 🙏✨_`;
    }

    if (kStatus === 'siap') {
      const isDelivery = order.delivery_method === 'delivery';
      return `*DAPUR DULANG UPDATE* 🥟✨
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*!
Kabar gembira! Pesanan *#${order.id}* sudah:
👉 *SIAP ${isDelivery ? 'DIKIRIM KURIR DULANG 🛵' : 'DIAMBIL DI DAPUR DULANG 🥟'}*

${isDelivery ? `🛵 Kurir kami bersiap mengantar ke lokasi Kakak (${order.shipping_district || 'Sidoarjo'}).` : '📍 Wajan sudah selesai goreng! Silakan merapat ke Dapur Dulang (Pasar Payan) yaa.'}

*Rincian Pesanan:*
${itemsSummary}

🔗 *Buka kartu resi & detail pesanan:*
${trackingUrl}

_Matur suwun sanget! Hangatkan kembali bila perlu yaa 🙏✨_`;
    }

    if (kStatus === 'selesai') {
      return `*DAPUR DULANG* 🎉
━━━━━━━━━━━━━━━━━━━━━
Matur suwun sanget Kak *${order.customer_name}* sampun jajan di Dapur Dulang! 🙏✨

Pesanan *#${order.id}* telah selesai diserahkan. Selamat menikmati selagi anget yaa! 🥟🔥

⭐ *Bantu dapur kami dengan ulasan bintang 5 & klaim Kupon Diskon Repeat Order:*
👉 ${trackingUrl}

Sampai jumpa di wajan berikutnya rek! 💛`;
    }

    // Default antre
    return `*UPDATE MASAK DAPUR DULANG* 🥟✨
━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${order.customer_name}*!
Pesanan *#${order.id}* saat ini sudah masuk sistem:
👉 *Antre Masak di Dapur Dulang ⏳*

*Rincian Menu:*
${itemsSummary}

Pantau proses penggorengan secara live di sini:
🔗 ${trackingUrl}

_Dapur Dulang Indonesia - Risoles & Katering Sidoarjo_`;
  },

  openWhatsAppStatusUpdate(order: OrderRecord, targetStatus?: KitchenCookingStatus): void {
    const target = targetStatus ? { ...order, kitchen_status: targetStatus } : order;
    const text = this.generateWaTrackingMessage(target);
    const cleanWa = (order.customer_wa || '').replace(/\D/g, '');
    let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (cleanWa) {
      const waNumber = cleanWa.startsWith('0') ? '62' + cleanWa.slice(1) : cleanWa;
      url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
      let latestOrderAt: string | undefined = undefined;

      custOrders.forEach((o) => {
        totalSpent += o.total_price || 0;
        if (o.created_at) {
          if (!latestOrderAt || new Date(o.created_at).getTime() > new Date(latestOrderAt).getTime()) {
            latestOrderAt = o.created_at;
          }
        }
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
        const effectiveLastOrder = latestOrderAt || (order.status === 'lunas' ? order.created_at : cust.last_order_at);
        const updatedCust: Customer = {
          ...cust,
          total_orders: Math.max(cust.total_orders, custOrders.length),
          total_spent: totalSpent,
          favorite_menu: topMenu || cust.favorite_menu,
          favorite_option: topOption || cust.favorite_option,
          last_order_at: effectiveLastOrder,
          status: custOrders.length >= 5 ? 'Sultan Dulang' : custOrders.length >= 2 ? 'Setia' : 'Baru',
        };
        const updatedList = [...customers];
        updatedList[custIdx] = updatedCust;
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedList));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('dulang_customers_updated'));
        }

        const client = getSupabaseClient();
        if (client) {
          client.from('customers').upsert(updatedCust).then(() => {}, () => {});
        }
      }
    } catch (e) {
      console.warn('Failed to update customer intelligence:', e);
    }
  },

  async clearOrders(): Promise<void> {
    try {
      const current = this.getOrders();
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));

      try {
        const deletedRaw = localStorage.getItem('dulang_deleted_order_ids') || '[]';
        const deletedIds: string[] = JSON.parse(deletedRaw);
        current.forEach((o) => {
          if (!deletedIds.includes(o.id)) deletedIds.push(o.id);
        });
        localStorage.setItem('dulang_deleted_order_ids', JSON.stringify(deletedIds));
      } catch (err) {
        console.warn('Failed to store deleted order IDs:', err);
      }

      const client = getSupabaseClient();
      if (client) {
        if (current.length > 0) {
          try {
            const ids = current.map((o) => o.id);
            await client.from('orders').update({ status: 'dihapus' }).in('id', ids);
            await client.from('orders').delete().in('id', ids);
          } catch (err) {
            console.warn('Failed to clear orders from Supabase:', err);
          }
        }
        try {
          await client.from('orders').update({ status: 'dihapus' }).neq('status', 'dihapus');
        } catch (err) {
          console.warn('Failed to soft-clear remaining orders from Supabase:', err);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_orders_updated'));
        window.dispatchEvent(new CustomEvent('dulang_kitchen_updated', { detail: { cleared: true } }));
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

  async syncTestimonialsFromSupabase(): Promise<CustomerTestimonial[]> {
    try {
      const client = getSupabaseClient();
      if (!client) return this.getTestimonials();

      const { data, error } = await client
        .from('menus')
        .select('deskripsi')
        .eq('id', SYS_PUBLIC_TESTIMONIALS_ID)
        .single();

      if (!error && data?.deskripsi) {
        const parsed = JSON.parse(data.deskripsi);
        const remoteItems = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
          ? parsed.items
          : null;
        if (remoteItems) {
          localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(remoteItems));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('dulang_testimonials_updated'));
          }
          return remoteItems;
        }
      }
    } catch (e) {
      console.warn('Failed to sync testimonials from Supabase:', e);
    }
    return this.getTestimonials();
  },

  async saveTestimonials(testimonials: CustomerTestimonial[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.TESTIMONIALS, JSON.stringify(testimonials));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
      }
      const client = getSupabaseClient();
      if (client) {
        await client.from('menus').upsert({
          id: SYS_PUBLIC_TESTIMONIALS_ID,
          nama: 'SYSTEM_PUBLIC_TESTIMONIALS',
          harga: 0,
          deskripsi: JSON.stringify({
            items: testimonials,
            updatedAt: new Date().toISOString(),
          }),
          tersedia: true,
        });
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
    this.saveTestimonials([]);
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

  // --- KAS LACI KASIR (PETTY CASH) & SHIFT MANAGEMENT ---
  addDrawerExpense(namaItem: string, nominal: number, cashierName?: string, catatan?: string): ExpenseRecord {
    const active = this.getActiveShift();
    const cName = cashierName || active?.cashier_name || 'Kasir Stand';
    return this.addExpense({
      tanggal: new Date().toISOString().split('T')[0],
      kategori: 'operasional',
      nama_item: `[Kas Laci] ${namaItem.trim()}`,
      nominal: Math.max(0, nominal),
      catatan: catatan ? `${catatan} (Kasir: ${cName})` : `Pengeluaran laci kasir oleh ${cName}`,
      source: 'kas_laci',
      cashier_name: cName,
    });
  },

  getActiveShift(): CashierShift | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SHIFT);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  startShift(cashierName: string, openingCashFloat: number): CashierShift {
    const newShift: CashierShift = {
      id: `SHIFT-${Date.now()}`,
      cashier_name: cashierName.trim() || 'Kasir Stand',
      started_at: new Date().toISOString(),
      status: 'open',
      opening_cash_float: Math.max(0, openingCashFloat),
      drawer_expenses: 0,
      total_orders_count: 0,
      total_revenue: 0,
      cash_revenue: 0,
      non_cash_revenue: 0,
    };
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SHIFT, JSON.stringify(newShift));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dulang_shift_updated', { detail: { shift: newShift } }));
    }
    return newShift;
  },

  getShiftExpenses(shiftStartedAt: string): ExpenseRecord[] {
    const expenses = this.getExpenses();
    return expenses.filter((e) => {
      return e.source === 'kas_laci' && new Date(e.created_at) >= new Date(shiftStartedAt);
    });
  },

  closeShift(actualCash: number, notes?: string): CashierShift | null {
    const active = this.getActiveShift();
    if (!active) return null;

    // Filter seluruh pesanan aktif selama shift
    const orders = this.getOrders().filter((o) => {
      const isTimeValid = new Date(o.created_at) >= new Date(active.started_at);
      const isStatusValid = o.status === 'lunas' || o.status === 'dp';
      return isTimeValid && isStatusValid;
    });

    const shiftExpenses = this.getShiftExpenses(active.started_at);
    const totalDrawerExpenses = shiftExpenses.reduce((sum, e) => sum + e.nominal, 0);

    const cashRevenue = orders
      .filter((o) => o.payment_method === 'tunai')
      .reduce((sum, o) => sum + (o.status === 'dp' ? (o.dp_amount || 0) : o.total_price), 0);

    const nonCashRevenue = orders
      .filter((o) => o.payment_method !== 'tunai')
      .reduce((sum, o) => sum + (o.status === 'dp' ? (o.dp_amount || 0) : o.total_price), 0);

    const totalRevenue = cashRevenue + nonCashRevenue;
    const expectedDrawerCash = active.opening_cash_float + cashRevenue - totalDrawerExpenses;
    const cashDifference = actualCash - expectedDrawerCash;

    // Hitung total porsi makanan terjual selama shift
    const totalPortions = orders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.qty || 1), 0);
    }, 0);

    const storeConfig = this.getStoreConfig();
    const targetPortions = storeConfig.cashierDailyTargetPortions || 100;
    const bonusPerPortion = storeConfig.cashierBonusPerPortion || 100;
    const targetAchieved = totalPortions >= targetPortions;
    const bonusEarned = targetAchieved ? totalPortions * bonusPerPortion : 0;

    const closedShift: CashierShift = {
      ...active,
      ended_at: new Date().toISOString(),
      status: 'closed',
      expected_drawer_cash: expectedDrawerCash,
      actual_drawer_cash: actualCash,
      cash_difference: cashDifference,
      drawer_expenses: totalDrawerExpenses,
      total_orders_count: orders.length,
      total_revenue: totalRevenue,
      cash_revenue: cashRevenue,
      non_cash_revenue: nonCashRevenue,
      total_portions: totalPortions,
      target_portions: targetPortions,
      target_achieved: targetAchieved,
      bonus_earned: bonusEarned,
      notes: notes?.trim() || undefined,
    };

    const history = this.getShiftHistory();
    const updatedHistory = [closedShift, ...history].slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.SHIFT_HISTORY, JSON.stringify(updatedHistory));
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SHIFT);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dulang_shift_updated', { detail: { shift: null } }));
    }
    return closedShift;
  },

  getActiveShiftMetrics(): {
    activeShift: CashierShift | null;
    totalOrders: number;
    totalPortions: number;
    cashRevenue: number;
    nonCashRevenue: number;
    totalRevenue: number;
    drawerExpenses: number;
    expectedDrawerCash: number;
    targetPortions: number;
    targetAchieved: boolean;
    bonusPerPortion: number;
    bonusEarned: number;
  } {
    const active = this.getActiveShift();
    const storeConfig = this.getStoreConfig();
    const targetPortions = storeConfig.cashierDailyTargetPortions || 100;
    const bonusPerPortion = storeConfig.cashierBonusPerPortion || 100;

    if (!active) {
      return {
        activeShift: null,
        totalOrders: 0,
        totalPortions: 0,
        cashRevenue: 0,
        nonCashRevenue: 0,
        totalRevenue: 0,
        drawerExpenses: 0,
        expectedDrawerCash: 0,
        targetPortions,
        targetAchieved: false,
        bonusPerPortion,
        bonusEarned: 0,
      };
    }

    const orders = this.getOrders().filter((o) => {
      const isTimeValid = new Date(o.created_at) >= new Date(active.started_at);
      const isStatusValid = o.status === 'lunas' || o.status === 'dp';
      return isTimeValid && isStatusValid;
    });

    const shiftExpenses = this.getShiftExpenses(active.started_at);
    const drawerExpenses = shiftExpenses.reduce((sum, e) => sum + e.nominal, 0);

    const cashRevenue = orders
      .filter((o) => o.payment_method === 'tunai')
      .reduce((sum, o) => sum + (o.status === 'dp' ? (o.dp_amount || 0) : o.total_price), 0);

    const nonCashRevenue = orders
      .filter((o) => o.payment_method !== 'tunai')
      .reduce((sum, o) => sum + (o.status === 'dp' ? (o.dp_amount || 0) : o.total_price), 0);

    const totalRevenue = cashRevenue + nonCashRevenue;
    const expectedDrawerCash = active.opening_cash_float + cashRevenue - drawerExpenses;

    const totalPortions = orders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.qty || 1), 0);
    }, 0);

    const targetAchieved = totalPortions >= targetPortions;
    const bonusEarned = targetAchieved ? totalPortions * bonusPerPortion : 0;

    return {
      activeShift: active,
      totalOrders: orders.length,
      totalPortions,
      cashRevenue,
      nonCashRevenue,
      totalRevenue,
      drawerExpenses,
      expectedDrawerCash,
      targetPortions,
      targetAchieved,
      bonusPerPortion,
      bonusEarned,
    };
  },

  getCashierLeaderboard(): CashierLeaderboardEntry[] {
    const history = this.getShiftHistory();
    const active = this.getActiveShift();
    const allOrders = this.getOrders().filter((o) => o.status !== 'batal');
    const storeConfig = this.getStoreConfig();
    const targetPortions = storeConfig.cashierDailyTargetPortions || 100;
    const bonusPerPortion = storeConfig.cashierBonusPerPortion || 100;

    // Kumpulkan nama kasir dari shift history, active shift, dan pesanan
    const cashierMap = new Map<string, {
      shifts: CashierShift[];
      hasActiveShift: boolean;
    }>();

    for (const sh of history) {
      const name = sh.cashier_name?.trim() || 'Kasir Stand';
      if (!cashierMap.has(name)) {
        cashierMap.set(name, { shifts: [], hasActiveShift: false });
      }
      cashierMap.get(name)!.shifts.push(sh);
    }

    if (active) {
      const name = active.cashier_name?.trim() || 'Kasir Stand';
      if (!cashierMap.has(name)) {
        cashierMap.set(name, { shifts: [], hasActiveShift: true });
      } else {
        cashierMap.get(name)!.hasActiveShift = true;
      }
    }

    for (const ord of allOrders) {
      if (ord.cashier_name && ord.cashier_name.trim()) {
        const name = ord.cashier_name.trim();
        if (!cashierMap.has(name)) {
          cashierMap.set(name, { shifts: [], hasActiveShift: false });
        }
      }
    }

    if (cashierMap.size === 0) {
      cashierMap.set('Siti', { shifts: [], hasActiveShift: false });
    }

    const leaderboard: CashierLeaderboardEntry[] = [];

    cashierMap.forEach((data, name) => {
      const shifts = data.shifts;
      const totalShifts = shifts.length + (data.hasActiveShift ? 1 : 0);

      const cashierOrders = allOrders.filter((o) => (o.cashier_name || '').toLowerCase() === name.toLowerCase());
      const totalOrdersFromOrders = cashierOrders.length;
      const totalPortionsFromOrders = cashierOrders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((itemSum, item) => itemSum + (item.qty || 1), 0);
      }, 0);

      const totalOrdersFromShifts = shifts.reduce((sum, s) => sum + (s.total_orders_count || 0), 0);
      const totalPortionsFromShifts = shifts.reduce((sum, s) => sum + (s.total_portions || 0), 0);
      const totalRevenueFromShifts = shifts.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
      const cashRevenueFromShifts = shifts.reduce((sum, s) => sum + (s.cash_revenue || 0), 0);
      const nonCashRevenueFromShifts = shifts.reduce((sum, s) => sum + (s.non_cash_revenue || 0), 0);
      const totalExpensesFromShifts = shifts.reduce((sum, s) => sum + (s.drawer_expenses || 0), 0);
      const totalDiscrepancy = shifts.reduce((sum, s) => sum + (s.cash_difference || 0), 0);
      const exactShiftsCount = shifts.filter((s) => (s.cash_difference || 0) === 0).length;
      const targetAchievedCount = shifts.filter((s) => s.target_achieved).length;
      const totalBonusFromShifts = shifts.reduce((sum, s) => sum + (s.bonus_earned || 0), 0);

      const finalOrders = Math.max(totalOrdersFromShifts, totalOrdersFromOrders);
      const finalPortions = Math.max(totalPortionsFromShifts, totalPortionsFromOrders);
      const finalRevenue = totalRevenueFromShifts > 0 ? totalRevenueFromShifts : cashierOrders.reduce((sum, o) => sum + o.total_price, 0);

      const effectiveShiftCount = Math.max(1, totalShifts);
      const avgPortions = Math.round(finalPortions / effectiveShiftCount);
      const honestyRate = shifts.length > 0 ? Math.round((exactShiftsCount / shifts.length) * 100) : 100;
      const isTargetAchieved = avgPortions >= targetPortions || targetAchievedCount > 0;
      const totalBonusEarned = totalBonusFromShifts > 0 ? totalBonusFromShifts : (isTargetAchieved ? finalPortions * bonusPerPortion : 0);

      const lastShift = shifts[0];
      const lastActiveAt = lastShift?.ended_at || lastShift?.started_at || (cashierOrders[0]?.created_at) || undefined;

      leaderboard.push({
        cashier_name: name,
        total_shifts: totalShifts,
        total_orders: finalOrders,
        total_portions: finalPortions,
        total_revenue: finalRevenue,
        cash_revenue: cashRevenueFromShifts,
        non_cash_revenue: nonCashRevenueFromShifts,
        total_drawer_expenses: totalExpensesFromShifts,
        total_discrepancy: totalDiscrepancy,
        exact_shifts_count: exactShiftsCount,
        honesty_rate: honestyRate,
        avg_portions_per_shift: avgPortions,
        target_portions: targetPortions,
        target_achieved_count: targetAchievedCount,
        is_target_achieved: isTargetAchieved,
        bonus_per_portion: bonusPerPortion,
        total_bonus_earned: totalBonusEarned,
        last_active_at: lastActiveAt,
      });
    });

    return leaderboard.sort((a, b) => b.total_portions - a.total_portions);
  },

  getShiftHistory(): CashierShift[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHIFT_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // --- BACKUP & RESTORE DATABASE OFFLINE (.JSON) ---
  exportDatabaseBackup(): DulangDatabaseBackup {
    return {
      version: '1.2',
      exported_at: new Date().toISOString(),
      app_name: 'Dapur Dulang Indonesia',
      menus: this.getMenus(),
      customers: this.getCustomers(),
      orders: this.getOrders(),
      testimonials: this.getTestimonials(),
      vouchers: this.getVouchers(),
      storeConfig: sanitizeStoreConfig(this.getStoreConfig()) as StoreConfig,
      expenses: this.getExpenses(),
      pantryIngredients: this.getPantryIngredients(),
      menuRecipes: this.getMenuRecipes(),
      kitchenRecaps: this.getKitchenRecaps(),
      subuhPlans: this.getSubuhPlans(),
      stockMovements: this.getStockMovements(),
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
        const cleanCfg = sanitizeStoreConfig(backup.storeConfig);
        localStorage.setItem('dulang_store_config', JSON.stringify(cleanCfg));
      }
      if (Array.isArray(backup.expenses)) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(backup.expenses));
      }
      if (Array.isArray(backup.pantryIngredients)) {
        localStorage.setItem(STORAGE_KEYS.PANTRY_INGREDIENTS, JSON.stringify(backup.pantryIngredients));
      }
      if (Array.isArray(backup.menuRecipes)) {
        localStorage.setItem(STORAGE_KEYS.MENU_RECIPES, JSON.stringify(backup.menuRecipes));
      }
      if (Array.isArray(backup.kitchenRecaps)) {
        localStorage.setItem(STORAGE_KEYS.KITCHEN_RECAPS, JSON.stringify(backup.kitchenRecaps));
      }
      if (Array.isArray(backup.subuhPlans)) {
        localStorage.setItem(STORAGE_KEYS.SUBUH_PLANS, JSON.stringify(backup.subuhPlans));
      }
      if (Array.isArray(backup.stockMovements)) {
        localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(backup.stockMovements));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dulang_menus_updated'));
        window.dispatchEvent(new Event('dulang_customers_updated'));
        window.dispatchEvent(new Event('dulang_orders_updated'));
        window.dispatchEvent(new Event('dulang_testimonials_updated'));
        window.dispatchEvent(new Event('dulang_vouchers_updated'));
        window.dispatchEvent(new Event('dulang_store_config_updated'));
        window.dispatchEvent(new Event('dulang_expenses_updated'));
        window.dispatchEvent(new Event('dulang_pantry_updated'));
        window.dispatchEvent(new Event('dulang_recipes_updated'));
        window.dispatchEvent(new Event('dulang_stock_movements_updated'));
      }

      const totalOrders = Array.isArray(backup.orders) ? backup.orders.length : 0;
      const totalCust = Array.isArray(backup.customers) ? backup.customers.length : 0;
      const totalExpenses = Array.isArray(backup.expenses) ? backup.expenses.length : 0;
      return {
        success: true,
        message: `Database berhasil dipulihkan! (${totalOrders} pesanan, ${totalCust} pelanggan, ${totalExpenses} catatan kas).`,
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

  getOwnerWa(): string {
    return localStorage.getItem('dulang_owner_wa') || BRAND.whatsapp || '6287703397035';
  },

  setOwnerWa(wa: string): void {
    localStorage.setItem('dulang_owner_wa', wa.replace(/\D/g, ''));
  },

  // --- GUDANG BAHAN BAKU & RESEP HPP OTOMATIS ---
  getPantryIngredients(): PantryIngredient[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PANTRY_INGREDIENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read pantry ingredients:', e);
    }
    return DEFAULT_PANTRY_INGREDIENTS;
  },

  savePantryIngredients(list: PantryIngredient[]): void {
    localStorage.setItem(STORAGE_KEYS.PANTRY_INGREDIENTS, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_pantry_updated'));
    }
  },

  restockIngredient(
    id: string,
    addedQty: number,
    costPerUnit?: number,
    recordExpense = false,
    expenseDate?: string
  ): void {
    const list = this.getPantryIngredients();
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return;

    const item = list[idx];
    const prevStock = item.currentStock;
    const newStock = Number((item.currentStock + addedQty).toFixed(2));
    const newCost = costPerUnit !== undefined && costPerUnit > 0 ? costPerUnit : item.costPerUnit;

    list[idx] = {
      ...item,
      currentStock: newStock,
      costPerUnit: newCost,
      updatedAt: new Date().toISOString(),
    };

    this.savePantryIngredients(list);

    // Catat ke Kartu Stok (Audit Log Pergerakan)
    this.recordStockMovement({
      ingredientId: item.id,
      ingredientName: item.name,
      type: 'masuk',
      amount: addedQty,
      unit: item.unit,
      previousStock: prevStock,
      newStock,
      note: `Restock belanja (+${addedQty} ${item.unit})`,
    });

    if (recordExpense) {
      const totalCost = Math.round(addedQty * newCost);
      if (totalCost > 0) {
        this.addExpense({
          tanggal: expenseDate || new Date().toISOString().split('T')[0],
          nama_item: `Belanja Restock ${item.name} (${addedQty} ${item.unit})`,
          kategori: item.category === 'kemasan' ? 'kemasan' : 'bahan_baku',
          nominal: totalCost,
          catatan: `Restock otomatis dari modul gudang bahan`,
        });
      }
    }
  },

  updatePantryIngredient(updated: PantryIngredient, note?: string): void {
    const list = this.getPantryIngredients();
    const idx = list.findIndex((p) => p.id === updated.id);
    if (idx < 0) return;

    const existing = list[idx];
    if (existing.currentStock !== updated.currentStock) {
      const diff = Number((updated.currentStock - existing.currentStock).toFixed(3));
      this.recordStockMovement({
        ingredientId: updated.id,
        ingredientName: updated.name,
        type: 'penyesuaian',
        amount: Math.abs(diff),
        unit: updated.unit,
        previousStock: existing.currentStock,
        newStock: updated.currentStock,
        note: note || `Penyesuaian stok opname (${diff > 0 ? `+${diff}` : `${diff}`} ${updated.unit})`,
      });
    }

    list[idx] = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    this.savePantryIngredients(list);
  },

  getStockMovements(): StockMovementRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STOCK_MOVEMENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read stock movements:', e);
    }
    return [];
  },

  saveStockMovements(movements: StockMovementRecord[]): void {
    // Simpan maksimal 500 riwayat transaksi stok terakhir agar performa kilat
    const trimmed = movements.slice(0, 500);
    localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_stock_movements_updated'));
    }
  },

  recordStockMovement(movement: Omit<StockMovementRecord, 'id' | 'createdAt'>): StockMovementRecord {
    const list = this.getStockMovements();
    const newRecord: StockMovementRecord = {
      ...movement,
      id: `MOV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newRecord);
    this.saveStockMovements(list);
    return newRecord;
  },

  getMenuRecipes(): MenuRecipe[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MENU_RECIPES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to read menu recipes:', e);
    }
    return DEFAULT_MENU_RECIPES;
  },

  saveMenuRecipes(recipes: MenuRecipe[]): void {
    localStorage.setItem(STORAGE_KEYS.MENU_RECIPES, JSON.stringify(recipes));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_recipes_updated'));
    }
  },

  saveMenuRecipe(recipe: MenuRecipe): void {
    const recipes = this.getMenuRecipes();
    const pantry = this.getPantryIngredients();
    const hpp = calculateRecipeHpp(recipe.components, pantry);
    const updatedRecipe = {
      ...recipe,
      calculatedHpp: hpp > 0 ? hpp : recipe.calculatedHpp,
      updatedAt: new Date().toISOString(),
    };
    const idx = recipes.findIndex((r) => r.menuId === recipe.menuId);
    if (idx >= 0) {
      recipes[idx] = updatedRecipe;
    } else {
      recipes.push(updatedRecipe);
    }
    this.saveMenuRecipes(recipes);
  },

  deductIngredientsForOrder(order: OrderRecord): { deducted: boolean; lowStockItems: PantryIngredient[] } {
    if (!order.items || order.items.length === 0 || order.ingredients_deducted) {
      return { deducted: false, lowStockItems: [] };
    }

    const pantry = this.getPantryIngredients();
    const recipes = this.getMenuRecipes();
    let hasChanges = false;

    order.items.forEach((ordItem) => {
      const recipe = recipes.find(
        (r) => r.menuId === ordItem.menu_id || r.menuName.toLowerCase() === ordItem.nama.toLowerCase()
      );
      if (!recipe) return;

      recipe.components.forEach((comp) => {
        const pIdx = pantry.findIndex((p) => p.id === comp.ingredientId);
        if (pIdx >= 0) {
          const usedQty = comp.amountPerPcs * ordItem.qty;
          const prevStock = pantry[pIdx].currentStock;
          const nextStock = Math.max(0, Number((prevStock - usedQty).toFixed(3)));
          pantry[pIdx].currentStock = nextStock;
          pantry[pIdx].updatedAt = new Date().toISOString();
          hasChanges = true;

          // Catat ke Kartu Stok (Audit Log Pergerakan Keluar)
          this.recordStockMovement({
            ingredientId: pantry[pIdx].id,
            ingredientName: pantry[pIdx].name,
            type: 'keluar',
            amount: Number(usedQty.toFixed(3)),
            unit: pantry[pIdx].unit,
            previousStock: prevStock,
            newStock: nextStock,
            note: `Pesanan #${order.id} (${ordItem.qty}x ${ordItem.nama})`,
            orderId: order.id,
          });
        }
      });
    });

    if (hasChanges) {
      this.savePantryIngredients(pantry);
      order.ingredients_deducted = true;
      const allOrders = this.getOrders();
      const oIdx = allOrders.findIndex((o) => o.id === order.id);
      if (oIdx >= 0) {
        allOrders[oIdx].ingredients_deducted = true;
        this.saveOrders(allOrders);
      }
    }

    const lowStockItems = pantry.filter((p) => p.currentStock <= p.minStock);
    return { deducted: hasChanges, lowStockItems };
  },
};

