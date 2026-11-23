import { describe, expect, it } from 'vitest';
import { boostDb, levelDb } from './boost';

describe('the song level boost of the sound effects', () => {
  it('is 0 over a quiet song and over silence', () => {
    expect(boostDb(-30)).toBe(0);
    expect(boostDb(-22)).toBe(0);
    expect(boostDb(levelDb(new Float32Array(16)))).toBe(0);
  });

  it('follows the song level above the quiet reference', () => {
    expect(boostDb(-17.5)).toBeCloseTo(4.5);
  });

  it('stops at 10 dB over a loud song', () => {
    expect(boostDb(-12)).toBe(10);
    expect(boostDb(0)).toBe(10);
  });

  it('reads the level in dBFS RMS', () => {
    // A square wave at half of full scale has an RMS of 0.5: -6 dBFS.
    const square = Float32Array.from({ length: 64 }, (_, index) => (index % 2 === 0 ? 0.5 : -0.5));
    expect(levelDb(square)).toBeCloseTo(-6.02);
  });
});
