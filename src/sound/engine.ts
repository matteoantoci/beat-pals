// One AudioContext for the whole app (spec, "Sound and the audio clock"). The unlock and the heal come from the
// Pile Pals engine. Files are decoded one time in an offline context, so the buffers stay good after a replacement.
import { soundStart } from '../model';

declare global {
  // The Audio Session API of WebKit. lib.dom does not have it yet.
  interface Navigator {
    readonly audioSession?: {
      type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
    };
  }
}

/**
 * True after a return from the background. iOS can give back a context that stays silent, and a resume
 * outside a tap can fail, so the next tap closes the old context and starts a new one.
 */
let stale = false;

let context: AudioContext | undefined;
let decoder: OfflineAudioContext | undefined;
const loading = new Map<string, Promise<AudioBuffer>>();

/** A resume outside a user gesture can fail. The next gesture tries again, so the failure needs no action. */
const ignore = (): undefined => undefined;

/** iOS can drop the audio session type in the background, so each new context sets it again. */
const audio = (): AudioContext => {
  if (!context && navigator.audioSession) {
    navigator.audioSession.type = 'playback';
  }
  context ??= new AudioContext();
  return context;
};

/** Starts the context, or ends an "interrupted" state. After a return from the background, it replaces the
 * context first. Call it from a user gesture. */
const unlockAudio = (): void => {
  if (stale) {
    stale = false;
    context?.close().catch(ignore);
    context = undefined;
  }
  const ctx = audio();
  if (ctx.state !== 'running') {
    ctx.resume().catch(ignore);
  }
};

/** An AudioBuffer works in each AudioContext. So an offline context decodes before the first touch,
 * and the buffers stay good after the unlock makes a new context. */
const decode = (data: ArrayBuffer): Promise<AudioBuffer> => {
  decoder ??= new OfflineAudioContext(1, 1, 44_100);
  return decoder.decodeAudioData(data);
};

const download = async (file: string): Promise<AudioBuffer> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!response.ok) {
    throw new Error(`${file}: HTTP ${String(response.status)}`);
  }
  return decode(await response.arrayBuffer());
};

/** Loads and decodes a file one time. After a failure, the next call tries again. */
const loadClip = (file: string): Promise<AudioBuffer> => {
  const known = loading.get(file);
  if (known) {
    return known;
  }
  const next = download(file);
  loading.set(file, next);
  next.catch(() => loading.delete(file));
  return next;
};

/** The loop that plays now, and the context that plays it. */
type Playing = { readonly file: string; readonly ctx: AudioContext; readonly source: AudioBufferSourceNode };
let looping: Playing | undefined;

/** Stops the loop, if one plays. */
export const stopLoop = (): void => {
  looping?.source.stop();
  looping = undefined;
};

/**
 * Plays a file as a loop with its start silence trimmed. Call it from a tap. A loop of the same file that plays in
 * the current context continues. After a context replacement, the loop starts again in the new context.
 */
export const playLoop = (file: string, gainDb: number): void => {
  const ctx = audio();
  if (looping?.file === file && looping.ctx === ctx) {
    return;
  }
  stopLoop();
  loadClip(file)
    .then((buffer) => {
      if (ctx !== context || looping) {
        return;
      }
      const offset = soundStart(buffer.getChannelData(0), buffer.sampleRate);
      const source = new AudioBufferSourceNode(ctx, {
        buffer,
        loop: true,
        loopStart: offset,
        loopEnd: buffer.duration,
      });
      source.connect(new GainNode(ctx, { gain: 10 ** (gainDb / 20) })).connect(ctx.destination);
      source.start(0, offset);
      looping = { file, ctx, source };
    })
    .catch(ignore);
};

const markStale = (): void => {
  if (context) {
    stale = true;
  }
};

/** Call one time at start. Sets the audio session, preloads the files, and unlocks the context on each gesture. */
export const installAudio = (files: readonly string[]): void => {
  // "playback", not "ambient": iOS can then play with the silent switch on.
  if (navigator.audioSession) {
    navigator.audioSession.type = 'playback';
  }
  for (const file of files) {
    loadClip(file).catch(ignore);
  }
  // For a mouse, pointerdown is a user gesture. For a touch, only pointerup is (HTML user activation).
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  document.addEventListener('pointerup', unlockAudio, { capture: true, passive: true });
  // This listener comes before the listeners of the screens, so they see the stale context.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markStale();
    }
  });
  // A page that comes back from the back-forward cache keeps its old context too.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      markStale();
    }
  });
};
