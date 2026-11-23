import { describe, expect, it } from 'vitest';
import { soundStart } from './index';

const RATE = 1000;

describe('soundStart', () => {
  it('gives the time of the first sample above the silence level', () => {
    const samples = new Float32Array(2000);
    samples[250] = 0.2;

    expect(soundStart(samples, RATE)).toBe(0.25);
  });

  it('ignores quiet noise in the silence', () => {
    const samples = new Float32Array(2000).fill(0.0005);
    samples[400] = -0.3;

    expect(soundStart(samples, RATE)).toBe(0.4);
  });

  it('gives 0 when the sound starts at once', () => {
    expect(soundStart(new Float32Array([0.5, 0.1]), RATE)).toBe(0);
  });

  it('gives 0 when all samples are silent', () => {
    expect(soundStart(new Float32Array(100), RATE)).toBe(0);
  });
});
