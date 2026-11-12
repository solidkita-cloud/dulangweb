import crypto from 'node:crypto';

const DEFAULT_HASHES = {
  ownerHash:
    'pbkdf2_v1$d600a3c2317e10622a37525015903379$d91f0d2479d56afcf2501cd296bc9478b19c37db977fda3e4c1c1767b9bba6ca',
  cashierHash:
    'pbkdf2_v1$076eca1007f8cf5897e4bc0e2fa5ca32$9801b4e12cdef1b4656bbb0465578991bb5b7808612096b7b07da593a1479b45',
  kitchenHash:
    'pbkdf2_v1$f8fe87b6d51feedf69f053d3c17ea112$ea693caacdecb49149f65ed426a069d253133fbe8a35f711184f5c45aac0b518',
};

const APP_SALT = 'dulang-indonesia-secure-kitchen-salt-2026';

function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function verifyStoredPin(inputPin: string, storedValue: string): boolean {
  const clean = inputPin.trim();
  const stored = (storedValue || '').trim();
  if (!clean || !stored) return false;

  if (stored.startsWith('pbkdf2_v1$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = parts[2].toLowerCase();
    const derived = crypto.pbkdf2Sync(clean, salt, 100_000, 32, 'sha256').toString('hex');
    return timingSafeHexEqual(derived, expected);
  }

  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const legacyHash = crypto.createHash('sha256').update(`${clean}:${APP_SALT}`).digest('hex');
    return timingSafeHexEqual(legacyHash.toLowerCase(), stored.toLowerCase());
  }

  return false;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    // Progressive upgrade: jika service key belum dipasang di Vercel, klien memakai PBKDF2 fallback
    return res.status(200).json({ fallbackClientMode: true });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const pin = String(body.pin || '').trim();
    if (!pin) {
      return res.status(400).json({ mode: 'server', success: false, message: 'PIN wajib diisi.' });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    let ownerHash = DEFAULT_HASHES.ownerHash;
    let cashierHash = DEFAULT_HASHES.cashierHash;
    let kitchenHash = DEFAULT_HASHES.kitchenHash;

    // 1. Utamakan baca tabel privat sys_auth
    const authRes = await fetch(`${supabaseUrl}/rest/v1/sys_auth?id=eq.main&select=*`, { headers });
    let loadedFromSysAuth = false;
    if (authRes.ok) {
      const rows = await authRes.json();
      if (Array.isArray(rows) && rows[0]) {
        ownerHash = rows[0].owner_hash || ownerHash;
        cashierHash = rows[0].cashier_hash || cashierHash;
        kitchenHash = rows[0].kitchen_hash || kitchenHash;
        loadedFromSysAuth = true;
      }
    }

    // 2. Kompatibilitas mundur jika masih tersimpan di menus.sys_auth_meta
    if (!loadedFromSysAuth) {
      const metaRes = await fetch(`${supabaseUrl}/rest/v1/menus?id=eq.sys_auth_meta&select=deskripsi`, { headers });
      if (metaRes.ok) {
        const metaRows = await metaRes.json();
        if (Array.isArray(metaRows) && metaRows[0]?.deskripsi) {
          const parsed = JSON.parse(metaRows[0].deskripsi);
          ownerHash = parsed.ownerHash || ownerHash;
          cashierHash = parsed.cashierHash || cashierHash;
          kitchenHash = parsed.kitchenHash || kitchenHash;
        }
      }
    }

    let matchedRole: 'owner' | 'cashier' | 'kitchen' | null = null;
    if (verifyStoredPin(pin, ownerHash)) matchedRole = 'owner';
    else if (verifyStoredPin(pin, cashierHash)) matchedRole = 'cashier';
    else if (verifyStoredPin(pin, kitchenHash)) matchedRole = 'kitchen';

    // Catat audit server jika tabel audit_logs tersedia (abaikan jika SQL belum dijalankan)
    void fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actor_role: matchedRole || 'anonymous',
        action: matchedRole ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
        details: matchedRole ? `Server auth berhasil (${matchedRole})` : 'Percobaan PIN gagal di /api/auth-login',
        severity: matchedRole ? 'INFO' : 'WARN',
      }),
    }).catch(() => {});

    if (!matchedRole) {
      return res.status(401).json({ mode: 'server', success: false, message: 'PIN tidak cocok.' });
    }

    const secret = process.env.AUTH_SESSION_SECRET || serviceKey;
    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const payloadStr = Buffer.from(JSON.stringify({ role: matchedRole, exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    const signedCookie = `${payloadStr}.${sig}`;

    res.setHeader(
      'Set-Cookie',
      `dulang_session=${signedCookie}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure`
    );

    return res.status(200).json({
      mode: 'server',
      success: true,
      role: matchedRole,
      label:
        matchedRole === 'owner'
          ? '👑 Pemilik Usaha (Owner)'
          : matchedRole === 'cashier'
          ? '🛒 Kasir Stand'
          : '🍳 Kru Dapur (KDS)',
    });
  } catch (err: any) {
    return res.status(500).json({
      fallbackClientMode: true,
      error: err?.message || 'Server auth error',
    });
  }
}
