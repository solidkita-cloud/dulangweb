// netlify/functions/owner-login.ts
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { pin } = JSON.parse(event.body || '{}');
    const validPin = process.env.VITE_OWNER_CODE || process.env.OWNER_PIN || '';

    if (!pin) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'PIN wajib diisi' }) };
    }

    if (validPin && pin.trim().toLowerCase() === validPin.toLowerCase()) {
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `dulang_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
        },
        body: JSON.stringify({
          success: true,
          authenticated: true,
          message: 'yey, masuk dapur!',
          expiresIn: 86400, // 24h
        }),
      };
    }

    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        authenticated: false,
        error: 'kode salah, coba lagi',
      }),
    };
  } catch (err: any) {
    console.error('[Error owner-login]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Terjadi kendala autentikasi sistem.' }),
    };
  }
}
