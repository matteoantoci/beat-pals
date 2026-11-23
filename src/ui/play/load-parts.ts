// The steps of a song load (play-load.ts): read and decrypt the song files with the ring on their bytes, make the
// child chart, decode the song with the ring at the predicted speed, decode the 18 pal pictures, and make the stage.
// A failed step gives its reason for the parent area. A load that a newer load replaced frees each part that it
// made and gives undefined.

import { childChart, decodeTime, nextDecodeRate, playSetup, readFacts } from '../../model';
import { loadDecodeRate, storeDecodeRate, type LoadProblemKind } from '../../shell/load-notes';
import { progressOf } from '../../shell/save';
import { loadSoundOn } from '../../shell/settings';
import { readSongFiles } from '../../shell/songs';
import { loadSong } from '../../sound';
import { decodePals } from '../pals/pal-svg';
import { measure, watchResize, type PlayElements } from './fit';
import { makePals } from './pals';
import { createStage, type Stage } from './stage';
import { makeView } from './view';
import type { Lane, LoadPhase } from '../../model';
import type { SongFiles } from '../../shell/songs';
import type { Song, SongEvents } from '../../sound';
import type { SongChoice } from '../songs/SongList';
import type { PlayLoopParts } from './play-loop';

export type Loaded = Omit<PlayLoopParts, 'root' | 'beads' | 'onPause' | 'onEnd'> & { readonly unresize: () => void };

/** A load that failed, with the reason for the parent area. */
export type LoadFailure = { readonly problem: LoadProblemKind };

export type LoadRequest = {
  readonly elements: PlayElements;
  readonly choice: SongChoice;
  /** False when a newer load replaced this one, or the screen closed. */
  readonly live: () => boolean;
  readonly onLoad: (phase: LoadPhase) => void;
  readonly songEvents: SongEvents;
};

const STAGE_STEPS = 2;

export const isFailure = (value: unknown): value is LoadFailure =>
  typeof value === 'object' && value !== null && 'problem' in value;

const failure = (problem: LoadProblemKind): LoadFailure => ({ problem });

/** Frees the parts of a load. */
export const free = (loaded: Loaded): void => {
  loaded.unresize();
  loaded.stage.destroy();
  loaded.song.release();
};

/** The song files, with the ring on their encrypted bytes. */
const readFiles = async ({ choice, onLoad }: LoadRequest): Promise<SongFiles | LoadFailure> => {
  const total = choice.song.size;
  let bytes = 0;
  onLoad({ step: 'read', bytes, total });
  const read = await readSongFiles(choice.key, choice.song, (count) => {
    bytes += count;
    onLoad({ step: 'read', bytes, total });
  });
  return read.ok ? read.files : failure(read.problem);
};

/** Decodes the audio while the ring moves at the predicted speed, and learns the decode rate of the device. */
const decodeSong = async ({ onLoad, songEvents }: LoadRequest, audio: ArrayBuffer): Promise<Song | LoadFailure> => {
  const bytes = audio.byteLength;
  const rate = loadDecodeRate();
  const startedAt = performance.now();
  onLoad({ step: 'decode', startedAt, predictedMs: decodeTime(bytes, rate) });
  try {
    const song = await loadSong(audio, songEvents, loadSoundOn());
    storeDecodeRate(nextDecodeRate(rate, bytes, performance.now() - startedAt));
    return song;
  } catch {
    return failure('audio');
  }
};

const makeStage = async ({ elements }: LoadRequest, band: readonly Lane[]): Promise<Stage | LoadFailure> => {
  try {
    return await createStage(elements.canvas, measure(elements), band);
  } catch {
    return failure('stage');
  }
};

/** The pal pictures and the stage. When a step fails or the load was replaced, the song and the stage are freed. */
const buildStage = async (
  request: LoadRequest,
  band: readonly Lane[],
  song: Song
): Promise<Stage | LoadFailure | undefined> => {
  request.onLoad({ step: 'stage', done: 0, steps: STAGE_STEPS });
  await decodePals();
  request.onLoad({ step: 'stage', done: 1, steps: STAGE_STEPS });
  const stage = request.live() ? await makeStage(request, band) : undefined;
  if (stage !== undefined && !isFailure(stage) && request.live()) {
    request.onLoad({ step: 'stage', done: STAGE_STEPS, steps: STAGE_STEPS });
    return stage;
  }
  song.release();
  if (stage !== undefined && !isFailure(stage)) {
    stage.destroy();
    return undefined;
  }
  return stage;
};

/** The parts of the play, a failure, or undefined when the load was replaced. */
export const loadParts = async (request: LoadRequest): Promise<Loaded | LoadFailure | undefined> => {
  const files = await readFiles(request);
  if (isFailure(files)) {
    return files;
  }
  const facts = readFacts(files.factsJson);
  if (facts === undefined) {
    return failure('facts');
  }
  if (!request.live()) {
    return undefined;
  }
  const { color, step } = playSetup(progressOf(request.choice.song.id));
  const chart = childChart(facts, color, step);
  const song = await decodeSong(request, files.audio);
  if (isFailure(song)) {
    return song;
  }
  const stage = await buildStage(request, chart.band, song);
  if (stage === undefined || isFailure(stage)) {
    return stage;
  }
  const { elements } = request;
  const pals = makePals(elements.pals, chart.band, facts.beats);
  return { chart, song, stage, pals, view: makeView(chart, facts.beats), ...watchResize(elements, { stage, pals }) };
};
