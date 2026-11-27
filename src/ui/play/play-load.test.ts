import { describe, expect, it } from 'vitest';
import { createDeviceStorage, memoryAdapter } from '../../shell/storage';
import { demoFacts } from '../demo/fixture';
import { loadParts, type LiveParts, type LivePorts } from './load-parts';
import { createPlay, type Play, type PlayAdapter, type PlayHooks } from './play-load';
import type { Song } from '../../sound';
import type { SongChoice } from '../songs/SongList';
import type { Geometry } from './geometry';
import type { Pals } from './pals';
import type { Stage } from './stage';

// The play lifetime with the live load steps on fake ports: the decode, the pictures, the stage, and the play loop
// write to a log instead of the browser.

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
};

const unset = (): void => undefined;

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = unset;
  let reject: (reason: unknown) => void = unset;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Lets every waiting step run: the lifetime keeps its promise chain inside, so the test waits for one empty timer
 * turn (0 ms), after all promise jobs. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const CHOICE = { song: { id: 'demo-parade', size: 100 }, key: {} } as SongChoice;
const FILES = { factsJson: JSON.stringify(demoFacts()), cover: null, audio: new ArrayBuffer(8) };

/** One play on fake ports. Each decode, stage, and scene close waits until the test ends it. */
const fakePlay = () => {
  const log: string[] = [];
  const decode = deferred<Song>();
  const stage = deferred<Stage>();
  const loaded = deferred<undefined>();
  const ports: LivePorts = {
    readFiles: () => Promise.resolve(FILES),
    decode: () => {
      log.push('decode');
      return decode.promise;
    },
    pictures: () => {
      log.push('pictures');
      return Promise.resolve();
    },
    stage: () => {
      log.push('stage');
      return stage.promise;
    },
    arrange: () => ({ pals: {} as Pals, geometry: () => ({}) as Geometry, unresize: () => log.push('unresize') }),
  };
  const adapter: PlayAdapter<LiveParts> = {
    load: (scope) => loadParts({ choice: CHOICE, storage: createDeviceStorage(memoryAdapter()) }, ports, scope),
    start: (_parts, calls) => {
      log.push('start');
      return {
        pause: () => log.push('pause'),
        resume: () => log.push('resume'),
        quit: () => calls.onEnd(null),
        stop: () => log.push('stop'),
      };
    },
  };
  const hooks: PlayHooks = {
    onLoad: () => undefined,
    onLoaded: () => loaded.promise,
    onStarted: () => log.push('started'),
    onFail: ({ problem }) => log.push(`fail ${problem}`),
    onPause: () => log.push('paused'),
    onEnd: (result) => log.push(`end ${result.kind}`),
  };
  const song = { duration: 10, release: () => log.push('release') } as unknown as Song;
  const decoded = (): void => decode.resolve(song);
  const staged = (): void => stage.resolve({ destroy: () => log.push('destroy') } as unknown as Stage);
  const ready = (): void => loaded.resolve(undefined);
  return { log, decode, stage, decoded, staged, ready, create: (): Play => createPlay(adapter, hooks) };
};

/** A play that runs: its load is done, and the load scene closed. */
const running = async (): Promise<{ readonly log: string[]; readonly play: Play }> => {
  const fake = fakePlay();
  const play = fake.create();
  fake.decoded();
  fake.staged();
  fake.ready();
  await flush();
  return { log: fake.log, play };
};

describe('the play lifetime', () => {
  it('frees the song at once when the play closes during the decode', async () => {
    const fake = fakePlay();
    const play = fake.create();
    await flush();
    play.dispose();
    fake.decoded();
    await flush();
    expect(fake.log).toEqual(['decode', 'release']);
  });

  it('frees the parts of a replaced load, and only the newer play starts', async () => {
    const older = fakePlay();
    older.create();
    await flush();
    const newer = fakePlay();
    newer.create();
    newer.decoded();
    newer.staged();
    newer.ready();
    await flush();
    older.decoded();
    older.staged();
    older.ready();
    await flush();
    expect(older.log).toEqual(['decode', 'release']);
    expect(newer.log).toEqual(['decode', 'pictures', 'stage', 'start', 'started']);
  });

  it('frees each part of a running play in the reverse order when a new play replaces it', async () => {
    const { log } = await running();
    fakePlay().create();
    expect(log.slice(-4)).toEqual(['stop', 'unresize', 'destroy', 'release']);
  });

  it('gives the reason of a failed step and frees what the load made', async () => {
    const fake = fakePlay();
    fake.create();
    fake.decoded();
    fake.stage.reject(new Error('No WebGL.'));
    await flush();
    expect(fake.log).toEqual(['decode', 'pictures', 'stage', 'release', 'fail stage']);
  });

  it('shows no failure of a replaced load', async () => {
    const older = fakePlay();
    older.create();
    await flush();
    fakePlay().create();
    older.decode.reject(new Error('A newer song load replaced this load.'));
    await flush();
    expect(older.log).toEqual(['decode']);
  });

  it('does not start a play that closed during the load scene', async () => {
    const fake = fakePlay();
    const play = fake.create();
    fake.decoded();
    fake.staged();
    await flush();
    play.dispose();
    fake.ready();
    await flush();
    expect(fake.log).toEqual(['decode', 'pictures', 'stage', 'unresize', 'destroy', 'release']);
  });

  it('ends with Home from the pause screen, frees the parts, and then ignores the controls', async () => {
    const { log, play } = await running();
    play.quit();
    play.pause();
    play.resume();
    expect(log.slice(-5)).toEqual(['stop', 'unresize', 'destroy', 'release', 'end home']);
  });
});
