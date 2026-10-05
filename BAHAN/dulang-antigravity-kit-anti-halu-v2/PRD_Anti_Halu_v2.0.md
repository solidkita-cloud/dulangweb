# DULANG INDONESIA - PRD ANTI-HALU v2.0 FOR ANTIGRAVITY - LOCKED SPEC
Tanggal: 24 Sep 2026 | Domain: https://dulangin.netlify.app/ | Sidoarjo Sejak 2020

## 0. ANTI-HALLUCINATION RULES - WAJIB BACA ANTIGRAVITY
- DILARANG invent warna/font/PIN/copy/WA. Semua locked di bawah.
- DILARANG pakai QR sequential DULANG-001. WAJIB random 8-char alphabet: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (no 0,O,1,I) via nanoid.
- DILARANG store HMAC secret di client bundle. Secret WAJIB di server env HMAC_SECRET, verifikasi via Netlify Function /api/verify-qr.
- DILARANG store PIN plaintext. PIN default migrasi: dulang2020 -> langsung hash bcrypt di Supabase Auth, expiry 24h, JWT httpOnly.
- DILARANG expose WA + alamat lengkap saat scan. Hanya first name + masked WA 08xx-xxxx-1234.
- DILARANG klaim HTML 1.01KB. Real bundle 180-350KB gzipped, build Vite ~7.9s.
- DILARANG invent tabel. Hanya tabel di Section 6.
- WA LOCKED: 6287703397035
- Copy locked verbatim Section 4.
- Tech stack locked: React 18.3.1, TS 5.7.3, Vite 6.1.0, Tailwind 3.4.17, qrcode 1.5.4, jspdf 2.5.2, nanoid 5.1.2, supabase-js 2.49.1, lucide-react 0.475.0

## 1. EXECUTIVE SUMMARY
Dulang Indonesia: risoles mayo lumer Sidoarjo sejak 2020, bangun jam 3 pagi. Problem: order WA manual, no customer data, no repeat. Solution: digital storefront + QR retention + WA assistant (NOT full OMS). Goals: increase repeat, own data. Non-goals v1: NO QRIS payment, NO marketplace, NO promo engine, NO AI, NO push.

## 2. USERS
- Kak Rina 25-35 Sidoarjo, males ketik alamat ulang, kangen anget-anget
- Mas Dhodhy Pemilik since 2020, mau edit menu dari HP, liat klaster Sidoarjo (Waru, Gedangan, Buduran, Sidoarjo Kota)

## 3. USER JOURNEYS
A: Buka web -> pilih Polaroid -> + Masukin Dulang -> StickyCart -> Pesan via WA -> WA terbuka wa.me/6287703397035?text=Dulang%2C%20aku%20kangen%20yang%20anget-anget
B: Owner Generate 20 stiker /qr/ -> PDF A4 Vinyl Doff 4x4cm -> tempel kardus
C: Customer scan UNUSED -> /scan.html?id=A7K9P2XQ -> verify server -> form Nama, WA, Alamat, Area Sidoarjo, Fav Menu + consent checkbox UU PDP + timestamp ISO8601 -> save encrypted
D: Scan RETURNING -> greeting "Halo Kak Budi! Kangen yang anget-anget?" + loyalty Baru/Setia/Sultan + button 1-klik WA TANPA tampilkan WA/alamat lengkap
E: Owner login gembok -> PIN dulang2020 hashed -> dashboard 4 tabs -> edit menu/photo/compress WebP 800px <200KB -> save -> Supabase sync

## 4. COPY LOCKED VERBATIM
- Hero H1: "Sudah makan? Jangan biarkan tubuhmu kelaparan"
- Hero sub: "bukan restoran, bukan cafe, bukan cloud kitchen. cuma dapur kecil di Sidoarjo yang bangun jam 3 pagi buat goreng risoles anget."
- Memo PS: "tunggu agak dingin dulu, biar kamu nyaman makannya"
- Pill best: "baru goreng • masih anget"
- Pill scan: "scan dulu • masih anget"
- QR note LEFT of QR: "QR-nya di sini → kecil biar gak norak"
- QR handwritten: "kangen? scan ini yaa ↳" + doodles ✨ 💛 lumer~
- WA main: "Dulang, aku kangen yang anget-anget"
- WA repeat: "Dulang, aku kangen yang anget-anget - aku {name} ID {id} mau {fav} lagi ya"
- Toast: "yeeee kapan-kapan pesen lagi", "yey, masuk dapur!", "kode salah, coba lagi"
- Footer: "© 2020 Dulang Indonesia — dibuat dengan wajan panas & tulisan tangan"
- Since 2020 badge everywhere

## 5. DESIGN SYSTEM LOCKED
Colors: #111111 black, #FFD700 yellow 100% only, #FFF8E7 cream + dot radial #111 1px @20px, #5C3D2E brown, #FFFFFF white, #9CA3AF gray
Fonts: Caveat 600,700 handwritten ONLY, Plus Jakarta Sans 400,600,700 UI
Sizes: H1 Hero Caveat 48px/36px lh1.1, H2 32/24 bold, H3 20/18 bold, Body 16/14 lh1.6
Components: Black Card bg #111 rounded 24px border 2px black shadow 8px 8px 0px #FFD700 rotate -2deg to 1deg padding 24px, White Sticky bg white rounded 16px border 2px + tape yellow 60x20px -3deg, Pill Yellow bg #FFD700 text #111 px12 py4 rounded-full text-xs bold, Button Primary bg #111 text white py12 px24 rounded-xl shadow 4px 4px 0 #FFD700, QR Cute Card black -2deg tape pill scan dulu masih anget QR 160x160 white rounded 12px handwritten Caveat 20px

## 6. DATA MODEL
See supabase-schema-v1.1.sql. Tables: qr_codes (code random 8, hmac 16hex=64bit, status UNUSED/ASSIGNED/ACTIVE/REVOKED/EXPIRED), customers (wa_encrypted, address_encrypted pgsodium), menus, scans (ip_hash), orders (CREATED/SENT_TO_WA/CONFIRMED/COMPLETED/CANCELLED), order_items (price_snapshot), store_config (owner_pin_hash bcrypt), owner_sessions (JWT expiry 24h), audit_logs, view v_customer_loyalty (Baru<2 Setia>=2 Sultan>=5)

## 7. API CONTRACTS
POST /api/verify-qr {code, hmac} -> {valid, status} uses HMAC_SECRET server only
POST /api/claim-qr {code, hmac, name, wa, address, area, fav, consent:true, consent_at:ISO8601} -> {customerId}
POST /api/create-order {customerId, qrCodeId, items} -> {orderId, waLink}
POST /api/confirm-order {orderId} owner only -> COMPLETED -> increment total_orders
POST /api/owner-login {pin} -> JWT httpOnly expiry 24h rate limit 5 fails lockout 15min
GET /api/customers?area= owner only

## 8. SECURITY P0
- HMAC secret NEVER client, 16hex=64bit truncated, threat model doc
- PIN bcrypt, no plaintext, rate limit, session, logout
- QR identifier not bearer, show only first name masked WA
- localStorage CACHE not source of truth, source Supabase, sync_status PENDING/SYNCING/SYNCED/FAILED/CONFLICT + version + device_id + mutationId
- XSS sanitization, image upload max 2MB jpeg/png/webp no SVG compress 800px WebP <200KB no Base64 localStorage
- Headers netlify.toml
- Backup Export CSV Import daily

## 9. ACCEPTANCE CRITERIA Gherkin
Hero not overlapped: Given mobile 375px When load Then text bukan restoran fully visible memo PS below not overlapping
Owner login: Given PIN dulang2020 hashed When correct + Enter Then dashboard + toast yey masuk dapur + JWT cookie, When wrong Then shake + kode salah
QR generator: Given click Generate Batch Baru Then 20 IDs random 8-char no ambiguous HMAC 16hex QR 160x160 scannable PDF A4 20 per sheet cut lines
Scan new: Given UNUSED A7K9P2XQ /scan.html?id=A7K9P2XQ Then form + consent required When submit Then customer encrypted + qr ACTIVE
Scan returning: Given same QR again Then greeting firstName only + loyalty badge + 1-klik WA without PII WA prefilled repeat
Cart: Given add 2 Mayo Lumer Then subtotal Rp 35.000 When Pesan via WA Then wa.me link
Menu edit: Given upload 1.5MB jpg Then compressed WebP 800px <200KB Supabase storage

## 10. TEST SUITES 4
01 FUNCTIONAL, 02 SECURITY (XSS auth bypass token forgery PII session secret extraction localStorage tampering replay duplicate cloning), 03 DATA INTEGRITY (duplicate race sync restore corruption refresh close browser clear site data offline timeout Supabase down device migration), 04 BUSINESS/PRIVACY (menu habis harga berubah after open double click qty 0/neg/extreme camera low light QR basah/gores/miring/kecil/screenshot/print ulang/foto layar scan other QR owner open data logout expired revoke)

## 11. DEPLOYMENT
Build npm run build -> dist/ Vite 7.9s bundle 180-350KB gzipped. Deploy manual v1 drag dist to Netlify Deploys dulangin -> Published -> https://dulangin.netlify.app/. Ideal v1.1 Git push CI build test preview prod rollback via Netlify history. _redirects and netlify.toml headers. .env.example

## 12. METRICS
Repeat rate, returning scans %, claimed rate, fav cluster, area heatmap Waru Gedangan Buduran Sidoarjo Kota, avg time to WA, LCP <2.5s

## 13. MILESTONES
Phase0 Done warm landing POV cute QR brand book, Phase1 P0 Hardening this week auth hash HMAC server orders privacy cloud source backup, Phase2 P1 error tracking audit log session timeout rate limit revoke expiration image compression auto deploy, Phase3 P2 segmentation promo analytics

## 14. OPEN DECISIONS LOCKED
QR size 4x4 or 5x5 Vinyl Doff waterproof top of dus, Default PIN dulang2020 hashed immediately, total_orders counts COMPLETED only not clicks

© 2020 Dulang Indonesia - PRD Locked for Antigravity
