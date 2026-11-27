import { describe, expect, it } from 'vitest';
import { STAGE_FACE, STEP_AT, STEP_END, STEP_SOUNDS, stepPlan } from './sun-step';
import type { SunStep } from '../../model';

const STEPS: readonly SunStep[] = [
  { from: 'day', to: 'afternoon' },
  { from: 'afternoon', to: 'sunset' },
  { from: 'day', to: 'sunset' },
];

const facesOf = (step: SunStep): readonly string[] => stepPlan(step).faces.map(({ face }) => face);

describe('the step of the sun', () => {
  it.each(STEPS)('starts on the face of the old stage and ends on the face of the new stage (%o)', (step) => {
    const faces = facesOf(step);
    expect(faces[0]).toBe(STAGE_FACE[step.from]);
    expect(faces.at(-1)).toBe(STAGE_FACE[step.to]);
  });

  it.each(STEPS)('changes each face and the swell inside 0.5 s to 3.1 s (%o)', (step) => {
    const { faces, swell } = stepPlan(step);
    for (const { at } of faces.slice(1)) {
      expect(at).toBeGreaterThan(STEP_AT);
      expect(at).toBeLessThan(STEP_END);
    }
    expect(faces.map(({ at }) => at)).toEqual(faces.map(({ at }) => at).toSorted((a, b) => a - b));
    if (swell) {
      expect([swell.at, swell.top, swell.hold, swell.end]).toEqual(
        [swell.at, swell.top, swell.hold, swell.end].toSorted((a, b) => a - b)
      );
      expect(swell.end).toBeLessThanOrEqual(STEP_END);
    }
  });

  it('blinks from day to late afternoon and yawns from late afternoon to sunset', () => {
    expect(facesOf(STEPS[0]!)).toEqual(['happy', 'blink', 'calm']);
    expect(facesOf(STEPS[1]!)).toEqual(['calm', 'yawn', 'droopy']);
  });

  it('blinks and then yawns from day to sunset', () => {
    expect(facesOf(STEPS[2]!)).toEqual(['happy', 'blink', 'calm', 'yawn', 'droopy']);
    expect(stepPlan(STEPS[2]!).swell).not.toBeNull();
  });

  it('plays the sun-step sound at 0.5 s', () => {
    expect(STEP_SOUNDS).toEqual([{ effect: 'sun-step', at: 0.5 }]);
  });
});
