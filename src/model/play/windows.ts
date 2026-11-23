// The hit windows (spec, "Play rules"). A tap counts for a note when it is inside the good window of the note.

/** The great window: a tap at most this far from the note time is a great hit. */
export const GREAT_SEC = 0.1;
/** The widest good window. */
const GOOD_SEC = 0.25;
/** A good window is never more than this share of the gap to a neighbour note, so 2 windows never overlap. */
const GAP_SHARE = 0.45;

/**
 * The good window of each note, in seconds, from the note times in time order. The cap uses the gap to the next
 * note and the gap to the note before, so the window of a note never reaches into the window of a neighbour.
 */
export const goodWindows = (times: readonly number[]): number[] =>
  times.map((t, at) => {
    const before = times[at - 1] ?? Number.NEGATIVE_INFINITY;
    const after = times[at + 1] ?? Number.POSITIVE_INFINITY;
    return Math.min(GOOD_SEC, GAP_SHARE * (t - before), GAP_SHARE * (after - t));
  });
