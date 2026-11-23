// The song handle (spec, "Sound and the audio clock"). One decoded song plays from an AudioBuffer, never from an
// <audio> element, and the guarded song clock gives its time. Pause and resume work across a context replacement.
// Only one song stays in memory, so the state of that song is the state of this module.
import { firstSongTime, songTime, startAt } from '../model';
import { loadSoundOn } from '../shell/settings';
import { clapBuffer } from './clap';
import { currentContext, decode, onReplaced } from './engine';
import { levelUpBuffer, type LevelUpStep } from './level-up';

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
  /** Plays a clap at a song time, brighter for a great hit. A past time plays now. The Sound effects switch turns it off. */
  readonly clap: (at: number, great: boolean) => void;
  /** Plays the level-up sound of an energy step at a song time, as a clap. */
  readonly levelUp: (step: LevelUpStep, at: number) => void;
  /** Cancels the claps that did not play yet. */
  readonly cancelClaps: () => void;
  /** Stops the song and frees its audio. */
  readonly release: () => void;
};

/** The source, the claps, and t0 of the song in one context. `claps` holds every sound effect that is to come. */
type Session = {
  readonly ctx: AudioContext;
  readonly source: AudioBufferSourceNode;
  readonly t0: number;
  readonly claps: Set<AudioBufferSourceNode>;
  /** The Sound effects switch, read when the session starts. */
  readonly effects: boolean;
  readonly unwatch: () => void;
};

/** The number of the song in memory. 0 when no song is in memory. */
let current = 0;
let loads = 0;
let buffer: AudioBuffer | undefined;
let events: SongEvents | undefined;
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
  source.connect(ctx.destination);
  source.start(when, offset);
  frozen = from;
  session = { ctx, source, t0, claps: new Set(), effects: loadSoundOn(), unwatch: watch(ctx, events) };
};

/** Plays a sound effect at a song time, when the Sound effects switch is on. */
const effect = (sound: AudioBuffer, at: number): void => {
  if (!session?.effects) {
    return;
  }
  const { ctx, t0, claps } = session;
  const source = new AudioBufferSourceNode(ctx, { buffer: sound });
  source.connect(ctx.destination);
  source.addEventListener('ended', () => claps.delete(source));
  source.start(Math.max(ctx.currentTime, t0 + at));
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
    clap: (at, great) => {
      if (id === current) {
        effect(clapBuffer(great), at);
      }
    },
    levelUp: (step, at) => {
      if (id === current) {
        effect(levelUpBuffer(step), at);
      }
    },
    cancelClaps: mine(cancelClaps),
    release: mine(release),
  };
};

/**
 * Decodes one song from its decrypted bytes. It first releases the song before it, so only one song stays in
 * memory. A load that a newer load replaces before its decode ends fails, so its audio does not stay in memory.
 */
export const loadSong = async (data: ArrayBuffer, songEvents: SongEvents): Promise<Song> => {
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
  started = false;
  frozen = 0;
  return handle(id, decoded.duration);
};
