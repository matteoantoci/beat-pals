import { describe, expect, it } from 'vitest';
import { makeEnergyTrack } from './energy';

describe('the lasting effects of the energy steps', () => {
  it('fade in over 0.8 s when she reaches a step', () => {
    const energy = makeEnergyTrack();
    energy.record(1, 1);
    energy.record(2, 10);
    expect(energy.at(10).fades).toStrictEqual([1, 0, 0, 0]);
    expect(energy.at(10.4).fades[1]).toBeCloseTo(0.5);
    expect(energy.at(10.9).fades).toStrictEqual([1, 1, 0, 0]);
  });

  it('fade out over 0.8 s when she loses a step, and the steps below stay', () => {
    const energy = makeEnergyTrack();
    energy.record(1, 1);
    energy.record(2, 2);
    energy.record(3, 3);
    energy.record(2, 20);
    expect(energy.at(20.2).fades[2]).toBeCloseTo(0.75);
    expect(energy.at(20.2).fades.slice(0, 2)).toStrictEqual([1, 1]);
    expect(energy.at(20.9).fades).toStrictEqual([1, 1, 0, 0]);
  });

  it('turn back without a jump when the step changes during a fade', () => {
    const energy = makeEnergyTrack();
    energy.record(1, 1);
    energy.record(2, 10);
    energy.record(1, 10.2);
    expect(energy.at(10.2).fades[1]).toBeCloseTo(0.25);
    expect(energy.at(10.3).fades[1]).toBeCloseTo(0.125);
    expect(energy.at(10.5).fades[1]).toBe(0);
  });
});

describe('the level-up moment', () => {
  it('shows after a step up, for 0.7 s', () => {
    const energy = makeEnergyTrack();
    expect(energy.record(1, 2)).toBe(true);
    expect(energy.at(2.3).levelUp?.to).toBe(1);
    expect(energy.at(2.3).levelUp?.age).toBeCloseTo(0.3);
    expect(energy.at(2.7).levelUp).toBeUndefined();
  });

  it('shows for 1.1 s at gold', () => {
    const energy = makeEnergyTrack();
    for (const step of [1, 2, 3] as const) {
      energy.record(step, step);
    }
    energy.record('gold', 10);
    expect(energy.at(11).levelUp?.to).toBe(4);
    expect(energy.at(11.2).levelUp).toBeUndefined();
  });

  it('does not show after a step down', () => {
    const energy = makeEnergyTrack();
    energy.record(1, 1);
    expect(energy.record(0, 5)).toBe(false);
    expect(energy.at(5.1).levelUp).toBeUndefined();
    expect(energy.at(5.1).step).toBe(0);
  });
});
