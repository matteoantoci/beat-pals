// The key code: the family key as 26 letters and digits in groups of 4 (Crockford base32), for the password
// manager of the Parent (spec, "Delivery" and "Guided song setup", step 2). 26 characters hold 130 bits: the
// 128 bits of the key, then 2 extra bits that are always 0.

/** The family key is 128 bits. */
export const FAMILY_KEY_BYTES = 16;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 26;
const GROUP = 4;
const EXTRA_BITS = CODE_LENGTH * 5 - FAMILY_KEY_BYTES * 8;
/** All whitespace (no-break spaces included), the hyphen-minus, and the Unicode hyphens, dashes, and minus. */
const SEPARATORS = /[\s\u2010\u2011\u2012\u2013\u2014\u2212-]/gu;
const ALIASES: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };
const ASCII = /^[0-9A-Za-z]*$/u;

/** The key code of a family key: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX`. */
export const encodeKeyCode = (key: Uint8Array): string => {
  if (key.length !== FAMILY_KEY_BYTES) {
    throw new Error(`A family key has ${String(FAMILY_KEY_BYTES)} bytes.`);
  }
  const bits = [...key].map((byte) => byte.toString(2).padStart(8, '0')).join('') + '0'.repeat(EXTRA_BITS);
  const digits = Array.from(
    { length: CODE_LENGTH },
    (_, at) => ALPHABET[Number.parseInt(bits.slice(at * 5, at * 5 + 5), 2)]
  );
  return Array.from({ length: Math.ceil(CODE_LENGTH / GROUP) }, (_, at) =>
    digits.slice(at * GROUP, at * GROUP + GROUP).join('')
  ).join('-');
};

/**
 * The family key of a key code, or undefined when the code breaks a decode rule. The rules: whitespace and dashes
 * are removed, lower case is changed to upper case, O is 0, I and L are 1, every other character must be
 * Crockford base32, the code has 26 characters, and its 2 extra bits are 0.
 */
export const decodeKeyCode = (code: string): Uint8Array<ArrayBuffer> | undefined => {
  const stripped = code.replaceAll(SEPARATORS, '');
  // Only ASCII letters and digits: an upper case of another letter can give Crockford characters ("ß" is "SS").
  if (!ASCII.test(stripped)) {
    return undefined;
  }
  const values = Array.from(stripped.toUpperCase(), (char) => ALPHABET.indexOf(ALIASES[char] ?? char));
  if (values.length !== CODE_LENGTH || values.includes(-1)) {
    return undefined;
  }
  const bits = values.map((value) => value.toString(2).padStart(5, '0')).join('');
  if (bits.slice(-EXTRA_BITS) !== '0'.repeat(EXTRA_BITS)) {
    return undefined;
  }
  return Uint8Array.from({ length: FAMILY_KEY_BYTES }, (_, at) => Number.parseInt(bits.slice(at * 8, at * 8 + 8), 2));
};
