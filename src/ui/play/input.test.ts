import { describe, expect, it } from 'vitest';
import { laneAt, layout } from './geometry';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

describe('the tap columns', () => {
  // An iPhone 12 in portrait: 390 px wide, so the lanes are 124 px wide and Dot's lane runs from 133 to 257.
  const portrait = layout(390, 844, NO_INSETS);

  it('gives Pip the column from the left edge to Dot lane', () => {
    expect([0, 60, 132].map((x) => laneAt(portrait, x))).toStrictEqual([0, 0, 0]);
  });

  it('gives Dot its drawn lane', () => {
    expect([133, 195, 257].map((x) => laneAt(portrait, x))).toStrictEqual([1, 1, 1]);
  });

  it('gives Bo the column from Dot lane to the right edge', () => {
    expect([258, 330, 390].map((x) => laneAt(portrait, x))).toStrictEqual([2, 2, 2]);
  });
});
