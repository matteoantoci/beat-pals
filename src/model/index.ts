// The public interface of the game model. The UI and the tests import only from this file.
// The model is pure TypeScript: no DOM, no time, no audio.

export { isParentAnswer, parentProblem } from './parent';
export type { ParentProblem } from './parent';
export { soundStart } from './silence';
export { firstSongTime, songTime, startAt } from './clock';
export type { ClockReading, SongStart } from './clock';
