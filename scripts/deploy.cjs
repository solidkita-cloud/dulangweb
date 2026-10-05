// scripts/deploy.cjs
// Script otomatis untuk deploy production ke Netlify API langsung dari terminal
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

// 1. Baca credential dari environment variable atau .env lokal
const envPath = path.resolve(__dirname, '../.env');
let siteId = process.env.NETLIFY_SITE_ID || '';
let authToken = process.env.NETLIFY_AUTH_TOKEN || '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const siteMatch = envContent.match(/NETLIFY_SITE_ID=(.*)/);
  const tokenMatch = envContent.match(/NETLIFY_AUTH_TOKEN=(.*)/);
  if (siteMatch && siteMatch[1]) siteId = siteMatch[1].trim();
  if (tokenMatch && tokenMatch[1]) authToken = tokenMatch[1].trim();
}

if (!siteId || !authToken) {
  console.error('❌ Gagal: NETLIFY_SITE_ID dan NETLIFY_AUTH_TOKEN tidak ditemukan di environment variables.');
  process.exit(1);
}

console.log('🚀 [1/4] Membangun web Dulang Indonesia (Vite Production Build)...');
execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

console.log('📦 [2/4] Mengompresi folder dist ke ZIP standar (POSIX)...');
const zipFile = path.resolve(__dirname, '../dist.zip');
if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

const zip = new AdmZip();
zip.addLocalFolder(path.resolve(__dirname, '../dist'));
zip.writeZip(zipFile);

const zipBuffer = fs.readFileSync(zipFile);
console.log(`📤 [3/4] Mengunggah ke Netlify API (${(zipBuffer.length / 1024).toFixed(1)} KB)...`);

const req = https.request(
  {
    hostname: 'api.netlify.com',
    path: `/api/v1/sites/${siteId}/deploys`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length,
      'User-Agent': 'DulangDeployer/1.0',
    },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.id) {
          console.log(`✅ [4/4] Deploy Berhasil!`);
          console.log(`🔗 URL Live: ${data.ssl_url || 'https://dulangin.netlify.app'}`);
          console.log(`🆔 Deploy ID: ${data.id}`);
        } else {
          console.error('❌ Gagal deploy:', body);
        }
      } catch (err) {
        console.error('❌ Respon tidak valid:', err);
      } finally {
        if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('❌ Gagal koneksi ke Netlify:', err);
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
});

req.write(zipBuffer);
req.end();
