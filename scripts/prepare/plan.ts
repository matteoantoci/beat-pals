// The plan of one song: what `prepare-song` makes from a `.sng` file, before `ffmpeg` runs (spec, "The song
// pipeline"). It is pure: it reads bytes, not files. The plan gives the facts file, the audio parts to mix,
// the picture source, and a log line for each part that it leaves out.

import { readSongChart, type SongFacts } from '../../src/model/index.ts';
import { readSng, type Sng, type SngFile } from '../lib/sng.ts';
import { type GridOverride, steadyBeats } from './grid.ts';

type PictureType = 'jpg' | 'png';

/** A picture to scale: where it comes from (for the log), its real image type, and its bytes. */
export type Picture = { source: string; type: PictureType; bytes: Uint8Array };

export type SongPlan = {
  facts: SongFacts;
  /** The audio parts to mix, in the order of the `.sng` file. */
  mix: SngFile[];
  /** No picture: the game shows a plain card with a pal. */
  picture: Picture | undefined;
  log: string[];
};

type PlanResult = { ok: true; plan: SongPlan } | { ok: false; reason: string };

/** The picture override of the inbox, `songs/<song-id>.jpg` or `.png`. */
type Override = { name: string; bytes: Uint8Array };

/** The overrides of the inbox for one song: its picture and its beat grid. */
type Overrides = { picture: Override | undefined; grid: GridOverride | undefined };

/** The file types that Clone Hero plays (chart-formats.md, "Audio"). */
const AUDIO = /^(.+)\.(?:opus|ogg|mp3|wav)$/u;
const ALBUM = ['album.jpg', 'album.png'];
const utf8 = new TextDecoder();

/** Why a part is left out of the mix, or undefined for a part of the mix. `parts` holds the part names. */
const leaveOut = (part: string, parts: ReadonlySet<string>): string | undefined => {
  if (part === 'preview') {
    return 'the preview clip is not part of the song';
  }
  if (part === 'crowd') {
    return 'crowd noise is not part of the song';
  }
  const split = `${part}_1`;
  return (part === 'drums' || part === 'vocals') && parts.has(split) ? `${split} exists` : undefined;
};

const pickMix = (files: readonly SngFile[]): { mix: SngFile[]; log: string[] } => {
  const audio = files.flatMap((file) => {
    const part = AUDIO.exec(file.name)?.[1];
    return part === undefined ? [] : [{ file, part }];
  });
  const parts = new Set(audio.map(({ part }) => part));
  const log: string[] = [];
  const mix = audio.flatMap(({ file, part }) => {
    const reason = leaveOut(part, parts);
    if (reason !== undefined) {
      log.push(`skipped part: ${file.name} (${reason})`);
    }
    return reason === undefined ? [file] : [];
  });
  return { mix, log };
};

/** The image type from the first bytes. The file name can be wrong: an `album.png` can hold a JPEG picture. */
const imageType = (bytes: Uint8Array): PictureType | undefined => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47];
  return png.every((byte, at) => bytes[at] === byte) ? 'png' : undefined;
};

/** The first picture that exists and is a JPEG or PNG picture: the override, then the album picture. */
const pickPicture = (override: Override | undefined, files: readonly SngFile[]): Picture | undefined => {
  const album = ALBUM.flatMap((name) => files.filter((file) => file.name.toLowerCase() === name));
  const sources = [
    ...(override === undefined ? [] : [{ source: `${override.name} (the override)`, bytes: override.bytes }]),
    ...album.map((file) => ({ source: `${file.name} from the .sng`, bytes: file.bytes })),
  ];
  return sources.flatMap(({ source, bytes }) => {
    const type = imageType(bytes);
    return type === undefined ? [] : [{ source, type, bytes }];
  })[0];
};

const pictureLog = (picture: Picture | undefined): string =>
  picture === undefined
    ? 'picture: none, the game shows a plain card'
    : `picture: ${picture.source}, a ${picture.type === 'jpg' ? 'JPEG' : 'PNG'} picture`;

/** The chart reader of the model: notes.mid when it exists, else notes.chart. */
const readFacts = (id: string, files: readonly SngFile[], metadata: ReadonlyMap<string, string>) => {
  const bytesOf = (name: string) => files.find((file) => file.name === name)?.bytes;
  const chart = bytesOf('notes.chart');
  const meta = {
    id,
    name: metadata.get('name') ?? '',
    artist: metadata.get('artist') ?? '',
    charter: metadata.get('charter') ?? '',
    delay: Number(metadata.get('delay') ?? 0) || 0,
  };
  const mid = bytesOf('notes.mid');
  return readSongChart({ ...(mid && { mid }), ...(chart && { chart: utf8.decode(chart) }) }, meta);
};

/** Plans one song from the bytes of its `.sng` file and its overrides: the picture and the grid (./grid.ts). */
export const planSong = (id: string, sng: Uint8Array, { picture: override, grid }: Overrides): PlanResult => {
  let container: Sng;
  try {
    container = readSng(sng);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const facts = readFacts(id, container.files, container.metadata);
  if (!facts.ok) {
    return facts;
  }
  const { mix, log } = pickMix(container.files);
  if (mix.length === 0) {
    return { ok: false, reason: 'The .sng file has no audio part to mix.' };
  }
  const picture = pickPicture(override, container.files);
  const audioLog = `audio: ${mix.map((file) => file.name).join(', ')}`;
  const beats = grid === undefined ? facts.facts.beats : steadyBeats(grid, facts.facts.beats.at(-1)?.t ?? 0);
  const gridLog =
    grid === undefined ? [] : [`grid: the override, ${String(grid.bpm)} BPM, a downbeat at ${String(grid.downbeat)} s`];
  return {
    ok: true,
    plan: { facts: { ...facts.facts, beats }, mix, picture, log: [audioLog, ...log, pictureLog(picture), ...gridLog] },
  };
};
