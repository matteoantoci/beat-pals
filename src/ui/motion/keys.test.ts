import { describe, expect, it } from 'vitest';
import { playKeys } from './keys';

// The tests run in Node, so a fake element keeps the keyframes and the timing of its animation.

type Played = { frames: readonly Keyframe[]; timing: KeyframeAnimationOptions };

const played = (keys: Parameters<typeof playKeys>[2]): Played => {
  const record: Played[] = [];
  const el = {
    animate: (frames: readonly Keyframe[], timing: KeyframeAnimationOptions) => {
      record.push({ frames, timing });
    },
  } as unknown as Element;
  playKeys(el, 'scale', keys);
  return record[0]!;
};

describe('the player of the scene keys', () => {
  it('plays the keys from the first key to the last key, and holds the ends', () => {
    const { frames, timing } = played([
      [1, '1 1', 'ease'],
      [3, '1.04 0.94'],
    ]);
    expect(frames).toEqual([
      { offset: 0, scale: '1 1', easing: 'ease' },
      { offset: 1, scale: '1.04 0.94', easing: 'linear' },
    ]);
    expect(timing).toEqual({ delay: 1000, duration: 2000, fill: 'both' });
  });

  // The night title holds the sleep pose of the pals with one key. With one keyframe, the pose went away after 1 ms.
  it('holds the value of one key', () => {
    const { frames, timing } = played([[0, '1.04 0.94']]);
    expect(frames).toEqual([
      { offset: 0, scale: '1.04 0.94', easing: 'linear' },
      { offset: 1, scale: '1.04 0.94', easing: 'linear' },
    ]);
    expect(timing.fill).toBe('both');
  });
});
