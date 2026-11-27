import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { installAudio } from './engine';
import type { fadeOutLoop, installLoop, playLoop } from './loop';
import type { playSceneSounds } from './scene';

// The title loop and the stop of the scene sounds (play-sessions spec, "Screens and motion"): the last-song cue fades
// the title music out over 0.4 s, and the music does not start again during the cue, also after a context
// replacement. A skip of the end scene lets a sound that plays ring out; a failed load of the cue cuts its tune.
// The tests run in Node, so fakes of the Web Audio API and of the page keep a record of what the sound module asks:
// the sources that it starts and stops, and the changes to their gains.

/** One change of an AudioParam, with its value and its context time. */
type ParamEvent = { readonly kind: 'set' | 'ramp' | 'cancel'; readonly value: number; readonly at: number };

class FakeContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  readonly destination = {};
  readonly sources: FakeSource[] = [];

  constructor() {
    contexts.push(this);
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

class FakeParam {
  value: number;
  readonly events: ParamEvent[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number, at: number): void {
    this.events.push({ kind: 'set', value, at });
  }

  linearRampToValueAtTime(value: number, at: number): void {
    this.events.push({ kind: 'ramp', value, at });
  }

  cancelScheduledValues(at: number): void {
    this.events.push({ kind: 'cancel', value: this.value, at });
  }
}

class FakeNode {
  readonly context: FakeContext;
  readonly outputs: unknown[] = [];

  constructor(context: FakeContext) {
    this.context = context;
  }

  connect<T>(node: T): T {
    this.outputs.push(node);
    return node;
  }
}

class FakeGain extends FakeNode {
  readonly gain: FakeParam;

  constructor(context: FakeContext, options: { gain?: number } = {}) {
    super(context);
    this.gain = new FakeParam(options.gain ?? 1);
  }
}

class FakeSource extends FakeNode {
  stoppedAt: number | undefined;

  constructor(context: FakeContext) {
    super(context);
    context.sources.push(this);
  }

  start(): void {
    this.stoppedAt = undefined;
  }

  stop(when = this.context.currentTime): void {
    this.stoppedAt = when;
  }

  /** The gain node that the source plays through. */
  get gainNode(): FakeGain | undefined {
    return this.outputs.find((node): node is FakeGain => node instanceof FakeGain);
  }
}

const BUFFER = { duration: 4, sampleRate: 44_100, getChannelData: () => new Float32Array([0.5, 0.5]) };

class FakeOffline {
  decodeAudioData(): Promise<typeof BUFFER> {
    return Promise.resolve(BUFFER);
  }
}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

const contexts: FakeContext[] = [];
let page = new FakeDocument();

/** A return from the background, then a tap: the tap replaces the context. */
const comeBackAndTap = (): void => {
  page.visibilityState = 'hidden';
  page.dispatchEvent(new Event('visibilitychange'));
  page.visibilityState = 'visible';
  page.dispatchEvent(new Event('visibilitychange'));
  page.dispatchEvent(new Event('pointerup'));
};

/** Waits until the loads and decodes that are under way end: they are promise chains of the fakes, and a task of
 * 0 ms comes after all of them. */
const settle = (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
};

const sourcesOf = (index: number): readonly FakeSource[] => contexts[index]?.sources ?? [];

type Modules = {
  readonly installAudio: typeof installAudio;
  readonly installLoop: typeof installLoop;
  readonly playLoop: typeof playLoop;
  readonly fadeOutLoop: typeof fadeOutLoop;
  readonly playSceneSounds: typeof playSceneSounds;
};

let sound: Modules;

beforeEach(async () => {
  vi.resetModules();
  contexts.length = 0;
  page = new FakeDocument();
  vi.stubGlobal('document', page);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('OfflineAudioContext', FakeOffline);
  vi.stubGlobal('GainNode', FakeGain);
  vi.stubGlobal('AudioBufferSourceNode', FakeSource);
  vi.stubGlobal('DynamicsCompressorNode', FakeNode);
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  // New copies of the modules for each test: the engine and the loop keep their state in the module.
  sound = { ...(await import('./engine')), ...(await import('./loop')), ...(await import('./scene')) };
  sound.installAudio(['sounds/record.wav', 'sounds/last-song.wav']);
  sound.installLoop();
});

const LOOP = 'music/loop.mp3';
const GAIN = 10 ** (-6 / 20);

const playingLoop = async (): Promise<FakeSource> => {
  sound.playLoop(LOOP, -6);
  await settle();
  const [source] = sourcesOf(0);
  if (!source) {
    throw new Error('The loop did not start.');
  }
  return source;
};

describe('the title loop', () => {
  it('starts again in the new context after a context replacement', async () => {
    await playingLoop();
    comeBackAndTap();
    await settle();
    expect(contexts).toHaveLength(2);
    expect(sourcesOf(1)).toHaveLength(1);
  });

  it('fades out from its gain to silence over the given time, and then stops', async () => {
    const source = await playingLoop();
    source.context.currentTime = 5;
    sound.fadeOutLoop(0.4);
    expect(source.gainNode?.gain.events).toEqual([
      { kind: 'cancel', value: GAIN, at: 5 },
      { kind: 'set', value: GAIN, at: 5 },
      { kind: 'ramp', value: 0, at: 5.4 },
    ]);
    expect(source.stoppedAt).toBe(5.4);
  });

  it('does not start again after a fade, also after a context replacement', async () => {
    await playingLoop();
    sound.fadeOutLoop(0.4);
    comeBackAndTap();
    await settle();
    expect(contexts).toHaveLength(2);
    expect(sourcesOf(1)).toEqual([]);
  });

  it('does not start when the fade comes while its file loads', async () => {
    sound.playLoop(LOOP, -6);
    sound.fadeOutLoop(0.4);
    await settle();
    expect(sourcesOf(0)).toEqual([]);
  });

  it('starts again when the app asks for it after a fade', async () => {
    await playingLoop();
    sound.fadeOutLoop(0.4);
    sound.playLoop(LOOP, -6);
    await settle();
    expect(sourcesOf(0)).toHaveLength(2);
    expect(sourcesOf(0)[1]?.stoppedAt).toBeUndefined();
  });
});

/** A scene with a sound that plays at 1 s and one that waits for 3 s. The scene time is 2 s. */
const stopAtTwoSeconds = async (playing?: 'cut'): Promise<readonly (number | undefined)[]> => {
  await settle();
  const stop = sound.playSceneSounds(
    [
      { effect: 'last-song', at: 1 },
      { effect: 'record', at: 3 },
    ],
    true
  );
  const [fake] = contexts;
  if (fake) {
    fake.currentTime = 2;
  }
  stop(playing);
  return sourcesOf(0).map((source) => source.stoppedAt);
};

describe('the stop of the scene sounds', () => {
  it('lets a sound that plays ring out, and stops the sounds still to come', async () => {
    expect(await stopAtTwoSeconds()).toEqual([undefined, 2]);
  });

  it('cuts also the sound that plays', async () => {
    expect(await stopAtTwoSeconds('cut')).toEqual([2, 2]);
  });
});
