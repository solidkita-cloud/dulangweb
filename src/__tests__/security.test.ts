import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  hashSha256Legacy,
  timingSafeEqualStr,
  sanitizeCsvCell,
  csvRow,
  checkLoginAttempts,
  recordFailedAttempt,
  resetLoginAttempts,
  createOwnerSession,
  isOwnerSessionValid,
  getOwnerSessionRole,
  clearOwnerSession,
} from '../lib/security';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
}

describe('security utilities (PBKDF2, RBAC session, rate limit, CSV defense)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('hashes with unique random salt (PBKDF2-SHA256) and verifies case-sensitively', async () => {
    const hash1 = await hashPassword('dulang2020');
    const hash2 = await hashPassword('dulang2020');
    expect(hash1.startsWith('pbkdf2_v1$')).toBe(true);
    expect(hash1).not.toBe(hash2);

    expect(await verifyPassword('dulang2020', hash1)).toBe(true);
    expect(await verifyPassword('Dulang2020', hash1)).toBe(false);
    expect(await verifyPassword('salah', hash1)).toBe(false);
  });

  it('verifies legacy SHA-256 hex hashes during smooth migration', async () => {
    const legacy = await hashSha256Legacy('kode-lama-99');
    expect(legacy).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPassword('kode-lama-99', legacy)).toBe(true);
    expect(await verifyPassword('salah', legacy)).toBe(false);
  });

  it('compares strings in constant time', () => {
    expect(timingSafeEqualStr('abc123', 'abc123')).toBe(true);
    expect(timingSafeEqualStr('abc123', 'abc124')).toBe(false);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
  });

  it('neutralizes CSV formula injection payloads', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(sanitizeCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(sanitizeCsvCell('@HYPERLINK')).toBe('"\'@HYPERLINK"');
    expect(sanitizeCsvCell('\t=2+2')).toBe('"\'\t=2+2"');
    expect(sanitizeCsvCell('   =evil')).toBe('"\'   =evil"');
    expect(csvRow(['Aman', '=1+1'])).toBe('"Aman","\'=1+1"');
  });

  it('enforces 5-attempt lockout rate limit and clears cleanly on reset', () => {
    expect(checkLoginAttempts().isLocked).toBe(false);
    for (let i = 1; i <= 4; i++) {
      const s = recordFailedAttempt();
      expect(s.isLocked).toBe(false);
      expect(s.attempts).toBe(i);
    }
    const locked = recordFailedAttempt();
    expect(locked.isLocked).toBe(true);
    expect(locked.remainingSeconds).toBeGreaterThan(0);

    resetLoginAttempts();
    expect(checkLoginAttempts().isLocked).toBe(false);
  });

  it('manages RBAC session lifecycle safely', () => {
    clearOwnerSession();
    expect(isOwnerSessionValid()).toBe(false);
    expect(getOwnerSessionRole()).toBeNull();

    createOwnerSession('cashier');
    expect(isOwnerSessionValid()).toBe(true);
    expect(getOwnerSessionRole()).toBe('cashier');

    clearOwnerSession();
    expect(isOwnerSessionValid()).toBe(false);
  });
});
