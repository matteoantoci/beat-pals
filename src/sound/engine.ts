// One AudioContext for the whole app (spec, "Sound and the audio clock"). The unlock and the heal come from the
// Pile Pals engine. Files are decoded one time in an offline context, so the buffers stay good after a replacement.
// The title loop is in ./loop.ts.

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
/** The end of the last decode. Each decode waits for it, so decodes never run in parallel. */
let decoding: Promise<unknown> = Promise.resolve();
const loading = new Map<string, Promise<AudioBuffer>>();
/** The decoded files, for the sound effects: they play at once or not at all. */
const ready = new Map<string, AudioBuffer>();
/** The code to run after a tap replaced the context. */
const replacedListeners = new Set<() => void>();

/** A resume outside a user gesture can fail. The next gesture tries again, so the failure needs no action. */
const ignore = (): undefined => undefined;

/** The current context. It makes a new context if none exists. Call it from a tap, or after the first tap.
 * iOS can drop the audio session type in the background, so each new context sets it again. */
export const currentContext = (): AudioContext => {
  if (!context && navigator.audioSession) {
    navigator.audioSession.type = 'playback';
  }
  context ??= new AudioContext();
  return context;
};

/** Calls `listener` each time a tap replaces the context. Gives the function that removes the listener. */
export const onReplaced = (listener: () => void): (() => void) => {
  replacedListeners.add(listener);
  return () => {
    replacedListeners.delete(listener);
  };
};

/** Starts the context, or ends an "interrupted" state. After a return from the background, it replaces the
 * context first. Call it from a user gesture. */
const unlockAudio = (): void => {
  const replaced = stale;
  if (stale) {
    stale = false;
    context?.close().catch(ignore);
    context = undefined;
  }
  const ctx = currentContext();
  if (ctx.state !== 'running') {
    ctx.resume().catch(ignore);
  }
  if (!replaced) {
    return;
  }
  for (const listener of replacedListeners) {
    listener();
  }
};

/** An AudioBuffer works in each AudioContext. So an offline context decodes before the first touch, and the
 * buffers stay good after the unlock makes a new context. One decode runs at a time, to keep the memory low. */
export const decode = (data: ArrayBuffer): Promise<AudioBuffer> => {
  decoder ??= new OfflineAudioContext(1, 1, 44_100);
  const offline = decoder;
  const next = decoding.then(() => offline.decodeAudioData(data));
  decoding = next.catch(ignore);
  return next;
};

const download = async (file: string): Promise<AudioBuffer> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
  if (!response.ok) {
    throw new Error(`${file}: HTTP ${String(response.status)}`);
  }
  const buffer = await decode(await response.arrayBuffer());
  ready.set(file, buffer);
  return buffer;
};

/** Loads and decodes a file one time. After a failure, the next call tries again. */
export const loadClip = (file: string): Promise<AudioBuffer> => {
  const known = loading.get(file);
  if (known) {
    return known;
  }
  const next = download(file);
  loading.set(file, next);
  next.catch(() => loading.delete(file));
  return next;
};

/** The decoded buffer of a file, or undefined when it is not decoded yet: then it starts the load, for a next call. */
export const readyClip = (file: string): AudioBuffer | undefined => {
  const buffer = ready.get(file);
  if (!buffer) {
    loadClip(file).catch(ignore);
  }
  return buffer;
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
  // On hidden, suspend the context: the "playback" session lets iOS play on in the background, so the title loop
  // would go on after the app leaves the screen. The return marks the context stale, and the next tap replaces it;
  // the replacement starts the wanted loop again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markStale();
      return;
    }
    context?.suspend().catch(ignore);
  });
  // A page that comes back from the back-forward cache keeps its old context too.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      markStale();
    }
  });
};
