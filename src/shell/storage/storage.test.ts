import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS, FIRST_DECODE_MS_PER_MB } from '../../model';
import { createDeviceStorage, memoryAdapter } from './index';
import { STORAGE_KEYS } from './keys';
import type { PlayDay, SessionSettings, SessionState } from '../../model';
import type { StorageAdapter } from './slot';

// The device storage on the memory adapter. A new storage on the same texts is the next launch of the app.

const H = 3_600_000;
const NOW = 100 * 24 * H + 12 * H;
const DAY: PlayDay = { start: NOW - 7 * H, stop: NOW + 8 * H, next: NOW + 17 * H };
const SETTINGS: SessionSettings = { minutes: 10, dayMinutes: 30, restMinutes: 90, stopMinutes: 1140 };
const ASLEEP: SessionState = { kind: 'asleep', until: NOW + H, today: { start: DAY.start, usedMs: H / 4 } };

/** An adapter on `texts` whose writes and removals fail, as a full storage or a blocked origin does. */
const refusing = (texts: Map<string, string>): StorageAdapter => ({
  ...memoryAdapter(texts),
  set: () => {
    throw new DOMException('The quota is full.', 'QuotaExceededError');
  },
  remove: () => {
    throw new DOMException('The origin is blocked.', 'SecurityError');
  },
});

/** An adapter that throws at each call, as a blocked localStorage does. */
const blocked: StorageAdapter = {
  get: () => {
    throw new DOMException('The origin is blocked.', 'SecurityError');
  },
  set: () => {
    throw new DOMException('The origin is blocked.', 'SecurityError');
  },
  remove: () => {
    throw new DOMException('The origin is blocked.', 'SecurityError');
  },
};

describe('device storage', () => {
  it('gives the values of each store back at the next launch', () => {
    const texts = new Map<string, string>();
    const first = createDeviceStorage(memoryAdapter(texts));
    first.save.savePlay('sunny-hill', 0);
    first.session.write(ASLEEP);
    first.session.storeSettings(SETTINGS);
    first.sound.set(false);
    first.setup.set('started');
    first.decodeRate.set(512.4);
    first.loadProblem.set({ kind: 'locked', at: NOW });

    const next = createDeviceStorage(memoryAdapter(texts));

    expect(next.save.progressOf('sunny-hill')).toEqual(first.save.progressOf('sunny-hill'));
    expect(next.save.progressOf('sunny-hill').weakPlays).toBe(1);
    expect(next.session.read(NOW, DAY)).toEqual(ASLEEP);
    expect(next.session.settings()).toEqual(SETTINGS);
    expect(next.sound.get()).toBe(false);
    expect(next.setup.get()).toBe('started');
    expect(next.decodeRate.get()).toBe(512);
    expect(next.loadProblem.get()).toEqual({ kind: 'locked', at: NOW });
  });

  it('gives the absent values for damaged data, and never throws', () => {
    const texts = new Map<string, string>([
      [STORAGE_KEYS.save, '{"version":1,"progress":'],
      [STORAGE_KEYS.session, 'not json'],
      [STORAGE_KEYS.sessionSettings, '{"version":2,"minutes":'],
      [STORAGE_KEYS.setup, 'finished'],
      [STORAGE_KEYS.decodeRate, '-40'],
      [STORAGE_KEYS.loadProblem, 'flood 123'],
    ]);
    const storage = createDeviceStorage(memoryAdapter(texts));

    expect(storage.save.current().progress).toEqual({});
    expect(storage.session.read(NOW, DAY)).toEqual({
      kind: 'awake',
      today: { start: DAY.start, usedMs: 0 },
      byParent: false,
    });
    expect(storage.session.settings()).toEqual(DEFAULT_SESSION_SETTINGS);
    expect(storage.setup.get()).toBeUndefined();
    expect(storage.decodeRate.get()).toBe(FIRST_DECODE_MS_PER_MB);
    expect(storage.loadProblem.get()).toBeUndefined();
  });

  it('gives no progress for a save of another version', () => {
    const texts = new Map([[STORAGE_KEYS.save, '{"version":99,"progress":{}}']]);

    expect(createDeviceStorage(memoryAdapter(texts)).save.progressOf('sunny-hill').weakPlays).toBe(0);
  });

  it('gives the defaults when the storage is blocked, and each write gives false', () => {
    const storage = createDeviceStorage(blocked);

    expect(storage.save.progressOf('sunny-hill').stars).toBe(0);
    expect(storage.sound.get()).toBe(true);
    expect(storage.session.settings()).toEqual(DEFAULT_SESSION_SETTINGS);
    expect(storage.save.write()).toBe(false);
    expect(storage.save.clear()).toBe(false);
  });

  it('keeps a value for this run when its write fails', () => {
    const texts = new Map<string, string>();
    const storage = createDeviceStorage(refusing(texts));

    const outcome = storage.save.savePlay('sunny-hill', 0);
    storage.session.storeSettings(SETTINGS);
    storage.sound.set(false);
    storage.setup.set('key');

    expect(storage.save.progressOf('sunny-hill')).toEqual(outcome.after);
    expect(storage.save.write()).toBe(false);
    expect(storage.session.settings()).toEqual(SETTINGS);
    expect(storage.sound.get()).toBe(false);
    expect(storage.setup.get()).toBe('key');
    expect(texts.size).toBe(0);
  });

  it('gives no progress for this run when the removal of the save fails', () => {
    const texts = new Map<string, string>();
    createDeviceStorage(memoryAdapter(texts)).save.savePlay('sunny-hill', 0);
    const storage = createDeviceStorage(refusing(texts));

    expect(storage.save.clear()).toBe(false);
    expect(storage.save.current().progress).toEqual({});
    expect(texts.has(STORAGE_KEYS.save)).toBe(true);
  });

  it('keeps the session, the settings, and the songs setup at a reset of the progress', () => {
    const texts = new Map<string, string>();
    const storage = createDeviceStorage(memoryAdapter(texts));
    storage.save.savePlay('sunny-hill', 0);
    storage.session.write(ASLEEP);
    storage.session.storeSettings(SETTINGS);
    storage.sound.set(false);
    storage.setup.set('done');

    expect(storage.save.clear()).toBe(true);

    const next = createDeviceStorage(memoryAdapter(texts));
    expect(next.save.current().progress).toEqual({});
    expect(next.session.read(NOW, DAY)).toEqual(ASLEEP);
    expect(next.session.settings()).toEqual(SETTINGS);
    expect(next.sound.get()).toBe(false);
    expect(next.setup.get()).toBe('done');
  });

  it('reads each key one time in a run', () => {
    const texts = new Map([[STORAGE_KEYS.sound, 'off']]);
    const storage = createDeviceStorage(memoryAdapter(texts));

    expect(storage.sound.get()).toBe(false);
    texts.set(STORAGE_KEYS.sound, 'on');

    expect(storage.sound.get()).toBe(false);
  });

  it('removes the setup mark and the load problem', () => {
    const texts = new Map<string, string>();
    const storage = createDeviceStorage(memoryAdapter(texts));
    storage.setup.set('done');
    storage.loadProblem.set({ kind: 'missing', at: NOW });

    expect(storage.setup.clear()).toBe(true);
    expect(storage.loadProblem.clear()).toBe(true);

    expect(storage.setup.get()).toBeUndefined();
    expect(storage.loadProblem.get()).toBeUndefined();
    expect(texts.size).toBe(0);
  });
});
