// The public interface of the game model. The UI and the tests import only from this file.
// The model is pure TypeScript: no DOM, no time, no audio.

export { readChart } from './chart/chart-file';
export type { SongFacts } from './chart/facts';
export { readSongChart } from './chart/song-chart';
export { bandOf, childChart, RECORD_COLORS } from './child/child-chart';
export type { ChildChart, RecordColor } from './child/child-chart';
export type { SpeedStep } from './child/speed-steps';
export { danceOf, NEW_SONG, playSetup, scorePlay } from './progress/progress';
export type { Dance, PlayScore, SongProgress } from './progress/progress';
export { restore, snapshot, songProgress, withSong } from './progress/save';
export type { SavedProgress } from './progress/save';
export { isParentAnswer, parentProblem } from './parent';
export type { ParentProblem } from './parent';
export { soundStart } from './silence';
export { firstSongTime, songTime, startAt } from './clock';
export type { ClockReading, SongStart } from './clock';
export { apply, result, startPlay } from './play/play';
export type { Action, Lane, PlayEvent, PlayState } from './play/play';
export { decodeKeyCode, encodeKeyCode, FAMILY_KEY_BYTES } from './store/key-code';
export {
  decryptFile,
  ENCRYPTION_OVERHEAD,
  encryptFile,
  makeKeyCheck,
  openFamilyKey,
  opensKeyCheck,
  storeName,
} from './store/family-key';
export type { FamilyKey } from './store/family-key';
export { readManifest, readSongIndex } from './store/manifest';
export type { CoverType, IndexSong, Manifest, SongIndex } from './store/manifest';
export { downloadPlan } from './download/plan';
export type { DownloadPlan } from './download/plan';
