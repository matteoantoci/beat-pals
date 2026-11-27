// The lifetime of a play, from the request to the free. An adapter makes the parts and starts the play: the live
// adapter (live-play.ts) loads and decodes the song, and the frozen adapter of the demo route draws one frozen frame.
// Only one play exists at a time: a new play frees the play before it. The stale rule is the same at each step: a
// play is current until a newer play replaces it or it closes. Each part that the load makes goes through `keep`, and
// `close` is the one free path: it frees the kept parts in the reverse order. A part that a step makes after the play
// stopped being current is freed at once, for example the song that a decode gives after the screen closed.

import type { LoadPhase } from '../../model';
import type { LoadProblemKind } from '../../shell/load-notes';

/** The end of a play: the score at the end of the song, a load that failed, or Home on the pause screen. */
export type PlayResult =
  | { readonly kind: 'score'; readonly score: number }
  | { readonly kind: 'failed' }
  | { readonly kind: 'home' };

/** A load that failed, with the reason for the parent area. */
export type LoadFailure = { readonly problem: LoadProblemKind };

export const isFailure = (value: unknown): value is LoadFailure =>
  typeof value === 'object' && value !== null && 'problem' in value;

/** What the adapter of a play uses during the load. */
export type PlayScope = {
  /** False when a newer play replaced this play, or the play closed. */
  readonly live: () => boolean;
  /** Keeps a part of the play with the function that frees it. When the play is not current, the part is freed at
   * once, and the answer is false. */
  readonly keep: (free: () => void) => boolean;
  /** The load moved on: the fill ring follows it while the play is current. */
  readonly progress: (phase: LoadPhase) => void;
  /** Pauses the play after its start, for example when the song paused itself. */
  readonly pause: () => void;
};

/** What a started play calls. */
export type PlayCalls = {
  /** The play paused itself (hidden page, stopped audio, still clock). */
  readonly onPause: () => void;
  /** The song ended (the score), or the play ended from the pause screen (null). */
  readonly onEnd: (score: number | null) => void;
};

type PlayControls = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly quit: () => void;
};

/** A started play: its controls, and the function that stops it with no end call. */
export type StartedPlay = PlayControls & { readonly stop: () => void };

export type PlayAdapter<Parts> = {
  /** Makes the parts of the play. Each part that needs a free goes through `scope.keep`. Gives undefined when the
   * play is not current. */
  readonly load: (scope: PlayScope) => Promise<Parts | LoadFailure | undefined>;
  /** Starts the play with its parts. */
  readonly start: (parts: Parts, calls: PlayCalls) => StartedPlay;
};

export type PlayHooks = Pick<PlayCalls, 'onPause'> & {
  /** The load moved on: the fill ring follows it. */
  readonly onLoad: (phase: LoadPhase) => void;
  /** The load is done. The play starts when the promise resolves, after the load scene closes. */
  readonly onLoaded: () => Promise<void>;
  /** The play started. */
  readonly onStarted: () => void;
  /** The load failed. */
  readonly onFail: (failure: LoadFailure) => void;
  /** The song ended (a score), or the play ended from the pause screen (Home). */
  readonly onEnd: (result: PlayResult) => void;
};

/** The controls of a play for its screen. Each call of a play that is not current does nothing. */
export type Play = PlayControls & {
  /** Frees the play with no end call, when the screen closes. */
  readonly dispose: () => void;
};

/** One play: its number, its hooks, and the kept parts with their free functions. */
type Life = {
  readonly id: number;
  readonly hooks: PlayHooks;
  readonly kept: (() => void)[];
};

const OTHER: LoadFailure = { problem: 'other' };

/** The number of the current play. */
let current = 0;
let currentLife: Life | undefined;
/** The started play of the current play. */
let started: StartedPlay | undefined;

/** The stale rule: a play is current until a newer play replaces it or it closes. */
const live = (life: Life): boolean => life.id === current;

/** The started play of `life`, while it is current. */
const startedOf = (life: Life): StartedPlay | undefined => (live(life) ? started : undefined);

/** The one free path: the play stops being current, and its kept parts are freed in the reverse order. */
const close = (life: Life): void => {
  if (live(life)) {
    current += 1;
    started = undefined;
  }
  for (const free of life.kept.splice(0).toReversed()) {
    free();
  }
};

const keep = (life: Life, free: () => void): boolean => {
  if (live(life)) {
    life.kept.push(free);
    return true;
  }
  free();
  return false;
};

/** A play that is current gives its failure; a play that is not current only frees what it kept. */
const fail = (life: Life, failure: LoadFailure): void => {
  const wasLive = live(life);
  close(life);
  if (wasLive) {
    life.hooks.onFail(failure);
  }
};

const scopeOf = (life: Life): PlayScope => ({
  live: () => live(life),
  keep: (free) => keep(life, free),
  progress: (phase) => live(life) && life.hooks.onLoad(phase),
  pause: () => startedOf(life)?.pause(),
});

/** The end of a started play frees it before the end hook. */
const callsOf = (life: Life): PlayCalls => ({
  onPause: life.hooks.onPause,
  onEnd: (score) => {
    close(life);
    life.hooks.onEnd(score === null ? { kind: 'home' } : { kind: 'score', score });
  },
});

/** Starts the play when its load is done and the load scene closed, if the play is still current. */
const start = async <Parts>(
  life: Life,
  adapter: PlayAdapter<Parts>,
  loaded: Parts | LoadFailure | undefined
): Promise<void> => {
  if (loaded === undefined || isFailure(loaded)) {
    fail(life, isFailure(loaded) ? loaded : OTHER);
    return;
  }
  await life.hooks.onLoaded();
  if (!live(life)) {
    return;
  }
  const play = adapter.start(loaded, callsOf(life));
  if (keep(life, play.stop)) {
    started = play;
  }
  life.hooks.onStarted();
};

/** Creates the play of an adapter: it frees the play before it, loads the parts, waits for `onLoaded`, and starts the
 * play. */
export const createPlay = <Parts>(adapter: PlayAdapter<Parts>, hooks: PlayHooks): Play => {
  if (currentLife !== undefined) {
    close(currentLife);
  }
  current += 1;
  const life: Life = { id: current, hooks, kept: [] };
  currentLife = life;
  adapter
    .load(scopeOf(life))
    .then((loaded) => start(life, adapter, loaded))
    .catch(() => fail(life, OTHER));
  return {
    pause: () => startedOf(life)?.pause(),
    resume: () => startedOf(life)?.resume(),
    quit: () => startedOf(life)?.quit(),
    dispose: () => close(life),
  };
};
