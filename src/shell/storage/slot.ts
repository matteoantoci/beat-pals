// The rules of one stored value of the device storage (./index.ts). The adapter holds the texts: localStorage in the
// app, a map in the tests. A slot reads its key one time and keeps the value for the run. The rules:
// - A missing key, a text that the codec cannot read, or an adapter that throws gives the absent value of the codec.
// - A write keeps the new value for the run first. A failed write (full storage, a blocked origin) keeps it for
//   this run only, and gives false.
// - A slot never throws.

/** The place of the stored texts. Each call can throw, for example when the origin blocks localStorage. */
export type StorageAdapter = {
  readonly get: (key: string) => string | null;
  readonly set: (key: string, text: string) => void;
  readonly remove: (key: string) => void;
};

/** How a value becomes a stored text, and back. */
export type Codec<T> = {
  /** The value of a key that is missing or damaged, or that the adapter cannot read. */
  readonly absent: T;
  /** The value of the stored text, or undefined when this build cannot read it. It can throw (damaged JSON). */
  readonly decode: (text: string) => T | undefined;
  readonly encode: (value: T) => string;
};

/** One stored value. */
export type Slot<T> = {
  /** The value of this run: read from the adapter at the first call. */
  readonly get: () => T;
  /** Keeps the value for this run and writes it. False when the write failed. */
  readonly set: (value: T) => boolean;
  /** Keeps the absent value for this run and removes the key. False when the removal failed. */
  readonly clear: () => boolean;
};

/** The localStorage of the browser. */
export const localStorageAdapter = (): StorageAdapter => ({
  get: (key) => localStorage.getItem(key),
  set: (key, text) => localStorage.setItem(key, text),
  remove: (key) => localStorage.removeItem(key),
});

/** A storage in memory, for the tests. `texts` holds the stored text of each key, so a test can set and read it. */
export const memoryAdapter = (texts: Map<string, string> = new Map()): StorageAdapter => ({
  get: (key) => texts.get(key) ?? null,
  set: (key, text) => {
    texts.set(key, text);
  },
  remove: (key) => {
    texts.delete(key);
  },
});

/** The stored value of `key` in `adapter`. */
export const slot = <T>(adapter: StorageAdapter, key: string, codec: Codec<T>): Slot<T> => {
  let kept: { readonly value: T } | undefined;
  const read = (): T => {
    try {
      const text = adapter.get(key);
      return (text === null ? undefined : codec.decode(text)) ?? codec.absent;
    } catch {
      return codec.absent;
    }
  };
  /** Keeps `value` for this run, and then runs the change of the adapter. False when the change failed. */
  const change = (value: T, write: () => void): boolean => {
    kept = { value };
    try {
      write();
      return true;
    } catch {
      return false;
    }
  };
  return {
    get: () => {
      kept ??= { value: read() };
      return kept.value;
    },
    set: (value) => change(value, () => adapter.set(key, codec.encode(value))),
    clear: () => change(codec.absent, () => adapter.remove(key)),
  };
};
