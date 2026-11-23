// The test helper of the chart reader tests: it reads a fixture and gives its facts.

import { readChart, type SongFacts } from '../../index';

/** The metadata of the test song. */
export const META = { id: 'test-tune', name: 'Test Tune', artist: 'The Testers', charter: 'Nobody', delay: 0 };

/** The facts of a .chart text. `delay` is the metadata delay in milliseconds. Fails the test on a refusal. */
export const factsOf = (text: string, delay = 0): SongFacts => {
  const result = readChart(text, { ...META, delay });
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.facts;
};
