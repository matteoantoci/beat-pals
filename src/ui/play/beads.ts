// The progress beads of a song in the HUD of the play screen and of the demo route: no numbers, only beads that fill.

/** The number of progress beads of a song. */
export const BEADS = 10;

/** The number of full beads at song time `t` of a song of `duration` seconds. */
export const fullBeads = (t: number, duration: number): number =>
  Math.max(0, Math.min(BEADS, Math.floor((t / duration) * BEADS)));

/** Fills the first `full` beads. */
export const fillBeads = (beads: readonly HTMLElement[], full: number): void => {
  let at = 0;
  for (const bead of beads) {
    bead.classList.toggle('full', at < full);
    at += 1;
  }
};
