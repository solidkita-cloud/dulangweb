// src/lib/security.ts
// Security Utilities: WebCrypto SHA-256 Hashing, Rate Limiting, and Session Management

const APP_SALT = 'dulang-indonesia-secure-kitchen-salt-2026';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 menit
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 jam

const LOCKOUT_STORAGE_KEY = 'dulang_auth_lockout';
const SESSION_STORAGE_KEY = 'dulang_owner_session';

/**
 * Hash a PIN or password using browser standard WebCrypto API SHA-256
 */
export async function hashPassword(plainText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${plainText.trim()}:${APP_SALT}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify whether an input PIN matches the stored hash (or legacy plaintext)
 */
export async function verifyPassword(inputPin: string, storedValue: string): Promise<boolean> {
  if (!inputPin || !storedValue) return false;
  const cleanInput = inputPin.trim();

  // If stored value is a 64-char SHA-256 hex string
  if (storedValue.length === 64 && /^[0-9a-f]{64}$/i.test(storedValue)) {
    const inputHash = await hashPassword(cleanInput);
    return inputHash === storedValue;
  }

  // Legacy fallback comparison (for existing plaintext during transition)
  return cleanInput.toLowerCase() === storedValue.toLowerCase();
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
}

export function createOwnerSession(): OwnerSession {
  const token = `dulang_sec_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  const session: OwnerSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
  return session;
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
    | 'BACKUP_RESTORED';
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

