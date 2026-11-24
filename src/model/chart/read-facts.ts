// The reader of the facts file of a ready song. `prepare-song` writes the file, and the family key seals it: the
// store name of the file is the keyed hash of its content, and AES-GCM refuses any change. So the reader checks only
// the version and the lists that the play reads, which catches a facts file of a newer version.

import type { SongFacts } from './facts';

/** A facts file from before the star moments has no phrases. It stays in the last store on a device until the
 * download of the new store is complete, and an offline start reads it. */
type OldFacts = Omit<SongFacts, 'phrases' | 'phraseSource'> & Partial<Pick<SongFacts, 'phrases' | 'phraseSource'>>;

const isFacts = (value: unknown): value is OldFacts => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  const phrases = fields.get('phrases');
  return (
    fields.get('version') === 1 &&
    Array.isArray(fields.get('beats')) &&
    Array.isArray(fields.get('notes')) &&
    Array.isArray(fields.get('fills')) &&
    (phrases === undefined || Array.isArray(phrases))
  );
};

/** Old facts with no phrases play with no star moments. */
const withPhrases = (value: OldFacts): SongFacts =>
  value.phrases && value.phraseSource
    ? { ...value, phrases: value.phrases, phraseSource: value.phraseSource }
    : { ...value, phrases: [], phraseSource: 'fallback' };

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
};

/** The facts of the JSON text, or undefined when the text is not a facts file of version 1. */
export const readFacts = (json: string): SongFacts | undefined => {
  const value = parse(json);
  return isFacts(value) ? withPhrases(value) : undefined;
};
