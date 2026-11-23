// The seeded random source of the model. The model never uses Math.random: the same seed gives the same level.

/** Random choices from one seed. Each call moves the source to its next value. */
export type Random = {
  /** One of the items, or undefined when there is no item. */
  readonly pick: <T>(items: readonly T[]) => T | undefined;
  /** The items in a random order, as a new array. */
  readonly shuffle: <T>(items: readonly T[]) => readonly T[];
};

/** A random source from a 32-bit seed (mulberry32). */
export const randomFrom = (seed: number): Random => {
  let state = seed >>> 0;
  /** A number from 0 (included) to 1 (not included). */
  const next = (): number => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    const a = Math.imul(state ^ (state >>> 15), state | 1);
    const b = a ^ (a + Math.imul(a ^ (a >>> 7), a | 61));
    return ((b ^ (b >>> 14)) >>> 0) / 2 ** 32;
  };
  return {
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) =>
      items
        .map((item) => ({ item, key: next() }))
        .toSorted((x, y) => x.key - y.key)
        .map(({ item }) => item),
  };
};
