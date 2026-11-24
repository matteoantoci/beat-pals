// The demo song: a chart that we wrote for the demo route, with invented names. Its phrase of 2 bars repeats 8
// times at 120 BPM: a chord on the downbeat (a double from gold up), a sustain of 1.5 beats (a soft hold from
// gold up), a note off the beat (for platinum), and a contour over all 5 frets (for the lanes of the band). The
// Star Power phrase from 18 s to 22 s gives phrase balls (a star moment at 21.5 s in a full play). The phrase from
// 30 s to 32 s starts less than 30 s after it, so the child chart drops it. The click of the demo (click.ts) ticks on
// its beats.

import { readChart } from '../../model';
import chartText from './demo.chart?raw';
import type { SongFacts } from '../../model';

const META = { id: 'demo-parade', name: 'Demo Parade', artist: 'Demo Band', charter: 'Demo Band', delay: 0 };

/** The facts of the demo chart. */
export const demoFacts = (): SongFacts => {
  const read = readChart(chartText, META);
  if (!read.ok) {
    throw new Error(`The demo chart is refused: ${read.reason}`);
  }
  return read.facts;
};
