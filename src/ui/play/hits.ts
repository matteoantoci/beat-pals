// The note that a `hit` event of the play model hit. The play screen needs it to remove the bubble of the note.
//
// The event gives the lane and `soundAt`: the note time for an early tap, and the tap time for a late tap. So the hit
// note is the last note of the lane at or before `soundAt`. For a late tap no other note lies between the note and
// the tap: the good window of a note is at most 45% of the gap to the next note, so a later note would be nearer
// to the tap than the window allows.

import type { ChildChart, PlayEvent } from '../../model';

type Hit = Extract<PlayEvent, { type: 'hit' }>;

/** The index in the child chart of the note that the hit hit. */
export const hitNote = (chart: ChildChart, hit: Hit): number =>
  chart.notes.findLastIndex((note) => note.t <= hit.soundAt && note.lanes.includes(hit.lane));
