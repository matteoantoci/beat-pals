// The play loop of the running play: the frames, the taps, the pause, and the end. Each frame and each tap read the
// guarded song clock of the sound module, so the notes, the judgment, and the music share one time (spec, "Sound and
// the audio clock"). The play model judges; the view, the stage, and the pals only show.
// Only one play runs at a time, so the state of that play is the state of this module (as in src/sound/song.ts).

import { apply, firstNoteTime, result } from '../../model';
import { watchLifecycle } from '../../shell/lifecycle';
import { keepScreenOn } from '../../shell/wake-lock';
import { fillBeads, fullBeads } from './beads';
import { makeEnergyTrack } from './energy';
import { actionTime, follow, type Followers } from './follow';
import { reducedMotion } from './reduced-motion';
import { watchTaps } from './taps';
import type { Action, PlayEvent, PlayState } from '../../model';
import type { Song } from '../../sound';
import type { Geometry } from './geometry';
import type { Pals } from './pals';
import type { PlayCalls, StartedPlay } from './play-load';
import type { Stage } from './stage';
import type { LiveView } from './view';

/** A clock that does not move for this long while the song should play needs a tap (an audio context that does not
 * run): the play pauses, and the play button gives that tap. */
const STALL_MS = 1000;
/** What the play loop draws, plays, and calls. */
export type PlayLoopParts = PlayCalls & {
  readonly root: HTMLElement;
  readonly beads: readonly HTMLElement[];
  readonly start: PlayState;
  readonly song: Song;
  readonly stage: Stage;
  readonly pals: Pals;
  readonly view: LiveView;
  readonly geometry: () => Geometry;
};

const nothing = (): void => undefined;
const NO_EVENTS: readonly PlayEvent[] = [];

let play: PlayState | undefined;
/** The pointers that are down in a lane. */
const down = new Set<number>();
let running = false;
let frameId = 0;
let lastT = Number.NaN;
let stillSince = 0;
let beadsFull = -1;
let sleep = nothing;
let unwatch = nothing;
let energy = makeEnergyTrack();
let followers: Followers | undefined;
let tick: FrameRequestCallback = nothing;
/** The advance action of each frame: the model only reads it, so each frame fills in the same object (C20). */
const advance = { type: 'advance' as const, t: 0 };

/** Shows one event at song time `t`: a hop of a waiting pal, or the sound of a hit. */
const showEvent = (parts: PlayLoopParts, event: PlayEvent, t: number): void => {
  if (event.type === 'hop') {
    parts.pals.hop(event.lane, t);
  } else if (event.type === 'hit') {
    parts.song.clap(event.soundAt, event.grade === 'great');
    parts.root.setAttribute('data-last-hit', `${String(event.lane)} ${event.grade} ${t.toFixed(3)}`);
  }
};

/** Applies an action to the play, and shows its events: the hops, the hit sounds, and through `follow` the view and
 * the band energy (a step up plays its level-up sound). `faded` has no picture: a missed note only fades. */
const act = (parts: PlayLoopParts, action: Action): void => {
  const outcome = play === undefined ? undefined : apply(play, action);
  const events = outcome?.events ?? NO_EVENTS;
  play = outcome?.state;
  if (followers) {
    follow(followers, action, events);
  }
  for (const event of events) {
    showEvent(parts, event, actionTime(action));
  }
};

/** Stops the loop and the song, and lets go of each finger. */
const halt = (parts: PlayLoopParts): void => {
  const t = parts.song.songTime();
  running = false;
  cancelAnimationFrame(frameId);
  sleep();
  sleep = nothing;
  parts.song.pause();
  for (const pointerId of down) {
    act(parts, { type: 'release', t, pointerId });
  }
  down.clear();
};

const finish = (parts: PlayLoopParts, value: number | null): void => {
  halt(parts);
  unwatch();
  unwatch = nothing;
  parts.onEnd(value);
};

const pause = (parts: PlayLoopParts): void => {
  if (running) {
    halt(parts);
    parts.onPause();
  }
};

const drawBeads = (parts: PlayLoopParts, t: number): void => {
  const full = fullBeads(t, parts.song.duration);
  if (full !== beadsFull) {
    beadsFull = full;
    fillBeads(parts.beads, full);
  }
};

/** True when the clock stood still too long. */
const stalled = (t: number, now: number): boolean => {
  stillSince = t === lastT ? stillSince : now;
  lastT = t;
  return now - stillSince > STALL_MS;
};

const frame = (parts: PlayLoopParts, now: number): void => {
  const t = parts.song.songTime();
  if (t >= parts.song.duration) {
    finish(parts, play === undefined ? null : result(play));
    return;
  }
  if (stalled(t, now)) {
    pause(parts);
    return;
  }
  advance.t = t;
  act(parts, advance);
  const view = parts.view.view();
  const look = energy.at(t);
  parts.stage.draw(view, reducedMotion(), look);
  parts.pals.update(view, reducedMotion(), look);
  drawBeads(parts, t);
  frameId = requestAnimationFrame(tick);
};

const run = (parts: PlayLoopParts): void => {
  running = true;
  stillSince = performance.now();
  sleep = keepScreenOn();
  tick = (now) => frame(parts, now);
  frameId = requestAnimationFrame(tick);
};

/** The taps go to the model only while the play runs. The play pauses when the page hides (the app root writes the
 * save then); iOS also stops the audio context then, and the song pauses itself for that. */
const listen = (parts: PlayLoopParts): (() => void) => {
  const time = (): number => parts.song.songTime();
  const unwatchTaps = watchTaps(parts.root, {
    geometry: () => (running ? parts.geometry() : undefined),
    press: (lane, pointerId) => {
      down.add(pointerId);
      act(parts, { type: 'press', t: time(), lane, pointerId });
    },
    release: (pointerId) => {
      if (down.delete(pointerId)) {
        act(parts, { type: 'release', t: time(), pointerId });
      }
    },
  });
  const unwatchLifecycle = watchLifecycle({ hidden: () => pause(parts), visible: nothing });
  return () => {
    unwatchTaps();
    unwatchLifecycle();
  };
};

/** Starts the song and the play. `stop` stops everything with no end call, for example when the screen closes. */
export const startPlayLoop = (parts: PlayLoopParts): StartedPlay => {
  play = parts.start;
  down.clear();
  beadsFull = -1;
  energy = makeEnergyTrack();
  followers = { view: parts.view, energy, stepUp: parts.song.levelUp, starMoment: parts.song.starMoment };
  lastT = Number.NaN;
  unwatch = listen(parts);
  parts.song.start(firstNoteTime(parts.start));
  run(parts);
  return {
    pause: () => pause(parts),
    resume: () => {
      if (!running && play !== undefined) {
        parts.song.resume();
        run(parts);
      }
    },
    quit: () => {
      act(parts, { type: 'quit' });
      finish(parts, null);
    },
    stop: () => {
      halt(parts);
      unwatch();
      unwatch = nothing;
      play = undefined;
    },
  };
};
