import crypto from 'node:crypto';

export default async function handler(req: any, res: any) {
  const secret = (process.env.QR_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!secret) {
    return res.status(200).json({ fallbackClientMode: true });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const message = String(body.message || req.query?.message || '').trim();
    if (!message) {
      return res.status(400).json({ mode: 'server', error: 'Parameter message wajib diisi.' });
    }

    const signature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex')
      .slice(0, 16);

    if (req.method === 'POST' && body.signature) {
      const provided = String(body.signature).trim();
      const bufA = Buffer.from(signature, 'utf8');
      const bufB = Buffer.from(provided, 'utf8');
      const valid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
      return res.status(200).json({ mode: 'server', valid });
    }

    return res.status(200).json({ mode: 'server', signature });
  } catch (err: any) {
    return res.status(500).json({ mode: 'server', error: err?.message || 'QR HMAC error' });
  }
}
