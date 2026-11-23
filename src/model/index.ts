// The public interface of the game model. The UI and the tests import only from this file.
// The model is pure TypeScript: no DOM, no time, no audio.

export { readChart } from './chart/chart-file';
export type { SongFacts } from './chart/facts';
export { readSongChart } from './chart/song-chart';
export { childChart, RECORD_COLORS } from './child/child-chart';
export type { ChildChart, RecordColor } from './child/child-chart';
export type { SpeedStep } from './child/speed-steps';
export { isParentAnswer, parentProblem } from './parent';
export type { ParentProblem } from './parent';
export { soundStart } from './silence';
export { firstSongTime, songTime, startAt } from './clock';
export type { ClockReading, SongStart } from './clock';
export { apply, result, startPlay } from './play/play';
export type { Action, Lane, PlayEvent, PlayState } from './play/play';
