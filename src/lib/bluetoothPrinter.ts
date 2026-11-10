import { OrderRecord, StoreConfig, KitchenClosingRecap } from '../types';

// Generic Bluetooth Remote Characteristic interface for compatibility
export interface BluetoothDeviceChar {
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
}

// In-memory cache for active Bluetooth printer connection during the session
let cachedDevice: any = null;
let cachedCharacteristic: BluetoothDeviceChar | null = null;

// Common Bluetooth Thermal Printer Service UUIDs (58mm/80mm ESC/POS)
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard 0x18f0 (POS printers)
  '0000ffe0-0000-1000-8000-00805f9b34fb', // 0xffe0 (RPP02N, MP-58A1, Goojprt, HM-10 UART)
  '0000ff00-0000-1000-8000-00805f9b34fb', // 0xff00
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
];

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!(navigator as any).bluetooth;
}

export function isPrinterConnected(): boolean {
  return !!cachedDevice && !!cachedDevice.gatt && cachedDevice.gatt.connected && !!cachedCharacteristic;
}

export function getConnectedDeviceName(): string | null {
  if (cachedDevice && cachedDevice.name) return cachedDevice.name;
  return null;
}

export function disconnectBluetoothPrinter(): void {
  if (cachedDevice && cachedDevice.gatt && cachedDevice.gatt.connected) {
    try {
      cachedDevice.gatt.disconnect();
    } catch (e) {
      console.warn('Disconnect error:', e);
    }
  }
  cachedDevice = null;
  cachedCharacteristic = null;
}

export async function getOrConnectPrinter(): Promise<BluetoothDeviceChar> {
  if (isPrinterConnected()) {
    return cachedCharacteristic!;
  }

  if (!isBluetoothSupported()) {
    throw new Error(
      'Web Bluetooth tidak didukung di browser ini. Silakan buka web Dapur Dulang lewat Google Chrome di HP Android.'
    );
  }

  const navBluetooth = (navigator as any).bluetooth;
  const device = await navBluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_PRINTER_SERVICES,
  });

  if (!device || !device.gatt) {
    throw new Error('Tidak ada printer Bluetooth yang dipilih.');
  }

  const server = await device.gatt.connect();

  let writeChar: BluetoothDeviceChar | null = null;

  // 1. Cari di daftar service umum thermal printer
  for (const uuid of KNOWN_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c;
          break;
        }
      }
    } catch {
      // service tidak ada di perangkat ini, lanjut ke UUID berikutnya
    }
    if (writeChar) break;
  }

  // 2. Fallback: Telusuri seluruh primary services jika belum ketemu
  if (!writeChar) {
    try {
      const services = await server.getPrimaryServices();
      for (const s of services) {
        const chars = await s.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      }
    } catch (err) {
      console.warn('Fallback primary service scan failed:', err);
    }
  }

  if (!writeChar) {
    throw new Error(
      `Printer "${device.name || 'Bluetooth'}" tersambung, tetapi channel cetak ESC/POS tidak merespons. Pastikan printer dalam posisi ON & baterai terisi.`
    );
  }

  cachedDevice = device;
  cachedCharacteristic = writeChar;

  device.addEventListener('gattserverdisconnected', () => {
    cachedDevice = null;
    cachedCharacteristic = null;
  });

  return writeChar;
}

// ESC/POS Commands Constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @ Initialize
    return this;
  }

  alignCenter(): this {
    this.buffer.push(ESC, 0x61, 0x01);
    return this;
  }

  alignLeft(): this {
    this.buffer.push(ESC, 0x61, 0x00);
    return this;
  }

  alignRight(): this {
    this.buffer.push(ESC, 0x61, 0x02);
    return this;
  }

  bold(enable = true): this {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  sizeNormal(): this {
    this.buffer.push(GS, 0x21, 0x00);
    return this;
  }

  sizeDouble(): this {
    this.buffer.push(GS, 0x21, 0x11); // Double width & height
    return this;
  }

  sizeDoubleHeight(): this {
    this.buffer.push(GS, 0x21, 0x01);
    return this;
  }

  newLine(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      this.buffer.push(code < 128 ? code : 0x20); // standard ASCII
    }
    return this;
  }

  textLine(str: string): this {
    this.text(str);
    this.newLine();
    return this;
  }

  separator(char = '-', width = 32): this {
    this.textLine(char.repeat(width));
    return this;
  }

  twoColumns(left: string, right: string, width = 32): this {
    const spaceNeeded = width - (left.length + right.length);
    if (spaceNeeded >= 0) {
      this.textLine(left + ' '.repeat(spaceNeeded) + right);
    } else {
      const maxLeft = width - right.length - 1;
      if (maxLeft > 5) {
        this.textLine(left.substring(0, maxLeft) + ' ' + right);
      } else {
        this.textLine(left);
        this.textLine(' '.repeat(Math.max(0, width - right.length)) + right);
      }
    }
    return this;
  }

  feedAndCut(lines = 4): this {
    this.newLine(lines);
    // Partial cut command for supported cutters (harmless on tear-bar)
    this.buffer.push(GS, 0x56, 0x41, 0x00);
    return this;
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export async function sendRawEscPos(
  characteristic: BluetoothDeviceChar,
  bytes: Uint8Array
): Promise<void> {
  const CHUNK_SIZE = 64; // Safe BLE MTU size for mini thermal printers
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

export function buildOrderReceipt(order: OrderRecord, storeConfig: StoreConfig): Uint8Array {
  const b = new EscPosBuilder();
  const width = 32;

  const brandName = (storeConfig.brandName || 'DAPUR DULANG').toUpperCase();
  const slogan = storeConfig.brandTagline || 'Risoles & Katering Sidoarjo';
  const address = storeConfig.pickupAddressNote || 'Sidoarjo, Jawa Timur';
  const phone = storeConfig.brandPhone || '0877-0339-7035';

  // 1. Header Toko
  b.alignCenter();
  b.bold(true).sizeDouble();
  b.textLine(brandName);
  b.bold(false).sizeNormal();
  b.textLine(slogan);
  b.textLine(address);
  b.textLine(`WA: ${phone}`);
  b.separator('=', width);

  // 2. Info Transaksi
  b.alignLeft();
  const dateObj = new Date(order.created_at || new Date().toISOString());
  const dateStr = dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr =
    dateObj.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';

  b.twoColumns('No. Nota :', `#${order.id.slice(-8)}`, width);
  b.twoColumns('Waktu    :', `${dateStr} ${timeStr}`, width);
  b.twoColumns('Kasir    :', 'Stand Dapur Dulang', width);
  b.twoColumns('Pelanggan:', order.customer_name || 'Pelanggan Umum', width);
  if (order.delivery_schedule) {
    b.twoColumns('Jadwal   :', order.delivery_schedule, width);
  }
  b.separator('-', width);

  // 3. Rincian Item Pesanan
  order.items.forEach((item) => {
    b.alignLeft().bold(true);
    b.textLine(item.nama);
    b.bold(false);

    const qtyPrice = `  ${item.qty}x @Rp ${item.harga.toLocaleString('id-ID')}`;
    const itemSubtotal = `Rp ${(item.qty * item.harga).toLocaleString('id-ID')}`;
    b.twoColumns(qtyPrice, itemSubtotal, width);
  });

  b.separator('-', width);

  // 4. Kalkulasi Total & Bayar
  const rawSubtotal = order.items.reduce((sum, it) => sum + it.qty * it.harga, 0);
  b.twoColumns('Subtotal      :', `Rp ${rawSubtotal.toLocaleString('id-ID')}`, width);

  const discountNominal = Math.max(0, rawSubtotal + (order.shipping_cost || 0) - order.total_price);
  if (discountNominal > 0) {
    b.twoColumns('Potongan Kupon:', `-Rp ${discountNominal.toLocaleString('id-ID')}`, width);
  }

  if (order.shipping_cost && order.shipping_cost > 0) {
    b.twoColumns('Ongkos Kirim  :', `+Rp ${order.shipping_cost.toLocaleString('id-ID')}`, width);
  }

  b.separator('=', width);

  // Total Bayar (Besar & Tebal)
  b.bold(true).sizeDoubleHeight();
  b.twoColumns('TOTAL BAYAR :', `Rp ${order.total_price.toLocaleString('id-ID')}`, width);
  b.bold(false).sizeNormal();

  const statusLabel =
    order.status === 'lunas'
      ? 'LUNAS ✓'
      : order.status === 'dp'
      ? `DP Rp ${(order.dp_amount || 0).toLocaleString('id-ID')}`
      : 'BELUM LUNAS';
  const methodLabel = (order.payment_method || 'tunai').toUpperCase();

  b.twoColumns('Status Bayar  :', statusLabel, width);
  b.twoColumns('Metode Bayar  :', methodLabel, width);

  if (order.status === 'dp') {
    const sisa =
      order.remaining_amount !== undefined
        ? order.remaining_amount
        : Math.max(0, order.total_price - (order.dp_amount || 0));
    b.bold(true);
    b.twoColumns('SISA TAGIHAN  :', `Rp ${sisa.toLocaleString('id-ID')}`, width);
    b.bold(false);
  }

  b.separator('-', width);

  // 5. Footer Pesan
  b.alignCenter();
  if (storeConfig.receiptFooterNote) {
    b.textLine(storeConfig.receiptFooterNote);
  } else {
    b.textLine('Terima kasih atas kunjungannya!');
    b.textLine('Risoles Renyah & Gurih Asli Sidoarjo');
  }
  b.textLine('Simpan struk ini sebagai bukti resmi.');

  b.feedAndCut(4);

  return b.getUint8Array();
}

export function buildClosingRecapReceipt(recap: KitchenClosingRecap, storeConfig: StoreConfig): Uint8Array {
  const b = new EscPosBuilder();
  const width = 32;

  b.alignCenter().bold(true).sizeDouble();
  b.textLine(storeConfig.brandName || 'DAPUR DULANG');
  b.sizeNormal();
  b.textLine('REKAP CLOSING TUTUP DAPUR');
  b.bold(false);
  b.separator('=', width);

  b.alignLeft();
  b.twoColumns('Tanggal   :', recap.recapDate, width);
  b.twoColumns(
    'Jam Rekap :',
    new Date(recap.closedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
    width
  );
  b.twoColumns('Total Trx :', `${recap.totalOrders} Transaksi`, width);
  b.twoColumns('Porsi Jual:', `${recap.totalPortions} pcs`, width);
  b.separator('-', width);

  b.twoColumns('Uang Masuk:', `Rp ${recap.grossRevenue.toLocaleString('id-ID')}`, width);
  b.twoColumns('  💵 Tunai :', `Rp ${recap.cashRevenue.toLocaleString('id-ID')}`, width);
  b.twoColumns('  📲 Digital:', `Rp ${recap.nonCashRevenue.toLocaleString('id-ID')}`, width);
  b.twoColumns('Belanja   :', `-Rp ${recap.totalExpenses.toLocaleString('id-ID')}`, width);
  b.separator('=', width);

  b.bold(true);
  b.twoColumns('LABA BERSIH:', `Rp ${recap.netProfit.toLocaleString('id-ID')}`, width);
  b.bold(false);

  if (recap.expectedDrawerCash !== undefined) {
    b.separator('-', width);
    b.alignCenter().bold(true).textLine('REKONSILIASI LACI KASIR').bold(false).alignLeft();
    b.twoColumns('Modal Awal :', `Rp ${(recap.openingCashFloat || 0).toLocaleString('id-ID')}`, width);
    b.twoColumns('Harus Ada  :', `Rp ${recap.expectedDrawerCash.toLocaleString('id-ID')}`, width);
    if (recap.actualDrawerCash !== undefined) {
      b.twoColumns('Fisik Laci :', `Rp ${recap.actualDrawerCash.toLocaleString('id-ID')}`, width);
      const diff = recap.cashDifference || 0;
      b.twoColumns(
        'Selisih    :',
        diff === 0
          ? 'PAS (Rp 0)'
          : diff > 0
          ? `+Rp ${diff.toLocaleString('id-ID')}`
          : `-Rp ${Math.abs(diff).toLocaleString('id-ID')}`,
        width
      );
    }
    if (recap.depositToOwner !== undefined) {
      b.bold(true)
        .twoColumns('Setoran    :', `Rp ${recap.depositToOwner.toLocaleString('id-ID')}`, width)
        .bold(false);
    }
  }

  b.separator('-', width);
  b.alignCenter();
  b.textLine('Alhamdulillah selesai closing!');
  b.textLine('Dapur Dulang Indonesia');
  b.feedAndCut(4);

  return b.getUint8Array();
}

export async function printOrderViaBluetooth(
  order: OrderRecord,
  storeConfig: StoreConfig
): Promise<{ success: boolean; deviceName: string }> {
  const char = await getOrConnectPrinter();
  const bytes = buildOrderReceipt(order, storeConfig);
  await sendRawEscPos(char, bytes);
  return { success: true, deviceName: getConnectedDeviceName() || 'RPP02N' };
}

export async function printClosingRecapViaBluetooth(
  recap: KitchenClosingRecap,
  storeConfig: StoreConfig
): Promise<{ success: boolean; deviceName: string }> {
  const char = await getOrConnectPrinter();
  const bytes = buildClosingRecapReceipt(recap, storeConfig);
  await sendRawEscPos(char, bytes);
  return { success: true, deviceName: getConnectedDeviceName() || 'RPP02N' };
}
