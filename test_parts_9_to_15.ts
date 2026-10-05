/**
 * TEST LENGKAP PART 9 SAMPAI 15
 * Memastikan semua 7 skenario baru + 8 kasus sebelumnya terjawab akurat & cerdas!
 */

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

(global as any).localStorage = new MockLocalStorage();
(global as any).window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { search: '' },
};
(global as any).Event = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

import { storageService } from './src/services/storageService';
import { waCustomerAgent } from './src/services/waCustomerAgent';

async function runAllTests() {
  const customerPhone = '6281234567899';
  const customerName = 'Kak Dhodhy';

  // Seed standard stock first
  storageService.parseAndUpdateStock('Update stok Risol Mayo 30, Rogut 30, Burger 10, Kebab Frozen 0, Rogut Frozen5 10, Mayo Frozen5 10, lainnya 0');

  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║   TEST SUITE: SKENARIO BARU 9 SAMPAI 15 DI DAPUR DULANG-3            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let total = 0;

  function assertReply(label: string, input: string, expectedCategory: number | number[], mustInclude: (string | string[])[]) {
    total++;
    const res = waCustomerAgent.handleMessage(input, customerPhone, customerName);
    const replyLower = res.reply.toLowerCase();
    const missing: string[] = [];

    for (const item of mustInclude) {
      if (Array.isArray(item)) {
        const foundOne = item.some(w => replyLower.includes(w.toLowerCase()));
        if (!foundOne) {
          missing.push(`(${item.join(' ATAU ')})`);
        }
      } else {
        if (!replyLower.includes(item.toLowerCase())) {
          missing.push(item);
        }
      }
    }
    
    const allowedCats = Array.isArray(expectedCategory) ? expectedCategory : [expectedCategory];
    const catOk = allowedCats.includes(res.category);
    const contentOk = missing.length === 0;

    if (catOk && contentOk) {
      passed++;
      console.log(`✅ [PASS] ${label}`);
      console.log(`   Input: "${input}"`);
      console.log(`   Kategori: [${res.category}] ${res.categoryName}`);
      console.log(`   Reply Preview: ${res.reply.split('\n')[0]}\n`);
    } else {
      console.error(`❌ [FAIL] ${label}`);
      console.error(`   Input: "${input}"`);
      console.error(`   Kategori Diterima: [${res.category}] ${res.categoryName} (Harapan: ${allowedCats.join(' / ')})`);
      if (missing.length > 0) {
        console.error(`   Kata kunci tidak ditemukan: ${missing.join(', ')}`);
      }
      console.error(`   Reply Lengkap:\n${res.reply}\n`);
    }
  }

  // -------------------------------------------------------------------------
  // PART 9: Nanya Stok Tapi Ngegas / Singkat
  // -------------------------------------------------------------------------
  console.log('=== PART 9: Nanya Stok Tapi Ngegas / Singkat ===');
  assertReply('9.1 Stok ready nggak?', 'stok ready nggak?', 9, ['ready']);
  assertReply('9.2 Ready?', 'ready?', 9, ['ready']);
  assertReply('9.3 Masih ready ta?', 'masih ready ta?', 9, ['ready']);
  assertReply('9.4 Ready gak kak? Jawab dong', 'ready gak kak? jawab dong', 9, ['ready']);
  assertReply('9.5 Cek stok dong', 'cek stok dong', 9, ['ready']);
  assertReply('9.6 Ada apa aja yang ready?', 'ada apa aja yang ready?', 9, ['ready']);

  // -------------------------------------------------------------------------
  // PART 10: Nanya Ngawur / Out-of-Scope (Spesialis Risol Dulang)
  // -------------------------------------------------------------------------
  console.log('\n=== PART 10: Nanya Ngawur / Out-of-Scope ===');
  assertReply('10.1 Jual ayam nggak?', 'jual ayam nggak?', 10, ['risol', 'ayam']);
  assertReply('10.2 Ada ayam geprek?', 'ada ayam geprek?', 10, ['risol', 'ayam']);
  assertReply('10.3 Jual nasi gak kak?', 'jual nasi gak kak?', 10, ['nasi']);
  assertReply('10.4 Ada dimsum?', 'ada dimsum?', 10, ['dimsum']);
  assertReply('10.5 Jual kue ultah gak?', 'jual kue ultah gak?', 10, ['kue']);
  assertReply('10.6 Ada es teh?', 'ada es teh?', 10, ['es teh']);
  assertReply('10.7 Jual gorengan lain?', 'jual gorengan lain?', 10, ['risoles premium']);
  assertReply('10.8 Risolnya ada yang isi ayam suwir aja gak?', 'risolnya ada yang isi ayam suwir aja gak?', 10, ['risol rogut ayam spesial', 'suwiran daging ayam']);

  // -------------------------------------------------------------------------
  // PART 11: Komplain Halus / Ngambek (Empati + Voucher/Bonus)
  // -------------------------------------------------------------------------
  console.log('\n=== PART 11: Komplain Halus / Ngambek ===');
  assertReply('11.1 Risolnya agak kering ya kemarin...', 'risolnya agak kering ya kemarin...', 11, ['maaf', 'bonus 2 piscok']);
  assertReply('11.2 Kemarin gosong dikit kak', 'kemarin gosong dikit kak', 11, ['maaf', 'bonus 2 piscok']);
  assertReply('11.3 Mayonya dikit banget kemarin', 'mayonya dikit banget kemarin', 11, ['maaf', 'bonus 2 piscok']);
  assertReply('11.4 Kok kecil ya sekarang?', 'kok kecil ya sekarang?', 11, ['maaf', 'bonus 2 piscok']);
  assertReply('11.5 Kemarin kelamaan ngirimnya', 'kemarin kelamaan ngirimnya', 11, ['maaf', 'bonus']);
  assertReply('11.6 Minyaknya masih nempel banyak kak', 'minyaknya masih nempel banyak kak', 11, ['maaf', 'bonus 2 piscok']);
  assertReply('11.7 Rasanya beda sama kemarin ya?', 'rasanya beda sama kemarin ya?', 11, ['maaf', 'bonus 2 piscok']);

  // -------------------------------------------------------------------------
  // PART 12: Puji / Testimoni
  // -------------------------------------------------------------------------
  console.log('\n=== PART 12: Puji / Testimoni ===');
  assertReply('12.1 Enak banget risolnya!', 'enak banget risolnya!', 12, [['alhamdulillah', 'makasih', 'terima kasih']]);
  assertReply('12.2 Langganan deh pokoknya', 'langganan deh pokoknya', 12, [['alhamdulillah', 'makasih', 'terima kasih']]);
  assertReply('12.3 Mayonya lumer banget', 'mayonya lumer banget', 12, [['alhamdulillah', 'makasih', 'terima kasih']]);
  assertReply('12.4 Mantap kak', 'mantap kak', 12, [['alhamdulillah', 'makasih', 'terima kasih']]);
  assertReply('12.5 Terbaik se-Sidoarjo!', 'terbaik se-Sidoarjo!', 12, [['alhamdulillah', 'makasih', 'terima kasih']]);

  // -------------------------------------------------------------------------
  // PART 13: Request Aneh / Custom
  // -------------------------------------------------------------------------
  console.log('\n=== PART 13: Request Aneh / Custom ===');
  assertReply('13.1 Bisa tanpa mayo?', 'bisa tanpa mayo?', 13, ['tanpa mayo', 'rogut ayam']);
  assertReply('13.2 Mayo pedes banget bisa?', 'mayo pedes banget bisa?', 13, ['cabe rawit', 'pedas']);
  assertReply('13.3 Bisa setengah mateng?', 'bisa setengah mateng?', 13, ['setengah matang', 'frozen pack']);
  assertReply('13.4 Tolong pisahin saosnya ya', 'tolong pisahin saosnya ya', 13, ['selalu kami kemas terpisah']);
  assertReply('13.5 Jangan pedes ya kak', 'jangan pedes ya kak', 13, ['tidak pedas', 'ramah']);
  assertReply('13.6 Bisa tulis ucapan di dus?', 'bisa tulis ucapan di dus?', 13, ['gratis', 'ucapan']);
  assertReply('13.7 Bisa diantar jam 6 pagi pas?', 'bisa diantar jam 6 pagi pas?', 13, ['jam 06.00', 'h-1']);

  // -------------------------------------------------------------------------
  // PART 14: Nego / Nawar Ala Emak-Emak
  // -------------------------------------------------------------------------
  console.log('\n=== PART 14: Nego / Nawar Ala Emak-Emak ===');
  assertReply('14.1 Beli banyak diskon dong', 'beli banyak diskon dong', 14, ['bonus', ['grosir', 'spesial', 'potongan']]);
  assertReply('14.2 100 biji diskon berapa?', '100 biji diskon berapa?', 14, ['free ongkir']);
  assertReply('14.3 Ongkirnya free ya kak langganan', 'ongkirnya free ya kak langganan', 14, ['free ongkir']);
  assertReply('14.4 Bonus apa kak kalau 50 box?', 'bonus apa kak kalau 50 box?', 14, ['bonus 5 pcs']);
  assertReply('14.5 Bisa kurang?', 'bisa kurang?', 14, ['bersahabat']);

  // -------------------------------------------------------------------------
  // PART 15: Nanya yang Bikin Owner Pusing (Mutu, Halal, Minyak, Shelf life)
  // -------------------------------------------------------------------------
  console.log('\n=== PART 15: Nanya yang Bikin Owner Pusing ===');
  assertReply('15.1 Ini halal kak?', 'ini halal kak?', 15, ['100% halal', 'mui']);
  assertReply('15.2 Pakai minyak apa gorengnya?', 'pakai minyak apa gorengnya?', 15, ['minyak nabati kemasan', 'jelantah']);
  assertReply('15.3 Homemade ta kak?', 'homemade ta kak?', 15, ['100% homemade', 'buatan dapur']);
  assertReply('15.4 Bikinnya jam berapa?', 'bikinnya jam berapa?', 15, ['04.30 wib', 'goreng dadakan']);
  assertReply('15.5 Frozen ada? Bisa stok kulkas?', 'frozen ada? bisa stok kulkas?', 15, ['frozen pack', 'kulkas']);
  assertReply('15.6 Tahan berapa hari kak di kulkas?', 'tahan berapa hari kak di kulkas?', 15, ['3 - 4 hari', '1 bulan']);

  // -------------------------------------------------------------------------
  // VERIFIKASI 8 KASUS KEMARIN (ANTI-REGRESI)
  // -------------------------------------------------------------------------
  console.log('\n=== VERIFIKASI KASUS KEMARIN (ANTI-REGRESI) ===');
  assertReply('Old.1 Stok yang readdy apa ya Ka?', 'stok yang readdy apa ya Ka?', [1, 9], ['ready']);
  assertReply('Old.2 Jual ayam goreng nggak?', 'jual ayam goreng nggak?', 10, ['khusus aneka risol']);
  
  // Test Order Intake
  waCustomerAgent.resetSession(customerPhone);
  const orderRes = waCustomerAgent.handleMessage('mayo 3 rogut 4', customerPhone, customerName);
  if (orderRes.category === 4 && orderRes.reply.includes('3x Risol Mayo') && orderRes.reply.includes('4x Risol Rogut')) {
    passed++;
    console.log(`✅ [PASS] Old.3 Order Intake: mayo 3 rogut 4`);
  } else {
    console.error(`❌ [FAIL] Old.3 Order Intake: mayo 3 rogut 4`);
  }
  total++;

  // Delivery Choice
  const delivRes = waCustomerAgent.handleMessage('diambil', customerPhone, customerName);
  if (delivRes.category === 4 && delivRes.reply.includes('Diambil langsung di dapur')) {
    passed++;
    console.log(`✅ [PASS] Old.4 Delivery: diambil`);
  } else {
    console.error(`❌ [FAIL] Old.4 Delivery: diambil`);
  }
  total++;

  // Payment Choice
  const payRes = waCustomerAgent.handleMessage('3', customerPhone, customerName);
  if (payRes.category === 4 && payRes.reply.includes('PESANAN RESMI DITERIMA')) {
    passed++;
    console.log(`✅ [PASS] Old.5 Payment: 3`);
  } else {
    console.error(`❌ [FAIL] Old.5 Payment: 3`);
  }
  total++;

  // Status check
  const statusRes = waCustomerAgent.handleMessage('udah siap ambil ka?', customerPhone, customerName);
  if (statusRes.category === 5 && (statusRes.reply.includes('STATUS PESANAN') || statusRes.reply.includes('SIAP HANGAT'))) {
    passed++;
    console.log(`✅ [PASS] Old.6 Status: udah siap ambil ka?`);
  } else {
    console.error(`❌ [FAIL] Old.6 Status: udah siap ambil ka?`);
  }
  total++;

  // OTW check
  const otwRes = waCustomerAgent.handleMessage('5 menit lagi', customerPhone, customerName);
  if (otwRes.category === 7 && otwRes.reply.includes('5 menit lagi')) {
    passed++;
    console.log(`✅ [PASS] Old.7 OTW: 5 menit lagi`);
  } else {
    console.error(`❌ [FAIL] Old.7 OTW: 5 menit lagi`);
  }
  total++;

  // Clarification
  const clarRes = waCustomerAgent.handleMessage('kok nggak sesuai jawabannya', customerPhone, customerName);
  if (clarRes.category === 8 && clarRes.reply.includes('salah memahami')) {
    passed++;
    console.log(`✅ [PASS] Old.8 Clarification: kok nggak sesuai jawabannya`);
  } else {
    console.error(`❌ [FAIL] Old.8 Clarification: kok nggak sesuai jawabannya`);
  }
  total++;

  // -------------------------------------------------------------------------
  // KASUS REAL KAK DHODHY: "mayo 10, rogut 5, tahu isi 6" & "aku pesen"
  // -------------------------------------------------------------------------
  console.log('\n=== KASUS REAL KAK DHODHY (TAHU ISI + MULAI PESAN) ===');
  // 1. Order Intent: "aku pesen"
  waCustomerAgent.resetSession(customerPhone);
  const startOrderRes = waCustomerAgent.handleMessage('aku pesen', customerPhone, customerName);
  if (startOrderRes.category === 4 && startOrderRes.categoryName === 'Mulai Pesan') {
    passed++;
    console.log(`✅ [PASS] Real.1 Intent Mulai Pesan: "aku pesen" -> Respon antusias dapur`);
  } else {
    console.error(`❌ [FAIL] Real.1 Intent Mulai Pesan: "aku pesen"`);
    console.error(`   Kategori: [${startOrderRes.category}] ${startOrderRes.categoryName}`);
    console.error(`   Reply:\n${startOrderRes.reply}\n`);
  }
  total++;

  // 2. Multi-item order including Tahu Isi: "mayo 10, rogut 5, tahu isi 6"
  // Reset stock limit to allow 10 Mayo, 5 Rogut, 6 Tahu Isi
  storageService.parseAndUpdateStock('Update stok Risol Mayo 30, Rogut 30, Tahu Isi Pedas 30, lainnya 30');
  waCustomerAgent.resetSession(customerPhone);
  const multiOrderRes = waCustomerAgent.handleMessage('mayo 10, rogut 5, tahu isi 6', customerPhone, customerName);
  const mReply = multiOrderRes.reply;
  const hasMayo = mReply.includes('10x Risol Mayo');
  const hasRogut = mReply.includes('5x Risol Rogut');
  const hasTahu = mReply.includes('6x Tahu Isi Pedas');
  const hasTotal = mReply.includes('70.500'); // 10*3500 + 5*3500 + 6*3000 = 70.500

  if (multiOrderRes.category === 4 && hasMayo && hasRogut && hasTahu && hasTotal) {
    passed++;
    console.log(`✅ [PASS] Real.2 Multi-Item Order with Tahu Isi: "mayo 10, rogut 5, tahu isi 6"`);
    console.log(`   Items: 10x Mayo + 5x Rogut + 6x Tahu Isi Pedas (Subtotal Rp 70.500)`);
  } else {
    console.error(`❌ [FAIL] Real.2 Multi-Item Order with Tahu Isi: "mayo 10, rogut 5, tahu isi 6"`);
    console.error(`   Kategori: [${multiOrderRes.category}] ${multiOrderRes.categoryName}`);
    console.error(`   hasMayo: ${hasMayo}, hasRogut: ${hasRogut}, hasTahu: ${hasTahu}, hasTotal: ${hasTotal}`);
    console.error(`   Reply:\n${mReply}\n`);
  }
  total++;

  // 3. Alternative order intent: "mau order dong"
  waCustomerAgent.resetSession(customerPhone);
  const orderIntent2 = waCustomerAgent.handleMessage('mau order dong', customerPhone, customerName);
  if (orderIntent2.category === 4 && orderIntent2.categoryName === 'Mulai Pesan') {
    passed++;
    console.log(`✅ [PASS] Real.3 Intent Mulai Pesan: "mau order dong"`);
  } else {
    console.error(`❌ [FAIL] Real.3 Intent Mulai Pesan: "mau order dong"`);
  }
  total++;

  // -------------------------------------------------------------------------
  // 4. KASUS REAL CONVERSATION FLOW (8-TURN INTERACTIVE CHAT)
  // Turn 1: "risol ada?" -> Stock check
  // Turn 2: "mayo 3" -> Cart: 3x Mayo (10.500)
  // Turn 3: "tambah rogut 3" -> Cart updated: 3x Mayo + 3x Rogut (21.000)
  // Turn 4: "kebabnya ada?" -> Stock check without losing cart!
  // Turn 5: "kak aku masih pilih-pilih" -> Cart held safely!
  // Turn 6: "dasar robot, males ah" -> Robot magang apology!
  // Turn 7: "diambil" -> Delivery set to PICKUP (21.000)
  // Turn 8: "1" -> Order committed as QRIS!
  // -------------------------------------------------------------------------
  console.log('\n=== REAL 8-TURN CONVERSATION FLOW TEST ===');
  waCustomerAgent.resetSession(customerPhone);

  // Turn 1: "risol ada?"
  const t1 = waCustomerAgent.handleMessage('risol ada?', customerPhone, customerName);
  if (t1.category === 1 && (t1.reply.includes('Risol') || t1.reply.includes('READY'))) {
    passed++;
    console.log(`✅ [PASS] Turn 1: "risol ada?" -> Info stok Risol`);
  } else {
    console.error(`❌ [FAIL] Turn 1: "risol ada?"`);
  }
  total++;

  // Turn 2: "mayo 3"
  const t2 = waCustomerAgent.handleMessage('mayo 3', customerPhone, customerName);
  if (t2.category === 4 && t2.reply.includes('3x Risol Mayo') && t2.reply.includes('10.500')) {
    passed++;
    console.log(`✅ [PASS] Turn 2: "mayo 3" -> Cart 3x Mayo (Rp 10.500)`);
  } else {
    console.error(`❌ [FAIL] Turn 2: "mayo 3"`);
  }
  total++;

  // Turn 3: "tambah rogut 3"
  const t3 = waCustomerAgent.handleMessage('tambah rogut 3', customerPhone, customerName);
  if (t3.category === 4 && t3.reply.includes('3x Risol Mayo') && t3.reply.includes('3x Risol Rogut') && t3.reply.includes('21.000')) {
    passed++;
    console.log(`✅ [PASS] Turn 3: "tambah rogut 3" -> Cart updated 3x Mayo + 3x Rogut (Rp 21.000)`);
  } else {
    console.error(`❌ [FAIL] Turn 3: "tambah rogut 3"`);
  }
  total++;

  // Turn 4: "kebabnya ada?"
  const t4 = waCustomerAgent.handleMessage('kebabnya ada?', customerPhone, customerName);
  if (t4.category === 1 && (t4.reply.includes('Kebab') || t4.reply.includes('kebab')) && t4.reply.includes('21.000')) {
    passed++;
    console.log(`✅ [PASS] Turn 4: "kebabnya ada?" -> Cek stok Kebab sambil jaga keranjang (Rp 21.000 tetap aman!)`);
  } else {
    console.error(`❌ [FAIL] Turn 4: "kebabnya ada?"`);
    console.error(`   Reply:\n${t4.reply}\n`);
  }
  total++;

  // Turn 5: "kak aku masih pilih-pilih"
  const t5 = waCustomerAgent.handleMessage('kak aku masih pilih-pilih', customerPhone, customerName);
  if (t5.category === 4 && t5.reply.includes('21.000')) {
    passed++;
    console.log(`✅ [PASS] Turn 5: "kak aku masih pilih-pilih" -> Keranjang tetap tersimpan tenang (Rp 21.000)`);
  } else {
    console.error(`❌ [FAIL] Turn 5: "kak aku masih pilih-pilih"`);
    console.error(`   Reply:\n${t5.reply}\n`);
  }
  total++;

  // Turn 6: "dasar robot, males ah"
  const t6 = waCustomerAgent.handleMessage('dasar robot, males ah', customerPhone, customerName);
  if (t6.category === 8 && (t6.reply.includes('robot') || t6.reply.includes('owner') || t6.reply.includes('Dhodhy') || t6.reply.includes('maaf'))) {
    passed++;
    console.log(`✅ [PASS] Turn 6: "dasar robot, males ah" -> Respon empati robot magang & tawarkan owner`);
  } else {
    console.error(`❌ [FAIL] Turn 6: "dasar robot, males ah"`);
    console.error(`   Reply:\n${t6.reply}\n`);
  }
  total++;

  // Turn 7: "diambil"
  const t7 = waCustomerAgent.handleMessage('diambil', customerPhone, customerName);
  if (t7.category === 4 && t7.reply.includes('Diambil langsung di dapur') && t7.reply.includes('21.000')) {
    passed++;
    console.log(`✅ [PASS] Turn 7: "diambil" -> Pengambilan dapur set, tagihan Rp 21.000`);
  } else {
    console.error(`❌ [FAIL] Turn 7: "diambil"`);
    console.error(`   Reply:\n${t7.reply}\n`);
  }
  total++;

  // Turn 8: "1" (QRIS)
  const t8 = waCustomerAgent.handleMessage('1', customerPhone, customerName);
  if (t8.category === 4 && t8.reply.includes('PESANAN RESMI DITERIMA') && t8.reply.includes('21.000') && t8.reply.includes('QRIS')) {
    passed++;
    console.log(`✅ [PASS] Turn 8: "1" -> Order resmi commit dengan metode QRIS & Total Rp 21.000!`);
  } else {
    console.error(`❌ [FAIL] Turn 8: "1"`);
    console.error(`   Reply:\n${t8.reply}\n`);
  }
  total++;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`HASIL TOTAL PENGUJIAN: ${passed} / ${total} LULUS (${Math.round((passed / total) * 100)}%)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

runAllTests().catch(console.error);
