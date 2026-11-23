// What the device keeps about song loads in localStorage (spec, "Screens", load scene): the decode rate that the
// fill ring predicts with, and the last load problem for the parent area. They are not game data, so a reset of the
// game keeps them. A blocked localStorage keeps them for this session only.

import { FIRST_DECODE_MS_PER_MB } from '../model';

const RATE_KEY = 'beat-pals:decode-rate';
const PROBLEM_KEY = 'beat-pals:load-problem';

/** Why a song did not load. `missing`: a file is not in the cache. `locked`: a file does not open with the key.
 * `facts`: the facts file is damaged. `audio`: the audio did not decode. `stage`: the graphics did not start. */
export type LoadProblemKind = 'missing' | 'locked' | 'facts' | 'audio' | 'stage' | 'other';

/** The last load problem and its time. The song title is not kept. */
export type LoadProblem = { readonly kind: LoadProblemKind; readonly at: number };

const KINDS: readonly LoadProblemKind[] = ['missing', 'locked', 'facts', 'audio', 'stage', 'other'];

let rate: number | undefined;
let problem: LoadProblem | undefined;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The value stays for this session.
  }
};

/** The decode rate of this device in ms for each MB of encoded audio. */
export const loadDecodeRate = (): number => {
  const stored = Number(read(RATE_KEY));
  rate ??= Number.isFinite(stored) && stored > 0 ? stored : FIRST_DECODE_MS_PER_MB;
  return rate;
};

export const storeDecodeRate = (next: number): void => {
  rate = next;
  write(RATE_KEY, String(Math.round(next)));
};

const parseProblem = (text: string | null): LoadProblem | undefined => {
  const [kind, at] = (text ?? '').split(' ');
  const time = Number(at);
  const known = KINDS.find((one) => one === kind);
  return known !== undefined && Number.isFinite(time) ? { kind: known, at: time } : undefined;
};

/** The last load problem on this device, or undefined when no load failed. */
export const loadLastProblem = (): LoadProblem | undefined => {
  problem ??= parseProblem(read(PROBLEM_KEY));
  return problem;
};

/** Keeps a load problem with the time now. */
export const storeLoadProblem = (kind: LoadProblemKind): void => {
  problem = { kind, at: Date.now() };
  write(PROBLEM_KEY, `${kind} ${String(problem.at)}`);
};

/** Ends the last load problem, after a song loads and plays. */
export const clearLoadProblem = (): void => {
  problem = undefined;
  try {
    localStorage.removeItem(PROBLEM_KEY);
  } catch {
    // The problem stays stored, and shows again at the next launch.
  }
};
