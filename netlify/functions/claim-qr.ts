// netlify/functions/claim-qr.ts
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { code, name, wa, address, area, fav, consent, consent_at } = JSON.parse(event.body || '{}');

    // 1. Validasi Input Ketat (Poin 7)
    if (!code || typeof code !== 'string' || code.trim().length > 30) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Kode QR tidak valid' }) };
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nama wajib diisi (2-100 karakter)' }) };
    }

    const cleanWa = typeof wa === 'string' ? wa.replace(/[^0-9+]/g, '') : '';
    const phoneRegex = /^(08|628|\+628)[0-9]{8,13}$/;
    if (!phoneRegex.test(cleanWa)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Nomor WhatsApp tidak valid (format: 08xxx atau 628xxx)' }) };
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5 || address.trim().length > 300) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Alamat wajib diisi (minimal 5 karakter)' }) };
    }

    if (!consent) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Persetujuan UU PDP wajib disetujui' }) };
    }

    const customerId = `cust-${Date.now()}`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        customerId,
        code: code.trim().toUpperCase(),
        status: 'ACTIVE',
        timestamp: consent_at || new Date().toISOString(),
      }),
    };
  } catch (err: any) {
    // 2. Error Sanitization - Jangan bocorkan stack trace/pesan error mentah (Poin 6)
    console.error('[Error claim-qr]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Terjadi kendala pada sistem, silakan coba lagi.' }),
    };
  }
}
