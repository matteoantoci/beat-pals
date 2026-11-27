import { describe, expect, it } from 'vitest';
import { GOODBYE_SEC, GOODBYE_SOUNDS, goodbyePlan } from './goodbye';
import { BOW, BREATH, GOODBYE_YAWN, nightPlan, SLEEP_POSE, WAKE_STRETCH, type Key, type Track } from './motion';
import { WAKE_SEC, WAKE_SOUNDS, wakePlan } from './wake';

/** The keys before and after scene time `at`. */
const around = (keys: readonly Key[], at: number): readonly [Key | undefined, Key | undefined] => {
  const next = keys.findIndex(([time]) => time >= at);
  return next === -1 ? [keys.at(-1), undefined] : [keys[next - 1], keys[next]];
};

/** The scene time of a loop: after its last key, it starts again at its first key. */
const loopTime = (track: Track, at: number): number => {
  const first = track.keys[0]?.[0] ?? 0;
  const period = (track.keys.at(-1)?.[0] ?? first) - first;
  return track.loop && at > first + period && period > 0 ? first + ((at - first) % period) : at;
};

// The value of a track at scene time `at`, as the Web Animations of the scene give it (fill both): the first value
// before the first key, the last value after the last key, and a straight line between 2 keys. The easings of the
// scenes never go past their 2 keys, so the straight line gives the same range.
const valueAt = (track: Track, at: number): string => {
  const [before, after] = around(track.keys, loopTime(track, at));
  if (!before || !after) {
    return (before ?? after)?.[1] ?? '';
  }
  const share = (loopTime(track, at) - before[0]) / (after[0] - before[0]);
  const to = after[1].split(' ').map(Number);
  return before[1]
    .split(' ')
    .map(Number)
    .map((value, axis) => value + ((to[axis] ?? value) - value) * share)
    .join(' ');
};

/** The width and height scale of a scale value: one number is the same scale on both axes. */
const axes = (value: string): [number, number] => {
  const [x = 1, y = x] = value.split(' ').map(Number);
  return [x, y];
};

type Probe = { readonly part: Track['part']; readonly pal: number; readonly at: number };

const scaleOf = (tracks: readonly Track[], { part, pal, at }: Probe): [number, number] => {
  const found = tracks.find((each) => each.part === part && each.pal === pal && each.prop === 'scale');
  return found ? axes(valueAt(found, at)) : [1, 1];
};

/** The largest distance from 1.0 of the body scale times the stack scale of each pal, over 20 s of the scene. */
const worstSquash = (tracks: readonly Track[]): number =>
  Math.max(
    ...[0, 1, 2].flatMap((pal) =>
      Array.from({ length: 2001 }, (_, step) => {
        const at = step / 100;
        const body = scaleOf(tracks, { part: 'body', pal, at });
        const stack = scaleOf(tracks, { part: 'stack', pal, at });
        return Math.max(Math.abs(body[0] * stack[0] - 1), Math.abs(body[1] * stack[1] - 1));
      })
    )
  );

const plans = {
  'the goodbye scene': goodbyePlan(false),
  'the night title': nightPlan(false),
  'the wake-up scene': wakePlan({ reduce: false, firstLight: true, rise: 300, brandShift: 0 }),
};

describe('the sounds of the session end and start', () => {
  it('play the goodbye tune at 2.6 s, so its chord at 5.34 s rings out as the first pal falls asleep at 5.45 s', () => {
    expect(GOODBYE_SOUNDS).toEqual([{ effect: 'goodbye', at: 2.6 }]);
    const sleep = goodbyePlan(false).find((each) => each.part === 'face-sleep' && each.pal === 0);
    expect(sleep?.keys.find(([, value]) => value === '1')?.[0]).toBe(5.45);
  });

  it('play the celesta from 0.9 s and the yawn at 2.55 s of the wake-up scene', () => {
    expect(WAKE_SOUNDS).toEqual([
      { effect: 'wake-up', at: 0.9 },
      { effect: 'yawn', at: 2.55 },
    ]);
  });

  it('all start before the scene ends', () => {
    expect(Math.max(...GOODBYE_SOUNDS.map((sound) => sound.at))).toBeLessThan(GOODBYE_SEC);
    expect(Math.max(...WAKE_SOUNDS.map((sound) => sound.at))).toBeLessThan(WAKE_SEC);
  });
});

describe('the squash and stretch of the pals', () => {
  it('use the values of the spec', () => {
    expect([BOW, GOODBYE_YAWN, SLEEP_POSE, BREATH, WAKE_STRETCH]).toEqual([
      [1.04, 0.94],
      [0.97, 1.05],
      [1.04, 0.94],
      [1.01, 1.03],
      [0.95, 1.06],
    ]);
  });

  it('give 1.0504 × 0.9682 at most for the sleep pose with its breath', () => {
    expect(SLEEP_POSE[0] * BREATH[0]).toBeCloseTo(1.0504, 6);
    expect(SLEEP_POSE[1] * BREATH[1]).toBeCloseTo(0.9682, 6);
  });

  it.each(Object.entries(plans))(
    'stay within 6%% of 1.0 on each axis in %s, a pose and its loop together',
    (_, tracks) => {
      expect(worstSquash(tracks)).toBeLessThanOrEqual(0.06 + 1e-9);
    }
  );

  it('bow, yawn, and lie down in the goodbye scene', () => {
    const goodbye = plans['the goodbye scene'];
    expect(scaleOf(goodbye, { part: 'body', pal: 0, at: 2.9 })).toEqual(BOW);
    expect(scaleOf(goodbye, { part: 'body', pal: 0, at: 5.2 })).toEqual(GOODBYE_YAWN);
    expect(scaleOf(goodbye, { part: 'body', pal: 2, at: GOODBYE_SEC })).toEqual(SLEEP_POSE);
  });

  it('start in the sleep pose and stretch in the wake-up scene', () => {
    const wake = plans['the wake-up scene'];
    expect(scaleOf(wake, { part: 'body', pal: 1, at: 0 })).toEqual(SLEEP_POSE);
    expect(scaleOf(wake, { part: 'body', pal: 1, at: 3.1 })).toEqual(WAKE_STRETCH);
    expect(scaleOf(wake, { part: 'body', pal: 1, at: WAKE_SEC })).toEqual([1, 1]);
  });
});

const reduced = {
  'the goodbye scene': goodbyePlan(true),
  'the night title': nightPlan(true),
  'the wake-up scene': wakePlan({ reduce: true, firstLight: true, rise: 300, brandShift: 60 }),
};

describe('the sun and the moon', () => {
  const all = [...Object.values(plans), ...Object.values(reduced)].flat();
  const sky = all.filter(({ part }) => /^(sun|moon)/u.test(part));

  it('use only uniform scale', () => {
    const values = sky.filter(({ prop }) => prop === 'scale').flatMap(({ keys }) => keys.map(([, value]) => value));
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((value) => value.trim().split(/\s+/u).length !== 1)).toEqual([]);
  });

  it('never get a transform, which could hold a scale of 2 axes', () => {
    expect(sky.filter(({ prop }) => prop === 'transform')).toEqual([]);
  });
});

describe('reduced motion', () => {
  it.each(Object.entries(reduced))('gives no loop in %s', (_, tracks) => {
    expect(tracks.filter((each) => each.loop)).toEqual([]);
  });

  // A colour change is a fade too. A still value that never changes is a pose, not a motion: the arms keep their
  // raised pose for the fade.
  it.each(Object.entries(reduced))('gives only fades in %s, and no move of a visible part', (_, tracks) => {
    const moves = tracks.filter(
      ({ part, prop }) => part !== 'brand' && !['opacity', 'background-color', '--sunc'].includes(prop)
    );
    expect(moves.filter(({ keys }) => new Set(keys.map(([, value]) => value)).size > 1)).toEqual([]);
  });

  it('moves the brand to its column in landscape only while it is hidden', () => {
    const brand = reduced['the wake-up scene'].filter(({ part }) => part === 'brand');
    const fade = brand.find(({ prop }) => prop === 'opacity');
    const jump = brand.find(({ prop }) => prop === 'translate')?.keys.find(([, value]) => value === '0px 0px')?.[0];
    expect(fade && jump !== undefined ? valueAt(fade, jump) : undefined).toBe('0');
  });
});

describe('the play button of the wake-up scene', () => {
  it('pops in at 3.8 s', () => {
    const play = plans['the wake-up scene'].filter(({ part }) => part === 'play');
    expect(play.map(({ prop, keys }) => [prop, keys[0]?.[0]])).toEqual([
      ['opacity', 3.8],
      ['scale', 3.8],
    ]);
  });
});
