// The reader of the SNG container, version 1 (spec, "The song pipeline"). It is pure: it reads bytes, not files.
// Layout, all numbers little-endian:
// - header: "SNGPKG", a u32 version, and a 16-byte XOR mask;
// - metadata: a u64 section size, a u64 pair count, then each key and value as a u32 size and UTF-8 bytes;
// - file index: a u64 section size, a u64 file count, then each file as a u8 name size, the name, a u64 size,
//   and a u64 offset from the start of the container;
// - file data: a u64 section size, then the masked files. Byte i of a file is masked with mask[i % 16] ^ (i % 256).

export type SngFile = { readonly name: string; readonly bytes: Uint8Array };

export type Sng = {
  /** The song.ini keys, for example `name`, `artist`, `charter`, `delay`. */
  readonly metadata: ReadonlyMap<string, string>;
  readonly files: readonly SngFile[];
};

const MAGIC = 'SNGPKG';
const MASK_SIZE = 16;
/** The keys that can hold rich-text tags such as `<color=#FFAA00>`. */
const TAGGED_KEYS = new Set(['name', 'artist', 'charter']);
const TAG = /<[^<>]*>/gu;
const CUT = 'The SNG file is cut: a section ends after the end of the file.';

const utf8 = new TextDecoder();

type Cursor = {
  /** The bytes from `start`, which can be anywhere in the file. */
  readonly slice: (start: number, size: number) => Uint8Array;
  readonly take: (size: number) => Uint8Array;
  readonly number: (size: 1 | 4 | 8) => number;
  readonly text: (size: number) => string;
};

/** A cursor over the bytes. Each read checks the end of the file. */
const cursor = (bytes: Uint8Array): Cursor => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  const slice = (start: number, size: number): Uint8Array => {
    if (start + size > bytes.length) {
      throw new Error(CUT);
    }
    return bytes.subarray(start, start + size);
  };
  const take = (size: number): Uint8Array => {
    const part = slice(at, size);
    at += size;
    return part;
  };
  const number = (size: 1 | 4 | 8): number => {
    const start = at;
    take(size);
    if (size === 1) {
      return view.getUint8(start);
    }
    return size === 4 ? view.getUint32(start, true) : Number(view.getBigUint64(start, true));
  };
  return { slice, take, number, text: (size: number) => utf8.decode(take(size)) };
};

/** Byte i of a file is masked with mask[i % 16] ^ (i % 256). The same XOR removes the mask. */
const unmask = (masked: Uint8Array, mask: Uint8Array): Uint8Array => {
  // A plain loop: songs are tens of MB, and Uint8Array.map with a callback is many times slower.
  const out = new Uint8Array(masked.length);
  for (let at = 0; at < masked.length; at += 1) {
    out[at] = (masked[at] ?? 0) ^ (mask[at % MASK_SIZE] ?? 0) ^ (at & 0xff);
  }
  return out;
};

// The section sizes are not necessary: the counts give the end of each section.
const readMetadata = (read: Cursor): Map<string, string> => {
  read.number(8);
  const metadata = new Map<string, string>();
  for (let pairs = read.number(8); pairs > 0; pairs -= 1) {
    const key = read.text(read.number(4));
    const value = read.text(read.number(4));
    metadata.set(key, TAGGED_KEYS.has(key) ? value.replace(TAG, '') : value);
  }
  return metadata;
};

const readFiles = (read: Cursor, mask: Uint8Array): SngFile[] => {
  read.number(8);
  const files: SngFile[] = [];
  for (let count = read.number(8); count > 0; count -= 1) {
    const name = read.text(read.number(1));
    const size = read.number(8);
    const offset = read.number(8);
    files.push({ name, bytes: unmask(read.slice(offset, size), mask) });
  }
  return files;
};

export const readSng = (bytes: Uint8Array): Sng => {
  const read = cursor(bytes);
  if (bytes.length < MAGIC.length || read.text(MAGIC.length) !== MAGIC) {
    throw new Error('This is not an SNG file: it does not start with SNGPKG.');
  }
  const version = read.number(4);
  if (version !== 1) {
    throw new Error(`The reader knows SNG version 1, not SNG version ${String(version)}.`);
  }
  const mask = read.take(MASK_SIZE);
  const metadata = readMetadata(read);
  return { metadata, files: readFiles(read, mask) };
};
