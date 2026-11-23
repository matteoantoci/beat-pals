// A test helper, not a test: it writes an SNG version 1 container in memory (layout in scripts/lib/sng.ts).
// The tests build each .sng file in code with invented names, and never read songs/.

type Entry = readonly [name: string, content: Uint8Array];

const text = new TextEncoder();

const u32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};

const u64 = (value: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
};

const join = (list: readonly Uint8Array[]) => {
  const out = new Uint8Array(list.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of list) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const sized = (value: string) => {
  const bytes = text.encode(value);
  return [u32(bytes.length), bytes];
};

export const buildSng = (
  metadata: readonly (readonly [string, string])[],
  files: readonly Entry[],
  mask: Uint8Array
): Uint8Array => {
  const header = join([text.encode('SNGPKG'), u32(1), mask]);
  const pairs = join([u64(metadata.length), ...metadata.flatMap(([key, value]) => [...sized(key), ...sized(value)])]);
  const indexSize = 8 + files.reduce((sum, [name]) => sum + 1 + text.encode(name).length + 16, 0);
  let offset = header.length + 8 + pairs.length + 8 + indexSize + 8;
  const index: Uint8Array[] = [u64(files.length)];
  for (const [name, content] of files) {
    const nameBytes = text.encode(name);
    index.push(Uint8Array.of(nameBytes.length), nameBytes, u64(content.length), u64(offset));
    offset += content.length;
  }
  const data = join(files.map(([, content]) => content.map((byte, at) => byte ^ (mask[at & 15] ?? 0) ^ (at & 0xff))));
  return join([header, u64(pairs.length), pairs, u64(indexSize), join(index), u64(data.length), data]);
};
