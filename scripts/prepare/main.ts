// The command line of `prepare-song` (spec, "The song pipeline" and "Delivery").
// `pnpm prepare-song` prepares each .sng file of songs/ into songs/.prepared/, and then encrypts the prepared
// songs into the song store, songs/.site/. It stops when no family key exists.
// `pnpm prepare-song --only <song-id>` prepares one song. The store step still stores every prepared song.
// A song that ffmpeg cannot encode is logged and counted, but the exit code stays 0 (story 50).
// `pnpm prepare-song report` prints the chart report of each song of songs/, with no ffmpeg and no key.
// `pnpm prepare-song key` prints the key code of the family key, for the password manager of the Parent.
// `pnpm prepare-song key --new` makes a new family key. In the home key folder it also empties the song store.
// The key folder is ~/.config/beat-pals/. The environment variable BEAT_PALS_KEY_FOLDER gives another folder, for
// a test run. It holds only the folder path, never the key. A test key never empties the song store.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpegEncoder } from './ffmpeg.ts';
import { readInbox } from './inbox.ts';
import { HOME_KEY_FOLDER, loadKey, makeKey, readKeyCode } from './key.ts';
import { reportSongs } from './report.ts';
import { prepareSongs } from './run.ts';
import { emptyStore, storeSongs } from './store.ts';

const SONGS = join(import.meta.dirname, '..', '..', 'songs');
const SITE = join(SONGS, '.site');

const keyFolder = (): string => process.env['BEAT_PALS_KEY_FOLDER'] ?? HOME_KEY_FOLDER;

const log = (line: string): void => {
  console.log(line);
};

type NewKeyOptions = {
  /** The key folder of this run. */
  folder: string;
  /** The home key folder, ~/.config/beat-pals/. */
  home: string;
  /** The song store, songs/.site/. */
  site: string;
  log: (line: string) => void;
};

/**
 * `prepare-song key --new`: a new family key. In the home key folder it also empties the song store, because each
 * old store name belongs to the old key. A test key folder leaves the store alone: the store belongs to the home key.
 */
export const newKeyCommand = async ({ folder, home, site, log: say }: NewKeyOptions): Promise<number> => {
  const made = await makeKey(folder);
  if (!made.ok) {
    say(`prepare-song key --new: ${made.reason}`);
    return 1;
  }
  if (resolve(folder) === resolve(home)) {
    await emptyStore(site);
    say(`prepare-song key --new: made the family key ${made.value} in ${folder}, and emptied ${site}.`);
  } else {
    say(
      `prepare-song key --new: made the family key ${made.value} in the test key folder ${folder}, and did not empty ${site}.`
    );
  }
  say('Run `pnpm prepare-song key` and keep the key code in the password manager.');
  return 0;
};

/** `prepare-song key`: prints the key code. The only command that prints the key. */
const keyCommand = async (): Promise<number> => {
  const code = await readKeyCode(keyFolder());
  log(code.ok ? code.value : `prepare-song key: ${code.reason}`);
  return code.ok ? 0 : 1;
};

/** `prepare-song report`: the chart report of each song, with no ffmpeg and no key. */
const reportCommand = async (): Promise<number> => {
  if (!existsSync(SONGS)) {
    log(`prepare-song: the song inbox ${SONGS} does not exist.`);
    return 1;
  }
  await reportSongs({ inbox: SONGS, log });
  return 0;
};

/** Prepares the songs and stores them. */
const prepareCommand = async (only: string | undefined): Promise<number> => {
  if (!existsSync(SONGS)) {
    log(`prepare-song: the song inbox ${SONGS} does not exist.`);
    return 1;
  }
  const key = await loadKey(keyFolder());
  if (!key.ok) {
    log(`prepare-song: ${key.reason}`);
    return 1;
  }
  const prepared = join(SONGS, '.prepared');
  const code = await prepareSongs({ inbox: SONGS, prepared, encoder: ffmpegEncoder, log, only });
  const songIds = new Set((await readInbox(SONGS)).songs.map((song) => song.id));
  const stored = await storeSongs({ prepared, site: SITE, key: key.value, songIds, log });
  if (!stored.ok) {
    log(`prepare-song: ${stored.reason}`);
  }
  return code === 0 && stored.ok ? 0 : 1;
};

/** The commands with a positional word, by their full word list. None of them takes `--only`. */
const COMMANDS: Readonly<Record<string, () => Promise<number>>> = {
  key: keyCommand,
  'key --new': async () => newKeyCommand({ folder: keyFolder(), home: HOME_KEY_FOLDER, site: SITE, log }),
  report: reportCommand,
};

/** Runs the command. Gives the exit code. */
export const main = async (args: readonly string[]): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { only: { type: 'string' }, new: { type: 'boolean', default: false } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length === 0 && !values.new) {
    return prepareCommand(values.only);
  }
  const command =
    values.only === undefined ? COMMANDS[[...positionals, ...(values.new ? ['--new'] : [])].join(' ')] : undefined;
  if (command === undefined) {
    log(
      'prepare-song: use `prepare-song [--only <song-id>]`, `prepare-song report`, `prepare-song key`, or `prepare-song key --new`.'
    );
    return 1;
  }
  return command();
};
