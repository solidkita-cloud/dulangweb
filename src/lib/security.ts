// src/lib/security.ts
// Security Utilities: WebCrypto PBKDF2-SHA256 Hashing, Legacy Migration, Rate Limiting, CSV Defense & Session Management

const APP_SALT = 'dulang-indonesia-secure-kitchen-salt-2026';
const PBKDF2_PREFIX = 'pbkdf2_v1';
const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 menit
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 jam

const LOCKOUT_STORAGE_KEY = 'dulang_auth_lockout';
const SESSION_STORAGE_KEY = 'dulang_owner_session';

// Hash standar awal sistem (tersandi PBKDF2-HMAC-SHA256 100.000 iterasi, tanpa plaintext di kode)
export const LEGACY_DEFAULT_OWNER_SHA256 =
  '6ed219215542ae196c7797caf21265aa08138a5bde34204c9d0f5e467d9c2bf5';

export const DEFAULT_AUTH_HASHES = {
  ownerHash:
    'pbkdf2_v1$d600a3c2317e10622a37525015903379$d91f0d2479d56afcf2501cd296bc9478b19c37db977fda3e4c1c1767b9bba6ca',
  cashierHash:
    'pbkdf2_v1$076eca1007f8cf5897e4bc0e2fa5ca32$9801b4e12cdef1b4656bbb0465578991bb5b7808612096b7b07da593a1479b45',
  kitchenHash:
    'pbkdf2_v1$f8fe87b6d51feedf69f053d3c17ea112$ea693caacdecb49149f65ed426a069d253133fbe8a35f711184f5c45aac0b518',
} as const;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isHashFormat(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (/^pbkdf2_v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/i.test(trimmed)) return true;
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return true;
  return false;
}

/**
 * Legacy SHA-256 hash — khusus memverifikasi hash 64-char lama saat proses migrasi/upgrade ke PBKDF2
 */
export async function hashSha256Legacy(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${plainText.trim()}:${APP_SALT}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function derivePbkdf2Hex(plainText: string, saltBytes: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(plainText.trim()),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Hash a PIN or password using salted WebCrypto PBKDF2-HMAC-SHA256 (100.000 iterations)
 */
export async function hashPassword(plainText: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(saltBytes);
  const hashHex = await derivePbkdf2Hex(plainText, saltBytes);
  return `${PBKDF2_PREFIX}$${saltHex}$${hashHex}`;
}

/**
 * Verify whether an input PIN matches a salted PBKDF2 hash (or legacy 64-char SHA-256 hex).
 * Never compares plaintext values.
 */
export async function verifyPassword(inputPin: string, storedValue: string): Promise<boolean> {
  if (!inputPin || !storedValue) return false;
  const cleanInput = inputPin.trim();
  const cleanStored = storedValue.trim();

  if (cleanStored.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = cleanStored.split('$');
    if (parts.length !== 3) return false;
    const saltBytes = hexToBytes(parts[1]);
    const expectedHex = parts[2].toLowerCase();
    if (!saltBytes || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
    try {
      const derivedHex = await derivePbkdf2Hex(cleanInput, saltBytes);
      return timingSafeEqualStr(derivedHex, expectedHex);
    } catch {
      return false;
    }
  }

  // Dukungan verifikasi hash 64-char SHA-256 lama agar owner yang sudah ganti password tidak terkunci
  if (/^[0-9a-f]{64}$/i.test(cleanStored)) {
    try {
      const inputHash = await hashSha256Legacy(cleanInput);
      return timingSafeEqualStr(inputHash.toLowerCase(), cleanStored.toLowerCase());
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Sanitasi sel CSV untuk mencegah CSV/Formula Injection (=, +, -, @, tab, CR) di Excel / Google Sheets
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const trimmedStart = raw.replace(/^[\u0000-\u001F\s]+/, '');
  const dangerousStart = /^[=+\-@\t\r]/.test(raw) || /^[=+\-@]/.test(trimmedStart);
  const safe = dangerousStart ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(cells: unknown[]): string {
  return cells.map((c) => sanitizeCsvCell(c)).join(',');
}

/**
 * Rate Limiter for Login Attempts (Anti Brute-Force)
 */
export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
}

export function checkLoginAttempts(): LockoutStatus {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };

    const data = JSON.parse(raw);
    const now = Date.now();

    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attempts: data.attempts || MAX_FAILED_ATTEMPTS };
    }

    // Lockout expired, reset if lockout timestamp passed
    if (data.lockedUntil && data.lockedUntil <= now) {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    return { isLocked: false, remainingSeconds: 0, attempts: data.attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedAttempt(): LockoutStatus {
  try {
    const current = checkLoginAttempts();
    const newAttempts = current.attempts + 1;
    const now = Date.now();

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_DURATION_MS;
      localStorage.setItem(
        LOCKOUT_STORAGE_KEY,
        JSON.stringify({ attempts: newAttempts, lockedUntil })
      );
      return { isLocked: true, remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000), attempts: newAttempts };
    }

    localStorage.setItem(
      LOCKOUT_STORAGE_KEY,
      JSON.stringify({ attempts: newAttempts, lockedUntil: null })
    );
    return { isLocked: false, remainingSeconds: 0, attempts: newAttempts };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 1 };
  }
}

export function resetLoginAttempts(): void {
  try {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch {}
}

/**
 * Cryptographic Session Token & Expiry Management
 */
export interface OwnerSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  role?: 'owner' | 'cashier' | 'kitchen';
}

export function createOwnerSession(role: 'owner' | 'cashier' | 'kitchen' = 'owner'): OwnerSession {
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  const token = `dulang_sec_${Date.now()}_${bytesToHex(rnd)}`;
  const now = Date.now();
  const session: OwnerSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
    role,
  };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export function getOwnerSessionRole(): 'owner' | 'cashier' | 'kitchen' | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: OwnerSession = JSON.parse(raw);
    if (!session || !session.token || !session.expiresAt || Date.now() > session.expiresAt) {
      return null;
    }
    if (session.role === 'owner' || session.role === 'cashier' || session.role === 'kitchen') {
      return session.role;
    }
    return 'owner';
  } catch {
    return null;
  }
}

export function isOwnerSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const session: OwnerSession = JSON.parse(raw);
    if (!session || !session.token || !session.expiresAt) return false;
    
    if (Date.now() > session.expiresAt) {
      clearOwnerSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearOwnerSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

/**
 * Security Audit Logging & Monitoring (Poin 27)
 */
export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  action:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'LOCKOUT_TRIGGERED'
    | 'PIN_CHANGED'
    | 'BACKUP_EXPORTED'
    | 'BACKUP_RESTORED'
    | 'ROLE_SWITCHED'
    | 'PRINT_REPRINT'
    | 'ORDER_VOIDED'
    | 'DATA_CLEARED'
    | 'SETTINGS_UPDATED';
  details: string;
  severity: 'INFO' | 'WARN' | 'ALERT';
}

const AUDIT_LOG_KEY = 'dulang_security_audit_logs';

export function logSecurityEvent(
  action: SecurityAuditEntry['action'],
  details: string,
  severity: SecurityAuditEntry['severity'] = 'INFO'
): void {
  try {
    const existing = getSecurityAuditLogs();
    const newEntry: SecurityAuditEntry = {
      id: `SEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      severity,
    };
    const updated = [newEntry, ...existing].slice(0, 50); // Simpan 50 aktivitas terakhir
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_security_log_updated'));
    }
  } catch {}
}

export function getSecurityAuditLogs(): SecurityAuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSecurityAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_LOG_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dulang_security_log_updated'));
    }
  } catch {}
}

