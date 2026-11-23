// The reader of the facts file of a ready song. `prepare-song` writes the file, and the family key seals it: the
// store name of the file is the keyed hash of its content, and AES-GCM refuses any change. So the reader checks only
// the version and the lists that the play reads, which catches a facts file of a newer version.

import type { SongFacts } from './facts';

const isFacts = (value: unknown): value is SongFacts => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  return (
    fields.get('version') === 1 &&
    Array.isArray(fields.get('beats')) &&
    Array.isArray(fields.get('notes')) &&
    Array.isArray(fields.get('fills'))
  );
};

/** The facts of the JSON text, or undefined when the text is not a facts file of version 1. */
export const readFacts = (json: string): SongFacts | undefined => {
  try {
    const value: unknown = JSON.parse(json);
    return isFacts(value) ? value : undefined;
  } catch {
    return undefined;
  }
};
