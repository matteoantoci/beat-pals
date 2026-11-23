// The song inbox: the files at the top level of songs/ (spec, "The song pipeline"). Each `<song-id>.sng` file
// is one song, and `<song-id>.jpg` or `<song-id>.png` is its picture override. All other files are skipped.
// Hidden entries (a name that starts with a dot) are left out with no log line: they are the output folders
// `.prepared/` and `.site/`, and Finder files such as `.DS_Store`.

/** A song of the inbox: its id, and the file names of its `.sng` file and of its picture override. */
export type InboxSong = { id: string; sng: string; override: string | undefined };

type Inbox = { songs: InboxSong[]; skipped: string[] };

const SONG_ID = /^[a-z0-9-]+$/u;
const SNG = '.sng';
/** The picture overrides, in the order of preference. */
const OVERRIDES: readonly string[] = ['.jpg', '.png'];

const stemOf = (name: string): string => name.slice(0, name.lastIndexOf('.'));

/** Why the inbox skips a file that is not a song file and not the picture override of a song. */
const skipReason = (name: string, ids: ReadonlySet<string>): string => {
  if (name.endsWith(SNG)) {
    return `the song id does not match ${SONG_ID.source}`;
  }
  if (!OVERRIDES.includes(name.slice(name.lastIndexOf('.')))) {
    return 'it is not a .sng file or a picture override';
  }
  return ids.has(stemOf(name)) ? `${stemOf(name)}.jpg is the picture override` : 'no .sng file has this name';
};

/** Sorts the top-level file names of songs/ into songs and skipped files, with a log line for each skip. */
export const readInbox = (names: readonly string[]): Inbox => {
  const visible = names.filter((name) => !name.startsWith('.')).toSorted();
  const files = new Set(visible);
  const ids = new Set(visible.filter((name) => name.endsWith(SNG) && SONG_ID.test(stemOf(name))).map(stemOf));
  const songs = [...ids].map((id) => ({
    id,
    sng: `${id}${SNG}`,
    override: OVERRIDES.map((extension) => `${id}${extension}`).find((name) => files.has(name)),
  }));
  const used = new Set(songs.flatMap((song) => [song.sng, ...(song.override === undefined ? [] : [song.override])]));
  const skipped = visible
    .filter((name) => !used.has(name))
    .map((name) => `${name}: skipped, ${skipReason(name, ids)}.`);
  return { songs, skipped };
};
