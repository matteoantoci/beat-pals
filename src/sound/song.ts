// The song handle (spec, "Sound and the audio clock"). One decoded song plays from an AudioBuffer, never from an
// <audio> element, and the guarded song clock gives its time. Pause and resume work across a context replacement.
// Only one song stays in memory, so the state of that song is the state of this module.
import { firstSongTime, songTime, startAt } from '../model';
import { songBoostDb, songMeter } from './boost';
import { levelUpShot, startEffect, type LevelUpStep, type Shot } from './effects';
import { currentContext, decode, onReplaced } from './engine';

/** What the play screen hears from the song. In both cases, the song paused itself before the call. */
export type SongEvents = {
  /** A tap replaced the context while the song played. */
  readonly onReplaced: () => void;
  /** The context stopped running while the song played, for example for a phone call. */
  readonly onInterrupted: () => void;
};

/** One loaded song. After `release`, or after the next `loadSong`, it plays no more. */
export type Song = {
  /** The length of the decoded audio in seconds. The play ends at this song time. */
  readonly duration: number;
  /** Starts the play 0.1 s from now, with the lead-in that the first note of the child chart needs. */
  readonly start: (firstNote: number) => void;
  /** The guarded song time. Read it each frame and at each tap. */
  readonly songTime: () => number;
  /** Saves the song time, stops the audio, and cancels the claps. */
  readonly pause: () => void;
  /** Continues from the saved song time in the current context. */
  readonly resume: () => void;
  /** Plays a clap at a song time, the great clap for a great hit. A past time plays now. The switch turns it off. */
  readonly clap: (at: number, great: boolean) => void;
  /** Plays the level-up sound of an energy step at a song time, as a clap. */
  readonly levelUp: (step: LevelUpStep, at: number) => void;
  /** Cancels the claps that did not play yet. */
  readonly cancelClaps: () => void;
  /** Stops the song and frees its audio. */
  readonly release: () => void;
};

/** The source, its meter, the claps, and t0 of the song in one context. `claps` holds every sound effect that is to
 * come. */
type Session = {
  readonly ctx: AudioContext;
  readonly source: AudioBufferSourceNode;
  readonly meter: AnalyserNode;
  readonly t0: number;
  readonly claps: Set<AudioBufferSourceNode>;
  readonly unwatch: () => void;
};

/** The number of the song in memory. 0 when no song is in memory. */
let current = 0;
let loads = 0;
let buffer: AudioBuffer | undefined;
let events: SongEvents | undefined;
let effectsOn = false; // The Sound effects switch, given with the song.
let started = false;
let session: Session | undefined;
/** The song time while no session plays, and the last read while one plays. */
let frozen = 0;

const readTime = (): number => {
  if (!session) {
    return frozen;
  }
  const { ctx, t0 } = session;
  const stamp = ctx.getOutputTimestamp();
  frozen = songTime(
    { t0, frozen },
    {
      running: ctx.state === 'running',
      contextTime: stamp.contextTime ?? 0,
      performanceTime: stamp.performanceTime ?? 0,
      now: performance.now(),
    }
  );
  return frozen;
};

const cancelClaps = (): void => {
  for (const clap of session?.claps ?? []) {
    clap.stop();
  }
  session?.claps.clear();
};

const pause = (): void => {
  if (!session) {
    return;
  }
  readTime();
  cancelClaps();
  session.source.stop();
  session.unwatch();
  session = undefined;
};

/** Pauses the song when its context stops running, or when a tap replaces the context. Gives the function that
 * ends the watch. */
const watch = (ctx: AudioContext, heard: SongEvents): (() => void) => {
  let running = ctx.state === 'running';
  const onState = (): void => {
    const wasRunning = running;
    running = ctx.state === 'running';
    if (wasRunning && !running) {
      pause();
      heard.onInterrupted();
    }
  };
  ctx.addEventListener('statechange', onState);
  const endReplaced = onReplaced(() => {
    pause();
    heard.onReplaced();
  });
  return () => {
    ctx.removeEventListener('statechange', onState);
    endReplaced();
  };
};

/** Starts a new source in the current context at the song time `from`. */
const play = (from: number): void => {
  if (!buffer || !events || session) {
    return;
  }
  const ctx = currentContext();
  const { t0, when, offset } = startAt(ctx.currentTime, from);
  const source = new AudioBufferSourceNode(ctx, { buffer });
  const meter = songMeter(ctx);
  source.connect(meter);
  source.start(when, offset);
  frozen = from;
  session = { ctx, source, meter, t0, claps: new Set(), unwatch: watch(ctx, events) };
};

/** Plays a sound effect of song number `id` at a song time, when the Sound effects switch is on, with the boost of
 * the song level now. */
const effect = (id: number, shot: Shot, at: number): void => {
  if (id !== current || !session || !effectsOn) {
    return;
  }
  const { ctx, t0, claps, meter } = session;
  const boosted = { ...shot, boostDb: songBoostDb(meter) };
  const source = startEffect(ctx, boosted, Math.max(ctx.currentTime, t0 + at));
  if (!source) {
    return;
  }
  source.addEventListener('ended', () => claps.delete(source));
  claps.add(source);
};

const release = (): void => {
  pause();
  current = 0;
  buffer = undefined;
  events = undefined;
};

/** The handle of song number `id`. Each call does nothing after the song left the memory. */
const handle = (id: number, duration: number): Song => {
  let last = 0;
  const mine = (action: () => void) => (): void => {
    if (id === current) {
      action();
    }
  };
  return {
    duration,
    start: (firstNote) => {
      if (id === current && !started) {
        started = true;
        play(firstSongTime(firstNote));
      }
    },
    songTime: () => {
      last = id === current ? readTime() : last;
      return last;
    },
    pause: mine(pause),
    resume: () => {
      if (id === current && started) {
        play(frozen);
      }
    },
    clap: (at, great) => effect(id, { effect: great ? 'clap-great' : 'clap', rate: 1 }, at),
    levelUp: (step, at) => effect(id, levelUpShot(step), at),
    cancelClaps: mine(cancelClaps),
    release: mine(release),
  };
};

/**
 * Decodes one song from its decrypted bytes. It first releases the song before it, so only one song stays in
 * memory. A load that a newer load replaces before its decode ends fails, so its audio does not stay in memory.
 * `effects` is the Sound effects switch: false plays no clap and no level-up sound.
 */
export const loadSong = async (data: ArrayBuffer, songEvents: SongEvents, effects: boolean): Promise<Song> => {
  release();
  loads += 1;
  const id = loads;
  const decoded = await decode(data);
  if (id !== loads) {
    throw new Error('A newer song load replaced this load.');
  }
  current = id;
  buffer = decoded;
  events = songEvents;
  effectsOn = effects;
  started = false;
  frozen = 0;
  return handle(id, decoded.duration);
};
