// The fill ring of the load scene (spec, "Screens", load scene). Only the read of the song files gives real progress:
// the decrypt and `decodeAudioData` are single calls with no events. So the ring follows the bytes up to READ_END,
// then moves with time at the predicted decode speed and waits at DECODE_END until the decode ends, and the stage
// build steps fill the rest. The prediction learns the decode rate of the device from each load.

/** The step of the load and what the ring knows about it. */
export type LoadPhase =
  | { readonly step: 'read'; readonly bytes: number; readonly total: number }
  | { readonly step: 'decode'; readonly startedAt: number; readonly predictedMs: number }
  | { readonly step: 'stage'; readonly done: number; readonly steps: number };

const READ_END = 0.1;
const DECODE_END = 0.85;
const MB = 1024 * 1024;

/** The decode rate before the first load on a device, in ms for each MB of encoded audio. */
export const FIRST_DECODE_MS_PER_MB = 300;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** The share of the ring to fill (0 to 1) at the time `now` (ms, the clock of `startedAt`). */
export const ringFill = (phase: LoadPhase, now: number): number => {
  if (phase.step === 'read') {
    return READ_END * clamp01(phase.total > 0 ? phase.bytes / phase.total : 0);
  }
  if (phase.step === 'decode') {
    return READ_END + (DECODE_END - READ_END) * clamp01((now - phase.startedAt) / Math.max(1, phase.predictedMs));
  }
  return DECODE_END + (1 - DECODE_END) * clamp01(phase.steps > 0 ? phase.done / phase.steps : 1);
};

/** The predicted decode time of `bytes` of encoded audio. */
export const decodeTime = (bytes: number, msPerMb: number): number => (bytes / MB) * msPerMb;

/**
 * The rate for the next prediction after a decode of `bytes` in `ms`: the mean of the old and the measured rate, so
 * one slow load moves the prediction only half of the way.
 */
export const nextDecodeRate = (old: number, bytes: number, ms: number): number =>
  bytes > 0 && ms > 0 ? (old + ms / (bytes / MB)) / 2 : old;
