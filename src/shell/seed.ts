// A seed for the model. The model has no random source: the same seed always gives the same result,
// so the UI picks the seed.

/** A new seed from the device random source. Every 32-bit number is a good seed. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
