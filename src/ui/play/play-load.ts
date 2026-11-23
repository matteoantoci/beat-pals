// The load of a play: it reads and decrypts the song files, makes the child chart, decodes the song and the 15 pal
// pictures, makes the stage, and then starts the play loop. A screen that closes during the load stops it, and the
// load frees each part that it made. Only one play exists at a time, so the running play is the state of this module.
// The play handle guards each call: a handle of a replaced play changes nothing.

import { childChart, playSetup, readFacts } from '../../model';
import { progressOf } from '../../shell/save';
import { loadSoundOn } from '../../shell/settings';
import { readSongFiles } from '../../shell/songs';
import { loadSong } from '../../sound';
import { decodePals } from '../pals/pal-svg';
import { layout, type Geometry } from './geometry';
import { makePals, type Pals } from './pals';
import { startPlayLoop, type PlayLoop, type PlayLoopParts } from './play-loop';
import { createStage, type Stage } from './stage';
import { makeView } from './view';
import type { SongFacts } from '../../model';
import type { SongFiles } from '../../shell/songs';
import type { SongEvents } from '../../sound';
import type { SongChoice } from '../songs/SongList';

export type PlayElements = {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** An element with the safe-area insets as its padding. */
  readonly probe: HTMLElement;
  /** Pip, Dot, and Bo. */
  readonly pals: readonly HTMLImageElement[];
  readonly beads: readonly HTMLElement[];
};

export type PlayHooks = {
  /** The play paused itself (hidden page, stopped audio, still clock): show the pause screen. */
  readonly onPause: () => void;
  /** The song ended (the hit ratio), or the play ended from the pause screen or could not start (null). */
  readonly onEnd: (result: number | null) => void;
};

/** The controls of a play for the play screen. */
export type PlayHandle = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly quit: () => void;
  /** Frees the play with no end call, when the screen closes. */
  readonly stop: () => void;
};

type Loaded = Omit<PlayLoopParts, 'root' | 'beads' | 'onPause' | 'onEnd'> & { readonly unresize: () => void };

/** The number of the play that may run. A load of an older play frees what it made. */
let current = 0;
let running: (Loaded & { readonly loop: PlayLoop }) | undefined;

const px = (value: string): number => Number.parseFloat(value) || 0;

/** The safe-area insets come from the padding of the probe, which CSS sets to env(safe-area-inset-*). */
export const measure = ({ root, probe }: Pick<PlayElements, 'root' | 'probe'>): Geometry => {
  const style = getComputedStyle(probe);
  return layout(root.clientWidth, root.clientHeight, {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  });
};

const stopRunning = (): void => {
  running?.loop.stop();
  running?.unresize();
  running?.stage.destroy();
  running?.song.release();
  running = undefined;
};

/** The song paused itself before each of these calls (a stopped audio context, or a tap that replaced it): the
 * play pauses too. */
const SONG_EVENTS: SongEvents = {
  onReplaced: () => running?.loop.pause(),
  onInterrupted: () => running?.loop.pause(),
};

const factsOf = (files: SongFiles | undefined): SongFacts | undefined =>
  files === undefined ? undefined : readFacts(files.factsJson);

/** A turn of the device paints the stage again for the new size. */
const watchResize = (
  elements: PlayElements,
  stage: Stage,
  pals: Pals
): { geometry: () => Geometry; unresize: () => void } => {
  let geometry = measure(elements);
  pals.layout(geometry);
  const onResize = (): void => {
    geometry = measure(elements);
    stage.resize(geometry);
    pals.layout(geometry);
  };
  window.addEventListener('resize', onResize);
  return { geometry: () => geometry, unresize: () => window.removeEventListener('resize', onResize) };
};

const load = async (elements: PlayElements, choice: SongChoice, id: number): Promise<Loaded | undefined> => {
  const files = await readSongFiles(choice.key, choice.song);
  const facts = factsOf(files);
  if (files === undefined || facts === undefined || id !== current) {
    return undefined;
  }
  const { color, step } = playSetup(progressOf(choice.song.id));
  const chart = childChart(facts, color, step);
  const song = await loadSong(files.audio, SONG_EVENTS, loadSoundOn());
  await decodePals();
  const stage = id === current ? await createStage(elements.canvas, measure(elements), chart.band) : undefined;
  if (stage === undefined || id !== current) {
    stage?.destroy();
    song.release();
    return undefined;
  }
  const pals = makePals(elements.pals, chart.band, facts.beats);
  return { chart, song, stage, pals, view: makeView(chart, facts.beats), ...watchResize(elements, stage, pals) };
};

/** Loads the song of the choice and starts its play at the record color and speed step of its progress. */
export const loadPlay = (elements: PlayElements, choice: SongChoice, hooks: PlayHooks): PlayHandle => {
  stopRunning();
  current += 1;
  const id = current;
  const end = (result: number | null): void => {
    stopRunning();
    hooks.onEnd(result);
  };
  const started = (loaded: Loaded | undefined): void => {
    if (id !== current) {
      return;
    }
    if (loaded === undefined) {
      hooks.onEnd(null);
      return;
    }
    const { root, beads } = elements;
    running = { ...loaded, loop: startPlayLoop({ ...loaded, root, beads, onPause: hooks.onPause, onEnd: end }) };
  };
  load(elements, choice, id).then(started, () => started(undefined));
  const mine = (action: () => void) => (): void => {
    if (id === current) {
      action();
    }
  };
  return {
    pause: mine(() => running?.loop.pause()),
    resume: mine(() => running?.loop.resume()),
    quit: mine(() => running?.loop.quit()),
    stop: mine(() => {
      stopRunning();
      current += 1;
    }),
  };
};
