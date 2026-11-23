// base64url (RFC 4648 §5) with no padding, for the save code and the key check.

/** The bytes as base64url text. */
export const toBase64url = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

/** The bytes of base64url text, or undefined when the text is not base64url. */
export const fromBase64url = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  if (!/^[\w-]*$/u.test(text)) {
    return undefined;
  }
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
  } catch {
    return undefined;
  }
};
