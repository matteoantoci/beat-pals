import { describe, expect, it } from 'vitest';
import {
  decodeKeyCode,
  decryptFile,
  encodeKeyCode,
  encryptFile,
  makeKeyCheck,
  openFamilyKey,
  opensKeyCheck,
  readManifest,
  readSongIndex,
  storeName,
} from '../index';

const utf8 = new TextEncoder();
/** The bytes 0 to 15. Its code, key id, and store name come from Python base32 and Node `crypto`. */
const COUNTING = Uint8Array.from({ length: 16 }, (_, at) => at);
const COUNTING_CODE = '000G-40R4-0M30-E209-185G-R38E-1W';
const OTHER = Uint8Array.from({ length: 16 }, (_, at) => 255 - at);

describe('the key code', () => {
  it('gives 26 Crockford characters in groups of 4', () => {
    expect(encodeKeyCode(COUNTING)).toBe(COUNTING_CODE);
    expect(encodeKeyCode(new Uint8Array(16).fill(255))).toBe('ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZW');
  });

  it('decodes its own code', () => {
    expect(decodeKeyCode(encodeKeyCode(OTHER))).toEqual(OTHER);
  });

  it('accepts spaces, dashes, lower case, and the O, I, and L aliases', () => {
    expect(decodeKeyCode(' 000g 40r4\u00a00m30\u2013e209\u2014185g-r38e\t1w\n')).toEqual(COUNTING);
    expect(decodeKeyCode('OOOG40R4OM3OE2O9i85GR38El W')).toEqual(COUNTING);
  });

  it('refuses other characters', () => {
    expect(decodeKeyCode('000G40R40M30E209185GR38E1U')).toBeUndefined();
    expect(decodeKeyCode('000G40R40M30E209185GR38E1*')).toBeUndefined();
    expect(decodeKeyCode('000G40R40M30E209185GR38E\u00df')).toBeUndefined();
  });

  it('refuses a wrong length', () => {
    expect(decodeKeyCode('000G40R40M30E209185GR38E1')).toBeUndefined();
    expect(decodeKeyCode('000G40R40M30E209185GR38E1W0')).toBeUndefined();
    expect(decodeKeyCode('')).toBeUndefined();
  });

  it('refuses a code whose 2 extra bits are not 0', () => {
    expect(decodeKeyCode('000G40R40M30E209185GR38E1X')).toBeUndefined();
  });
});

describe('the family key', () => {
  it('has the key id from HMAC-SHA-256 of "key-id"', async () => {
    expect((await openFamilyKey(COUNTING)).id).toBe('1707b293ed51dab8');
  });

  it('names a file with HMAC-SHA-256 under the HKDF name key', async () => {
    expect(await storeName(await openFamilyKey(COUNTING), utf8.encode('paper kites'))).toBe(
      '9a9173ad96618cae466fe6a2c8434fd52f694094d77c8639dd084b9eed7825ad'
    );
  });

  it('gives other names and another key id with another key', async () => {
    const [one, two] = await Promise.all([openFamilyKey(COUNTING), openFamilyKey(OTHER)]);
    const plain = utf8.encode('paper kites');

    expect(two.id).not.toBe(one.id);
    expect(await storeName(two, plain)).not.toBe(await storeName(one, plain));
  });

  it('decrypts what it encrypts, and the file is 28 bytes larger', async () => {
    const key = await openFamilyKey(COUNTING);
    const plain = utf8.encode('the facts of a song');

    const file = await encryptFile(key, plain);

    expect(file.length).toBe(plain.length + 28);
    expect(await decryptFile(key, file)).toEqual(plain);
  });

  it('starts each file with a new random IV', async () => {
    const key = await openFamilyKey(COUNTING);
    const plain = utf8.encode('the facts of a song');

    const [one, two] = await Promise.all([encryptFile(key, plain), encryptFile(key, plain)]);

    expect(one.subarray(0, 12)).not.toEqual(two.subarray(0, 12));
  });

  it('refuses a wrong key and a damaged file', async () => {
    const key = await openFamilyKey(COUNTING);
    const file = await encryptFile(key, utf8.encode('the facts of a song'));
    const damaged = file.slice();
    damaged[20] = (damaged[20] ?? 0) ^ 1;

    expect(await decryptFile(await openFamilyKey(OTHER), file)).toBeUndefined();
    expect(await decryptFile(key, damaged)).toBeUndefined();
    expect(await decryptFile(key, file.subarray(0, 27))).toBeUndefined();
  });

  it('opens its own key check and refuses the key check of another key', async () => {
    const [one, two] = await Promise.all([openFamilyKey(COUNTING), openFamilyKey(OTHER)]);
    const check = await makeKeyCheck(one);

    expect(check).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(await opensKeyCheck(one, check)).toBe(true);
    expect(await opensKeyCheck(two, check)).toBe(false);
    expect(await opensKeyCheck(one, 'not+base64url')).toBe(false);
  });
});

const NAME_A = 'a'.repeat(64);
const NAME_B = 'b'.repeat(64);
const NAME_C = 'c'.repeat(64);

const MANIFEST = {
  version: 1,
  keyId: '1707b293ed51dab8',
  keyCheck: 'AbC-_9',
  index: NAME_B,
  files: [
    { name: NAME_A, size: 128 },
    { name: NAME_B, size: 300 },
  ],
};

const SONG = {
  id: 'paper-kites',
  title: 'Paper Kites',
  artist: 'The Lanterns',
  charter: 'Mossy',
  files: { facts: NAME_A, cover: NAME_B, coverType: 'image/png', audio: NAME_C },
  size: 900,
};

const reasonOf = (result: { ok: true } | { ok: false; reason: string }): string | undefined =>
  result.ok ? undefined : result.reason;

/** The index text of one song: SONG with some fields changed or added. */
const song = (change: Partial<Record<keyof typeof SONG | 'year', unknown>>): string =>
  JSON.stringify({ version: 1, songs: [{ ...SONG, ...change }] });

describe('readManifest', () => {
  it('reads a manifest with exactly the schema keys', () => {
    expect(readManifest(JSON.stringify(MANIFEST))).toEqual({ ok: true, value: MANIFEST });
  });

  it('refuses another field, a missing field, or another version', () => {
    expect(reasonOf(readManifest(JSON.stringify({ ...MANIFEST, title: 'Paper Kites' })))).toMatch(/keys/u);
    const { keyCheck: _, ...noCheck } = MANIFEST;
    expect(reasonOf(readManifest(JSON.stringify(noCheck)))).toMatch(/keys/u);
    expect(reasonOf(readManifest(JSON.stringify({ ...MANIFEST, version: 2 })))).toMatch(/version/u);
    const extraFileField = { ...MANIFEST, files: [{ name: NAME_A, size: 128, title: 'x' }, MANIFEST.files[1]] };
    expect(reasonOf(readManifest(JSON.stringify(extraFileField)))).toMatch(/keys/u);
  });

  it('refuses files that are not sorted by name', () => {
    const files = MANIFEST.files.toReversed();

    expect(reasonOf(readManifest(JSON.stringify({ ...MANIFEST, files })))).toMatch(/sorted/u);
  });

  it('refuses a wrong key id, a store name that is not 64 hex characters, and an index that is not in files', () => {
    expect(reasonOf(readManifest(JSON.stringify({ ...MANIFEST, keyId: 'ABCDEF0123456789' })))).toMatch(/keyId/u);
    const shortName = { ...MANIFEST, files: [{ name: 'a'.repeat(63), size: 128 }, MANIFEST.files[1]] };
    expect(reasonOf(readManifest(JSON.stringify(shortName)))).toMatch(/name/u);
    expect(reasonOf(readManifest(JSON.stringify({ ...MANIFEST, index: NAME_C })))).toMatch(/index/u);
  });

  it('refuses a text that is not JSON', () => {
    expect(reasonOf(readManifest('{'))).toMatch(/JSON/u);
  });
});

describe('readSongIndex', () => {
  it('reads an index with exactly the schema keys, with or without a cover', () => {
    const plain = { ...SONG, id: 'quiet-moon', files: { ...SONG.files, cover: null, coverType: null } };
    const index = { version: 1, songs: [SONG, plain] };

    expect(readSongIndex(JSON.stringify(index))).toEqual({ ok: true, value: index });
  });

  it('refuses another field in the index, in a song, or in its files', () => {
    expect(reasonOf(readSongIndex(JSON.stringify({ version: 1, songs: [], count: 0 })))).toMatch(/keys/u);
    expect(reasonOf(readSongIndex(song({ year: 1999 })))).toMatch(/keys/u);
    expect(reasonOf(readSongIndex(song({ files: { ...SONG.files, preview: NAME_A } })))).toMatch(/keys/u);
  });

  it('refuses a cover with no cover type and a song id outside a-z, 0-9, and the dash', () => {
    expect(reasonOf(readSongIndex(song({ files: { ...SONG.files, coverType: null } })))).toMatch(/coverType/u);
    expect(reasonOf(readSongIndex(song({ id: 'Paper Kites' })))).toMatch(/id/u);
  });
});
