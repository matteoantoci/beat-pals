// The load of a play (load-parts.ts has the steps): it loads the parts with progress for the fill ring of the load
// scene, waits for the scene to close, and then starts the play loop. A failed load keeps its reason for the parent
// area. A screen that closes during the load stops it, and the parts are freed. Only one play exists at a time, so
// the running play is the state of this module. The play handle guards each call: a handle of a replaced play
// changes nothing.

import { storeLoadProblem } from '../../shell/load-notes';
import { free, isFailure, loadParts, type Loaded, type LoadFailure } from './load-parts';
import { startPlayLoop, type PlayLoop } from './play-loop';
import type { LoadPhase } from '../../model';
import type { SongEvents } from '../../sound';
import type { SongChoice } from '../songs/SongList';
import type { PlayElements } from './fit';

export type PlayHooks = {
  /** The play paused itself (hidden page, stopped audio, still clock): show the pause screen. */
  readonly onPause: () => void;
  /** The song ended (the hit ratio), or the play ended from the pause screen (null). */
  readonly onEnd: (result: number | null) => void;
  /** The load moved on: the fill ring follows it. */
  readonly onLoad: (phase: LoadPhase) => void;
  /** The load is done. The play starts when the promise resolves, after the load scene closes. */
  readonly onLoaded: () => Promise<void>;
  /** The load failed, and its reason is kept for the parent area. */
  readonly onFail: () => void;
};

/** The controls of a play for the play screen. */
export type PlayHandle = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly quit: () => void;
  /** Frees the play with no end call, when the screen closes. */
  readonly stop: () => void;
};

/** The number of the play that may run. A load of an older play frees what it made. */
let current = 0;
let running: (Loaded & { readonly loop: PlayLoop }) | undefined;

const stopRunning = (): void => {
  running?.loop.stop();
  if (running !== undefined) {
    free(running);
  }
  running = undefined;
};

/** The song paused itself before each of these calls (a stopped audio context, or a tap that replaced it): the
 * play pauses too. */
const SONG_EVENTS: SongEvents = {
  onReplaced: () => running?.loop.pause(),
  onInterrupted: () => running?.loop.pause(),
};

type AfterLoad = {
  readonly start: (result: Loaded | LoadFailure | undefined) => Promise<void>;
  readonly fail: (failure: LoadFailure) => void;
};

/** What happens at the end of the load of play `id`: the play starts, or the failure shows. */
const afterLoad = (id: number, elements: PlayElements, hooks: PlayHooks): AfterLoad => {
  const end = (result: number | null): void => {
    stopRunning();
    hooks.onEnd(result);
  };
  const fail = ({ problem }: LoadFailure): void => {
    if (id === current) {
      storeLoadProblem(problem);
      hooks.onFail();
    }
  };
  const start = async (result: Loaded | LoadFailure | undefined): Promise<void> => {
    if (result === undefined) {
      return;
    }
    if (isFailure(result)) {
      fail(result);
      return;
    }
    await hooks.onLoaded();
    if (id !== current) {
      free(result);
      return;
    }
    const { root, beads } = elements;
    running = { ...result, loop: startPlayLoop({ ...result, root, beads, onPause: hooks.onPause, onEnd: end }) };
  };
  return { start, fail };
};

/** Loads the song of the choice and starts its play at the record color and speed step of its progress. */
export const loadPlay = (elements: PlayElements, choice: SongChoice, hooks: PlayHooks): PlayHandle => {
  stopRunning();
  current += 1;
  const id = current;
  const live = (): boolean => id === current;
  const onLoad = (phase: LoadPhase): void => {
    if (live()) {
      hooks.onLoad(phase);
    }
  };
  const { start, fail } = afterLoad(id, elements, hooks);
  loadParts({ elements, choice, live, onLoad, songEvents: SONG_EVENTS })
    .then(start)
    .catch(() => fail({ problem: 'other' }));
  const mine = (action: () => void) => (): void => {
    if (live()) {
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
