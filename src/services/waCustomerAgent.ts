/**
 * WhatsApp Customer Agent for DULANG-3
 * Ported from WARUNG OS (Node.js engine) to TypeScript
 * 
 * Skenario Lengkap:
 * 1. Nanya Stok / Ready Gak (80% Chat)
 * 2. Nanya Bisa Kirim / Ongkir (Waru, Buduran, Taman, Sidoarjo Kota, dll.)
 * 3. Nanya Harga / Paket Hajatan / Snack Box
 * 4. Pesan Natural (Order Intake) -> Turn 1: Hitung & Tanya Pengiriman -> Turn 2: Tanya Pembayaran -> Turn 3: Commit Order
 * 5. Nanya Jam Buka / Kloter
 * 6. Nanya Pembayaran (QRIS, BCA, Tunai)
 * 7. Nanya Lokasi / Ambil Sendiri / Shareloc
 * 8. Slang & Typo Normalizer (myo -> mayo, rgt -> rogut, pcok -> piscok, dll.)
 */

import { storageService } from './storageService';
import { PERSONA_REPLIES, formatDynamicReply } from './botPersonaReplies';

export const SLANG_MAP: Record<string, string> = {
  'myo': 'mayo',
  'rgt': 'rogut',
  'pcok': 'piscok',
  'krm': 'kirim',
  'hrg': 'harga',
  'brp': 'berapa',
  'brapa': 'berapa',
  'ap': 'apa',
  'aj': 'aja',
  'skrg': 'sekarang',
  'bs': 'bisa',
  'blm': 'belum',
  'sdh': 'sudah',
  'uda': 'sudah',
  'udh': 'sudah',
  'dmana': 'dimana',
  'dmna': 'dimana',
  'bwt': 'buat',
  'makasi': 'terima kasih',
  'suwun': 'terima kasih',
  'ta': 'kah',
  'ga': 'tidak',
  'gak': 'tidak',
  'gmn': 'gimana',
  'readdy': 'ready',
  'redy': 'ready',
  'rdy': 'ready',
  'readyy': 'ready',
  'reedy': 'ready',
  'readi': 'ready',
  'ka': 'kak',
  'kka': 'kak',
  'kakk': 'kak',
  'gan': 'kak',
  'min': 'kak',
  'stok': 'stok',
  'stock': 'stok',
  'habiss': 'habis',
  'hbis': 'habis',
};

export function normalizeSlang(text: string): string {
  // Collapse letters repeated 3+ times (e.g. "mayoooo" -> "mayo", "readddy" -> "readdy")
  const deduped = text.toLowerCase().replace(/(.)\1{2,}/g, '$1$1').replace(/[?!]/g, ' ');
  return deduped.split(/\s+/).map((w) => {
    const trailingComma = w.endsWith(',') ? ',' : '';
    const cleanW = w.replace(/,/g, '');
    const mapped = SLANG_MAP[cleanW] || cleanW;
    return mapped + trailingComma;
  }).join(' ');
}

export interface CommittedOrderData {
  orderId: string;
  items: { name: string; price: number; qty: number; variant?: 'matang' | 'frozen' }[];
  total: number;
  method: string;
  deliveryType: 'PICKUP' | 'DELIVERY';
  area: string;
  ongkir: number;
  rawText?: string;
  fromPhone?: string;
  fromName?: string;
}

export interface WaAgentResponse {
  reply: string;
  category: number;
  categoryName: string;
  orderDraft?: any;
  committedOrder?: CommittedOrderData;
}

interface CustomerSession {
  step: 'AWAITING_DELIVERY_CHOICE' | 'AWAITING_PAYMENT_METHOD';
  draftOrder: {
    items: { name: string; price: number; qty: number; variant?: 'matang' | 'frozen' }[];
    total: number;
  };
  deliveryType?: 'PICKUP' | 'DELIVERY';
  area?: string;
  ongkir?: number;
  totalAkhir?: number;
}

export class WaCustomerAgent {
  private sessions: Map<string, CustomerSession> = new Map();
  private lastCommittedOrders: Map<string, CommittedOrderData> = new Map();

  getMenu() {
    try {
      const active = storageService.getMenus();
      if (active && active.length > 0) {
        return active.map((m) => ({
          id: m.id,
          name: m.nama,
          price: m.harga,
          tersedia: m.tersedia && (m.sisaStok === undefined || m.sisaStok === null || m.sisaStok > 0),
          sisaStok: m.sisaStok,
          stokHarian: m.stokHarian,
          variantType: m.variantType,
        }));
      }
    } catch (e) {
      // fallback
    }
    return [
      { id: 'm-1', name: 'Risol Mayo', price: 3500, tersedia: true },
      { id: 'm-2', name: 'Risol Rogut', price: 3500, tersedia: true },
      { id: 'm-3', name: 'Piscok Lumer', price: 2500, tersedia: true },
      { id: 'm-4', name: 'Lumpia', price: 2500, tersedia: true },
      { id: 'm-5', name: 'Kebab Daging', price: 10000, tersedia: true },
      { id: 'm-6', name: 'Burger', price: 13000, tersedia: true },
      { id: 'm-7', name: 'Kebab Frozen', price: 25000, tersedia: true },
      { id: 'm-8', name: 'Risol Mayo Frozen (Isi 5)', price: 17000, tersedia: true },
      { id: 'm-9', name: 'Risol Rogut Frozen (Isi 5)', price: 17000, tersedia: true },
    ];
  }

  resetSession(phone: string = '6289999990001') {
    this.sessions.delete(phone);
    this.lastCommittedOrders.delete(phone);
  }

  handleMessage(text: string, fromPhone: string = '6289999990001', fromName: string = 'Pelanggan WhatsApp'): WaAgentResponse {
    const norm = normalizeSlang(text);
    const lower = norm.toLowerCase();

    // =============================================================
    // OWNER STOCK MANAGEMENT: UPDATE STOK DUA ARAH DARI WA
    // =============================================================
    if (
      lower.startsWith('update stok') ||
      lower.includes('ready semua stok') ||
      lower.includes('stok semua') ||
      lower.startsWith('stok:')
    ) {
      const stockRes = storageService.parseAndUpdateStock(text);
      return {
        category: 9,
        categoryName: 'Update Stok Menu',
        reply: stockRes.message,
      };
    }

    const session = this.sessions.get(fromPhone);

    // Look up customer in CRM database by phone or name
    let matchedCust: any = null;
    try {
      const customers = storageService.getCustomers();
      const cleanPhone = fromPhone.replace(/\D/g, '');
      matchedCust = customers.find((c: any) => {
        const cPhone = (c.wa || '').replace(/\D/g, '');
        return (cPhone && cleanPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(cPhone.slice(-8)))) ||
               (c.name && c.name.toLowerCase() === fromName.toLowerCase());
      }) || null;
    } catch (e) {
      // ignore
    }

    const rawName = matchedCust ? matchedCust.name : fromName;
    const customerDisplayName = rawName.replace(/^kak\s+/i, '');
    const customerDefaultArea = matchedCust && matchedCust.district ? matchedCust.district : (matchedCust && matchedCust.village ? matchedCust.village : 'Sedati');

    // =============================================================
    // OTORITAS MENU & HELPER SCANNER MENU
    // =============================================================
    const liveMenus = storageService.getMenus();

    // Helper to find best matching menu from live database
    const findMenuByQuery = (term: string): any | undefined => {
      const c = term.trim().toLowerCase();
      if (!c) return undefined;

      // Frozen variants first
      if (c.includes('kebab frozen') || c.includes('frozen kebab')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('kebab') && m.variantType === 'frozen');
      }
      if (
        c.includes('mayo frozen5') ||
        c.includes('mayo frozen 5') ||
        c.includes('frozen5 mayo') ||
        c.includes('frozen 5 mayo')
      ) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('mayo') && m.nama.toLowerCase().includes('5'));
      }
      if (
        c.includes('rogut frozen5') ||
        c.includes('rogut frozen 5') ||
        c.includes('frozen5 rogut') ||
        c.includes('frozen 5 rogut')
      ) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('rogut') && m.nama.toLowerCase().includes('5'));
      }
      if (c.includes('mayo frozen10') || c.includes('mayo frozen 10')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('mayo') && m.nama.toLowerCase().includes('10'));
      }
      if (c.includes('rogut frozen10') || c.includes('rogut frozen 10')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('rogut') && m.nama.toLowerCase().includes('10'));
      }
      if (c.includes('mayo frozen') || c.includes('frozen mayo')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('mayo') && m.variantType === 'frozen');
      }
      if (c.includes('rogut frozen') || c.includes('frozen rogut')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('rogut') && m.variantType === 'frozen');
      }
      // Matang variants
      if (c.includes('risol mayo') || c.includes('mayo')) {
        return liveMenus.find((m) => m.nama.toLowerCase() === 'risol mayo');
      }
      if (c.includes('risol rogut') || c.includes('rogut')) {
        return liveMenus.find((m) => m.nama.toLowerCase() === 'risol rogut');
      }
      if (c.includes('piscok') || c.includes('pisang coklat') || c.includes('pisang')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('pisang') || m.nama.toLowerCase().includes('piscok'));
      }
      if (c.includes('burger')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('burger'));
      }
      if (c.includes('kebab')) {
        return liveMenus.find((m) => m.nama.toLowerCase() === 'kebab' && m.variantType !== 'frozen');
      }
      if (c.includes('lumpia')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('lumpia'));
      }
      if (c.includes('tahu')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('tahu'));
      }
      if (c.includes('ote') || c.includes('bakwan')) {
        return liveMenus.find((m) => m.nama.toLowerCase().includes('ote'));
      }
      return liveMenus.find((m) => m.nama.toLowerCase().includes(c));
    };

    const scanItems = (textToScan: string): { menu: any; qty: number }[] => {
      const candidates: { menu: any; qty: number }[] = [];
      const rxItemQty = /(kebab\s+frozen|frozen\s+kebab|mayo\s+frozen\s*5|mayo\s+frozen5|frozen5\s+mayo|frozen\s*5\s*mayo|rogut\s+frozen\s*5|rogut\s+frozen5|frozen5\s+rogut|frozen\s*5\s*rogut|mayo\s+frozen\s*10|mayo\s+frozen10|frozen10\s+mayo|frozen\s*10\s*mayo|rogut\s+frozen\s*10|rogut\s+frozen10|frozen10\s+rogut|frozen\s*10\s*rogut|mayo\s+frozen|frozen\s+mayo|rogut\s+frozen|frozen\s+rogut|risol\s+mayo|mayo|risol\s+rogut|rogut|pisang\s+coklat|piscok|lumpia\s+sayur|lumpia|tahu\s+isi\s+pedas|tahu\s+isi|tahu\s+pedas|tahu|ote[\-\s]*ote|ote|bakwan|kebab|burger)(?:\s+(?:pedas|isi\s+pedas|isi|sayur|lumer|daging|ori|original|matang|hangat|goreng|crispy|hot))?\s*(?:sebanyak|sejumlah|isi|x)?\s*[:=]?\s*(\d+)(?:\s*(?:pcs|biji|buah|porsi|pack|kotak|box))?/gi;

      let scanMatch;
      while ((scanMatch = rxItemQty.exec(textToScan)) !== null) {
        const itemTerm = scanMatch[1];
        const qty = parseInt(scanMatch[2], 10);
        const menuObj = findMenuByQuery(itemTerm);
        if (menuObj && qty > 0) {
          candidates.push({ menu: menuObj, qty });
        }
      }

      if (candidates.length === 0) {
        const rxQtyItem = /(\d+)\s*(?:pcs|biji|buah|porsi|pack|kotak|box|x)?\s*(kebab\s+frozen|frozen\s+kebab|mayo\s+frozen\s*5|mayo\s+frozen5|frozen5\s+mayo|frozen\s*5\s*mayo|rogut\s+frozen\s*5|rogut\s+frozen5|frozen5\s+rogut|frozen\s*5\s*rogut|mayo\s+frozen\s*10|mayo\s+frozen10|frozen10\s+mayo|frozen\s*10\s*mayo|rogut\s+frozen\s*10|rogut\s+frozen10|frozen10\s+rogut|frozen\s*10\s*rogut|mayo\s+frozen|frozen\s+mayo|rogut\s+frozen|frozen\s+rogut|risol\s+mayo|mayo|risol\s+rogut|rogut|pisang\s+coklat|piscok|lumpia\s+sayur|lumpia|tahu\s+isi\s+pedas|tahu\s+isi|tahu\s+pedas|tahu|ote[\-\s]*ote|ote|bakwan|kebab|burger)(?:\s+(?:pedas|isi\s+pedas|isi|sayur|lumer|daging|ori|original|matang|hangat|goreng|crispy|hot))?/gi;
        let qm;
        while ((qm = rxQtyItem.exec(textToScan)) !== null) {
          const qty = parseInt(qm[1], 10);
          const itemTerm = qm[2];
          const menuObj = findMenuByQuery(itemTerm);
          if (menuObj && qty > 0) {
            candidates.push({ menu: menuObj, qty });
          }
        }
      }

      if (candidates.length === 0) {
        const rxVerb = /(?:pesan|mau|beli|ambil|tambah)\s+([a-zA-Z\s]+?)\s+(\d+)(?:\s*(?:pcs|biji|buah|porsi|pack|kotak|box))?/gi;
        let vm;
        while ((vm = rxVerb.exec(textToScan)) !== null) {
          const itemTerm = vm[1].trim();
          const qty = parseInt(vm[2], 10);
          const menuObj = findMenuByQuery(itemTerm);
          if (menuObj && qty > 0) {
            candidates.push({ menu: menuObj, qty });
          }
        }
      }

      // Aggregate duplicates
      const agg = new Map<string, { menu: any; qty: number }>();
      for (const c of candidates) {
        if (agg.has(c.menu.id)) {
          agg.get(c.menu.id)!.qty += c.qty;
        } else {
          agg.set(c.menu.id, { menu: c.menu, qty: c.qty });
        }
      }
      return Array.from(agg.values());
    };

    // =============================================================
    // 1. RESPON FRUSTASI (ROBOT MAGANG & SAMBUNG OWNER)
    // =============================================================
    const isBotFrustration =
      !lower.includes('kemarin') &&
      !lower.includes('tahan') &&
      !lower.includes('awet') &&
      (
        lower.includes('robot') ||
        lower.includes('males') ||
        lower.includes('lemot') ||
        lower.includes('nyebelin') ||
        lower.includes('bodo amat') ||
        (lower.includes('lama') && (lower.includes('bales') || lower.includes('jawab') || lower.includes('respon') || lower.includes('amat'))) ||
        lower.includes('ga jelas') ||
        lower.includes('gak jelas')
      );

    if (isBotFrustration) {
      return {
        category: 8,
        categoryName: 'Respon Frustasi & Sambung Owner',
        reply: formatDynamicReply(PERSONA_REPLIES.frustasi, { nama: customerDisplayName })
      };
    }

    // =============================================================
    // 2. PELANGGAN MASIH PILIH-PILIH / BELUM PESEN: SIMPAN KERANJANG
    // =============================================================
    if (/(belum pesen|masih pilih|pilih-pilih|pilih dulu|nanti dulu|santai dulu|belum fix|gak buru)/i.test(lower)) {
      if (session && session.draftOrder.items.length > 0) {
        session.step = 'AWAITING_DELIVERY_CHOICE';
        this.sessions.set(fromPhone, session);
        const itemNames = session.draftOrder.items.map((i) => `${i.qty}x ${i.name}`).join(', ');
        return {
          category: 4,
          categoryName: 'Simpan Keranjang (Masih Memilih)',
          reply: formatDynamicReply(PERSONA_REPLIES.pilih_pilih, {
            nama: customerDisplayName,
            itemSummary: itemNames,
            total: session.draftOrder.total,
          })
        };
      }
      return {
        category: 4,
        categoryName: 'Eksplorasi Menu',
        reply: `Siap Kak ${customerDisplayName}, gak buru-buru kok! Dipilih-pilih dulu aja menu favoritnya. Mau tanya-tanya isi atau varian rasa dulu juga boleh banget yaa 😊`
      };
    }

    // =============================================================
    // 3. CART ADDITION / ORDER INTAKE (TAMBAH ITEM & HITUNG REALTIME)
    // =============================================================
    const hasTambahWord = /(tambah|plus|\+)/i.test(lower);
    const parsedOrderItems = scanItems(norm);

    if (parsedOrderItems.length > 0) {
      let workingItems: { name: string; price: number; qty: number; variant?: 'matang' | 'frozen' }[] = [];
      let isAddition = false;

      if (session && session.draftOrder.items.length > 0 && (hasTambahWord || session.step === 'AWAITING_DELIVERY_CHOICE' || session.step === 'AWAITING_PAYMENT_METHOD')) {
        isAddition = true;
        workingItems = [...session.draftOrder.items];
        for (const newItem of parsedOrderItems) {
          const existIdx = workingItems.findIndex((w) => w.name.toLowerCase() === newItem.menu.nama.toLowerCase());
          if (existIdx >= 0) {
            workingItems[existIdx].qty += newItem.qty;
          } else {
            workingItems.push({
              name: newItem.menu.nama,
              price: newItem.menu.harga,
              qty: newItem.qty,
              variant: newItem.menu.variantType || (newItem.menu.nama.toLowerCase().includes('frozen') ? 'frozen' : 'matang'),
            });
          }
        }
      } else {
        workingItems = parsedOrderItems.map((p) => ({
          name: p.menu.nama,
          price: p.menu.harga,
          qty: p.qty,
          variant: p.menu.variantType || (p.menu.nama.toLowerCase().includes('frozen') ? 'frozen' : 'matang'),
        }));
      }

      // Check stock limits
      const outOfStock: { name: string; requestedQty: number }[] = [];
      const adjusted: { name: string; actualQty: number }[] = [];
      const validItems: { name: string; price: number; qty: number; variant?: 'matang' | 'frozen' }[] = [];

      for (const item of workingItems) {
        const m = liveMenus.find((lm) => lm.nama.toLowerCase() === item.name.toLowerCase());
        const sisa = m?.sisaStok;
        const hasLimit = sisa !== null && sisa !== undefined;
        const isAvail = !m || (m.tersedia && (!hasLimit || sisa > 0));

        if (!isAvail) {
          outOfStock.push({ name: item.name, requestedQty: item.qty });
        } else if (hasLimit && item.qty > (sisa ?? 0)) {
          adjusted.push({ name: item.name, actualQty: sisa ?? 0 });
          validItems.push({ ...item, qty: sisa ?? 0 });
        } else {
          validItems.push(item);
        }
      }

      if (validItems.length === 0 && outOfStock.length > 0) {
        return {
          category: 4,
          categoryName: 'Pesanan Ditolak (Stok Habis)',
          reply: `❌ *Mohon maaf banget Kak ${customerDisplayName}, pesanan belum bisa diproses karena menu berikut SUDAH HABIS:*
${outOfStock.map((o) => `• ${o.name} (Habis / 0 pcs)`).join('\n')}

Mau diganti pesan dengan varian yang ready ini Kak? 😊`,
        };
      }

      const warnings: string[] = [];
      if (outOfStock.length > 0) {
        warnings.push(`⚠️ *Catatan:* Menu *${outOfStock.map((o) => o.name).join(', ')}* sedang *HABIS* hari ini 🙏`);
      }
      if (adjusted.length > 0) {
        adjusted.forEach((a) => {
          warnings.push(`⚠️ *Catatan:* Stok *${a.name}* tersisa *${a.actualQty} pcs*, kami sesuaikan pesanannya.`);
        });
      }

      const subtotal = validItems.reduce((acc, it) => acc + it.price * it.qty, 0);
      const lines = validItems.map((it) => `• ${it.qty}x ${it.name} (@ Rp ${it.price.toLocaleString('id-ID')}) = Rp ${(it.price * it.qty).toLocaleString('id-ID')}`);

      this.sessions.set(fromPhone, {
        step: 'AWAITING_DELIVERY_CHOICE',
        draftOrder: { items: validItems, total: subtotal },
      });

      const warningText = warnings.length > 0 ? `${warnings.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━\n` : '';

      if (isAddition) {
        return {
          category: 4,
          categoryName: 'Pesan Natural (Order Intake)',
          orderDraft: { items: validItems, subtotal },
          reply: `${warningText}Siap Kak ${customerDisplayName}! Ditambahin yaa 🙏\n${lines.join('\n')}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Total Belanja:* Rp ${subtotal.toLocaleString('id-ID')}\n\n🛵 Mau *Diambil Sendiri* di dapur atau *Dikirim Kurir* Kak?\n_(Ketik contoh: "ambil sendiri" atau "delivery waru", atau mau tambah menu lagi?)_ 😊`
        };
      }

      const isSultan = matchedCust && matchedCust.total_orders >= 2;
      const templateList = isSultan ? PERSONA_REPLIES.order_intake_sultan : PERSONA_REPLIES.order_intake_new;
      const orderReply = formatDynamicReply(templateList, {
        nama: customerDisplayName,
        itemSummary: lines.join('\n'),
        total: subtotal,
        defaultArea: customerDefaultArea,
      });

      return {
        category: 4,
        categoryName: 'Pesan Natural (Order Intake)',
        orderDraft: { items: validItems, subtotal },
        reply: `${warningText}${orderReply}`,
      };
    }

    // =============================================================
    // 4. TANYA STOK SAAT KERANJANG SUDAH ADA ISI (KEEP CART)
    // =============================================================
    if (session && session.draftOrder.items.length > 0 && (lower.includes('ada') || lower.includes('stok') || lower.includes('ready') || lower.includes('sisa'))) {
      const queriedMenu = findMenuByQuery(lower);
      if (queriedMenu) {
        const remaining = queriedMenu.sisaStok ?? queriedMenu.stokHarian ?? 10;
        const isAvail = queriedMenu.tersedia && remaining > 0;
        const cartSimple = session.draftOrder.items.map((i) => `${i.qty}x ${i.name}`).join(', ');

        if (isAvail) {
          return {
            category: 1,
            categoryName: 'Nanya Stok / Ready',
            reply: formatDynamicReply(PERSONA_REPLIES.tanya_stok_keep_cart, {
              nama: customerDisplayName,
              menu: queriedMenu.nama,
              stok: remaining,
              itemLines: cartSimple,
              total: session.draftOrder.total,
            })
          };
        } else {
          return {
            category: 1,
            categoryName: 'Nanya Stok / Habis',
            reply: `Waduh kalau *${queriedMenu.nama}* hari ini sedang habis Kak ${customerDisplayName} 🙏\nTapi tenang, di keranjang Kakak sudah aman tersimpan:\n${session.draftOrder.items.map((i) => `• ${i.qty}x ${i.name}`).join('\n')}\nTotal: Rp ${session.draftOrder.total.toLocaleString('id-ID')}.\n\nMau langsung dikirim/diambil atau mau coba varian lain Kak? 😊`
          };
        }
      }
    }

    // =============================================================
    // 5. STATE MACHINE STEP 2: HANDLE DELIVERY / PICKUP CHOICE
    // =============================================================
    if (session && session.step === 'AWAITING_DELIVERY_CHOICE') {
      if (lower.includes('ambil') || lower.includes('pickup') || lower.includes('dapur')) {
        session.deliveryType = 'PICKUP';
        session.area = 'Ambil Sendiri di Dapur';
        session.ongkir = 0;
        session.totalAkhir = session.draftOrder.total;
        session.step = 'AWAITING_PAYMENT_METHOD';
        this.sessions.set(fromPhone, session);

        return {
          category: 4,
          categoryName: 'Konfirmasi Pengiriman',
          reply: `🏠 *Siap Kak ${customerDisplayName}! Diambil langsung di dapur yaa (Fresh & Hangat).*
• Total Belanja: Rp ${session.totalAkhir.toLocaleString('id-ID')}

💳 Mau bayar lewat mana Kak?
[1] *QRIS* (Semua bank & e-wallet)
[2] *Transfer BCA*
[3] *Bayar Tunai di Dapur (Cash)*`
        };
      }

      // Check explicit area
      const areaKeywords: Record<string, { name: string; ongkir: number }> = {
        'waru': { name: 'Waru', ongkir: 12000 },
        'sedati': { name: 'Sedati', ongkir: 12000 },
        'buduran': { name: 'Buduran', ongkir: 8000 },
        'taman': { name: 'Taman', ongkir: 12000 },
        'candi': { name: 'Candi', ongkir: 10000 },
        'gedangan': { name: 'Gedangan', ongkir: 10000 },
        'sidoarjo': { name: 'Sidoarjo Kota', ongkir: 8000 },
        'kota': { name: 'Sidoarjo Kota', ongkir: 8000 },
        'sukodono': { name: 'Sukodono', ongkir: 10000 },
        'krian': { name: 'Krian', ongkir: 15000 },
        'surabaya': { name: 'Surabaya', ongkir: 15000 },
      };

      const matchedAreaKey = Object.keys(areaKeywords).find((k) => lower.includes(k));

      if (matchedAreaKey) {
        const areaInfo = areaKeywords[matchedAreaKey];
        let ongkir = areaInfo.ongkir;
        if (session.draftOrder.total >= 100000) {
          ongkir = 0;
        }

        session.deliveryType = 'DELIVERY';
        session.area = areaInfo.name;
        session.ongkir = ongkir;
        session.totalAkhir = session.draftOrder.total + ongkir;
        session.step = 'AWAITING_PAYMENT_METHOD';
        this.sessions.set(fromPhone, session);

        const ongkirText = ongkir === 0 ? 'GRATIS (Promo Belanja > Rp 100rb)' : `Rp ${ongkir.toLocaleString('id-ID')}`;

        return {
          category: 4,
          categoryName: 'Konfirmasi Pengiriman',
          reply: `🛵 *Siap Kak ${customerDisplayName}! Pesanan dikirim ke area ${areaInfo.name}.*
• Subtotal: Rp ${session.draftOrder.total.toLocaleString('id-ID')}
• Ongkir Kurir (${areaInfo.name}): ${ongkirText}
• *Total Akhir:* Rp ${session.totalAkhir.toLocaleString('id-ID')}

💳 Mau bayar lewat mana Kak?
[1] *QRIS* (Semua bank & e-wallet)
[2] *Transfer BCA*
[3] *COD (Bayar Tunai ke Kurir)*`
        };
      }

      if (lower.includes('delivery') || lower.includes('kirim') || lower.includes('antar')) {
        return {
          category: 4,
          categoryName: 'Konfirmasi Pengiriman',
          reply: `🛵 *Siap Kak ${customerDisplayName}! Mau dikirim ke daerah mana nih?*
Silakan tulis nama kecamatan atau daerahnya yaa (contoh: *"delivery Waru"*, *"delivery Sedati"*, *"Sidoarjo Kota"*). Biar langsung kami hitungkan ongkir kurirnya! 😊`
        };
      }
    }

    // =============================================================
    // 6. STATE MACHINE STEP 3: HANDLE PAYMENT METHOD & COMMIT ORDER
    // =============================================================
    if (session && session.step === 'AWAITING_PAYMENT_METHOD') {
      const isPickup = session.deliveryType === 'PICKUP';
      let method = '';
      let payDetail = '';

      if (lower.includes('qris') || lower === '1') {
        method = 'QRIS';
        payDetail = '📲 *Scan QRIS Dulang:* [Link/Gambar QRIS]\nBisa scan via BCA Mobile, GoPay, OVO, ShopeePay, DANA.\n_Kirimkan bukti bayar ke sini ya Kak._';
      } else if (lower.includes('transfer') || lower.includes('bca') || lower === '2') {
        method = 'Transfer BCA';
        payDetail = '🏦 *Transfer BCA:* `018-8899-771`\n👤 a.n *Dulang Indonesia / Dhodhy*\n_Kirimkan foto bukti transfer ke sini ya Kak._';
      } else if (
        lower.includes('cod') ||
        lower.includes('cash') ||
        lower.includes('tunai') ||
        lower === '3' ||
        lower.includes('bayar di dapur') ||
        lower.includes('bayar pas ambil')
      ) {
        method = isPickup ? 'Tunai di Kasir Dapur' : 'COD (Bayar Tunai ke Kurir)';
        payDetail = isPickup
          ? '💵 *Bayar Tunai:* Silakan bayar langsung di kasir dapur saat mengambil pesanan hangat Kakak yaa.'
          : '💵 *Bayar Tunai (COD):* Silakan siapkan uang pas saat kurir sampai di rumah.';
      }

      if (method) {
        const orderId = `ORD-${Date.now().toString().slice(-4)}`;
        const totalAkhir = session.totalAkhir || session.draftOrder.total;
        const committedOrder: CommittedOrderData = {
          orderId,
          items: session.draftOrder.items,
          total: totalAkhir,
          method,
          deliveryType: session.deliveryType || 'PICKUP',
          area: session.area || 'Dapur Dulang',
          ongkir: session.ongkir || 0,
          rawText: text,
          fromPhone,
          fromName: customerDisplayName,
        };

        this.sessions.delete(fromPhone); // Completed!
        this.lastCommittedOrders.set(fromPhone, committedOrder);

        let loyaltyNote = '';
        if (matchedCust && matchedCust.total_orders >= 1) {
          const nextOrderCount = matchedCust.total_orders + 1;
          loyaltyNote = `\n🎁 *Apresiasi Pelanggan Setia (${matchedCust.status || 'Setia'}):*\nTerima kasih Kak ${customerDisplayName}! Ini pesanan ke-${nextOrderCount} Kakak di Dapur Dulang. Kumpulkan ${Math.max(1, 5 - nextOrderCount)} pesanan lagi untuk bonus 2 Risol Rogut gratis! 🥟✨\n━━━━━━━━━━━━━━━━━━━━━`;
        }

        return {
          category: 4,
          categoryName: 'Pesanan Resmi Masuk Sistem',
          reply: `🎉 *PESANAN RESMI DITERIMA & MASUK SISTEM DULANG!*
🏢 _Dulang Indonesia - Sidoarjo_
━━━━━━━━━━━━━━━━━━━━━
🔖 *No. Pesanan:* \`${orderId}\`
👤 *Pemesan:* Kak ${customerDisplayName}
📦 *Rincian:* ${committedOrder.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
🛵 *Pengiriman:* ${committedOrder.deliveryType === 'DELIVERY' ? `Kurir ke ${committedOrder.area}` : 'Ambil Sendiri di Dapur'}
💵 *Total Tagihan:* Rp ${totalAkhir.toLocaleString('id-ID')} (${method})
━━━━━━━━━━━━━━━━━━━━━
${payDetail}${loyaltyNote}
👨‍🍳 *Dapur sedang menyiapkan pesanan Kakak agar fresh & crispy!*
_Estimasi siap: ~15-20 menit. Terima kasih banyak Kak ${customerDisplayName}!_ 🙏`,
          committedOrder,
        };
      }

      if (lower.includes('ambil') || lower.includes('pickup') || lower.includes('dapur')) {
        session.deliveryType = 'PICKUP';
        session.area = 'Ambil Sendiri di Dapur';
        session.ongkir = 0;
        session.totalAkhir = session.draftOrder.total;
        this.sessions.set(fromPhone, session);
        return {
          category: 4,
          categoryName: 'Konfirmasi Pengiriman',
          reply: `🏠 *Diubah jadi ambil langsung di dapur ya Kak!* Total belanja: Rp ${session.totalAkhir.toLocaleString('id-ID')}.\n\nMau bayar via [1] QRIS, [2] Transfer BCA, atau [3] Bayar Tunai di Kasir Dapur?`
        };
      }
    }

    // =============================================================
    // CATEGORY: KLARIFIKASI JAWABAN BOT / KELUHAN SALAH JAWAB
    // =============================================================
    if (
      lower.includes('nggak sesuai') ||
      lower.includes('tidak sesuai') ||
      lower.includes('bukan itu') ||
      lower.includes('salah jawab') ||
      lower.includes('gimana sih') ||
      lower.includes('kurang nyambung') ||
      lower.includes('maksudku') ||
      lower.includes('salah paham')
    ) {
      return {
        category: 8,
        categoryName: 'Klarifikasi Jawaban Bot',
        reply: `🙏 *Astagfirullah, mohon maaf yaa Kak ${customerDisplayName}!*
Sepertinya saya salah memahami maksud chat Kakak barusan.

Boleh infokan kembali apa yang Kakak butuhkan?
• Cek status pesanan (contoh: *"apakah pesanan sudah siap?"*)
• Cek stok menu hari ini (contoh: *"stok ready apa aja?"*)
• Mau pesan menu (contoh: *"mayo 3, rogut 4"*)\n
Atau bila ingin ngobrol langsung dengan Owner / Chef Dapur Dulang, kami siap sambungkan yaa! 😊`
      };
    }

    // =============================================================
    // CATEGORY: CEK STATUS & KESIAPAN PESANAN AKTIF
    // =============================================================
    if (
      lower.includes('udah siap') ||
      lower.includes('sudah siap') ||
      lower.includes('siap ambil') ||
      lower.includes('siap dikirim') ||
      lower.includes('udah jadi') ||
      lower.includes('sudah jadi') ||
      lower.includes('sudah matang') ||
      lower.includes('udah matang') ||
      lower.includes('sudah selesai') ||
      lower.includes('udah selesai') ||
      lower.includes('status pesanan') ||
      lower.includes('sampai mana') ||
      lower.includes('pesananku')
    ) {
      const recentOrders = storageService.getOrders();
      const cleanPhone = fromPhone.replace(/\D/g, '');
      const myOrder = this.lastCommittedOrders.get(fromPhone) || recentOrders.find((o) => {
        const oPhone = (o.customer_wa || '').replace(/\D/g, '');
        return (oPhone && cleanPhone && (oPhone === cleanPhone || oPhone.endsWith(cleanPhone.slice(-8)))) ||
               (o.customer_name && o.customer_name.toLowerCase() === fromName.toLowerCase());
      }) || (recentOrders.length > 0 ? recentOrders[0] : null);

      if (myOrder) {
        const orderId = (myOrder as any).orderId || (myOrder as any).id;
        const itemsText = ((myOrder as any).items || []).map((i: any) => `${i.qty}x ${i.nama || i.name}`).join(', ');
        const isReady = (myOrder as any).status === 'siap' || (myOrder as any).status === 'selesai' || (myOrder as any).status === 'lunas';

        if (isReady) {
          return {
            category: 5,
            categoryName: 'Cek Status Pesanan',
            reply: `🥟 *PESANAN KAKAK SUDAH SIAP HANGAT!* 🔥
━━━━━━━━━━━━━━━━━━━━━
🔖 *No. Pesanan:* \`${orderId}\`
📦 *Rincian:* ${itemsText}
✨ *Status:* Sudah selesai digoreng crispy & dikemas rapi!

Silakan langsung diambil di Dapur Dulang ya Kak. Ditunggu kedatangannya! 🙏`
          };
        }

        return {
          category: 5,
          categoryName: 'Cek Status Pesanan',
          reply: `👨‍🍳 *STATUS PESANAN KAKAK:*
━━━━━━━━━━━━━━━━━━━━━
🔖 *No. Pesanan:* \`${orderId}\`
📦 *Rincian:* ${itemsText}
🔥 *Status:* Sedang diproses & digoreng hangat di wajan dapur!
⏳ *Estimasi:* Sekitar ~5-10 menit lagi siap diangkat hangat-hangat.

Rencana mau diambil jam berapa atau berapa menit lagi sampai dapur Kak? 😊`
        };
      }

      return {
        category: 5,
        categoryName: 'Cek Status Pesanan',
        reply: `Halo Kak ${customerDisplayName}! Belum ada antrean pesanan aktif atas nomor ini nih. Mau dipesankan risoles hangat apa aja hari ini? 😊`
      };
    }

    // =============================================================
    // CATEGORY: KONFIRMASI WAKTU PENGAMBILAN / OTW
    // =============================================================
    if (
      /\b(\d+)\s*(?:menit|jam)\s*(?:lagi|lg)\b/i.test(lower) ||
      /\b(?:sebentar|bentar)\s*(?:lagi|lg)\b/i.test(lower) ||
      /\b(?:otw|di\s*jalan|meluncur|segera)\b/i.test(lower)
    ) {
      const matchMin = lower.match(/\b(\d+)\s*(?:menit|jam)\b/i);
      const timeStr = matchMin ? `${matchMin[1]} ${matchMin[0].includes('jam') ? 'jam' : 'menit'}` : 'sebentar';

      return {
        category: 7,
        categoryName: 'Konfirmasi Waktu Pengambilan',
        reply: `🛵 *Siap Kak ${customerDisplayName}! Ditunggu di Dapur Dulang yaa!*
Kami pastikan pesanan Kakak tetap hangat mengepul & crispy pas Kakak sampai sekitar *${timeStr} lagi*.

📍 *Alamat Dapur:* Sidoarjo (Dekat Sentra Kuliner, Google Maps: *"Dulang Indonesia Sidoarjo"*).
Hati-hati di jalan ya Kak! Sampai ketemu di dapur! 🙏🥟✨`
      };
    }

    // =============================================================
    // PART 11: KOMPLAIN HALUS / NGAMBEK (EMPATI TINGGI + BONUS GANTI)
    // =============================================================
    const isNegativeExperience =
      (lower.includes('kemarin') || lower.includes('kemaren') || lower.includes('tadi') || lower.includes('kok') || lower.includes('masih nempel') || lower.includes('dikit banget') || lower.includes('kelamaan')) &&
      (lower.includes('kering') || lower.includes('gosong') || lower.includes('dikit') || lower.includes('kecil') || lower.includes('lama') || lower.includes('minyak') || lower.includes('beda') || lower.includes('kecewa') || lower.includes('dingin') || lower.includes('kurang'));

    const isComplaint =
      !lower.includes('jangan') &&
      !lower.includes('tidak pedas') &&
      !lower.includes('tanpa') &&
      (
        isNegativeExperience ||
        lower.includes('kecewa') ||
        lower.includes('ngambek') ||
        lower.includes('gosong') ||
        lower.includes('hangus') ||
        lower.includes('dikit banget') ||
        lower.includes('minyaknya masih nempel') ||
        lower.includes('minyak nempel') ||
        lower.includes('kelamaan') ||
        lower.includes('kurang enak') ||
        lower.includes('agak kering') ||
        (lower.includes('kok') && (lower.includes('kecil') || lower.includes('beda') || lower.includes('kurang') || lower.includes('lama') || lower.includes('kering')))
      );

    if (isComplaint) {
      if (lower.includes('gosong') || lower.includes('hangus')) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_gosong, { nama: customerDisplayName })
        };
      }

      if (lower.includes('kering')) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_kering, { nama: customerDisplayName })
        };
      }

      if (lower.includes('mayo') && (lower.includes('dikit') || lower.includes('kurang'))) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_mayo_dikit, { nama: customerDisplayName })
        };
      }

      if (lower.includes('kecil')) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_kecil, { nama: customerDisplayName })
        };
      }

      if (lower.includes('lama') || lower.includes('kelamaan')) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_lama_kirim, { nama: customerDisplayName })
        };
      }

      if (lower.includes('minyak')) {
        return {
          category: 11,
          categoryName: 'Komplain Pelanggan',
          reply: formatDynamicReply(PERSONA_REPLIES.komplain_minyak, { nama: customerDisplayName })
        };
      }

      return {
        category: 11,
        categoryName: 'Komplain Pelanggan',
        reply: formatDynamicReply(PERSONA_REPLIES.komplain_general, { nama: customerDisplayName })
      };
    }

    // =============================================================
    // PART 12: PUJI / TESTIMONI (HANGAT, BERSYUKUR & APRESIATIF)
    // =============================================================
    const isTestimonial =
      lower.includes('enak banget') ||
      lower.includes('enak pol') ||
      lower.includes('enak bgt') ||
      lower.includes('lumer banget') ||
      lower.includes('lumer bgt') ||
      lower.includes('mantap kak') ||
      lower.includes('mantap') ||
      lower.includes('mantab') ||
      lower.includes('terbaik') ||
      lower.includes('langganan deh') ||
      lower.includes('langganan pokoknya') ||
      lower.includes('nagih banget') ||
      lower.includes('crispy banget') ||
      lower.includes('renyah banget') ||
      lower.includes('top markotop');

    if (isTestimonial && !lower.includes('kurang') && !lower.includes('kemarin')) {
      return {
        category: 12,
        categoryName: 'Pujian & Testimoni',
        reply: formatDynamicReply(PERSONA_REPLIES.pujian_testimoni, { nama: customerDisplayName })
      };
    }

    // =============================================================
    // PART 14: NEGO / NAWAR ALA EMAK-EMAK & PAKET GROSIR HAJATAN
    // =============================================================
    const isNego =
      (lower.includes('diskon') ||
       lower.includes('potongan') ||
       lower.includes('bisa kurang') ||
       lower.includes('nawar') ||
       lower.includes('bonus apa') ||
       (lower.includes('ongkir') && (lower.includes('free') || lower.includes('gratis'))) ||
       lower.includes('beli banyak diskon')) &&
      !lower.includes('kemarin');

    if (isNego) {
      if (lower.includes('100') || lower.includes('50') || lower.includes('box') || lower.includes('banyak') || lower.includes('arisan') || lower.includes('hajatan')) {
        return {
          category: 14,
          categoryName: 'Nego Harga & Paket Grosir',
          reply: formatDynamicReply(PERSONA_REPLIES.nego_grosir_partai, { nama: customerDisplayName })
        };
      }

      return {
        category: 14,
        categoryName: 'Nego Harga & Paket Grosir',
        reply: formatDynamicReply(PERSONA_REPLIES.nego_satuan_santai, { nama: customerDisplayName })
      };
    }

    // =============================================================
    // PART 15: NANYA YANG BIKIN OWNER PUSING (MUTU, HALAL, MINYAK, DLL)
    // =============================================================
    // 15.1 Halal
    if (lower.includes('halal')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `Dijamin *100% HALAL & THAYYIB Kak!* 🌿
Seluruh bahan baku yang kami pakai di Dapur Dulang: daging ayam, smoked beef, sosis sapi, keju, telur, hingga mayonaise Maestro bersertifikat resmi Halal MUI.
Dapur kami adalah dapur rumahan keluarga muslim yang bersih, suci, higienis, dan tanpa bahan pengawet/minyak hewani non-halal. Aman & berkah untuk seluruh keluarga! 🙏✨`
      };
    }

    // 15.2 Minyak Goreng
    if (lower.includes('minyak apa') || lower.includes('minyak goreng') || lower.includes('jelantah') || lower.includes('minyaknya baru')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `Dapur Dulang sangat peduli kesehatan & kualitas gorengan Kak! ✨
Kami *HANYA menggunakan minyak nabati kemasan bermerek (seperti Bimoli/Filma/SunCo)* dan rutin disaring serta diganti berkala.
Kami pantang memakai minyak curah kiloan apalagi minyak jelantah hitam, sehingga risoles Dulang selalu berwarna keemasan cerah, renyah, dan *TIDAK bikin batuk/serak di tenggorokan*! 👍`
      };
    }

    // 15.3 Homemade / Bikin Sendiri
    if (lower.includes('homemade') || lower.includes('bikin sendiri') || lower.includes('buatan sendiri') || lower.includes('bikinan sendiri')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `*100% HOMEMADE buatan dapur sendiri di Sidoarjo Kak!* 👩‍🍳
Mulai dari mengaduk adonan kulit lembut, memasak isian rogut ayam susu creamy, melipat rapi, sampai membalut tepung panir emas kami kerjakan sendiri secara higienis setiap hari.
Bukan produk pabrikan beku curah, jadi cita rasanya otentik, gurih, dan khas Dapur Dulang!`
      };
    }

    // 15.4 Kapan Dibikin / Jam Berapa / Goreng Dadakan
    if ((lower.includes('jam berapa') && (lower.includes('bikin') || lower.includes('buat') || lower.includes('masak'))) || lower.includes('goreng dadakan')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `Dapur kami mulai beroperasi subuh jam *04.30 WIB setiap pagi* untuk melipat kulit dan menyiapkan isian segar! 🌅
Untuk penggorengan, kami menganut sistem *Goreng Dadakan (Fresh-to-Order)*: risoles baru kami cemplungkan ke wajan panas saat Kakak order.
Begitu matang dan ditiriskan, langsung dikemas agar sampai ke tangan Kakak dalam kondisi panas mengepul & super renyah!`
      };
    }

    // 15.5 Tahan Berapa Hari / Shelf Life Kulkas
    if (lower.includes('tahan berapa') || lower.includes('awet berapa') || lower.includes('berapa hari') || lower.includes('kadaluarsa') || lower.includes('daya tahan')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `Daya tahan Risoles Dapur Dulang sangat aman untuk stok Kak:
• *Kondisi Matang Panas:* Tahan hingga 24 jam di suhu ruang.
• *Kondisi Frozen di Chiller (Kulkas Bawah):* Tahan *3 - 4 hari*.
• *Kondisi Frozen di Freezer Beku (-18°C):* Tahan hingga *1 BULAN* tanpa pengawet kimiawi sama sekali!

💡 *Tips Penyimpanan:* Simpan di wadah tertutup rapat. Sebelum digoreng, keluarkan dari freezer sekitar 10-15 menit agar saat digoreng isian dalamnya meleleh sempurna yaa Kak! 👍`
      };
    }

    // 15.6 Frozen Ada? Bisa Stok Kulkas?
    if ((lower.includes('frozen') && (lower.includes('ada') || lower.includes('kulkas') || lower.includes('bisa') || lower.includes('stok'))) || lower.includes('stok kulkas')) {
      return {
        category: 15,
        categoryName: 'Informasi Mutu & Kualitas',
        reply: `Ada banget Kak! Kami sedia *Varian Frozen Pack (Kemasan Beku isi 5 & 10 pcs)* khusus untuk stok kulkas di rumah! ❄️
• *Risol Mayo Frozen (Isi 5):* Rp 17.000 / pack
• *Risol Rogut Frozen (Isi 5):* Rp 17.000 / pack
• *Kebab Frozen (Isi 5):* Rp 25.000 / pack

Dikemas rapi dalam thinwall higienis dengan sekat plastik anti lengket. Sangat praktis, kapan saja anak-anak lapar tinggal goreng 3-5 menit api sedang!`
      };
    }

    // =============================================================
    // PART 13: REQUEST ANEH / CUSTOM ORDER
    // =============================================================
    // 13.1 Tanpa Mayo
    if (lower.includes('tanpa mayo') || lower.includes('gak pake mayo') || lower.includes('nggak pakai mayo') || lower.includes('tidak pakai mayo')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Bisa banget Kak! Ada dua pilihan lezat:
1. Kakak bisa pilih varian *Risol Rogut Ayam Creamy* (aslinya tanpa mayo, isinya suwiran ayam, wortel, & kaldu susu gurih).
2. Atau request Risol Mayo khusus tanpa mayonaise (isi smoked beef, telur rebus, & keju saja).
Tinggal tulis di catatan pesanan yaa Kak! Mau pesan berapa biji? 😊`
      };
    }

    // 13.2 Mayo Pedes Banget
    if (lower.includes('pedes banget') || lower.includes('pedas banget') || lower.includes('ekstra pedas') || lower.includes('mayo pedes')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Bisa banget Kak! Aslinya Risol Mayo kami rasanya gurih creamy tidak pedas (aman untuk anak-anak).
Tapi kalau Kakak pecinta pedas nendang, kami sediakan *ekstra cabe rawit ijo lalap & saos sambal pedas melimpah* terpisah! 🔥🌶️
Tinggal tulis pas order: *"Minta cabe rawit banyak & saos pedas"*, siap kami sediakan gratis!`
      };
    }

    // 13.3 Jangan Pedes / Tidak Pedas
    if (lower.includes('jangan pedes') || lower.includes('jangan pedas') || lower.includes('tidak pedas') || lower.includes('nggak pedas') || lower.includes('gak pedes')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Tenang Kak! Risol Mayo, Rogut Ayam, dan Piscok Dapur Dulang *aslinya 100% TIDAK PEDAS* kok. Rasanya gurih creamy lembut dan sangat ramah buat anak-anak.
Cabe rawit dan saos sambalnya selalu kami pisahkan di kantong terpisah, jadi aman banget dinikmati seluruh keluarga! 😊`
      };
    }

    // 13.4 Setengah Mateng
    if (lower.includes('setengah mateng') || lower.includes('setengah matang')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Bisa banget Kak! Kami bisa gorengkan setengah matang keemasan muda.
Atau kalau untuk stok di rumah, lebih praktis ambil varian *Frozen Pack (Isi 5 atau 10 pcs)* ya Kak! Jadi di rumah tinggal digoreng 3-5 menit api sedang kapan saja Kakak mau santap hangat. Mau yang siap santap atau frozen pack Kak? 👍`
      };
    }

    // 13.5 Pisahin Saos / Cabe
    if (lower.includes('pisahin saos') || lower.includes('pisah saos') || lower.includes('saos dipisah') || lower.includes('cabe dipisah') || lower.includes('saosnya terpisah') || lower.includes('saos pisah')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Pasti Kak! Di Dapur Dulang, *cabe rawit ijo segar dan saos sambal SELALU kami kemas terpisah dalam plastik higienis*, tidak dicampur ke dalam gorengan.
Hal ini agar kulit risoles Kakak tetap terjaga crispy, garing, dan tidak lembek saat sampai di rumah! 👍`
      };
    }

    // 13.6 Tulis Ucapan di Dus
    if (lower.includes('ucapan') || lower.includes('tulis ucapan') || lower.includes('kartu ucapan') || (lower.includes('di dus') && lower.includes('tulis'))) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Bisa banget Kak! *GRATIS tanpa biaya tambahan!* 🎁✨
Silakan ketik kalimat ucapan yang diinginkan (contoh: *"Selamat Ulang Tahun Sahabatku"* atau *"Barakallah Fii Umrik"*), nanti mimin tuliskan rapi dan cantik di atas box hantaran Dapur Dulang yaa. Mau dikirim ke siapa nih Kak? 😊`
      };
    }

    // 13.7 Jam 6 Pagi Pas / Pagi Buta
    if (lower.includes('jam 6') || lower.includes('jam 06') || lower.includes('06.00')) {
      return {
        category: 13,
        categoryName: 'Request Khusus / Custom',
        reply: `Bisa banget Kak! Khusus untuk pengantaran pagi buta jam 06.00 - 07.30 WIB, mohon lakukan pemesanan H-1 (sehari sebelumnya maksimal jam 20.30 malam) yaa Kak.
Tujuannya agar tim dapur kami bisa menjadwalkan penggorengan subuh pertama agar pesanan sampai tepat waktu dan masih hangat mengepul! Rencana untuk tanggal berapa dan berapa banyak Kak? 🌅`
      };
    }

    // =============================================================
    // INTENT: INGIN PESAN / MULAI ORDER (e.g. "aku pesen", "mau pesan", "pesen dong")
    // =============================================================
    const isOrderIntentPrompt = /^(?:halo\s+|hai\s+)?(?:aku\s+|saya\s+)?(?:mau\s+|pengen\s+|bisa\s+)?(?:pesen|pesan|order|beli)(?:\s+(?:dong|kak|min|gan|skrg|sekarang|ya|yaa|nih|donk))?[!?.]*$/i.test(lower.trim());

    if (isOrderIntentPrompt) {
      return {
        category: 4,
        categoryName: 'Mulai Pesan',
        reply: formatDynamicReply(PERSONA_REPLIES.mulai_pesan, {
          nama: customerDisplayName
        })
      };
    }

    // =============================================================
    // PART 10: NANYA NGAWUR / OUT-OF-SCOPE (SPESIALIS RISOL DULANG)
    // =============================================================
    // 10.1 Risol isi ayam suwir aja
    if (lower.includes('ayam suwir') || lower.includes('isi ayam aja') || lower.includes('ayam suwir aja')) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: `Ada Kak! Isian ayam kami ada di menu *Risol Rogut Ayam Spesial* 🥟✨
Isinya suwiran daging ayam asli dipadu wortel manis dan racikan bumbu kaldu susu creamy berempah khas Dapur Dulang (bukan ayam pedas mercon yaa).
Rasanya gurih, gurih-creamy lembut, dan nagih banget di lidah. Mau dipesankan berapa porsi Risol Rogut Ayamnya Kak? 😊`
      };
    }

    // 10.2 Ayam / Ayam Geprek / Ayam Utuh
    if (
      lower.includes('ayam geprek') ||
      lower.includes('ayam bakar') ||
      lower.includes('ayam krispi') ||
      lower.includes('ayam utuh') ||
      lower.includes('jual ayam') ||
      (lower.includes('ada ayam') && !lower.includes('rogut')) ||
      (lower.includes('ayam') && (lower.includes('geprek') || lower.includes('goreng') || lower.includes('kfc')))
    ) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_ayam, { nama: customerDisplayName })
      };
    }

    // 10.3 Nasi / Nasi Kotak / Makanan Berat
    if (lower.includes('nasi')) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_nasi, { nama: customerDisplayName })
      };
    }

    // 10.4 Minuman / Es Teh / Kopi
    if (lower.includes('es teh') || lower.includes('esteh') || lower.includes('kopi') || lower.includes('jus') || lower.includes('minuman')) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_minuman, { nama: customerDisplayName })
      };
    }

    // 10.5 Dimsum / Siomay / Batagor
    if (lower.includes('dimsum') || lower.includes('siomay') || lower.includes('batagor') || lower.includes('pempek')) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_dimsum, { nama: customerDisplayName })
      };
    }

    // 10.6 Kue Ultah / Cake
    if (lower.includes('kue ultah') || lower.includes('kue tart') || lower.includes('tart') || lower.includes('cake')) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_kue_ultah, { nama: customerDisplayName })
      };
    }

    // 10.7 Gorengan gerobak pasar curah (tempe mendoan, cireng, cilok, seblak) & pertanyaan gorengan lain
    if (
      lower.includes('gorengan lain') ||
      lower.includes('tempe mendoan') ||
      lower.includes('tempe goreng') ||
      lower.includes('mendoan') ||
      lower.includes('cireng') ||
      lower.includes('cilok') ||
      lower.includes('seblak') ||
      lower.includes('bakwan jagung')
    ) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: formatDynamicReply(PERSONA_REPLIES.ngawur_gorengan_pasar, { nama: customerDisplayName })
      };
    }

    // 10.8 Fallback Out-of-Menu
    const otherNonMenu = ['soto', 'rawon', 'bebek', 'sate', 'martabak', 'terang bulan', 'pizza', 'seblak', 'cilok', 'cireng'];
    const matchedOther = otherNonMenu.find((itm) => new RegExp(`\\b${itm}\\b`, 'i').test(lower));
    if (matchedOther) {
      return {
        category: 10,
        categoryName: 'Menu Luar Dapur Dulang',
        reply: `🥟 *Dapur Dulang Indonesia Spesialis Risoles & Pastel Sidoarjo!*

Mohon maaf Kak ${customerDisplayName}, di Dapur Dulang kami khusus memproduksi *Aneka Risoles Crispy Premium, Rogut Creamy, Piscok Lumer, Kebab, & Frozen Food* fresh dari wajan subuh yaa 🙏
Kami belum sedia menu *${matchedOther}*.

✨ Tapi kalau Kakak lagi pengen cemilan gurih renyah, lezat, & anget, wajib coba:
• *Risol Mayo Crispy:* Kulit lembut subuh, smoked beef gurih, telur rebus & mayo lumer ⭐ Best Seller!
• *Risol Rogut Creamy:* Rogut ayam sayur creamy wangi berempah
• *Piscok Lumer:* Pisang manis balut cokelat premium meleleh

Mau kami bungkusin Risol Mayo hangat untuk dicoba dulu Kak? 😊`
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 6: NANYA PEMBAYARAN
    // -------------------------------------------------------------
    if (lower.includes('qris') || lower.includes('transfer') || lower.includes('rekening') || lower.includes('bayar cash') || lower.includes('no rek')) {
      if (lower.includes('qris')) {
        return {
          category: 6,
          categoryName: 'Nanya Pembayaran',
          reply: `📲 *Bisa banget bayar pakai QRIS Kak!*\nBisa scan dari semua bank & e-wallet (BCA Mobile, Mandiri, GoPay, OVO, ShopeePay, DANA).\nKetik pesanan Kakak dulu yaa nanti kami siapkan tagihan QRIS-nya! ✨`
        };
      }
      if (lower.includes('transfer') || lower.includes('rekening') || lower.includes('no rek')) {
        return {
          category: 6,
          categoryName: 'Nanya Pembayaran',
          reply: `💳 *Pembayaran via Transfer Rekening:*\n🏦 *BCA:* \`018-8899-771\`\n👤 a.n *Dulang Indonesia / Dhodhy*\n_Bila sudah transfer, cukup kirimkan foto buktinya ke sini ya Kak!_ 👍`
        };
      }
      return {
        category: 6,
        categoryName: 'Nanya Pembayaran',
        reply: `💵 *Bisa banget bayar Cash (Tunai) Kak!*\nBisa bayar langsung saat ambil di dapur, atau bayar COD ke kurir saat pesanan sampai di rumah 😊`
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 7: NANYA LOKASI / AMBIL SENDIRI / SHARELOC
    // -------------------------------------------------------------
    if (lower.includes('lokasi') || lower.includes('dimana') || lower.includes('alamat') || lower.includes('shareloc') || lower.includes('ambil sendiri') || lower.includes('ambil di dapur') || /sebelah mana|posisi|dapur.*mana/i.test(lower)) {
      return {
        category: 7,
        categoryName: 'Nanya Lokasi / Ambil Sendiri',
        reply: `🏠 *Lokasi Dapur Dulang Indonesia:*\n📍 Area *Sidoarjo, Jawa Timur* (Dekat Sentra Kuliner)\nBisa dicari di Google Maps: *"Dulang Indonesia Sidoarjo"*.\n\nBisa banget ambil langsung ke dapur ya Kak (malah fresh banget baru diangkat dari wajan!). Rencana mau ambil jam berapa kak? 🛵`
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 5: NANYA JAM BUKA / KLOTER GORENGAN
    // -------------------------------------------------------------
    if (lower.includes('buka jam') || lower.includes('tutup jam') || lower.includes('kloter') || lower.includes('besok subuh') || lower.includes('ready jam') || lower.includes('sekarang buka')) {
      if (lower.includes('kloter')) {
        return {
          category: 5,
          categoryName: 'Nanya Jam Buka / Kloter',
          reply: `👨‍🍳 *Jadwal Kloter Gorengan Dapur Dulang:*\n• *Kloter 1 (Pagi):* 06.30 WIB\n• *Kloter 2 (Siang):* 12.30 WIB\n• *Kloter 3 (Sore):* 16.30 WIB\n_Di luar jam ini tetap bisa goreng dadakan yaa (tunggu ~15 menit)!_ 🔥`
        };
      }
      if (lower.includes('subuh') || lower.includes('pagi buta')) {
        return {
          category: 5,
          categoryName: 'Nanya Jam Buka / Kloter',
          reply: `🌅 *Bisa banget pesan buat subuh/pagi buta Kak!*\nUntuk acara pengajian/sarapan kantor, mohon konfirmasi malam ini sebelum jam 21.00 yaa agar subuh sudah kami siapkan fresh & hangat. Mau pesan berapa banyak kak?`
        };
      }
      return {
        category: 5,
        categoryName: 'Nanya Jam Buka / Kloter',
        reply: `⏰ *Jam Operasional Dapur Dulang:*\nBuka setiap hari jam *06.00 pagi - 20.00 malam* WIB.\nSekarang dapur *SEDANG BUKA* dan siap melayani pesanan Kakak! Ada yang mau dipesan sekarang? 😊`
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 2: NANYA BISA KIRIM / ONGKIR
    // -------------------------------------------------------------
    if (lower.includes('kirim') || lower.includes('delivery') || lower.includes('ongkir') || lower.includes('cod') || lower.includes('free ongkir') || lower.includes('waru') || lower.includes('sedati') || lower.includes('buduran') || lower.includes('taman')) {
      if (lower.includes('sedati')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🛵 *Bisa banget kirim ke Sedati Kak!*\nEstimasi ongkir kurir sekitar *Rp 12.000* (atau gratis untuk belanja di atas Rp 100.000). Rencana mau dikirim ke Sedati sebelah mana kak?`
        };
      }
      if (lower.includes('waru')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🛵 *Bisa banget kirim ke Waru Kak!*\nEstimasi ongkir kurir sekitar *Rp 12.000 - Rp 15.000*, atau bisa pakai Grab/Gosend instan agar sampai cepat & masih crispy. Mau dikirim ke alamat mana di Waru kak?`
        };
      }
      if (lower.includes('buduran')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🛵 *Bisa banget ke Buduran Kak, dekat sekali dari dapur kita!*\nOngkir kurir cuma sekitar *Rp 8.000 - Rp 10.000* aja. Mau kirim ke Buduran sebelah mana kak?`
        };
      }
      if (lower.includes('taman')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🛵 *Bisa kirim ke daerah Taman Kak!*\nOngkir kurir sekitar *Rp 12.000 - Rp 14.000*. Shareloc aja titik lengkapnya yaa kak biar kurir langsung meluncur 👍`
        };
      }
      if (lower.includes('sidoarjo') || lower.includes('kota')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🛵 *Ke Sidoarjo Kota ongkir cuma Rp 8.000 Kak!*\nKhusus order di atas Rp 75.000 ada subsidi potongan ongkir lho kak 😉 Mau dikirim untuk jam berapa kak?`
        };
      }
      if (lower.includes('cod')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🤝 *Bisa COD (Bayar di Tempat) Kak!*\nKhusus pengiriman via kurir toko kita, Kakak bisa bayar tunai pas risolesnya sampai di tangan. Aman & terpercaya! 👍`
        };
      }
      if (lower.includes('free ongkir')) {
        return {
          category: 2,
          categoryName: 'Nanya Bisa Kirim / Ongkir',
          reply: `🎉 *Ada promo Free Ongkir Kak!*\nKhusus area dekat dapur (radius 2 km) atau minimal pemesanan Rp 100.000. Mau borong varian apa aja hari ini kak? ✨`
        };
      }
      return {
        category: 2,
        categoryName: 'Nanya Bisa Kirim / Ongkir',
        reply: formatDynamicReply(PERSONA_REPLIES.bisa_kirim_general, { nama: customerDisplayName })
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 3: NANYA HARGA / PAKET HAJATAN / SNACK BOX
    // -------------------------------------------------------------
    if (((lower.includes('berapa') || lower.includes('harga')) && !lower.includes('sisa') && !lower.includes('stok')) || lower.includes('seporsi') || lower.includes('minimal order') || lower.includes('snack box') || lower.includes('box') || lower.includes('arisan') || lower.includes('hajatan') || lower.includes('diskon')) {
      const matchBiji = lower.match(/(\d+)\s*(?:biji|pcs|buah)/);
      if (matchBiji) {
        const qty = parseInt(matchBiji[1], 10);
        const subtotal = qty * 3500;
        return {
          category: 3,
          categoryName: 'Nanya Harga / Paket Hajatan',
          reply: `📦 *Hitungan Pesanan ${qty} Biji:*\nJika Risol Mayo/Rogut: ${qty} x Rp 3.500 = *Rp ${subtotal.toLocaleString('id-ID')}*\n✓ Sudah termasuk dus rapi & cabe rawit hijau melimpah!\n✓ Mau mix Risol Mayo + Rogut juga bisa banget Kak. Rencana buat acara jam berapa? 😊`
        };
      }

      if (lower.includes('snack box') || lower.includes('dus mini') || lower.includes('arisan') || lower.includes('hajatan')) {
        return {
          category: 3,
          categoryName: 'Nanya Harga / Paket Hajatan',
          reply: `🍱 *Paket Snack Box & Hajatan Dulang:*\n• *Paket Hemat (Rp 10.000):* 1 Risol Mayo + 1 Lumpia + 1 Lemper/Kue Basah + Air Mineral\n• *Paket Spesial (Rp 13.000):* 1 Risol Mayo + 1 Kebab Mini + 1 Piscok + Air Mineral\n✓ Sudah free dus kemasan cantik & label acara.\n_Rencana buat acara tanggal berapa dan butuh berapa box Kak?_ 🎉`
        };
      }

      if (lower.includes('minimal order')) {
        return {
          category: 3,
          categoryName: 'Nanya Harga / Paket Hajatan',
          reply: `✨ *Nggak ada minimal order Kak! Beli 1 pcs pun kami layani dengan ramah.* 😊\nKalau mau diantar kurir, biasanya customer ambil min 5-10 pcs agar lebih hemat ongkir yaa.`
        };
      }

      return {
        category: 3,
        categoryName: 'Nanya Harga / Paket Hajatan',
        reply: `📋 *Daftar Harga Menu Dulang:*\n• Risol Mayo: Rp 3.500/pcs\n• Risol Rogut: Rp 3.500/pcs\n• Piscok Lumer: Rp 2.500/pcs\n• Lumpia: Rp 2.500/pcs\n• Kebab Daging: Rp 12.000/pcs\n• Burger: Rp 13.000/pcs\n• Frozen Pack (Isi 5): Rp 17.000 | (Isi 10): Rp 33.000\nMau coba yang mana kak? ✨`
      };
    }

    // =============================================================
    // PART 9: NANYA STOK TAPI NGEGAS / SINGKAT (RESPON CEPAT & SIGAP)
    // =============================================================
    const isBriefOrUrgentStock =
      lower.trim() === 'ready' ||
      lower.trim() === 'stok' ||
      lower.includes('jawab dong') ||
      lower.includes('stok ready') ||
      lower.includes('masih ready') ||
      lower.includes('ready gak') ||
      lower.includes('ready tidak') ||
      lower.includes('ready ga') ||
      lower.includes('ready kah') ||
      lower.includes('cek stok') ||
      lower.includes('ada apa aja yang ready') ||
      lower.includes('ready apa aja') ||
      lower.includes('masih ada gak') ||
      lower.includes('masih ada tidak') ||
      lower.includes('masih ada kah');

    if (isBriefOrUrgentStock) {
      const readyList = liveMenus.filter((m) => m.tersedia && (m.sisaStok === undefined || m.sisaStok === null || m.sisaStok > 0));
      const soldOutList = liveMenus.filter((m) => !m.tersedia || (m.sisaStok !== undefined && m.sisaStok !== null && m.sisaStok <= 0));

      const readyLines = readyList.map((m) => {
        const count = m.sisaStok !== undefined && m.sisaStok !== null ? ` (Sisa ${m.sisaStok} pcs)` : '';
        const star = m.nama.includes('Mayo') ? ' ⭐ Best Seller' : '';
        return `• *${m.nama}:* Rp ${m.harga.toLocaleString('id-ID')}${count}${star}`;
      });

      let soldOutSection = '';
      if (soldOutList.length > 0) {
        soldOutSection = `\n\n❌ *Habis Hari Ini:* ${soldOutList.map((m) => m.nama).join(', ')}`;
      }

      const extra = readyLines.join('\n') + soldOutSection;

      return {
        category: 9,
        categoryName: 'Nanya Stok Cepat / Singkat',
        reply: formatDynamicReply(PERSONA_REPLIES.stok_ngegas_singkat, {
          nama: customerDisplayName,
          extra
        })
      };
    }

    // -------------------------------------------------------------
    // CATEGORY 1: NANYA STOK / READY GAK (LIVE STOK REALTIME)
    // -------------------------------------------------------------
    if (lower.includes('stok') || lower.includes('stock') || lower.includes('ada') || lower.includes('ready') || lower.includes('masih') || lower.includes('habis') || lower.includes('sisa')) {
      // Check if querying a specific item
      const queriedMenu = findMenuByQuery(lower);

      if (queriedMenu) {
        const isReady = queriedMenu.tersedia && (queriedMenu.sisaStok === undefined || queriedMenu.sisaStok === null || queriedMenu.sisaStok > 0);
        const remaining = queriedMenu.sisaStok ?? queriedMenu.stokHarian ?? 0;

        if (!isReady || remaining <= 0) {
          const readyAlternatives = liveMenus
            .filter((m) => m.tersedia && (m.sisaStok === undefined || m.sisaStok === null || m.sisaStok > 0))
            .slice(0, 5);

          const altLines = readyAlternatives.map((m) => {
            const count = m.sisaStok !== undefined && m.sisaStok !== null ? ` (sisa ${m.sisaStok})` : '';
            return `• ${m.nama}${count} - Rp ${m.harga.toLocaleString('id-ID')}`;
          });

          return {
            category: 1,
            categoryName: 'Nanya Stok / Habis',
            reply: formatDynamicReply(PERSONA_REPLIES.stok_habis, {
              nama: customerDisplayName,
              menu: queriedMenu.nama,
              extra: altLines.join('\n')
            })
          };
        }

        if (remaining <= 5) {
          return {
            category: 1,
            categoryName: 'Nanya Stok / Ready',
            reply: formatDynamicReply(PERSONA_REPLIES.stok_ready_dikit, {
              nama: customerDisplayName,
              menu: queriedMenu.nama,
              stok: remaining,
              harga: queriedMenu.harga
            })
          };
        }

        return {
          category: 1,
          categoryName: 'Nanya Stok / Ready',
          reply: formatDynamicReply(PERSONA_REPLIES.stok_ready_banyak, {
            nama: customerDisplayName,
            menu: queriedMenu.nama,
            stok: remaining,
            harga: queriedMenu.harga
          })
        };
      }

      // General stock inquiry
      const readyList = liveMenus.filter((m) => m.tersedia && (m.sisaStok === undefined || m.sisaStok === null || m.sisaStok > 0));
      const soldOutList = liveMenus.filter((m) => !m.tersedia || (m.sisaStok !== undefined && m.sisaStok !== null && m.sisaStok <= 0));

      const readyLines = readyList.map((m) => {
        const count = m.sisaStok !== undefined && m.sisaStok !== null ? ` (Sisa ${m.sisaStok} pcs)` : '';
        const star = m.nama.includes('Mayo') ? ' ⭐ Best Seller' : '';
        return `• ${m.nama}: Rp ${m.harga.toLocaleString('id-ID')}${count}${star}`;
      });

      let soldOutSection = '';
      if (soldOutList.length > 0) {
        soldOutSection = `\n\n❌ *SUDAH HABIS HARI INI:*\n• ${soldOutList.map((m) => m.nama).join(', ')}`;
      }

      return {
        category: 1,
        categoryName: 'Nanya Stok / Ready',
        reply: `🔥 *STATUS STOK HARI INI DI DAPUR DULANG:*
━━━━━━━━━━━━━━━━━━━━━
✅ *READY HANGAT / PACK:*
${readyLines.join('\n')}${soldOutSection}
━━━━━━━━━━━━━━━━━━━━━
Semua digoreng fresh dadakan di wajan panas. Mau dibungkusin apa aja nih Kak? 😊`,
      };
    }

    // Fallback welcome message
    return {
      category: 0,
      categoryName: 'Sapaan Umum',
      reply: `Halo Kak! Selamat datang di *Dapur Dulang Indonesia - Sidoarjo* 🥟✨\n\nKami sedia aneka Risoles Mayo Crispy, Rogut, Piscok Lumer, & Kebab hangat fresh dari wajan!\nAda yang bisa kami bantu? Kakak bisa tanya stok, harga, atau langsung ketik pesanan (contoh: *"mayo 3, rogut 2"*). 😊`
    };
  }
}

export const waCustomerAgent = new WaCustomerAgent();
