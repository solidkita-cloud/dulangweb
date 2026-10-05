# Dulang Indonesia — Web App Resmi (Sejak 2020)
> *"Dibuat dengan wajan panas & tulisan tangan"*

Aplikasi web resmi untuk **Dulang Indonesia** (Sidoarjo, Jawa Timur) yang menggabungkan:
1. **Landing Page Toko Hangat**: Menampilkan menu risoles & piscok lumer, jadwal dapur, dan keranjang belanja WhatsApp (*sticky cart*).
2. **Smart QR Stiker Dus**: Sistem scan stiker pada dus risoles & gantungan kunci akrilik. Pelanggan cukup mengisi alamat **1x saja** saat pertama kali order; pada pesanan berikutnya, sistem langsung menyapa nama mereka dan memungkinkan pemesanan ulang (*repeat order*) tanpa mengetik ulang alamat.
3. **Mode Pemilik (Dapur)**: Kelola menu dapur (harga, foto, ketersediaan), pantau pelanggan setia (Tier *Baru*, *Setia*, *Sultan Dulang*), dan lihat sebaran klaster wilayah pelanggan Sidoarjo.
4. **Cetak Stiker Vinyl A4**: Generator batch QR stiker acak (Nanoid + HMAC) dengan tata letak presisi 20 stiker per lembar A4 (4×5), siap diekspor ke CSV dan PDF untuk percetakan lokal.

---

## 🎨 Brand Book Locked (Aturan Desain Terkunci)
* **Warna Utama**:
  * Cream Hangat: `#FFF8E7` (dengan latar belakang *dot pattern* halus)
  * Hitam Pekat: `#111111`
  * Kuning Mentega: `#FFD700` (untuk selotip/tape, pill status, dan tombol aksi)
  * Coklat Tanah: `#5C3D2E`
* **Tipografi**:
  * Heading & Tulisan Tangan: **Caveat** *(600, 700)*
  * Teks Utama & UI: **Plus Jakarta Sans** *(400, 600, 700)*
* **Gaya Visual**:
  * Hard shadow kaku (`8px 8px 0px #FFD700` atau `4px 4px 0px #111111`, tanpa blur).
  * Kemiringan organik (*tilt*) `-1°` hingga `2°` pada kartu dan foto polaroid.
  * Aksen selotip kuning (*yellow tape*) miring di atas kartu.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Mode Pengembangan (Development)
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

### 2. Membangun untuk Produksi (Production Build)
```bash
npm run build
```
File hasil kompilasi yang siap di-*deploy* berada di folder `dist/`.

---

## 🛡️ Setup Database Supabase (Opsional)
Aplikasi ini sudah dilengkapi sistem **Dual-Engine (Anti-Mati)**:
* **Secara Default**: Langsung berjalan 100% menggunakan *LocalStorage Cerdas* di browser (bisa testing pesanan, scan QR, dan edit menu tanpa internet atau server).
* **Jika Ingin Menghubungkan ke Cloud Supabase**:
  1. Buka [supabase.com](https://supabase.com), buat project baru (Region Singapore).
  2. Buka menu **SQL Editor**, salin dan jalankan seluruh isi file `supabase-schema.sql`.
  3. Buat file `.env` di folder project ini (atau atur di Environment Variables Netlify):
     ```env
     VITE_SUPABASE_URL=https://xxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJh......
     VITE_OWNER_CODE=dulang2020
     ```

---

## 📦 Deployment ke Netlify
Aplikasi sudah dilengkapi file `netlify.toml` dan `public/_redirects`:
1. Hubungkan repository ke Netlify (atau *drag-and-drop* folder `dist`).
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Seluruh *security headers* (`X-Frame-Options: DENY`, `nosniff`, `CSP`, `HSTS`) langsung aktif otomatis.
