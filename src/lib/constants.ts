import { MenuItem, Customer, StoreConfig, Voucher, OrderRecord, CustomerTestimonial } from '../types';

export const MONTHS_INDONESIA = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export const BRAND = {
  name: 'Dulang Indonesia',
  shortName: 'Dulang',
  tagline: 'Dibuat dengan wajan panas & tulisan tangan',
  since: '2020',
  instagram: 'dulang_indonesia',
  whatsapp: '6287703397035',
  displayWhatsapp: '+62 877 0339 7035',
  location: 'Sidoarjo, Jawa Timur',
  locationDetail: 'Sidoarjo, Jawa Timur — dapur kecil deket Pasar Payan, yang sedia menyambut ceritamu',
  operatingHours: '10.00 - 19.30 (kalo habis ya tutup duluan)',
};

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  heroImage: '/dulang-logo.png',
  heroHeadlineSub: 'digoreng jam 10 pagi\nhabis jam 8 malem',
  jamBukaTeks: '10.00 - 19.30 (kalo habis ya tutup duluan)',
  schedules: [
    {
      jam: '03.00',
      teks: 'bangun, ngadon kulit risoles. masih ngantuk tapi wajan udah panas.',
      rot: '-1.2deg',
    },
    {
      jam: '10.00',
      teks: 'goreng pertama. yang antri di WA udah belasan orang. mayo masih lumer.',
      rot: '1.2deg',
    },
    {
      jam: '15.00',
      teks: 'istirahat bentar, lap wajan. cerita-cerita santai sama tetangga komplek.',
      rot: '-0.8deg',
    },
    {
      jam: '19.30',
      teks: 'tutup. kalo masih ada sisa, bagi-bagi ke musala. besok goreng lagi yaa.',
      rot: '1deg',
    },
  ],
  ownerPin: 'dulang2020',
  isStoreClosed: false,
  closedReason: 'Maaf lagi nggak goreng dulu, hari ini masak di dapur sendiri ya. -Tim Dulang Indonesia',
  activeKloter: 'Kloter Siang (13.00) • Sedang Digoreng Panas 🔥',
  isTomorrowOrderOpen: true,
  tomorrowOrderNote: 'Amankan kuota risoles besok! Digulung & digoreng fresh besok subuh khusus pesananmu.',
  enableDeliveryOption: false, // Default mati/pasif (kebanyakan ambil di tempat, aktifkan bila perlu)
  pickupAddressNote: 'Ambil di Dapur Dulang (Jl. Diponegoro No. 12, Pagerwojo - Dekat Pasar)',
  deliveryRates: {
    'Sidoarjo Kota': 6000,
    'Buduran': 7000,
    'Candi': 8000,
    'Sukodono': 9000,
    'Gedangan': 10000,
    'Waru': 13000,
    'Sedati': 12000,
    'Taman': 14000,
    'Wonoayu': 11000,
    'Tulangan': 12000,
    'Tanggulangin': 10000,
    'Porong': 13000,
    'Krembung': 15000,
    'Krian': 16000,
    'Prambon': 17000,
    'Balongbendo': 19000,
    'Tarik': 20000,
    'Jabon': 18000,
  },
  qrisTeks: 'DULANG INDONESIA (Mendukung QRIS semua Bank & E-Wallet)',
  qrisNmid: 'ID1020057244342',
  qrisImage: '/qris-dulang.png',
};

export const DEFAULT_SIDOARJO_DELIVERY_RATES: Record<string, number> = {
  'Sidoarjo Kota': 6000,
  'Buduran': 7000,
  'Candi': 8000,
  'Sukodono': 9000,
  'Gedangan': 10000,
  'Waru': 13000,
  'Sedati': 12000,
  'Taman': 14000,
  'Wonoayu': 11000,
  'Tulangan': 12000,
  'Tanggulangin': 10000,
  'Porong': 13000,
  'Krembung': 15000,
  'Krian': 16000,
  'Prambon': 17000,
  'Balongbendo': 19000,
  'Tarik': 20000,
  'Jabon': 18000,
};


// Delivery Regions: Sidoarjo, Surabaya, Gresik & Luar Kota
export interface DeliveryRegionGroup {
  group: string;
  areas: string[];
}

export const DELIVERY_REGIONS: DeliveryRegionGroup[] = [
  {
    group: 'Sidoarjo (Dapur Utama)',
    areas: [
      'Sidoarjo Kota',
      'Waru',
      'Gedangan',
      'Buduran',
      'Candi',
      'Sukodono',
      'Taman',
      'Sedati',
      'Krian',
      'Tulangan',
      'Wonoayu',
      'Porong',
      'Tanggulangin',
      'Krembung',
      'Balongbendo',
      'Prambon',
      'Tarik',
      'Jabon',
    ],
  },
  {
    group: 'Surabaya',
    areas: [
      'Surabaya Selatan (Rungkut, Wonokromo, Gayungan, Jambangan, Tenggilis)',
      'Surabaya Timur (Sukolilo, Gubeng, Mulyorejo, Gunung Anyar)',
      'Surabaya Barat (Wiyung, Sambikerep, Karangpilang, Dukuh Pakis, Tandes)',
      'Surabaya Pusat (Tegalsari, Genteng, Bubutan, Simokerto)',
      'Surabaya Utara (Kenjeran, Semampir, Pabean Cantian, Krembangan)',
    ],
  },
  {
    group: 'Gresik & Sekitarnya',
    areas: [
      'Gresik Kota',
      'Menganti',
      'Driyorejo',
      'Kebomas',
    ],
  },
  {
    group: 'Luar Kota / Ekspedisi',
    areas: [
      'Luar Kota (Frozen Paxel / 1 Hari Sampai)',
      'Lainnya (Tulis detail kota di alamat)',
    ],
  },
];

export const INDONESIA_CITIES: string[] = [
  'Kabupaten Sidoarjo',
  'Kota Surabaya',
  'Kabupaten Gresik',
  'Kabupaten Pasuruan',
  'Kabupaten Mojokerto',
  'Luar Kota Lainnya',
];

export const CITY_DISTRICTS: Record<string, string[]> = {
  'Kabupaten Sidoarjo': [
    'Sidoarjo Kota',
    'Buduran',
    'Candi',
    'Gedangan',
    'Waru',
    'Sedati',
    'Sukodono',
    'Taman',
    'Krian',
    'Tulangan',
    'Wonoayu',
    'Tanggulangin',
    'Porong',
    'Krembung',
    'Balongbendo',
    'Prambon',
    'Tarik',
    'Jabon',
  ],
  'Kota Surabaya': [
    'Rungkut',
    'Wonokromo',
    'Gubeng',
    'Sukolilo',
    'Tegalsari',
    'Genteng',
    'Wiyung',
    'Dukuh Pakis',
    'Gayungan',
    'Jambangan',
    'Tenggilis Mejoyo',
    'Gunung Anyar',
    'Mulyorejo',
    'Sawahan',
    'Wonocolo',
    'Karangpilang',
    'Sambikerep',
    'Tandes',
    'Kenjeran',
    'Tambaksari',
    'Semampir',
    'Pabean Cantian',
    'Krembangan',
    'Bubutan',
    'Simokerto',
    'Benowo',
    'Pakal',
    'Asemrowo',
    'Bulak',
    'Lakarsantri',
    'Sukomanunggal',
  ],
  'Kabupaten Gresik': [
    'Driyorejo',
    'Menganti',
    'Kebomas',
    'Gresik Kota',
    'Manyar',
    'Cerme',
    'Kedamean',
    'Wringinanom',
  ],
  'Kabupaten Pasuruan': [
    'Bangil',
    'Beji',
    'Gempol',
    'Pandaan',
    'Prigen',
    'Sukorejo',
    'Purwosari',
  ],
  'Kabupaten Mojokerto': [
    'Mojosari',
    'Puri',
    'Ngoro',
    'Pungging',
    'Trowulan',
    'Bangsal',
  ],
  'Luar Kota Lainnya': [
    'Luar Kota (Ekspedisi Paxel Frozen)',
    'Lainnya (Luar Jawa Timur)',
  ],
};

export const ALL_DELIVERY_AREAS: string[] = DELIVERY_REGIONS.flatMap((r) => r.areas);
export const SIDOARJO_AREAS = CITY_DISTRICTS['Kabupaten Sidoarjo'];


// Default Menus Riil Dapur Dulang Indonesia (8 Menu Utama)
export const DEFAULT_MENUS: MenuItem[] = [
  {
    id: 'menu-1',
    nama: 'Risol Mayo',
    harga: 3500,
    deskripsi: 'Kulit lembut buatan subuh, smoked beef gurih, telur rebus, dan mayo lumer melimpah.',
    tersedia: true,
    opsi: ['Saos Pedas', 'Saos Tidak Pedas', 'cabai aja'],
  },
  {
    id: 'menu-2',
    nama: 'Risol Rogut',
    harga: 3500,
    deskripsi: 'Rogut ayam wortel creamy gurih berempah khas resep wajan panas sejak 2020.',
    tersedia: true,
    opsi: ['Saos Pedas', 'Saos Tidak Pedas', 'cabai aja'],
  },
  {
    id: 'menu-3',
    nama: 'Lumpia Sayur',
    harga: 2500,
    deskripsi: 'Lumpia renyah isi tumisan rebung dan sayuran segar gurih mantap.',
    tersedia: true,
    opsi: ['komplit', 'daun bawang aja', 'cabai aja'],
  },
  {
    id: 'menu-4',
    nama: 'Pisang Coklat',
    harga: 2500,
    deskripsi: 'Pisang manis legit berbalut cokelat premium yang meletus di mulut. Luar renyah, dalam melted.',
    tersedia: true,
  },
  {
    id: 'menu-5',
    nama: 'Tahu Isi Pedas',
    harga: 3000,
    deskripsi: 'Tahu goreng renyah isi sayur pedas gurih nagih, pas buat cemilan anget.',
    tersedia: true,
    opsi: ['Pedas', 'Tidak Pedas', 'cabai aja'],
  },
  {
    id: 'menu-6',
    nama: 'Ote-Ote',
    harga: 2000,
    deskripsi: 'Bakwan sayur / ote-ote khas Jawa Timur yang renyah di luar, lembut dan gurih di dalam.',
    tersedia: true,
  },
  {
    id: 'menu-7',
    nama: 'Kebab',
    harga: 10000,
    deskripsi: 'Tortilla panggang isi irisan daging lezat, sayuran segar, dan racikan saus spesial.',
    tersedia: true,
    opsi: ['Pedas', 'Sedang', 'Tidak Pedas'],
  },
  {
    id: 'menu-8',
    nama: 'Burger',
    harga: 13000,
    deskripsi: 'Roti bun lembut dengan patty daging gurih, sayuran segar, dan siraman saus mantap.',
    tersedia: true,
    opsi: ['Pedas', 'Sedang', 'Tidak Pedas'],
  },
  {
    id: 'menu-9',
    nama: 'Risol Mayo Frozen (Isi 5)',
    harga: 17000,
    deskripsi: 'Pack hemat isi 5 pcs risoles mayo siap goreng di rumah, tahan simpan kulkas/freezer.',
    tersedia: true,
    variantType: 'frozen',
  },
  {
    id: 'menu-10',
    nama: 'Risol Rogut Frozen (Isi 5)',
    harga: 17000,
    deskripsi: 'Pack hemat isi 5 pcs risoles rogut ayam sayur creamy siap goreng kapan saja.',
    tersedia: true,
    variantType: 'frozen',
  },
  {
    id: 'menu-11',
    nama: 'Kebab Frozen',
    harga: 25000,
    deskripsi: 'Pack isi kebab tortilla daging siap panggang teflon hangat di rumah.',
    tersedia: true,
    variantType: 'frozen',
  },
  {
    id: 'menu-12',
    nama: 'Risol Mayo Frozen (Isi 10)',
    harga: 33000,
    deskripsi: 'Kemasan box isi 10 pcs risoles mayo beku super mantap buat stok keluarga.',
    tersedia: true,
    variantType: 'frozen',
  },
  {
    id: 'menu-13',
    nama: 'Risol Rogut Frozen (Isi 10)',
    harga: 33000,
    deskripsi: 'Kemasan box isi 10 pcs risoles rogut beku gurih berempah.',
    tersedia: true,
    variantType: 'frozen',
  },
];

// Seed initial loyal customers (dimulai kosong untuk dapur riil)
export const INITIAL_CUSTOMERS: Customer[] = [];

// Seed initial personalized vouchers (dimulai kosong untuk dapur riil)
export const DEFAULT_VOUCHERS: Voucher[] = [];

// Locked Copywriting Texts - PRD Anti-Halu v2.0 Source of Truth
export const LOCKED_COPY = {
  heroH1: 'Sudah makan? Jangan biarkan tubuhmu kelaparan',
  heroSub: 'bukan restoran, bukan cafe, bukan cloud kitchen. cuma dapur kecil di Sidoarjo yang bangun jam 3 pagi buat goreng risoles anget.',
  psWajib: 'tunggu agak dingin dulu, biar kamu nyaman makannya',
  pillBest: 'baru goreng • masih anget',
  pillScan: 'scan dulu • masih anget',
  pillHot: 'baru goreng • masih anget',
  qrNoteLeft: 'QR-nya di sini → kecil biar gak norak',
  qrScanNote: 'kangen? scan ini yaa ↳',
  qrDoodles: '✨ 💛 lumer~',
  waMain: 'Dulang, aku kangen yang anget-anget',
  waCheckout: 'Dulang, aku kangen yang anget-anget',
  toastSuccess: 'yey, masuk dapur!',
  toastReorder: 'yeeee kapan-kapan pesen lagi',
  toastPinError: 'kode salah, coba lagi',
  footer: '© 2020 Dulang Indonesia — dibuat dengan wajan panas & tulisan tangan',
  badgeSince: 'sejak 2020',
};

// --- DEFAULT TESTIMONIALS PELANGGAN (dimulai kosong untuk ulasan riil) ---
export const DEFAULT_TESTIMONIALS: CustomerTestimonial[] = [];

// --- DATA TRANSAKSI PENJUALAN AWAL (dimulai kosong untuk transaksi riil) ---
export const DEFAULT_ORDERS: OrderRecord[] = [];
