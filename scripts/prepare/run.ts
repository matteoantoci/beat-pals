// The prepare step of `prepare-song` (spec, "The song pipeline"). For each song of the inbox it writes
// `<prepared>/<song-id>/` with `song.m4a`, the cover picture (`cover.jpg` or `cover.png`, none for a plain card),
// `song.json` (the facts file), and `stamp.json`. A song with an unchanged stamp is skipped before ffmpeg runs.
// Each song is built in a hidden work folder and then replaces the old folder, so a stopped run leaves no
// half-written song folder.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type InboxSong, readInbox } from './inbox.ts';
import { type Picture, planSong, type SongPlan } from './plan.ts';

/** The encoder port. `ffmpegEncoder` is the real one; the tests use a fake one that writes small files. */
export type Encoder = {
  /** Mixes the audio parts into one AAC `.m4a` file at `out`. Gives the log lines of the mix. */
  audio: (parts: readonly string[], out: string) => Promise<string[]>;
  /** Scales the picture at `input` into `out`, in the same image type. */
  picture: (input: string, out: string) => Promise<void>;
};

type Options = {
  /** The songs/ folder. */
  inbox: string;
  /** The output folder, songs/.prepared/. */
  prepared: string;
  encoder: Encoder;
  log: (line: string) => void;
  /** Prepare only the song with this id. */
  only?: string | undefined;
};

type Outcome = 'prepared' | 'unchanged' | 'skipped' | 'failed';

// Increase this number only when a change to the prepare step must reach every song: a new number changes the
// stamp of every song, so the next run prepares every song again.
const PIPELINE_VERSION = 1;
const STAMP = 'stamp.json';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The stamp of a song: its source files and the pipeline version. Not the ffmpeg version. */
const stampOf = (sng: Uint8Array, override: Uint8Array | undefined): string => {
  const stamp = {
    pipeline: PIPELINE_VERSION,
    sng: sha256(sng),
    picture: override === undefined ? null : sha256(override),
  };
  return `${JSON.stringify(stamp, null, 2)}\n`;
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Scales the picture into `cover.jpg` or `cover.png`. No picture writes no cover: the game shows a plain card. */
const writeCover = async (picture: Picture | undefined, work: string, encoder: Encoder): Promise<void> => {
  if (picture === undefined) {
    return;
  }
  const source = join(work, 'parts', `picture.${picture.type}`);
  await writeFile(source, picture.bytes);
  await encoder.picture(source, join(work, `cover.${picture.type}`));
};

/** Writes the files of the song into the work folder. Gives the log lines of the encoder. */
const writeSong = async (work: string, plan: SongPlan, encoder: Encoder): Promise<string[]> => {
  const parts = join(work, 'parts');
  await mkdir(parts, { recursive: true });
  await Promise.all(plan.mix.map(async (file) => writeFile(join(parts, file.name), file.bytes)));
  const lines = await encoder.audio(
    plan.mix.map((file) => join(parts, file.name)),
    join(work, 'song.m4a')
  );
  await writeCover(plan.picture, work, encoder);
  await rm(parts, { recursive: true });
  await writeFile(join(work, 'song.json'), `${JSON.stringify(plan.facts)}\n`);
  return lines;
};

/** Writes the song folder through a work folder, with the stamp last. Gives the log lines of the encoder. */
const build = async (
  target: { folder: string; stamp: string },
  plan: SongPlan,
  encoder: Encoder
): Promise<string[]> => {
  const work = join(target.folder, '..', `.${plan.facts.id}.work`);
  await rm(work, { recursive: true, force: true });
  try {
    const lines = await writeSong(work, plan, encoder);
    await writeFile(join(work, STAMP), target.stamp);
    await rm(target.folder, { recursive: true, force: true });
    await rename(work, target.folder);
    return lines;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
};

const prepareOne = async (song: InboxSong, { inbox, prepared, encoder, log }: Options): Promise<Outcome> => {
  const sng = await readFile(join(inbox, song.sng));
  const override =
    song.override === undefined
      ? undefined
      : { name: song.override, bytes: await readFile(join(inbox, song.override)) };
  const stamp = stampOf(sng, override?.bytes);
  const folder = join(prepared, song.id);
  if ((await readFile(join(folder, STAMP), 'utf8').catch(() => undefined)) === stamp) {
    log(`${song.id}: unchanged, skipped before ffmpeg.`);
    return 'unchanged';
  }
  const result = planSong(song.id, sng, override);
  if (!result.ok) {
    log(`${song.id}: skipped, ${result.reason}`);
    return 'skipped';
  }
  log(`${song.id}: preparing`);
  result.plan.log.forEach((line) => log(`  ${line}`));
  try {
    (await build({ folder, stamp }, result.plan, encoder)).forEach((line) => log(`  ${line}`));
  } catch (error) {
    log(`${song.id}: failed, ${messageOf(error)}`);
    return 'failed';
  }
  log(`${song.id}: prepared.`);
  return 'prepared';
};

/** Prepares each song of the inbox, one at a time. Gives the count of failed songs. */
export const prepareSongs = async (options: Options): Promise<number> => {
  const entries = await readdir(options.inbox, { withFileTypes: true });
  const inbox = readInbox(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  inbox.skipped.forEach((line) => options.log(line));
  const songs = inbox.songs.filter((song) => options.only === undefined || song.id === options.only);
  if (options.only !== undefined && songs.length === 0) {
    options.log(`${options.only}: no song with this id in the inbox.`);
    return 1;
  }
  await mkdir(options.prepared, { recursive: true });
  const outcomes = await songs.reduce<Promise<Outcome[]>>(
    async (done, song) => [...(await done), await prepareOne(song, options)],
    Promise.resolve([])
  );
  const count = (outcome: Outcome) => outcomes.filter((each) => each === outcome).length;
  const summary = (['prepared', 'unchanged', 'skipped', 'failed'] as const).map(
    (each) => `${String(count(each))} ${each}`
  );
  options.log(`prepare-song: ${summary.join(', ')}.`);
  return count('failed');
};
