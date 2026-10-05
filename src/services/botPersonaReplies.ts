/**
 * BOT PERSONA REPLIES ENGINE - DAPUR DULANG SIDOARJO
 * Karakter: Mbak dapur asli Sidoarjo yang bangun jam 3 pagi,
 * ramah, anget, ceplas-ceplos, solutif, dan GAK HAFALAN (Multi-Variasi).
 * 
 * Fitur Utama:
 * 1. 1 Intent = 3-4 Variasi Jawaban Acak (Tidak monoton)
 * 2. Sisipin Nama Pelanggan ({nama})
 * 3. Sisipin Konteks Jam Riil ({jam}, pagi/siang/sore)
 * 4. Peka Status Pelanggan (Pelanggan Baru vs Pelanggan Setia / Sultan Dulang)
 * 5. Peka Kondisi Stok (Stok Melimpah vs Sisa Dikit vs Habis)
 */

export interface PersonaContextData {
  nama?: string;
  isSultan?: boolean;
  orderCount?: number;
  stok?: number;
  menu?: string;
  harga?: number;
  total?: number;
  totalText?: string;
  itemSummary?: string;
  itemLines?: string;
  defaultArea?: string;
  area?: string;
  ongkir?: number;
  orderId?: string;
  extra?: string;
}

export function pickRandom<T>(list: T[]): T {
  if (!list || list.length === 0) return '' as any;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

export function getTimeContext(): { label: string; timeStr: string; slot: 'pagi' | 'siang' | 'sore' | 'malam' } {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours.toString().padStart(2, '0')}.${minutes} WIB`;

  if (hours >= 4 && hours < 11) {
    return { label: 'pagi-pagi gini', timeStr, slot: 'pagi' };
  } else if (hours >= 11 && hours < 15) {
    return { label: 'siang-siang gini', timeStr, slot: 'siang' };
  } else if (hours >= 15 && hours < 18) {
    return { label: 'sore-sore gini pas ngopi/ngeteh', timeStr, slot: 'sore' };
  } else {
    return { label: 'malem-malem gini', timeStr, slot: 'malam' };
  }
}

export const PERSONA_REPLIES = {
  // -------------------------------------------------------------------------
  // 1. NANYA STOK SPESIFIK (e.g. "mayo ada kak?")
  // -------------------------------------------------------------------------
  stok_ready_banyak: [
    `Ada kak {nama}! 😍 {menu} masih anget banget, baru turun dari wajan jam segini ({jam}). Sisa {stok} pcs nih. Mau dibungkusin berapa?`,
    `Masih ada dong kak {nama}! Stok {menu} aman melimpah ({stok} pcs), digoreng dadakan biar dapet renyah & lumernya. Mau berapa biji? ✨`,
    `Ada banget kak! Kebetulan kloter {menu} baru aja ditiriskan dari minyak, ada {stok} pcs ready. Mau diambil di dapur atau dikirim kurir? 😊`
  ],

  stok_ready_dikit: [
    `Ada kok kak {nama}, tapi sisa {stok} pcs aja nih yang {menu}, rebutan dari tadi! 😱 Mau aku sisihin sekarang biar gak kehabisan?`,
    `Waduh sisa dikit kak, tinggal {stok} pcs aja buat {menu} anget! Mau langsung aku amankan di kotak buat kakak?`,
    `Masih kebagian kak, tapi mepet banget tinggal {stok} pcs! Mau aku bungkusin semuanya atau berapa kak? 🏃💨`
  ],

  stok_habis: [
    `Yaahh {menu} baru aja ludes kak {nama} 😭 Tadi jam segini rebutan. Besok subuh aku gorengin fresh lagi ya, mau aku list-in buat kakak dari sekarang? 🙏`,
    `Waduh maaf banget kak {nama}, {menu} hari ini udah habis terjual! 🙏 Tapi tenang, varian lain yang masih ready anget ada: {extra}. Mau coba varian yang ready ini? 😊`,
    `Duh sayang banget kak, {menu} udah sold out duluan barusan 😭 Mau aku kabarin pas wajan kloter berikutnya naik, atau mau ganti menu yang ready?`
  ],

  // -------------------------------------------------------------------------
  // 2. NANYA STOK UMUM / NGEGAS / SINGKAT (e.g. "ready?", "cek stok dong")
  // -------------------------------------------------------------------------
  stok_ngegas_singkat: [
    `⚡ *SIAP KAK {nama}! DAPUR DULANG AKTIF & WAJAN STANDBY!* 🔥\nLangsung kami cekkan stok fresh dari wajan & etalase saat ini ({jam}):\n\n✅ *READY HANGAT SEKARANG:*\n{extra}\n━━━━━━━━━━━━━━━━━━━━━\nSemua digoreng fresh dadakan di wajan panas. Mau dibungkusin yang mana Kak? Langsung ketik aja yaa (contoh: *"mayo 3, rogut 2"*). 😊`,
    `Standby selalu kak {nama}! Etalase sama wajan masih anget ngebul nih jam segini ({jam}) 🥟🔥\n\n✅ *MENU READY FRESH:*\n{extra}\n━━━━━━━━━━━━━━━━━━━━━\nMau dipesenin yang mana kak? Langsung ketik pesanan kakak yaa! 😊`,
    `Aman sentosa Kak {nama}! Mumpung baru diangkat dari tirisan minyak, ini list yang ready:\n\n✅ *READY HANGAT:*\n{extra}\n━━━━━━━━━━━━━━━━━━━━━\nMau diambil sendiri ke dapur atau dikirim kurir anget-anget? Langsung kabari yaa! 🛵`
  ],

  // -------------------------------------------------------------------------
  // 3. NANYA BISA KIRIM / ONGKIR
  // -------------------------------------------------------------------------
  bisa_kirim_general: [
    `Bisa banget kak {nama}! Ke daerah mana? Biar langsung aku cekin ongkir dan estimasi kurirnya yaa 🛵✨`,
    `Bisa dong! Dapur Dulang cover area Sidoarjo sampai Surabaya. Rencana mau dikirim ke kecamatan mana nih kak? 😊`,
    `Bisaaa banget, kurir toko & driver kami standby kok jam segini. Mau meluncur ke alamat mana kak {nama}? 👍`
  ],

  // -------------------------------------------------------------------------
  // 4. KOMPLAIN HALUS / NGAMBEK (EMPATI + BONUS PENGGANTI)
  // -------------------------------------------------------------------------
  komplain_kering: [
    `Ya ampun maaf ya kak {nama} 😭 makasih udah jujur bilang ke kami. Kemarin emang kelamaan dikit di wajan pas jam sibuk dapur. Buat ganti rasa kecewa Kakak, *di next order aku kasih bonus 2 piscok anget ya*, janji digoreng lebih juicy, lumer, dan crispy lembut! 🥟✨ Mimin catet nama Kakak di daftar bonus yaa.`,
    `Aduhhh maaf banget ya kak {nama}, kemarin kebablasan gorengnya jadi agak kering 🙏 Makasih banyak udah ngingetin, ini jadi koreksi langsung buat tim wajan dapur hari ini. Sebagai gantinya, *di next order aku kasih bonus 2 piscok anget ya*, janji digoreng lebih juicy & pas! 😭`,
    `Waduhh noted kak {nama}! Maaf yaa, kemarin yang goreng keasikan ngobrol 😅 Next order mimin kawal sendiri gorengannya biar lebih moist & lumer! Buat ganti kecewanya, *next order ada bonus 2 piscok lumer anget gratis* yaa kak 🙏`
  ],

  komplain_gosong: [
    `Ya ampun maaf ya kak {nama} 😭 Makasih banyak udah jujur ngasih tahu kami. Kemarin mungkin api penggorengan sempat kebesaran pas antrean dapur lagi padat. Buat ganti rasa kecewa Kakak, *di next order aku kasih BONUS 2 Piscok Lumer anget yaa*, janji digoreng lebih pas keemasan, renyah, dan juicy! 🙏`,
    `Aduhh ampun kak {nama} 🙏 Maaf banget kemarin ada yang kegosongan dikit. Makasih udah negur, langsung mimin evaluasi ke tukang gorengnya. Next order mimin kawal sendiri biar dapet golden brown cantik + *BONUS 2 Piscok Lumer anget gratis* ya kak! 😭✨`
  ],

  komplain_mayo_dikit: [
    `Astagfirullah maaf yaa kak {nama} 😭 Makasih banyak udah jujur mengingatkan kami. Harusnya mayo Dapur Dulang creamy melimpah sampai lumer. Bagian isian dapur langsung mimin tegur dan evaluasi hari ini. Buat ganti rasa kecewa Kakak, *di next order aku kasih BONUS 2 Piscok Lumer anget + pesanan Kakak mimin kasih ekstra mayo melimpah gratis!* 🙏`,
    `Duhh mbak dapur yang lipat kemarin kurang royal nih mayonya, udah mimin briefing ulang hari ini 😅 Maaf banget ya kak {nama}! Next order langsung mimin kasih ekstra mayo meluber-luber plus *bonus 2 piscok lumer anget* yaa! 🙏`
  ],

  komplain_kecil: [
    `Astagfirullah maaf ya kak {nama} 😭 Makasih udah jujur ngasih tahu kami. Ukuran kulit dan takaran isian kemarin langsung mimin briefing ke tim dapur agar tetap montok dan mantap sesuai standar Dulang. Buat ganti, *next order aku kasih bonus 2 piscok anget ya*, dan mimin pilihin risoles yang paling montok buat Kakak! 🙏`,
    `Ya ampun maaf ya kak {nama} 😭 Makasih kejujurannya. Timbangan isian langsung kami standarkan ulang hari ini. Next order aku kasih *bonus 2 piscok anget* yaa biar puas ngemilnya! 🙏`
  ],

  komplain_lama_kirim: [
    `Ya ampun maaf banget ya kak {nama} 😭 Makasih udah sabar dan jujur ngasih tahu. Kemarin kurir kami sempat terhambat cuaca dan antrean jalanan Sidoarjo. Kami sangat menghargai waktu Kakak. Buat permohonan maaf kami, *next order pesanan Kakak kami prioritaskan paling awal + BONUS 2 camilan anget gratis dari dapur!* 🛵💨`,
    `Aduhh maafin kurir kami ya kak {nama} 😭 Kemarin rutenya padat merayap. Untuk pesanan berikutnya, nomor Kakak mimin kasih tanda VIP prioritas paling awal + bonus camilan anget dari dapur yaa! 🙏`
  ],

  komplain_minyak: [
    `Duh ya ampun maaf ya kak {nama} 😭 Harusnya penirisan minyak minimal 5 menit di jaring dapur sebelum dipack. Makasih banget udah ingetin kami! Evaluasi langsung kami tegaskan ke bagian wajan hari ini. Buat ganti kecewanya Kakak, *next order aku kasih bonus 2 piscok anget ya*, janji digoreng tiris kering sempurna & crispy! 🥟✨`,
    `Ya ampun maaf kak {nama} 🙏 Tirisannya kemarin kurang lama pas buru-buru dipack. Makasih udah kritik, hari ini langsung mimin wajibkan tiris kering! Buat kompensasi, *next order aku kasih bonus 2 piscok anget yaa*! 🥟`
  ],

  komplain_general: [
    `Ya ampun maaf ya kak {nama} 😭 Makasih udah jujur mengingatkan kami. Dapur Dulang berkomitmen menjaga rasa gurih renyah yang konsisten untuk seluruh keluarga. Buat ganti rasa kecewa Kakak, *di next order aku kasih bonus 2 piscok anget ya*, janji digoreng lebih fresh, juicy, dan mantap! 🙏 Bila ingin bicara langsung dengan Mas Dhodhy (Owner Dulang), ketik *hubungi owner* ya Kak.`,
    `Aduhhh maaf banget kak {nama} 😭 Masukan Kakak sangat berharga buat kami berbenah. Buat gantinya, *next order aku kasih bonus 2 piscok anget ya*! Semoga berkenan yaa Kak 🙏`
  ],

  // -------------------------------------------------------------------------
  // 5. NANYA NGAWUR / OUT-OF-SCOPE (AYAM UTUH, NASI, DIMSUM, DLL)
  // -------------------------------------------------------------------------
  ngawur_ayam: [
    `Hehe ayam utuhnya gak ada kak {nama} 🤭 Dapur Dulang khusus aneka risol & gorengan anget aja 🙏 Daging ayamnya udah nyempil cantik di dalam *Risol Rogut Ayam Creamy* (suwir ayam gurih berempah) & Risol Mayo, bukan ayam geprek/ayam potong utuh yaa. Mau cobain Risol Rogut Ayamnya Kak? Dijamin gurih nagih! 🥰`,
    `Gak ada kak {nama}, kita bukan warung ayam geprek hehe 😅 Dapur Dulang khusus aneka risol crispy anget aja. Tapi ayam di Risol Rogut kita pakai daging ayam asli disuwir banyak lho, bukan perisa abal-abal! Mau coba dibungkusin? 😊`,
    `Waduh kalau ayam goreng utuh kita gak jualan kak {nama} 🙏 Dapur Dulang khusus aneka risol anget. Adanya Risol Rogut Ayam suwir bumbu susu kaldu creamy. Renyah di luar lumer di dalam! Mau coba berapa biji kak? 🥟`
  ],

  ngawur_nasi: [
    `Mohon maaf yaa Kak {nama}, di Dapur Dulang kami fokus spesialis aneka risoles crispy & camilan hangat, belum sedia nasi/makanan berat 🙏 Tapi kalau butuh camilan padat yang mengenyangkan buat ganjel lapar atau isian snack box, *Risol Mayo (telur + smoked beef tebal)* dan *Kebab Daging* kami ngenyangin banget lho Kak! Mau coba dibungkusin hangat? 😊`,
    `Hehe belum ada nasi kak {nama}! Kita khusus gorengan dan risoles anget buat teman ngemil. Tapi Risol Mayo kita isinya padet (telur rebus, smoked beef, mayo, keju), makan 2 aja udah kenyang banget lho kak! Mau cobain? 😉`
  ],

  ngawur_minuman: [
    `Untuk saat ini Dapur Dulang khusus memproduksi aneka camilan gorengan hangat & frozen pack yaa Kak {nama}, belum sedia minuman/es teh 🙏 Tapi risoles mayo dan piscok lumer kami juara banget dinikmati bareng teh manis hangat atau kopi buatan rumah Kakak. Mau dipesankan cemilan hangatnya Kak? 🥟☕`,
    `Belum ada es teh kak hehe 😅 Kita fokus ngegoreng risoles anget dari wajan. Tapi pas banget nih risoles mayo dinikmati bareng es teh bikinan sendiri di rumah! Mau dibungkusin risolesnya kak? 🥟`
  ],

  ngawur_dimsum: [
    `Hehe mohon maaf yaa Kak {nama}, Dapur Dulang bukan kedai dimsum yaa 🙏 Kami spesialis *Risoles Mayo Crispy, Risol Rogut Ayam, Piscok Lumer, & Kebab Daging* kebanggaan Sidoarjo. Kulitnya renyah keemasan dan isiannya lumer juicy. Dijamin nggak kalah nagih dari dimsum! Mau cobain Risol Mayo kami Kak? 😊`,
    `Dimsumnya belum sedia kak, tapi kita punya Risoles Mayo yang lumernya gak kalah saing sama dimsum! Mau coba icip 1-2 pcs dulu kak? 🥟✨`
  ],

  ngawur_kue_ultah: [
    `Waduh mohon maaf Kak {nama}, Dapur Dulang tidak jualan kue ultah/tart yaa 🎂 Tapi banyak banget pelanggan kami yang pesan *Paket Dus Cantik Risol Mayo & Piscok Lumer* untuk kejutan ulang tahun atau suguhan arisan! Kami juga bisa bantu selipkan *Kartu Ucapan Ulang Tahun Gratis* di atas dusnya lho Kak 🎁 Mau dibikinkan paket hantaran risoles? 😊`,
    `Kue tart gak ada kak, tapi kita sering bikinin "Tumpeng Risol" atau hantaran box cantik buat ultah lho! Udah free kartu ucapan juga. Mau dibikinkan hantaran risoles kak? 🎉`
  ],

  ngawur_gorengan_pasar: [
    `Di Dapur Dulang kami fokus ke camilan risoles premium & aneka gorengan hangat homemade Kak {nama}:
• *Risol Mayo Crispy:* Rp 3.500 ⭐ Best Seller
• *Risol Rogut Ayam Creamy:* Rp 3.500
• *Tahu Isi Pedas:* Rp 3.000 (Renyaah gurih pedas nagih!)
• *Ote-Ote / Bakwan Sayur Jatim:* Rp 2.000
• *Lumpia Sayur:* Rp 2.500
• *Piscok Lumer:* Rp 2.500
Kami tidak sedia gorengan gerobak pasar curah (seperti tempe mendoan/cireng/cilok) yaa Kak karena semua kulit & isian kami olah sendiri higienis setiap hari. Mau coba tahu isi pedas atau risoles hangatnya Kak? ✨`,
    `Gorengan pasar curah kayak tempe mendoan/cireng kita gak jualan kak {nama} 🙏 Dapur Dulang khusus camilan risoles premium modern & gorengan homemade anget: Risol Mayo, Rogut Ayam Susu, Tahu Isi Pedas (Rp 3.000), Ote-Ote (Rp 2.000), & Piscok Lumer. Mau dibungkusin yang mana nih kak? 😊`
  ],

  // -------------------------------------------------------------------------
  // 5.5 INGIN PESAN / MULAI ORDER (e.g. "aku pesen", "mau pesan dong")
  // -------------------------------------------------------------------------
  mulai_pesan: [
    `Siap banget Kak {nama}! 🔥 Dapur Dulang siap gorengin yang renyah & hangat mengepul dari wajan!\n\nMau pesan apa aja nih Kak? Kakak bisa langsung ketik pesanannya yaa, contohnya:\n• *"mayo 5, rogut 5, tahu isi 6"*\n• atau *"mayo 10, piscok 4"*\n\nMau dibungkusin menu apa aja hari ini Kak? 😊`,
    `Asyiikk, mau jajan apa hari ini Kak {nama}? 🥟✨\nWajan dapur lagi standby nih jam segini ({jam})! Langsung ketik aja menu dan jumlah yang mau dipesan (contoh: *"mayo 3, rogut 2"*). Mimin langsung list-in yaa!`,
    `Siap melayani Kak {nama}! Dapur Dulang ready aneka Risoles Mayo Crispy, Rogut Creamy, Tahu Isi Pedas, Ote-Ote, Kebab, & Piscok Lumer fresh dari wajan panas.\n\nMau dipesenin apa aja nih Kak? Langsung sebutin menu dan jumlahnya yaa! 🛵🔥`
  ],

  // -------------------------------------------------------------------------
  // 6. PESAN NATURAL (ORDER INTAKE)
  // -------------------------------------------------------------------------
  order_intake_new: [
    `Siap kak {nama}! 📝\n{itemLines}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Total Belanja:* Rp {totalFormatted}\n\n🛵 Mau *Diambil Sendiri* di dapur atau *Dikirim Kurir* Kak?\n_(Ketik contoh: "ambil sendiri" atau "delivery waru")_ 😊`,
    `Oke noted Kak {nama}! Catatan pesanan udah masuk:\n{itemLines}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Total:* Rp {totalFormatted}\n\nMau pickup langsung ke dapur atau diantar kurir hangat-hangat nih kak? 🛵`,
    `Sip mantap! Pesanan Kak {nama} sudah dicatat:\n{itemLines}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Subtotal:* Rp {totalFormatted}\n\nBisa diambil di dapur atau kami kirim ke rumah yaa. Rencana mau diambil atau dikirim kak? ✨`
  ],

  order_intake_sultan: [
    `Siap Sultan {nama}! 😍 Pesanan langganan tercatat:\n{itemLines}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Total:* Rp {totalFormatted}\n\n🛵 Mau dikirim ke {defaultArea} lagi kayak biasa, atau mau mampir ambil sendiri di dapur Kak? 🥰`,
    `Wah asyik Kak {nama} borong lagi! 🥟✨\n{itemLines}\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Total Belanja:* Rp {totalFormatted}\n\nLangsung meluncur ke alamat {defaultArea} seperti biasa ya kak? Atau mau mampir ke dapur? 😊`
  ],

  // -------------------------------------------------------------------------
  // 7. PUJI / TESTIMONI
  // -------------------------------------------------------------------------
  pujian_testimoni: [
    `Alhamdulillah MasyaAllah, seneng dan terharu banget dengernya Kak {nama}! 🥹✨ Terima kasih banyak atas apresiasi & review manisnya untuk Dapur Dulang Sidoarjo! Chat dari Kakak ini langsung bikin tim dapur yang bangun subuh makin bersemangat goreng yang fresh & crispy 🥟🔥 Semoga rezeki Kakak dan keluarga semakin berlimpah, berkah, dan sehat selalu yaa. Kapanpun Kakak rindu cemilan hangat & renyah, pintu Dapur Dulang selalu terbuka lebar! Ditunggu pesanan berikutnya yaa Kak! 🥰🙏`,
    `Aaaaa makasih banyaak Kak {nama}! 🥰 Seneng pol kalau rasanya cocok di lidah Kakak sekeluarga. Tim dapur langsung senyum-senyum denger pujiannya! Semoga rezekinya makin lancar terus ya kak. Jangan kapok jajan di Dapur Dulang yaa! 🥟💖`,
    `Bikin meleleh ulasannya, kayak mayonya Dulang 🤤 Makasih banyak ya Kak {nama}! Komentar dari Kakak ini jadi moodbooster terbaik buat kami sekeluarga. Ditunggu orderan selanjutnya pas lagi kangen ngemil anget-anget yaa! 🙏✨`
  ],

  // -------------------------------------------------------------------------
  // 8. NEGO / NAWAR ALA EMAK-EMAK
  // -------------------------------------------------------------------------
  nego_grosir_partai: [
    `Wah mantap banget Kak {nama} buat acara arisan / pengajian / syukuran keluarga! 😍 Khusus pemesanan partai banyak di Dapur Dulang ada skema paket hemat resmi lho:\n• *Pemesanan 50 - 99 pcs:* GRATIS Bonus 5 pcs Piscok Lumer / Risol hangat!\n• *Pemesanan 100 pcs ke atas:* Harga spesial grosir jadi *Rp 3.000/pcs* + *FREE ONGKIR* se-Sidoarjo & Surabaya terjangkau!\n• Sudah include dus rapi, cabe rawit melimpah, dan saos sambal higienis.\n\nMau pesan varian apa aja untuk acara tanggal berapa Kak? Biar langsung kami amankan slot wajan penggorengannya! 🎉`,
    `Borong banyak siap mimin kasih harga spesial kak {nama}! Buat 100 biji ke atas dapet potongan Rp 3.000/biji plus Free Ongkir se-Sidoarjo! Kalau 50-99 pcs dapet bonus 5 pcs cemilan anget gratis. Mau di-list buat acara tanggal berapa kak? 🥳`
  ],

  nego_satuan_santai: [
    `Hehe bisa aja nih Kak {nama}! 🤭 Harga satuan kami Rp 3.500 ini sudah hitungan pas & bersahabat banget Kak, dengan isian melimpah (daging asap tebal, telur, mayo Maestro lumer, & kulit lembut homemade).\n\nTapi tenang Kak, kami ada promo menarik:\n• *FREE ONGKIR:* Khusus belanja minimal Rp 100.000\n• *Bonus Camilan:* Pesan di atas 30 pcs selalu mimin selipin bonus camilan ekstra hangat dari dapur! 😉\nYuk Kak, mau dibungkusin berapa biji hari ini? Dijamin puas dan bikin nagih!`,
    `Aduhh bu/kak {nama}, harga 3.500 ini udah mepet modal daging ayam, smoked beef tebel & mayo Maestro lumer lho hehe 😅 Kulitnya juga homemade lembut bersahabat. Tapi kalau belanja 100rb mimin kasih promo Free Ongkir kok! Mau borong varian apa aja nih? 😉`
  ],

  // -------------------------------------------------------------------------
  // 9. RESPON FRUSTASI (ROBOT MAGANG & SAMBUNG OWNER)
  // -------------------------------------------------------------------------
  frustasi: [
    `Hehe maaf yaa Kak {nama} kalau aku agak lelet atau kaku 😅 Aku robot asisten dapur Dulang yang baru magang dan lagi belajar sat-set.\n\nBiar gak ribet dan langsung dilayani dengan cepat, mau aku sambungkan langsung ke *Mas Dhodhy (Owner Dapur Dulang)* sekarang? Ketik *"hubungi owner"* ya Kak 🙏`,
    `Aduhh ampun Kak {nama} 🙏 Jangan males dulu yaa, aku belajar cepet kok! Biar gak salah paham, mau langsung aku panggilkan tim dapur / owner asli sekarang?`,
    `Ya ampun maaf banget yaa Kak {nama} 😭 Kalau caraku jawab bikin kesel, boleh ketik *"hubungi owner"* biar Mas Dhodhy langsung handle chat Kakak saat ini juga yaa!`
  ],

  // -------------------------------------------------------------------------
  // 10. PELANGGAN MASIH PILIH-PILIH / BELUM FIX
  // -------------------------------------------------------------------------
  pilih_pilih: [
    `Santai Kak {nama}, keranjangnya aku simpenin dulu yaa 😊 Total sementara Rp {totalFormatted}. Kalau sudah fix tinggal bilang *"lanjut kirim"* atau ketik menu tambahannya yaa! ✨`,
    `Siap Kak {nama}, gak buru-buru kok! Keranjang belanja Rp {totalFormatted} aman tersimpan di dapur. Mau tanya-tanya varian rasa dulu juga boleh banget yaa 😊`,
    `Oke Kak {nama}, dipilih-pilih dulu aja dengan tenang. Belum kami proses kok sebelum Kakak mantap. Kapanpun mau lanjut, tinggal kabari yaa! 🥟`
  ],

  // -------------------------------------------------------------------------
  // 11. TANYA STOK SAAT KERANJANG SUDAH ADA ISI (KEEP CART)
  // -------------------------------------------------------------------------
  tanya_stok_keep_cart: [
    `*{menu}* ada kok Kak {nama}! Sisa {stok} pcs, baru turun dari wajan masih anget mengepul 🔥\n\nNgomong-ngomong di keranjang Kakak sudah ada: {itemLines} (Total Rp {totalFormatted}).\n\nMau sekalian ditambah *{menu}*nya ke pesanan Kak? 😊`,
    `Ada banget Kak! Kloter *{menu}* ready sisa {stok} pcs. Keranjang Kakak saat ini Rp {totalFormatted}. Mau dibungkusin sekalian {menu}nya Kak? ✨`
  ]
};

/**
 * Format dynamic reply with variable replacement
 */
export function formatDynamicReply(templateList: string[], data: PersonaContextData): string {
  const chosen = pickRandom(templateList);
  const timeCtx = getTimeContext();

  return chosen
    .replace(/\{nama\}/g, data.nama || 'Kak')
    .replace(/\{jam\}/g, timeCtx.timeStr)
    .replace(/\{waktuSlot\}/g, timeCtx.label)
    .replace(/\{menu\}/g, data.menu || 'Risol')
    .replace(/\{stok\}/g, (data.stok ?? 0).toString())
    .replace(/\{totalFormatted\}/g, data.total ? data.total.toLocaleString('id-ID') : '0')
    .replace(/\{totalShort\}/g, data.total ? `${Math.round(data.total / 1000)}rb` : '0')
    .replace(/\{defaultArea\}/g, data.defaultArea || 'Sidoarjo')
    .replace(/\{area\}/g, data.area || 'Sidoarjo')
    .replace(/\{itemSummary\}/g, data.itemSummary || data.itemLines || '')
    .replace(/\{itemLines\}/g, data.itemLines || data.itemSummary || '')
    .replace(/\{extra\}/g, data.extra || '');
}
