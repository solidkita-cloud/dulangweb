# DULANG INDONESIA - KIT FOR ANTIGRAVITY - ANTI-HALU
Cara pakai: JANGAN baca PRD lama, baca PRD_Anti_Halu_v2.0.md saja. Ini source of truth.
WA LOCKED: 6287703397035, PIN migrasi: dulang2020 -> hash bcrypt, QR random 8-char ABCDEFGHJKMNPQRSTUVWXYZ23456789, HMAC 16hex server only, Copy WA: "Dulang, aku kangen yang anget-anget"
Design: #111111 black, #FFD700 yellow, #FFF8E7 cream + dot, Caveat + Plus Jakarta Sans
Overlap fix: max-w-[340px] pb-10 lg:pb-28
Files: PRD, supabase-schema-v1.1.sql (orders, order_items, owner_sessions, audit_logs), .env.example (HMAC_SECRET server only), netlify.toml headers, _redirects SPA, variables.css tokens

Urutan build:
1. Setup Vite + React 18.3.1 + TS 5.7.3 + Tailwind 3.4.17
2. File structure sesuai PRD
3. Supabase schema
4. Netlify Functions verify-qr, claim-qr, create-order, confirm-order, owner-login (HMAC_SECRET server)
5. LandingView overlap fix
6. SmartScanView new vs returning NO PII expose loyalty Baru/Setia/Sultan
7. OwnerDashboard 4 tabs image compress WebP 800px <200KB
8. StickerGenerator 20 per A4 PDF CSV
9. Test 4 suites Functional Security Data Integrity Business Privacy

5 Pertanyaan Pembunuh:
1. Secret HMAC di browser? TIDAK server env
2. PIN plaintext? TIDAK hash bcrypt JWT 24h
3. total_orders dari klik atau COMPLETED? COMPLETED only
4. Kalau localStorage hilang? Supabase source truth cache backup CSV
5. Kalau QR difoto orang? Hanya first name masked WA bukan alamat lengkap

Deploy: npm run build -> dist/ -> drag Netlify Deploys dulangin -> https://dulangin.netlify.app/
© 2020 Dulang Indonesia
