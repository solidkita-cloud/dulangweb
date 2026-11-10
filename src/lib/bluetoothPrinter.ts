import { OrderRecord, StoreConfig, KitchenClosingRecap, CashierShift } from '../types';

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

/**
 * Clean text for standard ESC/POS ASCII thermal printer:
 * - Drops emojis that cause garbled prints or unexpected wrapping
 * - Maps special characters (bullet, arrows, checkmark) to clean ASCII equivalents
 */
export function cleanTextForPrinter(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[^\x20-\x7E\r\n]/g, (char) => {
      if (char === '•') return '-';
      if (char === '↳') return '>';
      if (char === '✓') return 'OK';
      return '';
    })
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Natural word-wrapping for thermal printers.
 * Prevents words like "bila" or "resmi" from splitting across line boundaries.
 */
export function wordWrap(text: string, maxWidth = 32): string[] {
  if (!text) return [];
  const clean = cleanTextForPrinter(text);
  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

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
    const clean = cleanTextForPrinter(str);
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
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
    const cleanLeft = cleanTextForPrinter(left);
    const cleanRight = cleanTextForPrinter(right);
    const spaceNeeded = width - (cleanLeft.length + cleanRight.length);
    if (spaceNeeded >= 0) {
      this.textLine(cleanLeft + ' '.repeat(spaceNeeded) + cleanRight);
    } else {
      const maxLeft = width - cleanRight.length - 1;
      if (maxLeft > 8) {
        this.textLine(cleanLeft.substring(0, maxLeft) + ' ' + cleanRight);
      } else {
        this.textLine(cleanLeft);
        this.textLine(' '.repeat(Math.max(0, width - cleanRight.length)) + cleanRight);
      }
    }
    return this;
  }

  /**
   * ESC/POS standard QR Code command (Model 2, Level L)
   * Supported by RPP02N, MP-58A1, Goojprt, POS-58
   */
  qrCode(data: string, size = 5): this {
    const cleanData = data.trim();
    const bytes: number[] = [];
    for (let i = 0; i < cleanData.length; i++) {
      const code = cleanData.charCodeAt(i);
      if (code < 128) bytes.push(code);
    }
    const len = bytes.length + 3;
    const pL = len % 256;
    const pH = Math.floor(len / 256);

    // 1. Function 165: Model (Model 2)
    this.buffer.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // 2. Function 167: Module size (1-16 dots, 5 is ideal for 58mm width)
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, size)));
    // 3. Function 169: Error correction (Level L = 48)
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    // 4. Function 180: Store data in symbol storage area
    this.buffer.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...bytes);
    // 5. Function 181: Print symbol data
    this.buffer.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

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

  const brandName = (storeConfig.brandName || 'DAPUR DULANG INDONESIA').toUpperCase();
  const slogan = storeConfig.brandTagline || 'Dibuat dengan wajan panas & tulisan tangan';
  const address = storeConfig.pickupAddressNote || 'Sedati - Sidoarjo, Jawa Timur';
  const phone = storeConfig.brandPhone || '0877-0339-7035';

  // 1. Header Toko (Mirip Persis Visual Preview Layar)
  b.alignCenter();
  b.bold(true).sizeDouble();
  b.textLine(brandName);
  b.bold(false).sizeNormal();

  // Slogan & Alamat di-wordwrap rapi agar kata tidak terpotong sembarangan
  for (const line of wordWrap(slogan, width)) {
    b.textLine(line);
  }
  for (const line of wordWrap(address, width)) {
    b.textLine(line);
  }
  b.textLine(`WA: ${phone}`);
  b.separator('-', width);

  // 1.5. Peringatan Cetak Ulang (Reprint Indicator)
  if (order.print_count && order.print_count >= 1) {
    b.alignCenter().bold(true);
    b.textLine('*** SALINAN / CETAK ULANG ***');
    b.textLine(`(Cetakan Ke-${order.print_count + 1})`);
    if (order.last_printed_at) {
      const lastTime = new Date(order.last_printed_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      b.textLine(`Asli: ${lastTime} WIB`);
    }
    b.bold(false);
    b.separator('-', width);
  }

  // Peringatan Nota Batal / Void (jika status batal)
  if (order.status === 'batal') {
    b.alignCenter().bold(true);
    b.textLine('*** NOTA DIBATALKAN (VOID) ***');
    if (order.cancellation_reason) {
      for (const line of wordWrap(`Alasan: ${order.cancellation_reason}`, width)) {
        b.textLine(line);
      }
    }
    b.bold(false);
    b.separator('-', width);
  }

  // 2. Info Transaksi (Format Rapi Seperti di Layar)
  b.alignLeft();
  const dateObj = new Date(order.created_at || new Date().toISOString());
  const dateStr = dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  b.twoColumns('No. Pesanan:', `#${order.id.replace(/^ORD-/, 'ORD-')}`, width);
  b.twoColumns('Waktu      :', dateStr, width);
  b.twoColumns('Kasir      :', order.cashier_name || 'Stand Dapur Dulang', width);
  b.twoColumns('Pelanggan  :', order.customer_name || 'Pelanggan Umum', width);
  if (order.customer_wa) {
    b.twoColumns('WhatsApp   :', `+${order.customer_wa}`, width);
  }
  b.twoColumns('Metode Bayar:', (order.payment_method || 'TUNAI').toUpperCase(), width);

  const isDelivery = order.delivery_method === 'delivery';
  b.twoColumns('Layanan    :', isDelivery ? 'ANTAR KURIR' : 'AMBIL DI DAPUR', width);

  if (isDelivery) {
    if (order.shipping_district) {
      b.twoColumns('Tujuan     :', `Kec. ${order.shipping_district}`, width);
    }
    if (order.notes) {
      for (const line of wordWrap(`Catatan: ${order.notes}`, width)) {
        b.textLine(line);
      }
    }
  } else {
    b.twoColumns('Lokasi     :', (storeConfig.pickupAddressNote || 'Sedati, Sidoarjo').slice(0, 19), width);
  }

  if (order.delivery_schedule) {
    b.twoColumns('Jadwal     :', order.delivery_schedule, width);
  }

  // Info Pesanan Hadiah (jika ada)
  if (order.is_gift || order.gift_recipient) {
    b.separator('-', width);
    b.alignCenter().bold(true).textLine('** PESANAN KHUSUS HADIAH **').bold(false);
    if (order.gift_recipient) {
      b.textLine(`Untuk: ${order.gift_recipient}`);
    }
    if (order.gift_message) {
      for (const line of wordWrap(`"${order.gift_message}"`, width)) {
        b.textLine(line);
      }
    }
    b.alignLeft();
  }

  b.separator('-', width);

  // 3. Rincian Item (1 Baris Padat: "4x Pisang Coklat   Rp 10.000" + Opsi di bawahnya)
  order.items.forEach((item) => {
    b.alignLeft();
    const left = `${item.qty}x ${item.nama}`;
    const right = `Rp ${(item.qty * item.harga).toLocaleString('id-ID')}`;

    if (left.length + 1 + right.length <= width) {
      b.bold(true).twoColumns(left, right, width).bold(false);
    } else {
      b.bold(true).textLine(left);
      b.twoColumns('', right, width).bold(false);
    }

    // Cetak opsi/varian jika ada (contoh: "↳ Semua Pedas (2 pcs)")
    if (item.pilihanOpsi) {
      const opsiText = item.qty > 1
        ? ` > Semua ${item.pilihanOpsi} (${item.qty} pcs)`
        : ` > ${item.pilihanOpsi}`;
      for (const line of wordWrap(opsiText, width)) {
        b.textLine(line);
      }
    }
  });

  b.separator('-', width);

  // 4. Ongkir & Potongan Kupon
  if (order.shipping_cost && order.shipping_cost > 0) {
    const distText = order.shipping_district ? ` (${order.shipping_district})` : '';
    b.twoColumns(`Ongkir${distText}:`, `Rp ${order.shipping_cost.toLocaleString('id-ID')}`, width);
  }

  const rawSubtotal = order.items.reduce((sum, it) => sum + it.qty * it.harga, 0);
  const discountNominal = Math.max(0, rawSubtotal + (order.shipping_cost || 0) - order.total_price);
  if (discountNominal > 0) {
    b.twoColumns('Potongan Kupon:', `-Rp ${discountNominal.toLocaleString('id-ID')}`, width);
  }

  // TOTAL (Besar & Tebal)
  b.bold(true).sizeDoubleHeight();
  b.twoColumns('TOTAL:', `Rp ${order.total_price.toLocaleString('id-ID')}`, width);
  b.bold(false).sizeNormal();

  // Rincian Uang Tunai & Kembalian (jika bayar tunai)
  if (order.payment_method === 'tunai' && order.cash_received !== undefined && order.cash_received > 0) {
    b.twoColumns('Tunai Diterima:', `Rp ${order.cash_received.toLocaleString('id-ID')}`, width);
    b.twoColumns('Kembalian     :', `Rp ${(order.cash_change || 0).toLocaleString('id-ID')}`, width);
  }

  b.separator('-', width);

  // Status Bayar Badge (Tengah)
  b.alignCenter().bold(true);
  if (order.status === 'lunas') {
    b.textLine('*** LUNAS ***');
  } else if (order.status === 'dp') {
    const sisa = order.remaining_amount ?? Math.max(0, order.total_price - (order.dp_amount || 0));
    b.textLine(`*** DP: Rp ${(order.dp_amount || 0).toLocaleString('id-ID')} ***`);
    b.textLine(`SISA TAGIHAN: Rp ${sisa.toLocaleString('id-ID')}`);
  } else {
    b.textLine('*** BELUM LUNAS ***');
  }
  b.bold(false);

  b.separator('-', width);

  // 5. Footer Quote Ucapan (Word-wrapped, kata utuh tidak terpotong)
  b.alignCenter();
  const footerNote = storeConfig.receiptFooterNote || 'Matur suwun sanget sampun jajan di Dulang! Hangatkan kembali bila perlu yaa';
  for (const line of wordWrap(footerNote, width)) {
    b.textLine(line);
  }

  b.newLine(1);

  // 6. QR Code Asli Thermal (Lacak Resi Status Wajan)
  const trackUrl = `https://dulangweb.vercel.app/?track=${order.id}`;
  b.qrCode(trackUrl, 5);

  b.newLine(1);
  b.bold(true).textLine('SCAN UNTUK LACAK STATUS WAJAN').bold(false);
  b.textLine(`dulangweb.vercel.app/?track=${order.id.replace(/^ORD-/, '')}`);

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
  b.separator('-', width);

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
  b.separator('-', width);

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

  if (recap.notes) {
    b.separator('-', width);
    b.alignLeft();
    for (const line of wordWrap(`Catatan: ${recap.notes}`, width)) {
      b.textLine(line);
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

export function buildShiftClosingSlip(shift: CashierShift, storeConfig: StoreConfig): Uint8Array {
  const b = new EscPosBuilder();
  const width = 32;

  b.alignCenter().bold(true).sizeDouble();
  b.textLine(storeConfig.brandName || 'DAPUR DULANG INDONESIA');
  b.sizeNormal();
  b.textLine('SLIP SERAH TERIMA SHIFT KASIR');
  b.bold(false);
  b.separator('-', width);

  b.alignLeft();
  b.twoColumns('Kasir     :', shift.cashier_name, width);
  const startDate = new Date(shift.started_at);
  const endDate = shift.ended_at ? new Date(shift.ended_at) : new Date();
  const startStr = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const endStr = endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  b.twoColumns('Jam Shift :', `${startStr} - ${endStr}`, width);
  b.twoColumns('Total Trx :', `${shift.total_orders_count} Transaksi`, width);
  b.separator('-', width);

  b.twoColumns('Modal Awal :', `Rp ${shift.opening_cash_float.toLocaleString('id-ID')}`, width);
  b.twoColumns('Tunai Masuk:', `+Rp ${shift.cash_revenue.toLocaleString('id-ID')}`, width);
  b.twoColumns('QRIS Masuk :', `+Rp ${shift.non_cash_revenue.toLocaleString('id-ID')}`, width);
  if (shift.drawer_expenses > 0) {
    b.twoColumns('Kas Keluar :', `-Rp ${shift.drawer_expenses.toLocaleString('id-ID')}`, width);
  }
  b.separator('-', width);

  b.bold(true);
  b.twoColumns('TOTAL OMZET:', `Rp ${shift.total_revenue.toLocaleString('id-ID')}`, width);
  b.bold(false);
  b.separator('-', width);

  b.bold(true).sizeDoubleHeight();
  const uangFisik = shift.actual_drawer_cash !== undefined ? shift.actual_drawer_cash : 0;
  b.twoColumns('FISIK LACI :', `Rp ${uangFisik.toLocaleString('id-ID')}`, width);
  b.sizeNormal().bold(false);

  const diff = shift.cash_difference || 0;
  const diffText =
    diff === 0
      ? 'PAS (Rp 0)'
      : diff > 0
      ? `LEBIH (+Rp ${diff.toLocaleString('id-ID')})`
      : `KURANG (-Rp ${Math.abs(diff).toLocaleString('id-ID')})`;
  b.twoColumns('Selisih Kas:', diffText, width);

  if (shift.notes) {
    b.separator('-', width);
    b.alignLeft();
    for (const line of wordWrap(`Catatan: ${shift.notes}`, width)) {
      b.textLine(line);
    }
  }

  b.separator('-', width);
  b.alignCenter();
  b.textLine('Tanda Tangan Kasir:');
  b.newLine(2);
  b.textLine(`( ${shift.cashier_name} )`);
  b.newLine(1);
  b.textLine('Dapur Dulang Indonesia');
  b.feedAndCut(4);

  return b.getUint8Array();
}

export async function printShiftSlipViaBluetooth(
  shift: CashierShift,
  storeConfig: StoreConfig
): Promise<{ success: boolean; deviceName: string }> {
  const char = await getOrConnectPrinter();
  const bytes = buildShiftClosingSlip(shift, storeConfig);
  await sendRawEscPos(char, bytes);
  return { success: true, deviceName: getConnectedDeviceName() || 'RPP02N' };
}
