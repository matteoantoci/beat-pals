import { describe, expect, it } from 'vitest';
import { SIT, STRETCH, yawnOf, yawnTimes } from './yawn';

describe('the yawn of the end scene', () => {
  it('plays from the late-afternoon stage on', () => {
    expect(yawnOf('day', { opened: false, joins: null })).toBeNull();
    expect(yawnOf('afternoon', { opened: false, joins: null })).toBe('afternoon');
    expect(yawnOf('sunset', { opened: false, joins: null })).toBe('sunset');
  });

  it('never plays on a scene with a new record color or a join', () => {
    expect(yawnOf('sunset', { opened: true, joins: null })).toBeNull();
    expect(yawnOf('afternoon', { opened: true, joins: 2 })).toBeNull();
  });

  it('sits every pal down at 2.95 s and yawns each pal 0.12 s after the one before it', () => {
    expect(yawnTimes(0)).toEqual({ sit: 2.95, yawn: 3.25, back: 4.5 });
    expect(yawnTimes(1).sit).toBe(2.95);
    expect(yawnTimes(2).sit).toBe(2.95);
    expect(yawnTimes(1).yawn).toBeCloseTo(3.37);
    expect(yawnTimes(2).yawn).toBeCloseTo(3.49);
    expect(yawnTimes(2).back).toBeCloseTo(4.74);
  });

  it('ends the last yawn before the button shows at 4.75 s', () => {
    expect(yawnTimes(2).back).toBeLessThan(4.75);
  });

  it('keeps each stretch of the pals within 6% of 1.0 on each axis', () => {
    expect(SIT).toEqual({ x: 1.05, y: 0.94 });
    expect(STRETCH).toEqual({ x: 0.96, y: 1.06 });
    for (const scale of [SIT.x, SIT.y, STRETCH.x, STRETCH.y]) {
      expect(scale).toBeGreaterThanOrEqual(0.94);
      expect(scale).toBeLessThanOrEqual(1.06);
    }
  });
});
