import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * The phone's own pairing secret. 32 random bytes as base64url (no padding)
 * = 43 characters. Only its SHA-256 hex ever leaves the device at pairing;
 * afterwards the secret travels ONLY as the JSON field `phone_token` or the
 * `x-phone-token` header. NEVER log it and NEVER put it in a URL.
 */

const keyFor = (computerKeyId: string) =>
  `dispatch.secret.${computerKeyId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

function toBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 !== undefined) out += alphabet[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 !== undefined) out += alphabet[b2 & 63];
  }
  return out;
}

export function generatePhoneSecret(): string {
  return toBase64Url(Crypto.getRandomBytes(32));
}

/** 64 lowercase hex chars: SHA-256 of the secret's UTF-8 bytes. */
export async function hashPhoneSecret(secret: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, secret, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return hex.toLowerCase();
}

/* In-memory copy for this app session only (never persisted). It keeps a phone that was
   just paired working even when the device's secure store cannot read back what it wrote
   (some emulators / broken keystores); across a restart the secure store is still the source. */
const sessionSecrets = new Map<string, string>();

export async function savePhoneSecret(computerKeyId: string, secret: string): Promise<void> {
  sessionSecrets.set(keyFor(computerKeyId), secret);
  await SecureStore.setItemAsync(keyFor(computerKeyId), secret);
}

export async function loadPhoneSecret(computerKeyId: string): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(keyFor(computerKeyId));
    if (stored) return stored;
  } catch {
    /* fall through to the session copy */
  }
  return sessionSecrets.get(keyFor(computerKeyId)) ?? null;
}

export async function forgetPhoneSecret(computerKeyId: string): Promise<void> {
  sessionSecrets.delete(keyFor(computerKeyId));
  try {
    await SecureStore.deleteItemAsync(keyFor(computerKeyId));
  } catch {
    /* already gone */
  }
}
