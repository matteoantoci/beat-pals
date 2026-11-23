// The 2 index files of the song store (spec, "Delivery: the encrypted song store"), with strict schema checks:
// - The manifest, `manifest.json`: the only plain file of the store.
// - The song index: an encrypted store file. The game downloads and decrypts it first.
// A file with any other field, a missing field, or a wrong value is refused.

/** A store file: its store name (64 hex characters, the file is `<name>.bin`) and its encrypted size. */
type StoreFile = { name: string; size: number };

export type Manifest = {
  version: 1;
  /** 16 hex characters. */
  keyId: string;
  /** base64url of the encrypted known text. */
  keyCheck: string;
  /** The store name of the encrypted song index. */
  index: string;
  /** Every store file, the index included, sorted by name. */
  files: StoreFile[];
};

export type CoverType = 'image/jpeg' | 'image/png';

/** One song of the song index. Its file values are store names. */
export type IndexSong = {
  id: string;
  title: string;
  artist: string;
  charter: string;
  files: { facts: string; cover: string | null; coverType: CoverType | null; audio: string };
  /** The sum of the encrypted sizes of its files. */
  size: number;
};

export type SongIndex = { version: 1; songs: IndexSong[] };

type Read<T> = { ok: true; value: T } | { ok: false; reason: string };

const STORE_NAME = /^[0-9a-f]{64}$/u;
const KEY_ID = /^[0-9a-f]{16}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const SONG_ID = /^[a-z0-9-]+$/u;

/** Marks the errors of a failed check, so a bug in the code still throws. */
const REFUSED = Symbol('refused');

const refuse = (reason: string): never => {
  throw new Error(reason, { cause: REFUSED });
};

/** The fields of the value, which must be an object with exactly these keys. */
const exactly = (value: unknown, keys: readonly string[], path: string): ReadonlyMap<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return refuse(`${path} is not an object`);
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  const actual = [...fields.keys()].toSorted();
  const expected = keys.toSorted();
  if (actual.join(',') !== expected.join(',')) {
    refuse(`${path} has the keys ${actual.join(', ')}, not ${expected.join(', ')}`);
  }
  return fields;
};

const text = (value: unknown, path: string, pattern?: RegExp): string =>
  typeof value === 'string' && (pattern === undefined || pattern.test(value))
    ? value
    : refuse(`${path} is not a valid string`);

const size = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : refuse(`${path} is not a positive whole number`);

const list = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : refuse(`${path} is not a list`);

const versionOne = (value: unknown, path: string): 1 => (value === 1 ? value : refuse(`${path} is not 1`));

/** The reason of a failed check. Any other error is a bug, so it is thrown again. */
const reasonOf = (error: unknown): string => {
  if (error instanceof Error && error.cause === REFUSED) {
    return error.message;
  }
  throw error;
};

/** Parses the JSON text and runs the check. Gives the value, or the first reason why the file is refused. */
const readWith = <T>(json: string, check: (value: unknown) => T): Read<T> => {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'the file is not JSON' };
  }
  try {
    return { ok: true, value: check(value) };
  } catch (error) {
    return { ok: false, reason: reasonOf(error) };
  }
};

const checkFiles = (value: unknown): StoreFile[] => {
  const files = list(value, 'files').map((each, at) => {
    const file = exactly(each, ['name', 'size'], `files[${String(at)}]`);
    return {
      name: text(file.get('name'), `files[${String(at)}].name`, STORE_NAME),
      size: size(file.get('size'), `files[${String(at)}].size`),
    };
  });
  if (files.some((file, at) => at > 0 && (files[at - 1]?.name ?? '') >= file.name)) {
    refuse('files is not sorted by name, or a name occurs 2 times');
  }
  return files;
};

const checkManifest = (value: unknown): Manifest => {
  const manifest = exactly(value, ['version', 'keyId', 'keyCheck', 'index', 'files'], 'the manifest');
  const files = checkFiles(manifest.get('files'));
  const index = text(manifest.get('index'), 'index', STORE_NAME);
  if (!files.some((file) => file.name === index)) {
    refuse('files does not hold the index');
  }
  return {
    version: versionOne(manifest.get('version'), 'version'),
    keyId: text(manifest.get('keyId'), 'keyId', KEY_ID),
    keyCheck: text(manifest.get('keyCheck'), 'keyCheck', BASE64URL),
    index,
    files,
  };
};

const checkCover = (
  cover: unknown,
  coverType: unknown,
  path: string
): Pick<IndexSong['files'], 'cover' | 'coverType'> => {
  if (cover === null && coverType === null) {
    return { cover: null, coverType: null };
  }
  if (coverType !== 'image/jpeg' && coverType !== 'image/png') {
    return refuse(`${path}.coverType is not image/jpeg or image/png`);
  }
  return { cover: text(cover, `${path}.cover`, STORE_NAME), coverType };
};

const checkSong = (value: unknown, at: number): IndexSong => {
  const path = `songs[${String(at)}]`;
  const song = exactly(value, ['id', 'title', 'artist', 'charter', 'files', 'size'], path);
  const files = exactly(song.get('files'), ['facts', 'cover', 'coverType', 'audio'], `${path}.files`);
  return {
    id: text(song.get('id'), `${path}.id`, SONG_ID),
    title: text(song.get('title'), `${path}.title`),
    artist: text(song.get('artist'), `${path}.artist`),
    charter: text(song.get('charter'), `${path}.charter`),
    files: {
      facts: text(files.get('facts'), `${path}.files.facts`, STORE_NAME),
      ...checkCover(files.get('cover'), files.get('coverType'), `${path}.files`),
      audio: text(files.get('audio'), `${path}.files.audio`, STORE_NAME),
    },
    size: size(song.get('size'), `${path}.size`),
  };
};

const checkSongIndex = (value: unknown): SongIndex => {
  const index = exactly(value, ['version', 'songs'], 'the song index');
  return {
    version: versionOne(index.get('version'), 'version'),
    songs: list(index.get('songs'), 'songs').map(checkSong),
  };
};

/** Reads the text of `manifest.json`. Refuses a manifest that breaks the schema. */
export const readManifest = (json: string): Read<Manifest> => readWith(json, checkManifest);

/** Reads the decrypted text of the song index. Refuses an index that breaks the schema. */
export const readSongIndex = (json: string): Read<SongIndex> => readWith(json, checkSongIndex);
