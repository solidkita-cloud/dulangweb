import { describe, it, expect, afterEach } from 'vitest';
import {
  buildOrderReceipt,
  buildTestReceipt,
  tryAutoPrintOrderViaBluetooth,
  disconnectBluetoothPrinter,
  isPrinterConnected,
  type EscPosRasterBitmap,
} from '../lib/bluetoothPrinter';
import type { OrderRecord, StoreConfig } from '../types';

function findSubsequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function bytesToAscii(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => (b === 0x0a ? '\n' : b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ' '))
    .join('');
}

const config: StoreConfig = {
  heroImage: '/dulang-logo.png',
  jamBukaTeks: '10:00 - 20:00',
  schedules: [],
  brandName: 'Brand Profil Test',
  brandLogo: '/custom-logo.png',
  brandPhone: '081122334455',
  pickupAddressNote: 'Jl. Toko Profil No. 1, Sidoarjo',
  receiptFooterNote: 'Matur nuwun sampun mampir!',
  printerPaperWidth: '58mm',
  autoPrintReceipt: true,
};

const mockLogo: EscPosRasterBitmap = {
  widthBytes: 2,
  height: 2,
  data: [0xaa, 0x55, 0xf0, 0x0f],
};

const sensitiveOrder: OrderRecord = {
  id: 'ORD-PRIV-901',
  customer_name: 'Budi Rahasia',
  customer_wa: '6281234567899',
  items: [
    {
      menu_id: 'risol-1',
      nama: 'Risoles Mayo Lumer',
      harga: 12000,
      qty: 2,
      pilihanOpsi: 'Original',
      variantType: 'matang',
    },
  ],
  total_price: 34000,
  status: 'lunas',
  created_at: '2026-11-12T08:00:00.000Z',
  channel: 'web_wa',
  delivery_method: 'delivery',
  shipping_cost: 10000,
  shipping_district: 'Kec. Buduran',
  notes: 'Jl. Rahasia Pelanggan No. 99 Pagar Hitam',
  payment_method: 'qris',
};

const originalNavigator = (globalThis as Record<string, unknown>).navigator;

describe('ESC/POS receipt, GS v 0 logo, customer privacy & auto-print', () => {
  afterEach(() => {
    disconnectBluetoothPrinter();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('prints GS v 0 logo bitmap and hides customer phone, address, and district', () => {
    const receipt58 = buildOrderReceipt(sensitiveOrder, config, '58mm', mockLogo);
    const expectedRaster = [0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x02, 0x00, 0xaa, 0x55, 0xf0, 0x0f];
    expect(findSubsequence(receipt58, expectedRaster)).toBeGreaterThanOrEqual(0);

    const text58 = bytesToAscii(receipt58);
    expect(text58).toContain('BRAND PROFIL TEST');
    expect(text58).toContain('Jl. Toko Profil No. 1');
    expect(text58).toContain('081122334455');
    expect(text58).toContain('ANTAR KURIR');
    expect(text58).toContain('Ongkir Kurir:');
    expect(text58).toContain('-'.repeat(32));
    expect(text58).not.toContain('-'.repeat(48));

    expect(text58).not.toContain('81234567899');
    expect(text58).not.toContain('Jl. Rahasia Pelanggan');
    expect(text58).not.toContain('Pagar Hitam');
    expect(text58).not.toContain('Buduran');

    const receipt80 = bytesToAscii(buildOrderReceipt(sensitiveOrder, config, '80mm', mockLogo));
    expect(receipt80).toContain('-'.repeat(48));
    expect(receipt80).not.toContain('Buduran');
  });

  it('builds Indonesian Tes Print receipt with logo and paper width mode', () => {
    const test58 = buildTestReceipt(config, '58mm', 'RPP02N', mockLogo);
    const text58 = bytesToAscii(test58);
    expect(text58).toContain('TES PRINT PRINTER THERMAL');
    expect(text58).toContain('58mm (32 Kolom)');
    expect(text58).toContain('RPP02N');
  });

  it('handles silent auto-print states without popping up requestDevice picker', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
    const unsupported = await tryAutoPrintOrderViaBluetooth(sensitiveOrder, config);
    expect(unsupported).toEqual({ printed: false, reason: 'unsupported' });

    let pickerOpened = false;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        bluetooth: {
          getDevices: async () => [],
          requestDevice: async () => {
            pickerOpened = true;
            throw new Error('Should not open');
          },
        },
      },
      configurable: true,
      writable: true,
    });
    const notConnected = await tryAutoPrintOrderViaBluetooth(sensitiveOrder, config);
    expect(notConnected).toEqual({ printed: false, reason: 'not_connected' });
    expect(pickerOpened).toBe(false);

    const writtenBytes: number[] = [];
    const fakeChar = {
      properties: { write: true, writeWithoutResponse: true },
      writeValue: async (chunk: Uint8Array) => {
        writtenBytes.push(...Array.from(chunk));
      },
      writeValueWithoutResponse: async (chunk: Uint8Array) => {
        writtenBytes.push(...Array.from(chunk));
      },
    };
    const fakeGatt = {
      connected: true,
      connect: async () => fakeGatt,
      disconnect: () => {
        fakeGatt.connected = false;
      },
      getPrimaryService: async (uuid: string) => {
        if (uuid === '0000ffe0-0000-1000-8000-00805f9b34fb') {
          return { getCharacteristics: async () => [fakeChar] };
        }
        throw new Error('Service unavailable');
      },
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        bluetooth: {
          getDevices: async () => [{ name: 'RPP02N', gatt: fakeGatt, addEventListener: () => {} }],
          requestDevice: async () => {
            pickerOpened = true;
            throw new Error('Should not open');
          },
        },
      },
      configurable: true,
      writable: true,
    });

    const ok = await tryAutoPrintOrderViaBluetooth(sensitiveOrder, config, '58mm');
    expect(ok).toEqual({ printed: true, deviceName: 'RPP02N' });
    expect(pickerOpened).toBe(false);
    expect(isPrinterConnected()).toBe(true);
    expect(writtenBytes).toEqual(Array.from(buildOrderReceipt(sensitiveOrder, config, '58mm', null)));
  });
});
