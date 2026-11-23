import { describe, expect, it } from 'vitest';
import { decodeTime, nextDecodeRate, ringFill } from './load-progress';

const MB = 1024 * 1024;

describe('ringFill', () => {
  it('follows the read bytes up to a tenth of the ring', () => {
    expect(ringFill({ step: 'read', bytes: 0, total: 4 * MB }, 0)).toBe(0);
    expect(ringFill({ step: 'read', bytes: 2 * MB, total: 4 * MB }, 0)).toBeCloseTo(0.05);
    expect(ringFill({ step: 'read', bytes: 4 * MB, total: 4 * MB }, 0)).toBeCloseTo(0.1);
  });

  it('moves with time during the decode and waits at 85 % when the decode is late', () => {
    const decode = { step: 'decode', startedAt: 1000, predictedMs: 1000 } as const;
    expect(ringFill(decode, 1000)).toBeCloseTo(0.1);
    expect(ringFill(decode, 1500)).toBeCloseTo(0.475);
    expect(ringFill(decode, 2000)).toBeCloseTo(0.85);
    expect(ringFill(decode, 9000)).toBeCloseTo(0.85);
  });

  it('fills the rest in the stage steps, and is full only after the last step', () => {
    expect(ringFill({ step: 'stage', done: 0, steps: 2 }, 0)).toBeCloseTo(0.85);
    expect(ringFill({ step: 'stage', done: 1, steps: 2 }, 0)).toBeLessThan(1);
    expect(ringFill({ step: 'stage', done: 2, steps: 2 }, 0)).toBe(1);
  });

  it('never goes back at the change from one step to the next', () => {
    const readEnd = ringFill({ step: 'read', bytes: 1, total: 1 }, 0);
    const decodeStart = ringFill({ step: 'decode', startedAt: 0, predictedMs: 500 }, 0);
    const decodeEnd = ringFill({ step: 'decode', startedAt: 0, predictedMs: 500 }, 500);
    const stageStart = ringFill({ step: 'stage', done: 0, steps: 2 }, 0);
    expect(decodeStart).toBeGreaterThanOrEqual(readEnd);
    expect(stageStart).toBeGreaterThanOrEqual(decodeEnd);
  });
});

describe('decode prediction', () => {
  it('predicts from the audio size and the rate', () => {
    expect(decodeTime(4 * MB, 300)).toBe(1200);
  });

  it('moves the rate half of the way to the measured rate', () => {
    expect(nextDecodeRate(300, 4 * MB, 2000)).toBe(400);
  });

  it('keeps the rate after a measure with no bytes or no time', () => {
    expect(nextDecodeRate(300, 0, 2000)).toBe(300);
    expect(nextDecodeRate(300, 4 * MB, 0)).toBe(300);
  });
});
