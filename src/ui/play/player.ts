// The running play: the frame loop, the taps, the pause, and the end. Each frame and each tap read the guarded song
// clock of the sound module, so the notes, the judgment, and the music share one time (spec, "Sound and the audio
// clock"). The play model judges; the view, the stage, and the pals only show.
// Only one play runs at a time, so the state of that play is the state of this module (as in src/sound/song.ts).

import { apply, result, startPlay } from '../../model';
import { watchLifecycle } from '../../shell/lifecycle';
import { keepScreenOn } from '../../shell/wake-lock';
import { watchTaps } from './taps';
import type { Action, ChildChart, PlayEvent, PlayState } from '../../model';
import type { Song } from '../../sound';
import type { Geometry } from './geometry';
import type { Pals } from './pals';
import type { Stage } from './stage';
import type { LiveView } from './view';

/** A clock that does not move for this long while the song should play needs a tap (an audio context that does not
 * run): the play pauses, and the play button gives that tap. */
const STALL_MS = 1000;
const BEADS = 10;

export type PlayerParts = {
  readonly root: HTMLElement;
  readonly beads: readonly HTMLElement[];
  readonly chart: ChildChart;
  readonly song: Song;
  readonly stage: Stage;
  readonly pals: Pals;
  readonly view: LiveView;
  readonly geometry: () => Geometry;
  /** The play paused itself: show the pause screen. */
  readonly onPause: () => void;
  /** The song ended (the hit ratio) or the play ended from the pause screen (null). */
  readonly onEnd: (result: number | null) => void;
};

export type Player = {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly quit: () => void;
  /** Stops everything with no end call, for example when the screen closes. */
  readonly stop: () => void;
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const nothing = (): void => undefined;

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

const show = (parts: PlayerParts, events: readonly PlayEvent[], t: number): void => {
  // `energy`, `faded`, and `holdDone` have no picture at bronze.
  for (const event of events.filter((each) => each.type === 'hop')) {
    parts.pals.hop(event.lane, t);
  }
  for (const event of events.filter((each) => each.type === 'hit')) {
    parts.view.record(event, t);
    parts.song.clap(event.soundAt);
    parts.root.setAttribute('data-last-hit', `${String(event.lane)} ${event.grade} ${t.toFixed(3)}`);
  }
};

const act = (parts: PlayerParts, action: Action, t: number): void => {
  const outcome = play === undefined ? undefined : apply(play, action);
  play = outcome?.state;
  show(parts, outcome?.events ?? [], t);
};

/** Stops the loop and the song, and lets go of each finger. */
const halt = (parts: PlayerParts): void => {
  const t = parts.song.songTime();
  running = false;
  cancelAnimationFrame(frameId);
  sleep();
  sleep = nothing;
  parts.song.pause();
  for (const pointerId of down) {
    act(parts, { type: 'release', t, pointerId }, t);
  }
  down.clear();
};

const finish = (parts: PlayerParts, value: number | null): void => {
  halt(parts);
  unwatch();
  unwatch = nothing;
  parts.onEnd(value);
};

const pause = (parts: PlayerParts): void => {
  if (running) {
    halt(parts);
    parts.onPause();
  }
};

const drawBeads = (parts: PlayerParts, t: number): void => {
  const full = Math.max(0, Math.min(BEADS, Math.floor((t / parts.song.duration) * BEADS)));
  if (full !== beadsFull) {
    beadsFull = full;
    parts.beads.forEach((bead, at) => bead.classList.toggle('full', at < full));
  }
};

/** True when the clock stood still too long. */
const stalled = (t: number, now: number): boolean => {
  stillSince = t === lastT ? stillSince : now;
  lastT = t;
  return now - stillSince > STALL_MS;
};

const frame = (parts: PlayerParts, now: number): void => {
  const t = parts.song.songTime();
  if (t >= parts.song.duration) {
    finish(parts, play === undefined ? null : result(play));
    return;
  }
  if (stalled(t, now)) {
    pause(parts);
    return;
  }
  act(parts, { type: 'advance', t }, t);
  parts.view.update(t);
  parts.stage.draw(parts.view.view(), reducedMotion.matches);
  parts.pals.update(parts.view.view(), reducedMotion.matches);
  drawBeads(parts, t);
  frameId = requestAnimationFrame((next) => frame(parts, next));
};

const run = (parts: PlayerParts): void => {
  running = true;
  stillSince = performance.now();
  sleep = keepScreenOn();
  frameId = requestAnimationFrame((now) => frame(parts, now));
};

/** The taps go to the model only while the play runs. The play pauses when the page hides; iOS also stops the audio
 * context then, and the song pauses itself for that. */
const listen = (parts: PlayerParts): (() => void) => {
  const time = (): number => parts.song.songTime();
  const unwatchTaps = watchTaps(parts.root, {
    geometry: () => (running ? parts.geometry() : undefined),
    press: (lane, pointerId) => {
      down.add(pointerId);
      act(parts, { type: 'press', t: time(), lane, pointerId }, time());
    },
    release: (pointerId) => {
      if (down.delete(pointerId)) {
        act(parts, { type: 'release', t: time(), pointerId }, time());
      }
    },
  });
  const unwatchLifecycle = watchLifecycle({ hidden: () => pause(parts), visible: nothing });
  return () => {
    unwatchTaps();
    unwatchLifecycle();
  };
};

/** Starts the song and the play. */
export const startPlayer = (parts: PlayerParts): Player => {
  play = startPlay(parts.chart);
  down.clear();
  beadsFull = -1;
  lastT = Number.NaN;
  unwatch = listen(parts);
  parts.song.start(parts.chart.notes[0]?.t ?? Number.POSITIVE_INFINITY);
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
      act(parts, { type: 'quit' }, parts.song.songTime());
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
