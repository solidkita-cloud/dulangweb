// netlify/functions/verify-qr.ts
import { crypto } from 'node:crypto';

export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { code, hmac } = JSON.parse(event.body || '{}');
    if (!code || !hmac) {
      return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Missing code or hmac' }) };
    }

    // Secret is stored ONLY in server environment
    const secret = process.env.HMAC_SECRET;
    if (!secret) {
      return { statusCode: 500, body: JSON.stringify({ valid: false, error: 'Server security configuration missing' }) };
    }

    const hmacObj = crypto.createHmac('sha256', secret);
    hmacObj.update(code.trim().toUpperCase());
    const expected = hmacObj.digest('hex').slice(0, 16);

    const valid = hmac.toLowerCase() === expected.toLowerCase();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid,
        code: code.toUpperCase(),
        status: valid ? 'ACTIVE' : 'INVALID',
      }),
    };
  } catch (err: any) {
    console.error('[Error verify-qr]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, error: 'Terjadi kendala saat verifikasi QR code' }),
    };
  }
}
