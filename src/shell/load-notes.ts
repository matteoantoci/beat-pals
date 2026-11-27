// What the device storage keeps about song loads (spec, "Screens", load scene): the decode rate that the fill ring
// predicts with, and the last load problem for the parent area. They are not game data, so a reset of the game keeps
// them.

import { FIRST_DECODE_MS_PER_MB } from '../model';
import type { Codec } from './storage/slot';

/** Why a song did not load. `missing`: a file is not in the cache. `locked`: a file does not open with the key.
 * `facts`: the facts file is damaged. `audio`: the audio did not decode. `stage`: the graphics did not start. */
export type LoadProblemKind = 'missing' | 'locked' | 'facts' | 'audio' | 'stage' | 'other';

/** The last load problem and its time. The song title is not kept. */
export type LoadProblem = { readonly kind: LoadProblemKind; readonly at: number };

const KINDS: readonly LoadProblemKind[] = ['missing', 'locked', 'facts', 'audio', 'stage', 'other'];

/** The decode rate of this device in ms for each MB of encoded audio, stored in whole ms. */
export const decodeRateCodec: Codec<number> = {
  absent: FIRST_DECODE_MS_PER_MB,
  decode: (text) => {
    const rate = Number(text);
    return Number.isFinite(rate) && rate > 0 ? rate : undefined;
  },
  encode: (rate) => String(Math.round(rate)),
};

/** The last load problem as "kind time", or undefined when no load failed. */
export const loadProblemCodec: Codec<LoadProblem | undefined> = {
  absent: undefined,
  decode: (text) => {
    const [kind, at] = text.split(' ');
    const time = Number(at);
    const known = KINDS.find((one) => one === kind);
    return known !== undefined && Number.isFinite(time) ? { kind: known, at: time } : undefined;
  },
  encode: (problem) => (problem === undefined ? '' : `${problem.kind} ${String(problem.at)}`),
};
