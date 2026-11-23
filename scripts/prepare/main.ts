// The command line of `prepare-song` (spec, "The song pipeline" and "Delivery").
// `pnpm prepare-song` prepares each .sng file of songs/ into songs/.prepared/, and then encrypts the prepared
// songs into the song store, songs/.site/. It stops when no family key exists.
// `pnpm prepare-song --only <song-id>` prepares one song. The store step still stores every prepared song.
// `pnpm prepare-song key` prints the key code of the family key, for the password manager of the Parent.
// `pnpm prepare-song key --new` makes a new family key and empties the song store.
// The key folder is ~/.config/beat-pals/. The environment variable BEAT_PALS_KEY_FOLDER gives another folder, for
// a test run. It holds only the folder path, never the key.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpegEncoder } from './ffmpeg.ts';
import { HOME_KEY_FOLDER, loadKey, makeKey, readKeyCode } from './key.ts';
import { prepareSongs } from './run.ts';
import { emptyStore, storeSongs } from './store.ts';

const SONGS = join(import.meta.dirname, '..', '..', 'songs');
const SITE = join(SONGS, '.site');

const keyFolder = (): string => process.env['BEAT_PALS_KEY_FOLDER'] ?? HOME_KEY_FOLDER;

const log = (line: string): void => {
  console.log(line);
};

/** `prepare-song key --new`: a new family key, and an empty song store. */
const newKeyCommand = async (): Promise<number> => {
  const folder = keyFolder();
  const made = await makeKey(folder);
  if (!made.ok) {
    log(`prepare-song key --new: ${made.reason}`);
    return 1;
  }
  await emptyStore(SITE);
  log(`prepare-song key --new: made the family key ${made.value} in ${folder}, and emptied ${SITE}.`);
  log('Run `pnpm prepare-song key` and keep the key code in the password manager.');
  return 0;
};

/** `prepare-song key`: prints the key code. The only command that prints the key. */
const keyCommand = async (): Promise<number> => {
  const code = await readKeyCode(keyFolder());
  log(code.ok ? code.value : `prepare-song key: ${code.reason}`);
  return code.ok ? 0 : 1;
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
  const failed = await prepareSongs({ inbox: SONGS, prepared, encoder: ffmpegEncoder, log, only });
  const stored = await storeSongs({ prepared, site: SITE, key: key.value, log });
  if (!stored.ok) {
    log(`prepare-song: ${stored.reason}`);
  }
  return failed === 0 && stored.ok ? 0 : 1;
};

/** Runs the command. Gives the exit code. */
export const main = async (args: readonly string[]): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { only: { type: 'string' }, new: { type: 'boolean', default: false } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals[0] === 'key' && positionals.length === 1 && values.only === undefined) {
    return values.new ? newKeyCommand() : keyCommand();
  }
  if (positionals.length > 0 || values.new) {
    log('prepare-song: use `prepare-song [--only <song-id>]`, `prepare-song key`, or `prepare-song key --new`.');
    return 1;
  }
  return prepareCommand(values.only);
};
