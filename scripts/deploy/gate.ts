// The pre-push gate of `deploy` (spec, "Delivery: the encrypted song store", "Pre-push gate"). It checks the
// built site in dist/ before the push, and gives one failure line for each problem. No failure lets the push go.
// Rules 1 to 3 check the song store in dist/songs/ (scripts/deploy/store-check.ts): the allowlist, the manifest,
// and each store file. The rules here check every other file:
// 4. No raw media: no .sng, .m4a, or .opus file, and no ftyp, OggS, SNGPKG, JPEG, or PNG magic at the start of
//    a file. The app assets are allowed: a file with the content of a file in git (git is public and passes the
//    leak scan), and the icons that vite-plugin-pwa makes from public/icon.svg.
// 5. No song id, title, artist, or charter in a path or a file, with the rules of the leak scan: case and accents
//    folded, whole words, and a one-word name only next to another name of its song. The names come from the
//    caller (the .sng files) and from the song index of the store.
// The store files are only checked by rules 1 to 3: they are encrypted, so they hold no media and no text.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findLeaks } from '../lib/leaks.ts';
import { checkStore } from './store-check.ts';
import type { FamilyKey } from '../../src/model/index.ts';

/** The names of one song that must not be in the site. */
export type SongStrings = { id: string; title: string; artist: string; charter: string };

type Options = {
  /** The built site. */
  dist: string;
  key: FamilyKey;
  /** The songs of the inbox. The gate adds the songs of the song index. */
  songs: readonly SongStrings[];
  /** The SHA-256 (hex) of each file in git. A file of the site with one of these contents is an app asset. */
  appAssets: ReadonlySet<string>;
};

const STORE_FILE = /^songs\/[0-9a-f]{64}\.bin$/u;
/** The icons that vite-plugin-pwa makes at the build, at the root of the site. */
const PWA_ICON = /^(?:favicon\.ico|(?:pwa|maskable-icon|apple-touch-icon)-\d+x\d+\.png)$/u;
const RAW_MEDIA = /\.(?:sng|m4a|opus)$/u;
const ascii = (text: string) => new TextEncoder().encode(text);
const MAGIC: readonly { kind: string; at: number; bytes: Uint8Array }[] = [
  { kind: 'ftyp (MP4 or M4A)', at: 4, bytes: ascii('ftyp') },
  { kind: 'OggS (Ogg or Opus)', at: 0, bytes: ascii('OggS') },
  { kind: 'SNGPKG (a .sng file)', at: 0, bytes: ascii('SNGPKG') },
  { kind: 'JPEG', at: 0, bytes: Uint8Array.of(0xff, 0xd8, 0xff) },
  { kind: 'PNG', at: 0, bytes: Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
];
/** A charter field can name more than one charter, for example "One + Two". */
const CHARTER_SPLIT = /[,&+/]/u;
const utf8 = new TextDecoder();

/** Every file of the folder, as paths with `/` relative to the folder. */
const filesOf = async (folder: string): Promise<string[]> => {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(folder.length + 1)
        .replaceAll('\\', '/')
    )
    .toSorted();
};

const startsWith = (bytes: Uint8Array, at: number, magic: Uint8Array): boolean =>
  bytes.length >= at + magic.length && magic.every((byte, offset) => bytes[at + offset] === byte);

/** Rule 4 for one file that is not an app asset. */
const mediaFailures = (path: string, bytes: Uint8Array): string[] => [
  ...(RAW_MEDIA.test(path) ? [`${path}: the site must not hold a .sng, .m4a, or .opus file.`] : []),
  ...MAGIC.filter(({ at, bytes: magic }) => startsWith(bytes, at, magic)).map(
    ({ kind }) => `${path}: the file starts with the ${kind} magic, and it is not an app asset.`
  ),
];

/**
 * A charter has the rule of a title: it counts alone with 2 or more words, or next to the title or the artist of
 * its song. So each charter becomes 2 entries for findLeaks, as a title with the other name as its artist.
 */
const charterEntries = (songs: readonly SongStrings[]): SongStrings[] =>
  songs.flatMap((song) =>
    song.charter.split(CHARTER_SPLIT).flatMap((name) => {
      const charter = name.trim();
      return charter === ''
        ? []
        : [
            { id: '', title: charter, artist: song.title, charter: '' },
            { id: '', title: charter, artist: song.artist, charter: '' },
          ];
    })
  );

/** Rule 5 for one text: the path and the content of a file. The charters are the entries of charterEntries. */
const songFailures = (
  path: string,
  text: string,
  { songs, charters }: { songs: readonly SongStrings[]; charters: readonly SongStrings[] }
): string[] => {
  const leaks = findLeaks(text, songs).map((leak) => `the ${leak.kind} "${leak.name}"`);
  const charterLeaks = findLeaks(text, charters)
    .filter((leak) => leak.kind === 'title')
    .map((leak) => `the charter "${leak.name}"`);
  return [...new Set([...leaks, ...charterLeaks])].map((leak) => `${path}: the site names ${leak}.`);
};

/** Checks the built site. Gives one line for each failure; an empty list lets the push go. */
export const checkSite = async ({ dist, key, songs, appAssets }: Options): Promise<string[]> => {
  const store = await checkStore(dist, key);
  const names = { songs: [...songs, ...store.songs], charters: charterEntries([...songs, ...store.songs]) };
  const others = (await filesOf(dist)).filter((path) => !STORE_FILE.test(path));
  const siteFailures = await others.reduce<Promise<string[]>>(async (done, path) => {
    const bytes = await readFile(join(dist, path));
    const asset = PWA_ICON.test(path) || appAssets.has(createHash('sha256').update(bytes).digest('hex'));
    return [
      ...(await done),
      ...(asset ? [] : mediaFailures(path, bytes)),
      ...songFailures(path, `${path}\n${utf8.decode(bytes)}`, names),
    ];
  }, Promise.resolve([]));
  return [...store.failures, ...siteFailures];
};
