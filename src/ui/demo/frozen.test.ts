import { describe, expect, it } from 'vitest';
import { childChart, playSetup } from '../../model';
import { demoFacts } from './fixture';
import { freeze } from './frozen';
import type { SongProgress } from '../../model';

const chartOf = (progress: SongProgress) => {
  const { color, step } = playSetup(progress);
  return childChart(demoFacts(), color, step);
};

const BRONZE: SongProgress = { color: 0, stars: 0, weakPlays: 0 };
const PLATINUM: SongProgress = { color: 3, stars: 1, weakPlays: 0 };

describe('freeze', () => {
  it('hits each note before the frozen time and no note after it', () => {
    const chart = chartOf(BRONZE);
    const { view } = freeze(chart, demoFacts().beats, { t: 14.15, energy: undefined });
    expect(view.t).toBe(14.15);
    const hit = chart.notes.map((note, at) => [note.t < 14.15, view.hitNotes[at] === 1]);
    expect(hit.every(([before, wasHit]) => before === wasHit)).toBe(true);
  });

  it('holds the soft hold that the frozen time is in', () => {
    const chart = chartOf(PLATINUM);
    const hold = chart.notes.find((note) => note.holdSec > 0 && note.t > 10);
    expect(hold).toBeDefined();
    const t = (hold?.t ?? 0) + (hold?.holdSec ?? 0) / 2;
    const { view } = freeze(chart, demoFacts().beats, { t, energy: undefined });
    expect(view.lanes.some((lane) => lane.held)).toBe(true);
  });

  it('shows the energy step of the query fully, with no level-up moment', () => {
    const { energy } = freeze(chartOf(PLATINUM), demoFacts().beats, { t: 0.5, energy: 'gold' });
    expect(energy).toEqual({ level: 4, fades: [1, 1, 1, 1], levelUp: undefined });
  });

  it('shows the energy that the play reached without a step in the query', () => {
    const { energy } = freeze(chartOf(PLATINUM), demoFacts().beats, { t: 20, energy: undefined });
    expect(energy.level).toBeGreaterThan(0);
  });
});
