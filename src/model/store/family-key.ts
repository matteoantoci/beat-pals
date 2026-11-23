// The cryptography of the song store (spec, "Delivery: the encrypted song store"). Web Crypto only, so the Mac
// scripts (Node) and the game (the browser) run the same code.
// - Key id: the first 8 bytes of HMAC-SHA-256(family key, "key-id"), in hex.
// - Store name of a file: hex(HMAC-SHA-256(K_name, plain content)), with
//   K_name = HKDF-SHA-256(family key, no salt, info "beat-pals/name").
// - Encryption: AES-GCM with a random 12-byte IV at the start of the file, so a file is 28 bytes larger than its
//   plain content (IV and tag). The model draws no random values: the caller makes each IV.
// - Key check: a known text, encrypted with the family key, in base64url.

import { FAMILY_KEY_BYTES } from './key-code';

/**
 * The family key, ready for use. The CryptoKeys cannot be exported, so no raw copy of the key stays. The game can
 * keep this object in IndexedDB, because a CryptoKey is structured-cloneable.
 */
export type FamilyKey = {
  /** 16 hex characters. The manifest of a store holds the key id of its family key. */
  id: string;
  /** AES-GCM, for the store files and the key check. */
  cipher: CryptoKey;
  /** HMAC-SHA-256 with K_name, for the store names. */
  naming: CryptoKey;
};

/** An encrypted file is this many bytes larger than its plain content: the IV (12) and the tag (16). */
export const ENCRYPTION_OVERHEAD = 28;

/** The length of an AES-GCM IV. Use a new random IV for each file. */
export const IV_BYTES = 12;
const KEY_CHECK_TEXT = 'beat-pals/key-check';
const utf8 = new TextEncoder();

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');

const fromBase64url = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  if (!/^[A-Za-z0-9_-]*$/u.test(text)) {
    return undefined;
  }
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
  } catch {
    return undefined;
  }
};

const keyIdOf = async (raw: Uint8Array<ArrayBuffer>): Promise<string> => {
  const hmac = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', hmac, utf8.encode('key-id')));
  return hex(mac.subarray(0, 8));
};

const namingKeyOf = async (raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => {
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: utf8.encode('beat-pals/name') },
    base,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign']
  );
};

/** Makes the family key from its 16 raw bytes. */
export const openFamilyKey = async (raw: Uint8Array<ArrayBuffer>): Promise<FamilyKey> => {
  if (raw.length !== FAMILY_KEY_BYTES) {
    throw new Error(`A family key has ${String(FAMILY_KEY_BYTES)} bytes.`);
  }
  const [id, cipher, naming] = await Promise.all([
    keyIdOf(raw),
    crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),
    namingKeyOf(raw),
  ]);
  return { id, cipher, naming };
};

/** The store name of a file: 64 hex characters from its plain content. Only the key holder can calculate it. */
export const storeName = async (key: FamilyKey, plain: Uint8Array<ArrayBuffer>): Promise<string> =>
  hex(new Uint8Array(await crypto.subtle.sign('HMAC', key.naming, plain)));

/** Encrypts the plain content with the IV, which must be new and random. The result starts with the IV. */
export const encryptFile = async (
  key: FamilyKey,
  plain: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> => {
  if (iv.length !== IV_BYTES) {
    throw new Error(`An IV has ${String(IV_BYTES)} bytes.`);
  }
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key.cipher, plain));
  const file = new Uint8Array(IV_BYTES + sealed.length);
  file.set(iv);
  file.set(sealed, IV_BYTES);
  return file;
};

/** The plain content of an encrypted file, or undefined when the key does not open it (or the file is damaged). */
export const decryptFile = async (
  key: FamilyKey,
  file: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  if (file.length < ENCRYPTION_OVERHEAD) {
    return undefined;
  }
  try {
    const iv = file.subarray(0, IV_BYTES);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key.cipher, file.subarray(IV_BYTES));
    return new Uint8Array(plain);
  } catch {
    return undefined;
  }
};

/** A new key check: the known text, encrypted with a new random IV, in base64url. Made one time with the key. */
export const makeKeyCheck = async (key: FamilyKey, iv: Uint8Array<ArrayBuffer>): Promise<string> =>
  base64url(await encryptFile(key, utf8.encode(KEY_CHECK_TEXT), iv));

/** True when the family key opens the key check of a manifest. */
export const opensKeyCheck = async (key: FamilyKey, keyCheck: string): Promise<boolean> => {
  const file = fromBase64url(keyCheck);
  const plain = file === undefined ? undefined : await decryptFile(key, file);
  return plain !== undefined && new TextDecoder().decode(plain) === KEY_CHECK_TEXT;
};
