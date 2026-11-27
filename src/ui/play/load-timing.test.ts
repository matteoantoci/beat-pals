import { createRoot } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSceneTiming } from './load-timing';

// The load scene of the last song (play-sessions spec, "Screens and motion"): "The song starts at 3.2 s or when the
// load ends, whichever is later." The play starts when `loaded` resolves.

/** The time in ms from the start of the scene to the start of the play, for a load that ends at `loadMs`. */
const playStartOfLastSong = async (loadMs: number): Promise<number> => {
  const timing = createRoot(() => loadSceneTiming(true));
  await vi.advanceTimersByTimeAsync(loadMs);
  const startedAt = timing.loaded().then(() => performance.now());
  await vi.advanceTimersByTimeAsync(5000);
  return startedAt;
};

describe('the load scene of the last song', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0, toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the play at 3.2 s after a fast load', async () => {
    expect(await playStartOfLastSong(100)).toBe(3200);
  });

  it('starts the play after the close fade when the load ends after 3.2 s', async () => {
    expect(await playStartOfLastSong(4000)).toBe(4200);
  });

  it('keeps the scene shown until its close fade at 3.0 s', async () => {
    const timing = createRoot(() => loadSceneTiming(true));
    const closed = timing.loaded();
    await vi.advanceTimersByTimeAsync(2999);
    expect(timing.state()).toBe('shown');
    await vi.runAllTimersAsync();
    await closed;
  });
});
