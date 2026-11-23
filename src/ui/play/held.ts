// The soft holds that the play screen shows: which hold notes a finger holds, and which were let go before their end.

/** The hold state of a note: not held, held by a finger, or let go before its end. */
export const HOLD = { none: 0, held: 1, letGo: 2 } as const;

/** The soft holds of a play: the `HOLD` state of each note and the pointer that holds each held note. */
type Holds = {
  /** The `HOLD` state of each note. */
  readonly holds: Uint8Array;
  /** A pointer hit the hold `note`: it holds it. */
  readonly grab: (note: number, pointerId: number) => void;
  /** A pointer went up: it lets go of its hold, if any. */
  readonly letGo: (pointerId: number) => void;
};

/** The soft holds of a play with `count` notes. */
export const makeHolds = (count: number): Holds => {
  const holds = new Uint8Array(count);
  const holders = new Map<number, number>();
  return {
    holds,
    grab: (note: number, pointerId: number): void => {
      holds[note] = HOLD.held;
      holders.set(pointerId, note);
    },
    letGo: (pointerId: number): void => {
      const note = holders.get(pointerId);
      holders.delete(pointerId);
      if (note !== undefined && holds[note] === HOLD.held) {
        holds[note] = HOLD.letGo;
      }
    },
  };
};
