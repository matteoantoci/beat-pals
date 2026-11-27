import { describe, expect, it } from 'vitest';
import { sceneLength, sceneSounds, type ScenePlan } from './timeline';

const plan = (change: Partial<ScenePlan>): ScenePlan => ({
  star: null,
  opened: false,
  joins: null,
  dance: 'band',
  band: [1],
  yawn: null,
  ...change,
});

describe('the sounds of the end scene', () => {
  it('play only the record slide-out when the play earned nothing new', () => {
    expect(sceneSounds(plan({}))).toEqual([{ effect: 'record', at: 0.2 }]);
  });

  it('play the star at its pop, the new record at its slide-out, and the new pal at its landing', () => {
    expect(sceneSounds(plan({ star: 2, opened: true, joins: 0 }))).toEqual([
      { effect: 'record', at: 0.2 },
      { effect: 'star', at: 1.8 },
      { effect: 'record', at: 2.6 },
      { effect: 'join', at: 4.3 },
    ]);
  });

  it('all start before the scene ends by itself, so its end cancels no sound', () => {
    const scene = plan({ star: 0, opened: true, joins: 2 });
    expect(Math.max(...sceneSounds(scene).map((sound) => sound.at))).toBeLessThan(sceneLength(scene));
  });
});

describe('the length and the sounds of each end scene', () => {
  it('in the day stage: the record and the star, and the button at 3 s', () => {
    const day = plan({ star: 1 });
    expect(sceneLength(day)).toBe(3);
    expect(sceneSounds(day)).toEqual([
      { effect: 'record', at: 0.2 },
      { effect: 'star', at: 1.8 },
    ]);
  });

  it('with the yawn: the yawn sound at 3.2 s, and the button at 4.75 s', () => {
    for (const yawn of ['afternoon', 'sunset'] as const) {
      const tired = plan({ star: 1, yawn });
      expect(sceneLength(tired)).toBe(4.75);
      expect(sceneSounds(tired)).toEqual([
        { effect: 'record', at: 0.2 },
        { effect: 'star', at: 1.8 },
        { effect: 'yawn', at: 3.2 },
      ]);
    }
  });

  it('with a new record color: the second record at 2.6 s, and the button at 3.5 s', () => {
    const opened = plan({ star: 2, opened: true });
    expect(sceneLength(opened)).toBe(3.5);
    expect(sceneSounds(opened)).toEqual([
      { effect: 'record', at: 0.2 },
      { effect: 'star', at: 1.8 },
      { effect: 'record', at: 2.6 },
    ]);
  });

  it('with a join: the new pal at 4.3 s, and the button at 5 s', () => {
    const join = plan({ star: 2, opened: true, joins: 0 });
    expect(sceneLength(join)).toBe(5);
    expect(sceneSounds(join).at(-1)).toEqual({ effect: 'join', at: 4.3 });
  });
});
