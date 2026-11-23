// The rules of the leak scan (spec, "Delivery", "Leak scan"). It is pure: the caller gives the texts and the names.
// - All matches are whole words, compared with case and accents folded. A word is a run of letters and digits,
//   with an apostrophe allowed inside it. Other marks (space, dash, underscore, dot) only divide the words.
// - A song id always counts.
// - A title or an artist of 2 or more words always counts.
// - A one-word title or artist counts only when the same text also holds the other name of its song, because
//   common words can be song names.

export type SongNames = { readonly id: string; readonly title: string; readonly artist: string };

type Leak = { readonly kind: 'id' | 'title' | 'artist'; readonly name: string };

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const MARK = /\p{M}/gu;

/** Folds case and accents, so that "Café" and "CAFE" are the same. The leak scan uses this fold. */
export const fold = (text: string): string => text.normalize('NFKD').replace(MARK, '').toLowerCase();

const words = (text: string): readonly string[] => fold(text).match(WORD) ?? [];

/** The songs whose id, title, or artist the text names, by the rules above. */
export const findLeaks = (text: string, songs: readonly SongNames[]): Leak[] => {
  // The words of the text with one space around each, so that a name matches only at word edges.
  const spaced = ` ${words(text).join(' ')} `;
  const named = (name: readonly string[]) => name.length > 0 && spaced.includes(` ${name.join(' ')} `);

  return songs.flatMap((song): Leak[] => {
    const title = words(song.title);
    const artist = words(song.artist);
    const hasTitle = named(title);
    const hasArtist = named(artist);
    const found: Leak[] = [];
    if (named(words(song.id))) {
      found.push({ kind: 'id', name: song.id });
    }
    if (hasTitle && (title.length > 1 || hasArtist)) {
      found.push({ kind: 'title', name: song.title });
    }
    if (hasArtist && (artist.length > 1 || hasTitle)) {
      found.push({ kind: 'artist', name: song.artist });
    }
    return found;
  });
};
