import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeStoreConfig,
  sanitizePublicStoreConfig,
  sanitizePublicOrderRecord,
  storageService,
} from '../services/storageService';
import type { OrderRecord, StoreConfig } from '../types';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
}

describe('privacy sanitization and public/staff sync isolation', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('strips PINs on sanitizeStoreConfig and owner internals on sanitizePublicStoreConfig', () => {
    const fullConfig: StoreConfig = {
      heroImage: '/hero.jpg',
      jamBukaTeks: '10:00 - 20:00',
      schedules: [],
      brandName: 'Dulang Indonesia',
      brandLogo: '/dulang-logo.png',
      brandPhone: '087703397035',
      pickupAddressNote: 'Sedati, Sidoarjo',
      ownerPin: 'secret-owner',
      cashierPin: 'secret-cashier',
      kitchenPin: 'secret-kitchen',
      bankBCA: '1234567890',
      bankMandiri: '9988776655',
      qrisNmid: 'ID1020057',
      qrisImage: 'data:image/png;base64,abc',
      gofoodCommissionPercent: 20,
      cashierDailyTargetPortions: 100,
      cashierBonusPerPortion: 150,
      deletedMenuIds: ['menu-x'],
    };

    const staffSafe = sanitizeStoreConfig(fullConfig) as Record<string, unknown>;
    expect(staffSafe.ownerPin).toBeUndefined();
    expect(staffSafe.cashierPin).toBeUndefined();
    expect(staffSafe.kitchenPin).toBeUndefined();
    expect(staffSafe.bankBCA).toBe('1234567890');

    const publicSafe = sanitizePublicStoreConfig(fullConfig) as unknown as Record<string, unknown>;
    expect(publicSafe.brandName).toBe('Dulang Indonesia');
    expect(publicSafe.brandLogo).toBe('/dulang-logo.png');
    expect(publicSafe.pickupAddressNote).toBe('Sedati, Sidoarjo');
    expect(publicSafe.bankBCA).toBeUndefined();
    expect(publicSafe.bankMandiri).toBeUndefined();
    expect(publicSafe.qrisNmid).toBeUndefined();
    expect(publicSafe.qrisImage).toBeUndefined();
    expect(publicSafe.gofoodCommissionPercent).toBeUndefined();
    expect(publicSafe.cashierDailyTargetPortions).toBeUndefined();
    expect(publicSafe.cashierBonusPerPortion).toBeUndefined();
    expect(publicSafe.deletedMenuIds).toBeUndefined();
  });

  it('strips phone, street address, district, and QR ID on sanitizePublicOrderRecord', () => {
    const sensitiveOrder: OrderRecord = {
      id: 'ORD-7788',
      customer_name: 'Ahmad Budi Santoso',
      customer_wa: '6281234567899',
      customer_qr_id: 'DULANG-999',
      items: [{ menu_id: 'm1', nama: 'Risoles Mayo', harga: 15000, qty: 2 }],
      total_price: 40000,
      status: 'lunas',
      created_at: '2026-11-12T08:00:00.000Z',
      channel: 'web_wa',
      delivery_method: 'delivery',
      shipping_cost: 10000,
      shipping_district: 'Kec. Waru',
      notes: 'Jl. Rahasia Blok C No. 12',
      kitchen_status: 'sedang_goreng',
      cashier_name: 'Kasir Uji',
    };

    const sanitized = sanitizePublicOrderRecord(sensitiveOrder);
    expect(sanitized.id).toBe('ORD-7788');
    expect(sanitized.customer_name).toBe('Ahmad');
    expect(sanitized.kitchen_status).toBe('sedang_goreng');
    expect(sanitized.delivery_method).toBe('delivery');
    expect(sanitized.customer_wa).toBeUndefined();
    expect(sanitized.notes).toBeUndefined();
    expect(sanitized.shipping_district).toBeUndefined();
    expect(sanitized.customer_qr_id).toBeUndefined();
    expect(sanitized.cashier_name).toBeUndefined();
  });

  it('refuses cloud order/customer dump when not logged in as staff', async () => {
    storageService.setOwnerAuthenticated(false);
    localStorage.setItem('dulang_orders_v1', JSON.stringify([]));
    localStorage.setItem('dulang_customers', JSON.stringify([]));

    const orders = await storageService.syncOrdersFromSupabase();
    const customers = await storageService.fetchCustomersFromCloud();
    expect(orders).toEqual([]);
    expect(customers).toEqual([]);
  });

  it('clears staff PII caches from localStorage upon logout when cloud is configured', () => {
    localStorage.setItem('dulang_orders_v1', JSON.stringify([{ id: 'ORD-1' }]));
    localStorage.setItem('dulang_customers', JSON.stringify([{ id: 'CUST-1', wa: '08111' }]));
    localStorage.setItem('dulang_expenses_v1', JSON.stringify([{ id: 'EXP-1' }]));
    localStorage.setItem(
      'dulang_store_config',
      JSON.stringify({ brandName: 'Dulang', bankBCA: '999999' })
    );

    storageService.clearSensitiveStaffCacheOnLogout();

    expect(localStorage.getItem('dulang_orders_v1')).toBeNull();
    expect(localStorage.getItem('dulang_customers')).toBeNull();
    expect(localStorage.getItem('dulang_expenses_v1')).toBeNull();
    const cleanCfg = JSON.parse(localStorage.getItem('dulang_store_config') || '{}');
    expect(cleanCfg.brandName).toBe('Dulang');
    expect(cleanCfg.bankBCA).toBeUndefined();
  });
});
