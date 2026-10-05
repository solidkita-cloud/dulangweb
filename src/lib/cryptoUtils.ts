// Custom alphabet without ambiguous characters (O, 0, I, 1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomQRId(length = 8, prefix = 'DULANG-'): string {
  let result = '';
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined'
      ? (window.crypto || (window as any).msCrypto)
      : null;

  const values = new Uint8Array(length);
  if (cryptoObj && cryptoObj.getRandomValues) {
    cryptoObj.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += ALPHABET[values[i] % ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  }
  return `${prefix}${result}`;
}

// Generate simple HMAC SHA-256 signature for QR anti-tampering
export async function generateHMAC(message: string, secret = 'sidoarjo-dulang-2026-secret'): Promise<string> {
  try {
    const cryptoObj =
      typeof globalThis !== 'undefined' && globalThis.crypto
        ? globalThis.crypto
        : typeof window !== 'undefined'
        ? window.crypto
        : null;

    if (!cryptoObj || !cryptoObj.subtle) {
      throw new Error('WebCrypto subtle not available');
    }

    const enc = new TextEncoder();
    const key = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await cryptoObj.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16); // Short 16-hex for QR readability
  } catch (e) {
    // Fallback simple hash for older runtimes
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = (hash << 5) - hash + message.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
