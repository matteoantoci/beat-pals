// The steps of a song load for the live play (live-play.ts): read and decrypt the song files with the ring on their
// bytes, make the child chart, decode the song with the ring at the predicted speed, decode the 18 pal pictures, and
// make the stage. A failed step gives its reason for the parent area. Each part goes to the play lifetime
// (play-load.ts) at once, so a play that closed during a step frees the part when the step ends. The ports do the
// work of the browser, so a test can give fakes.

import { childChart, decodeTime, nextDecodeRate, playSetup, readFacts, startPlay } from '../../model';
import { isFailure, type LoadFailure, type PlayScope } from './play-load';
import { makeView } from './view';
import type { Lane, SongFacts } from '../../model';
import type { LoadProblemKind } from '../../shell/load-notes';
import type { SongFiles } from '../../shell/songs';
import type { DeviceStorage } from '../../shell/storage';
import type { Song, SongEvents } from '../../sound';
import type { SongChoice } from '../songs/SongList';
import type { Geometry } from './geometry';
import type { Pals } from './pals';
import type { PlayLoopParts } from './play-loop';
import type { Stage } from './stage';

/** The parts of the play loop that the load makes. */
export type LiveParts = Omit<PlayLoopParts, 'root' | 'beads' | 'onPause' | 'onEnd'>;

/** The pals in their places, and the watch of the screen size. */
type Arranged = {
  readonly pals: Pals;
  readonly geometry: () => Geometry;
  readonly unresize: () => void;
};

/** The steps of the stage: the same for the live play and for the frozen play of the demo route. */
export type StagePorts = {
  /** Decodes the pal pictures. */
  readonly pictures: () => Promise<void>;
  readonly stage: (band: readonly Lane[]) => Promise<Stage>;
  readonly arrange: (stage: Stage, band: readonly Lane[], beats: SongFacts['beats']) => Arranged;
};

export type LivePorts = StagePorts & {
  readonly readFiles: (choice: SongChoice, onBytes: (count: number) => void) => Promise<SongFiles | LoadFailure>;
  readonly decode: (audio: ArrayBuffer, events: SongEvents, effects: boolean) => Promise<Song>;
};

export type LoadRequest = {
  readonly choice: SongChoice;
  /** The progress of the song, the Sound effects switch, and the decode rate of the device. */
  readonly storage: DeviceStorage;
};

type Step = { readonly request: LoadRequest; readonly ports: LivePorts; readonly scope: PlayScope };

const STAGE_STEPS = 2;

const failure = (problem: LoadProblemKind): LoadFailure => ({ problem });

/** The song files, with the ring on their encrypted bytes. */
const readFiles = ({ request: { choice }, ports, scope }: Step): Promise<SongFiles | LoadFailure> => {
  const total = choice.song.size;
  let bytes = 0;
  scope.progress({ step: 'read', bytes, total });
  return ports.readFiles(choice, (count) => {
    bytes += count;
    scope.progress({ step: 'read', bytes, total });
  });
};

/** Decodes the audio while the ring moves at the predicted speed, and learns the decode rate of the device. A
 * paused song pauses the play. */
const decodeSong = async (
  { request: { storage }, ports, scope }: Step,
  audio: ArrayBuffer
): Promise<Song | LoadFailure> => {
  const bytes = audio.byteLength;
  const rate = storage.decodeRate.get();
  const startedAt = performance.now();
  scope.progress({ step: 'decode', startedAt, predictedMs: decodeTime(bytes, rate) });
  try {
    const song = await ports.decode(
      audio,
      { onReplaced: scope.pause, onInterrupted: scope.pause },
      storage.sound.get()
    );
    storage.decodeRate.set(nextDecodeRate(rate, bytes, performance.now() - startedAt));
    return song;
  } catch {
    return failure('audio');
  }
};

/** The pal pictures and the stage, or undefined when the play is not current. */
const buildStage = async ({ ports, scope }: Step, band: readonly Lane[]): Promise<Stage | LoadFailure | undefined> => {
  scope.progress({ step: 'stage', done: 0, steps: STAGE_STEPS });
  await ports.pictures();
  scope.progress({ step: 'stage', done: 1, steps: STAGE_STEPS });
  if (!scope.live()) {
    return undefined;
  }
  const stage = await ports.stage(band).catch(() => failure('stage'));
  if (isFailure(stage) || !scope.keep(stage.destroy)) {
    return isFailure(stage) ? stage : undefined;
  }
  scope.progress({ step: 'stage', done: STAGE_STEPS, steps: STAGE_STEPS });
  return stage;
};

/** The parts of the play, a failure, or undefined when the play is not current. */
export const loadParts = async (
  request: LoadRequest,
  ports: LivePorts,
  scope: PlayScope
): Promise<LiveParts | LoadFailure | undefined> => {
  const step: Step = { request, ports, scope };
  const files = await readFiles(step);
  if (isFailure(files)) {
    return files;
  }
  const facts = readFacts(files.factsJson);
  if (facts === undefined) {
    return failure('facts');
  }
  if (!scope.live()) {
    return undefined;
  }
  const setup = playSetup(request.storage.save.progressOf(request.choice.song.id));
  const chart = childChart(facts, setup);
  const song = await decodeSong(step, files.audio);
  // The check right after the decode: a play that closed during the decode frees the song at once.
  if (isFailure(song) || !scope.keep(song.release)) {
    return isFailure(song) ? song : undefined;
  }
  const stage = await buildStage(step, chart.band);
  if (stage === undefined || isFailure(stage)) {
    return stage;
  }
  const { pals, geometry, unresize } = ports.arrange(stage, chart.band, facts.beats);
  scope.keep(unresize);
  return { start: startPlay(chart, setup.emptyTaps), song, stage, pals, view: makeView(chart, facts.beats), geometry };
};
