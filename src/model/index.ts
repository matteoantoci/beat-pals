// The public interface of the game model. The UI and the tests import only from this file.
// The model is pure TypeScript: no DOM, no time, no audio.

export { readChart } from './chart/chart-file';
export type { SongFacts } from './chart/facts';
export { readSongChart } from './chart/song-chart';
export { isParentAnswer, parentProblem } from './parent';
export type { ParentProblem } from './parent';
export { soundStart } from './silence';
