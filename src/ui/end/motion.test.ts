import { describe, expect, it } from 'vitest';
import { sceneLength, sceneSounds, type ScenePlan } from './motion';

const plan = (change: Partial<ScenePlan>): ScenePlan => ({
  star: null,
  opened: false,
  joins: null,
  dance: 'band',
  band: [1],
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
