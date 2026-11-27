import { describe, expect, it } from 'vitest';
import skyCss from './sky.css?raw';
import { STAGE_FACE, STEP_AT, STEP_END, STEP_SOUNDS, stepPlan, SUN_PLACES, SWELL } from './sun-step';
import type { SunStage, SunStep } from '../../model';

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

// The sky strip clips the sun (./sky.css). The box of the sun is 16/9 of the disc and holds the rays (./sun.css), so
// the top of the box is 8/9 of the disc above the place of the sun. On the iPhone, the rays of the day sun went out
// of the top of the strip.
const STRIP_HEIGHTS = [...skyCss.matchAll(/--sky-strip-h: (\d+)px/g)].map((match) => Number(match[1]));
const STAGES: readonly SunStage[] = ['day', 'afternoon', 'sunset'];
const PLACES = (['portrait', 'landscape'] as const).flatMap((orientation) =>
  STAGES.map((stage) => ({ orientation, stage, place: SUN_PLACES[orientation][stage] }))
);

describe('the sun in the sky strip', () => {
  it('reads one strip height for portrait and one for landscape', () => {
    expect(STRIP_HEIGHTS).toHaveLength(2);
  });

  it.each(PLACES)(
    'keeps the box with the rays and the disc in the strip, with the swell ($orientation, $stage)',
    (sun) => {
      const half = ((sun.place.d * 8) / 9) * SWELL;
      expect(sun.place.y - half).toBeGreaterThanOrEqual(0);
      expect(sun.place.y + sun.place.d / 2).toBeLessThanOrEqual(STRIP_HEIGHTS[sun.orientation === 'portrait' ? 0 : 1]!);
    }
  );
});
