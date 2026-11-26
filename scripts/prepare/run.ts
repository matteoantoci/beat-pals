// The prepare step of `prepare-song` (spec, "The song pipeline"). For each song of the inbox it writes
// `<prepared>/<song-id>/` with `song.m4a`, the cover picture (`cover.jpg` or `cover.png`, none for a plain card),
// `song.json` (the facts file), and `stamp.json`. A song with an unchanged stamp is skipped before ffmpeg runs, and a
// song whose stamp changed only in its facts version gets only its facts file again.
// Each song is built in a hidden work folder and then replaces the old folder, so a stopped run leaves no
// half-written song folder. A prepared folder whose `.sng` file left the inbox is removed.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGrid } from './grid.ts';
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

type Outcome = 'prepared' | 'refreshed' | 'unchanged' | 'skipped' | 'failed';

// Increase this number only when a change to the prepare step must reach every song: a new number changes the
// stamp of every song, so the next run prepares every song again.
const PIPELINE_VERSION = 1;
// Increase this number when the facts file changes (the chart reader of the model): the next run writes the facts
// file of every song again and keeps its audio and its cover, so their store names stay. Version 2: the phrases.
const FACTS_VERSION = 2;
const STAMP = 'stamp.json';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The stamp of a song: its source files, the pipeline version, and the facts version. Not the ffmpeg version. A song
 * with no grid override has no `grid` field, so the stamps of the other songs stay as before the grid override. */
const stampOf = (sng: Uint8Array, override: Uint8Array | undefined, grid: Uint8Array | undefined): string => {
  const stamp = {
    pipeline: PIPELINE_VERSION,
    facts: FACTS_VERSION,
    sng: sha256(sng),
    picture: override === undefined ? null : sha256(override),
    ...(grid !== undefined && { grid: sha256(grid) }),
  };
  return `${JSON.stringify(stamp, null, 2)}\n`;
};

/** The fields of a stamp without its facts version and its grid override, or undefined for a stamp that is not a JSON
 * object. The grid override changes only the facts file. */
const audioPart = (stamp: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(stamp);
    return typeof parsed === 'object' && parsed !== null
      ? JSON.stringify(Object.entries(parsed).filter(([key]) => key !== 'facts' && key !== 'grid'))
      : undefined;
  } catch {
    return undefined;
  }
};

/** True when the old stamp differs from the new one only in its facts fields: the audio and the cover stay. */
const onlyFactsChanged = (old: string | undefined, stamp: string): boolean => {
  const before = old === undefined ? undefined : audioPart(old);
  return before !== undefined && before === audioPart(stamp);
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

/** Writes the song folder of the plan with ffmpeg, and logs it. */
const buildSong = async (
  target: { id: string; folder: string; stamp: string },
  plan: SongPlan,
  { encoder, log }: Options
): Promise<Outcome> => {
  log(`${target.id}: preparing`);
  plan.log.forEach((line) => log(`  ${line}`));
  try {
    (await build(target, plan, encoder)).forEach((line) => log(`  ${line}`));
  } catch (error) {
    log(`${target.id}: failed, ${messageOf(error)}`);
    return 'failed';
  }
  log(`${target.id}: prepared.`);
  return 'prepared';
};

/** Writes only the facts file and the stamp of a prepared song, and logs it: its audio and its cover stay. */
const refreshFacts = async (
  target: { id: string; folder: string; stamp: string },
  plan: SongPlan,
  log: Options['log']
): Promise<Outcome> => {
  await writeFile(join(target.folder, 'song.json'), `${JSON.stringify(plan.facts)}\n`);
  // The stamp goes last, so a stopped run writes the facts again next time.
  await writeFile(join(target.folder, STAMP), target.stamp);
  log(`${target.id}: facts refreshed, the audio and the cover stay.`);
  return 'refreshed';
};

const prepareOne = async (song: InboxSong, options: Options): Promise<Outcome> => {
  const { inbox, prepared, log } = options;
  const sng = await readFile(join(inbox, song.sng));
  const override =
    song.override === undefined
      ? undefined
      : { name: song.override, bytes: await readFile(join(inbox, song.override)) };
  const grid = await readGrid(inbox, song.grid);
  if (!grid.ok) {
    log(`${song.id}: skipped, ${grid.reason}`);
    return 'skipped';
  }
  const target = { id: song.id, folder: join(prepared, song.id), stamp: stampOf(sng, override?.bytes, grid.bytes) };
  const old = await readFile(join(target.folder, STAMP), 'utf8').catch(() => undefined);
  if (old === target.stamp) {
    log(`${song.id}: unchanged, skipped before ffmpeg.`);
    return 'unchanged';
  }
  const result = planSong(song.id, sng, { picture: override, grid: grid.grid });
  if (!result.ok) {
    log(`${song.id}: skipped, ${result.reason}`);
    return 'skipped';
  }
  return onlyFactsChanged(old, target.stamp)
    ? refreshFacts(target, result.plan, log)
    : buildSong(target, result.plan, options);
};

/** Removes each prepared song folder whose id has no `.sng` file in the inbox, with a log line for each. */
const removeOrphans = async ({ prepared, log }: Options, ids: ReadonlySet<string>): Promise<void> => {
  const orphans = (await readdir(prepared, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !ids.has(entry.name))
    .map((entry) => entry.name)
    .toSorted();
  await Promise.all(orphans.map(async (id) => rm(join(prepared, id), { recursive: true, force: true })));
  orphans.forEach((id) => log(`${id}: removed from the prepared songs, its .sng file is gone.`));
};

/**
 * Prepares each song of the inbox, one at a time. A song that fails is logged and counted, but it does not stop the
 * run (story 50). Gives the exit code: 1 only when `only` names no song of the inbox.
 */
export const prepareSongs = async (options: Options): Promise<number> => {
  const inbox = await readInbox(options.inbox);
  inbox.skipped.forEach((line) => options.log(line));
  const songs = inbox.songs.filter((song) => options.only === undefined || song.id === options.only);
  if (options.only !== undefined && songs.length === 0) {
    options.log(`${options.only}: no song with this id in the inbox.`);
    return 1;
  }
  await mkdir(options.prepared, { recursive: true });
  await removeOrphans(options, new Set(inbox.songs.map((song) => song.id)));
  const outcomes = await songs.reduce<Promise<Outcome[]>>(
    async (done, song) => [...(await done), await prepareOne(song, options)],
    Promise.resolve([])
  );
  const count = (outcome: Outcome) => outcomes.filter((each) => each === outcome).length;
  const summary = (['prepared', 'refreshed', 'unchanged', 'skipped', 'failed'] as const).map(
    (each) => `${String(count(each))} ${each}`
  );
  options.log(`prepare-song: ${summary.join(', ')}.`);
  return 0;
};
