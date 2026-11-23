// The family key on the Mac (spec, "Delivery: the encrypted song store"). The key folder is
// `~/.config/beat-pals/` with mode 0700. It holds 2 files with mode 0600:
// - `song-key`: the key code of the family key. Only `prepare-song key --new` writes it, and never over a file.
// - `song-key-check`: the key check (base64url), made one time with the key. Each manifest holds it, so an
//   unchanged run writes no file.
// The key never goes into a log line or an error message. Only `prepare-song key` prints the key code.

import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  decodeKeyCode,
  encodeKeyCode,
  FAMILY_KEY_BYTES,
  type FamilyKey,
  makeKeyCheck,
  openFamilyKey,
  opensKeyCheck,
} from '../../src/model/index.ts';

/** The family key with the key check that the Mac keeps next to it. */
export type MacKey = { key: FamilyKey; keyCheck: string };

type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

/** The key folder of the Parent. */
export const HOME_KEY_FOLDER = join(homedir(), '.config', 'beat-pals');

const KEY_FILE = 'song-key';
const CHECK_FILE = 'song-key-check';
const FOLDER_MODE = 0o700;
const FILE_MODE = 0o600;
const NEW_KEY = 'Run `pnpm prepare-song key --new` to make the family key.';

const octal = (mode: number): string => `0${(mode & 0o777).toString(8)}`;

const exists = async (path: string): Promise<boolean> =>
  lstat(path).then(
    () => true,
    () => false
  );

/** The reason why the path is refused, or undefined. A mode wider than `allowed` is refused. */
const modeProblem = async (path: string, allowed: number, kind: 'folder' | 'file'): Promise<string | undefined> => {
  const stats = await lstat(path);
  if (kind === 'folder' ? !stats.isDirectory() : !stats.isFile()) {
    return `${path} is not a ${kind}.`;
  }
  if ((stats.mode & 0o777 & ~allowed) !== 0) {
    return `${path} has the mode ${octal(stats.mode)}. It must be ${octal(allowed)}: run \`chmod ${octal(allowed)} ${path}\`.`;
  }
  return undefined;
};

/** The first mode problem of the key folder and its files that exist. */
const keyFolderProblem = async (folder: string): Promise<string | undefined> => {
  const files = [join(folder, KEY_FILE), join(folder, CHECK_FILE)];
  const present = await Promise.all(files.map(async (file) => ((await exists(file)) ? [file] : [])));
  const problems = await Promise.all([
    modeProblem(folder, FOLDER_MODE, 'folder'),
    ...present.flat().map(async (file) => modeProblem(file, FILE_MODE, 'file')),
  ]);
  return problems.find((problem) => problem !== undefined);
};

/** Reads the family key and its key check. Refuses a missing key, a wide mode, or a key check of another key. */
export const loadKey = async (folder: string): Promise<Result<MacKey>> => {
  if (!(await exists(join(folder, KEY_FILE)))) {
    return { ok: false, reason: `No family key exists in ${folder}. ${NEW_KEY}` };
  }
  const problem = await keyFolderProblem(folder);
  if (problem !== undefined) {
    return { ok: false, reason: problem };
  }
  if (!(await exists(join(folder, CHECK_FILE)))) {
    return { ok: false, reason: `${join(folder, CHECK_FILE)} is missing. It is made with the key.` };
  }
  const raw = decodeKeyCode(await readFile(join(folder, KEY_FILE), 'utf8'));
  if (raw === undefined) {
    return { ok: false, reason: `${join(folder, KEY_FILE)} does not hold a valid key code.` };
  }
  const key = await openFamilyKey(raw);
  const keyCheck = (await readFile(join(folder, CHECK_FILE), 'utf8')).trim();
  if (!(await opensKeyCheck(key, keyCheck))) {
    return { ok: false, reason: `${join(folder, CHECK_FILE)} is not the key check of the family key.` };
  }
  return { ok: true, value: { key, keyCheck } };
};

/** The key code of the family key, for `prepare-song key`. */
export const readKeyCode = async (folder: string): Promise<Result<string>> => {
  const loaded = await loadKey(folder);
  if (!loaded.ok) {
    return loaded;
  }
  const raw = decodeKeyCode(await readFile(join(folder, KEY_FILE), 'utf8'));
  return raw === undefined
    ? { ok: false, reason: 'The key code is not valid.' }
    : { ok: true, value: encodeKeyCode(raw) };
};

/** Makes a new random family key and its key check. Refuses when a key file exists. Gives the new key id. */
export const makeKey = async (folder: string): Promise<Result<string>> => {
  if (await exists(join(folder, KEY_FILE))) {
    return {
      ok: false,
      reason: `${join(folder, KEY_FILE)} exists. The script never replaces it. Remove the old file by hand first.`,
    };
  }
  await mkdir(folder, { recursive: true, mode: FOLDER_MODE });
  const problem = await keyFolderProblem(folder);
  if (problem !== undefined) {
    return { ok: false, reason: problem };
  }
  const raw = crypto.getRandomValues(new Uint8Array(FAMILY_KEY_BYTES));
  const key = await openFamilyKey(raw);
  await writeFile(join(folder, CHECK_FILE), `${await makeKeyCheck(key)}\n`, { mode: FILE_MODE });
  await writeFile(join(folder, KEY_FILE), `${encodeKeyCode(raw)}\n`, { mode: FILE_MODE, flag: 'wx' });
  return { ok: true, value: key.id };
};
