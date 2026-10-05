// cartState.ts - Otak anti-kacau untuk WA Dapur Dulang
// Fix: tambah item gak langsung checkout, nanya stok gak ngeriset keranjang, handling frustasi

export type MenuKey = 'mayo' | 'rogut' | 'lumpia' | 'piscok' | 'tahu' | 'ote' | 'kebab' | 'burger';

export interface MenuItem {
  key: MenuKey;
  name: string;
  aliases: string[]; // buat fuzzy: mayo, myo, risol mayo
  price: number;
  stock: number;
}

export const MENU: MenuItem[] = [
  { key: 'mayo', name: 'Risol Mayo', aliases: ['mayo', 'myo', 'risol mayo', 'mayonaise'], price: 3500, stock: 20 },
  { key: 'rogut', name: 'Risol Rogut', aliases: ['rogut', 'rgt', 'risol rogut', 'rogout'], price: 3500, stock: 20 },
  { key: 'lumpia', name: 'Lumpia Sayur', aliases: ['lumpia', 'lunpia', 'sayur'], price: 2500, stock: 15 },
  { key: 'piscok', name: 'Pisang Coklat', aliases: ['piscok', 'pisang coklat', 'pcok', 'pis cok'], price: 2500, stock: 15 },
  { key: 'tahu', name: 'Tahu Isi Pedas', aliases: ['tahu', 'tahu isi', 'tahu pedas'], price: 3000, stock: 15 },
  { key: 'ote', name: 'Ote-Ote', aliases: ['ote', 'ote-ote', 'bakwan', 'bala'], price: 2000, stock: 20 },
  { key: 'kebab', name: 'Kebab Daging', aliases: ['kebab', 'kebab daging'], price: 10000, stock: 8 },
  { key: 'burger', name: 'Burger Daging', aliases: ['burger', 'burgir'], price: 13000, stock: 8 },
];

export const ONGKIR: Record<string, number> = {
  'sidoarjo': 5000,
  'waru': 8000,
  'buduran': 7000,
  'candi': 8000,
  'gedangan': 9000,
  'sedati': 12000,
  'sukodono': 10000,
  'taman': 10000,
  'krian': 15000,
  'surabaya': 15000,
};

export type State = 'IDLE' | 'CART' | 'TANYA_KIRIM' | 'TANYA_BAYAR' | 'CONFIRMED';

export interface CartItem {
  key: MenuKey;
  name: string;
  qty: number;
  price: number;
}

export interface Session {
  state: State;
  cart: CartItem[];
  alamat?: string;
  kecamatan?: string;
  ongkir?: number;
  metodeBayar?: 'QRIS' | 'BCA' | 'COD';
  nama?: string;
  orderId?: string;
}

const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const REPLIES = {
  stok_ready: [
    `🔥 *READY HANGAT HARI INI:*\n{list}\n\nSemua baru turun dari wajan! Mau bungkus apa kak?`,
    `Masih anget semua kak! 😍\n{list}\n\nMau pesen yang mana?`,
    `Ready dong kak, fresh dadakan:\n{list}\n\nSisihin berapa?`,
  ],
  stok_ada: [
    `{name} ada kok kak! Sisa {stock}pcs, masih anget 🔥 Mau disisihin?`,
    `Ada kak {name}nya! Sisa {stock} aja nih, mau berapa?`,
    `Adaaa! {name} ready {stock}pcs. Mau aku bungkusin?`,
  ],
  stok_habis: [
    `Yaahh {name} baru aja habis kak 😭 Tadi jam 10 rebutan. Besok subuh aku gorengin lagi ya, mau aku list-in dulu?`,
    `Waduh {name} habis kak, sisa besok. Mau ganti menu lain?`,
  ],
  cart_update: [
    `Siap kak! Ditambahin ya 🙏\n{cart}\n━━━━━━━━━━━━━━━━━━━━━\n💵 Total: Rp {total}\n\nMau tambah lagi atau langsung kirim?`,
    `Oke noted! Sekarang keranjang kakak:\n{cart}\n━━━━━━━━━━━━━━━━━━━━━\nTotal Rp {total} aja. Ada lagi yang mau ditambah?`,
    `Masuk keranjang! 😍\n{cart}\n━━━━━━━━━━━━━━━━━━━━━\nJadi Rp {total}. Lanjut apa lagi kak?`,
  ],
  tanya_kirim: [
    `Oke total belanja Rp {total}. Mau diambil di dapur atau dikirim kurir kak?\nKetik: "ambil sendiri" atau "delivery Waru"`,
    `Siap! Belanja Rp {total}. Kirim kemana kak? Tulis aja "delivery + kecamatan" ya`,
  ],
  tanya_kirim_keep_cart: [
    `{name} ada kok kak sisa {stock}! Ngomong-ngomong keranjang kakak masih ada {cart_simple} (Rp {total}), mau sekalian tambah {name}?`,
    `Ada kak! {name} ready sisa {stock}pcs. Keranjang kakak sekarang Rp {total} lho, mau ditambah sekalian?`,
  ],
  tanya_bayar: [
    `🛵 Siap kirim ke {kecamatan}!\n• Belanja: Rp {subtotal}\n• Ongkir: Rp {ongkir}\n• *Total Akhir:* Rp {totalAkhir}\n\nBayar pakai apa kak?\n[1] QRIS\n[2] Transfer BCA\n[3] COD`,
    `Oke ke {kecamatan} ya! Ongkir Rp {ongkir}, total jadi Rp {totalAkhir}. Mau QRIS, Transfer atau COD kak?`,
  ],
  confirmed: [
    `🎉 *PESANAN MASUK DAPUR!* No: {orderId}\n{cart}\n🛵 {kecamatan} - {metode}\n💵 Total: Rp {totalAkhir}\n\nDapur lagi goreng biar crispy! Estimasi 15-20 menit ya kak 🙏`,
  ],
  pilih_pilih: [
    `Santai kak, keranjangnya aku simpen dulu ya 😊 Total sementara Rp {total}. Kalau udah fix tinggal ketik "lanjut" atau "kirim ke Waru"`,
    `Siap kak, gak buru-buru kok! Keranjang Rp {total} aku simpenin. Mau tanya-tanya dulu juga boleh`,
    `Oke kak, dipilih-pilih dulu aja. Kalau udah mantap tinggal bilang "lanjut kirim" ya`,
  ],
  frustasi: [
    `Hehe maaf ya kak kalau aku lelet 😅 Aku robot magang baru di dapur. Mau aku sambungin langsung ke owner biar sat-set?`,
    `Ya ampun maaf kak 🙏 Jangan males dulu, aku belajar cepet kok. Mau aku panggil kakak dapurnya?`,
    `Aduh sorry kak, aku error dikit. Biar gak salah, mau dilanjutin sama orang asli aja ya?`,
  ],
  out_of_scope: [
    `Hehe {keyword} gak ada kak, kita khusus risol anget aja 🙏 Ayamnya adanya di dalam Risol Mayo & Rogut, bukan ayam utuh ya. Mau coba risolnya?`,
    `Kita gak jual {keyword} kak, spesialis risol & gorengan Sidoarjo aja 🥟 Mau coba yang best seller Mayo?`,
  ],
  komplain: [
    `Ya ampun maaf ya kak 😭 Makasih udah jujur. Next order aku kasih bonus 2 piscok lumer ya buat gantinya, janji lebih juicy!`,
    `Aduhh maaf banget kak 🙏 Jadi koreksi buat dapur. Boleh aku catet namanya biar next lebih spesial ya?`,
  ]
};

function formatCart(cart: CartItem[]) {
  if (cart.length === 0) return '(kosong)';
  return cart.map(c => `• ${c.qty}x ${c.name} = Rp ${(c.qty * c.price).toLocaleString('id-ID')}`).join('\n');
}

function formatCartSimple(cart: CartItem[]) {
  if (cart.length === 0) return 'kosong';
  return cart.map(c => `${c.qty} ${c.name}`).join(', ');
}

function formatList() {
  return MENU.map(m => `• ${m.name}: Rp ${m.price.toLocaleString('id-ID')} ${m.key === 'mayo' ? '⭐' : ''} (sisa ${m.stock})`).join('\n');
}

function findMenu(text: string): MenuKey | null {
  const lower = text.toLowerCase();
  for (const m of MENU) {
    if (m.aliases.some(a => lower.includes(a))) return m.key;
  }
  return null;
}

function findAllMenus(text: string): { key: MenuKey; qty: number }[] {
  const results: { key: MenuKey; qty: number }[] = [];
  const lower = text.toLowerCase();
  MENU.forEach(m => {
    m.aliases.forEach(alias => {
      const patterns = [
        new RegExp(`${alias}\\s*(\\d+)`, 'g'), // mayo 3
        new RegExp(`(\\d+)\\s*${alias}`, 'g'), // 3 mayo
        new RegExp(`${alias}(\\d+)`, 'g'), // mayo3
      ];
      patterns.forEach(p => {
        let match;
        while ((match = p.exec(lower)) !== null) {
          const qty = parseInt(match[1] || '1', 10);
          if (qty > 0 && qty < 100) {
            results.push({ key: m.key, qty });
          }
        }
      });
    });
  });
  // deduplicate by key sum qty
  const map = new Map<MenuKey, number>();
  results.forEach(r => map.set(r.key, (map.get(r.key) || 0) + r.qty));
  return Array.from(map.entries()).map(([key, qty]) => ({ key, qty }));
}

function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/(robot|males|lemot|lama|bodo|nyebelin|ga jelas|dasar)/.test(t)) return 'frustasi';
  if (/(belum pesen|masih pilih|pilih-pilih|nanti dulu|santai)/.test(t)) return 'pilih_pilih';
  if (/(kering|gosong|asin|kecil|lama|kecewa|minyak|beda)/.test(t) && t.length < 40) return 'komplain';
  if (/(jual.*ayam|ayam geprek|nasi|dimsum|es teh|kue ultah)/.test(t)) return 'out_of_scope';
  if (/(ada\?|ready|stok|ready ga|sisa berapa)/.test(t)) return 'tanya_stok';
  if (/(tambah|plus|\+)/.test(t) || findAllMenus(t).length > 0) return 'tambah_cart';
  if (/(delivery|kirim|antar|waru|sedati|sidoarjo|taman|buduran|gedangan|surabaya|ambil|pickup)/.test(t)) return 'kirim';
  if (/(qris|transfer|bca|cod|cash|bayar)/.test(t)) return 'bayar';
  if (/(omset|paling laku|laris|saldo|stok hari ini)/.test(t)) return 'owner_query';
  return 'sapaan';
}

export function handleMessage(session: Session, message: string): { session: Session; reply: string; shouldRing: boolean; committedOrder?: any } {
  const intent = detectIntent(message);
  const lower = message.toLowerCase();
  let reply = '';
  let shouldRing = false;

  // Helper
  const total = session.cart.reduce((s, c) => s + c.qty * c.price, 0);

  // FRUSTASI -> jangan reset
  if (intent === 'frustasi') {
    reply = randomPick(REPLIES.frustasi);
    return { session, reply, shouldRing: false };
  }

  // PILIH-PILIH -> simpan cart
  if (intent === 'pilih_pilih') {
    const tpl = randomPick(REPLIES.pilih_pilih);
    reply = tpl.replace('{total}', total.toLocaleString('id-ID'));
    return { session, reply, shouldRing: false };
  }

  // TANYA STOK
  if (intent === 'tanya_stok') {
    const key = findMenu(lower);
    if (key) {
      const menu = MENU.find(m => m.key === key)!;
      if (menu.stock <= 0) {
        const tpl = randomPick(REPLIES.stok_habis);
        reply = tpl.replace('{name}', menu.name);
      } else {
        // Jika lagi di CART, jangan reset cart
        if (session.state === 'CART' || session.state === 'TANYA_KIRIM') {
          const tpl = randomPick(REPLIES.tanya_kirim_keep_cart);
          reply = tpl
            .replace(/\{name\}/g, menu.name)
            .replace(/\{stock\}/g, String(menu.stock))
            .replace(/\{cart_simple\}/g, formatCartSimple(session.cart) || 'kosong')
            .replace(/\{total\}/g, total.toLocaleString('id-ID'));
        } else {
          const tpl = randomPick(REPLIES.stok_ada);
          reply = tpl.replace(/\{name\}/g, menu.name).replace(/\{stock\}/g, String(menu.stock));
        }
      }
    } else {
      // tanya stok umum
      const list = formatList();
      const tpl = randomPick(REPLIES.stok_ready);
      reply = tpl.replace('{list}', list);
    }
    return { session, reply, shouldRing: false };
  }

  // TAMBAH CART
  if (intent === 'tambah_cart') {
    const items = findAllMenus(message);
    if (items.length === 0) {
      // fallback: mungkin cuma "mayo" tanpa angka = qty 1
      const k = findMenu(lower);
      if (k) items.push({ key: k, qty: 1 });
    }
    items.forEach(({ key, qty }) => {
      const menu = MENU.find(m => m.key === key)!;
      const existing = session.cart.find(c => c.key === key);
      if (existing) existing.qty += qty;
      else session.cart.push({ key, name: menu.name, qty, price: menu.price });
    });
    session.state = 'CART';
    const newTotal = session.cart.reduce((s, c) => s + c.qty * c.price, 0);
    const tpl = randomPick(REPLIES.cart_update);
    reply = tpl.replace('{cart}', formatCart(session.cart)).replace('{total}', newTotal.toLocaleString('id-ID'));
    return { session, reply, shouldRing: false };
  }

  // TANYA KIRIM
  if (intent === 'kirim') {
    // cek kecamatan
    const kec = Object.keys(ONGKIR).find(k => lower.includes(k));
    if (kec) {
      session.kecamatan = kec.charAt(0).toUpperCase() + kec.slice(1);
      session.ongkir = ONGKIR[kec];
      session.alamat = message;
      session.state = 'TANYA_BAYAR';
      const subtotal = session.cart.reduce((s, c) => s + c.qty * c.price, 0);
      const totalAkhir = subtotal + (session.ongkir || 0);
      const tpl = randomPick(REPLIES.tanya_bayar);
      reply = tpl
        .replace('{kecamatan}', session.kecamatan)
        .replace('{subtotal}', subtotal.toLocaleString('id-ID'))
        .replace('{ongkir}', (session.ongkir || 0).toLocaleString('id-ID'))
        .replace('{totalAkhir}', totalAkhir.toLocaleString('id-ID'));
    } else if (lower.includes('ambil') || lower.includes('pickup')) {
      session.kecamatan = 'Ambil Sendiri di Dapur';
      session.ongkir = 0;
      session.state = 'TANYA_BAYAR';
      const subtotal = session.cart.reduce((s, c) => s + c.qty * c.price, 0);
      reply = `🏠 *Siap ambil di dapur ya kak!* Total tetap Rp ${subtotal.toLocaleString('id-ID')}\n\nBayar mau QRIS, Transfer BCA, atau Cash pas ambil?\nKetik: [1] QRIS | [2] Transfer BCA | [3] Bayar Tunai di Dapur`;
    } else {
      // user bilang "delivery" tanpa alamat -> jangan langsung total
      if (session.cart.length === 0) {
        reply = `Siap kak, mau delivery kemana? Tulis kecamatannya ya, contoh: "delivery Waru"`;
      } else {
        const tpl = randomPick(REPLIES.tanya_kirim);
        reply = tpl.replace('{total}', total.toLocaleString('id-ID'));
        session.state = 'TANYA_KIRIM';
      }
    }
    return { session, reply, shouldRing: false };
  }

  // BAYAR -> CONFIRMED
  if (intent === 'bayar' && (session.state === 'TANYA_BAYAR' || session.state === 'TANYA_KIRIM')) {
    let metode: Session['metodeBayar'] = 'COD';
    if (lower.includes('qris') || lower === '1') metode = 'QRIS';
    else if (lower.includes('bca') || lower.includes('transfer') || lower === '2') metode = 'BCA';
    else if (lower.includes('cod') || lower.includes('cash') || lower.includes('tunai') || lower === '3') metode = 'COD';

    session.metodeBayar = metode;
    session.state = 'CONFIRMED';
    session.orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const subtotal = session.cart.reduce((s, c) => s + c.qty * c.price, 0);
    const totalAkhir = subtotal + (session.ongkir || 0);

    const tpl = randomPick(REPLIES.confirmed);
    reply = tpl
      .replace('{orderId}', session.orderId)
      .replace('{cart}', formatCart(session.cart))
      .replace('{kecamatan}', session.kecamatan || 'Ambil Sendiri di Dapur')
      .replace('{metode}', metode)
      .replace('{totalAkhir}', totalAkhir.toLocaleString('id-ID'));

    shouldRing = true; // bunyikan lonceng DULANG-3!

    const committedOrder = {
      orderId: session.orderId,
      items: session.cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
      total: totalAkhir,
      method: metode,
      deliveryType: (session.kecamatan?.includes('Ambil') ? 'PICKUP' : 'DELIVERY') as 'PICKUP' | 'DELIVERY',
      area: session.kecamatan || 'Dapur Dulang',
      ongkir: session.ongkir || 0,
      fromPhone: '6289999990001',
      fromName: 'Pelanggan WhatsApp',
    };

    return { session, reply, shouldRing, committedOrder };
  }

  // OUT OF SCOPE & KOMPLAIN
  if (intent === 'out_of_scope') {
    const keyword = lower.match(/ayam|nasi|dimsum|es teh|kue ultah/)?.[0] || 'itu';
    const tpl = randomPick(REPLIES.out_of_scope);
    reply = tpl.replace('{keyword}', keyword);
    return { session, reply, shouldRing: false };
  }
  if (intent === 'komplain') {
    reply = randomPick(REPLIES.komplain);
    return { session, reply, shouldRing: false };
  }

  // DEFAULT SAPAAN
  reply = `Halo Kak! Selamat datang di *Dapur Dulang Indonesia - Sidoarjo* 🥟✨\n\nKami sedia Risol Mayo, Rogut, Piscok lumer fresh dari wajan!\nMau pesen apa? Ketik aja contoh: "mayo 3, rogut 2" 😊`;
  return { session, reply, shouldRing: false };
}
