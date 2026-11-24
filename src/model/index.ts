// The public interface of the game model. The UI and the tests import only from this file, with one exception: the
// demo route (src/ui/demo/frozen.ts) imports the test player `model/play/test-player`, to play a chart up to a time.
// The model is pure TypeScript: no DOM, no time, no audio.

export { readChart } from './chart/chart-file';
export type { SongFacts } from './chart/facts';
export { readFacts } from './chart/read-facts';
export { readSongChart } from './chart/song-chart';
export { bandOf, childChart, RECORD_COLORS } from './child/child-chart';
export type { ChildChart, RecordColor } from './child/child-chart';
export type { SpeedStep } from './child/speed-steps';
export { danceOf, NEW_SONG, playSetup, outcomeOf } from './progress/progress';
export type { Dance, PlayOutcome, SongProgress } from './progress/progress';
export { restore, snapshot, songProgress, withSong } from './progress/save';
export type { RestoreFailure, SaveData, SavedProgress } from './progress/save';
export { readSaveCode, saveCode } from './progress/save-code';
export { chartAuthors, CREDIT_GROUPS, CREDITS } from './credits/credits';
export type { CreditGroup } from './credits/credits';
export { isParentAnswer, parentProblem } from './parent';
export { randomFrom } from './random';
export type { ParentProblem } from './parent';
export { soundStart } from './silence';
export { firstSongTime, LOOK_AHEAD, songTime, startAt } from './clock';
export type { ClockReading, SongStart } from './clock';
export { apply, result, startPlay } from './play/play';
export type { PlayState } from './play/play';
export type { Action, Lane, PlayEvent } from './play/play-events';
export type { EnergyStep } from './play/energy';
export { decodeTime, FIRST_DECODE_MS_PER_MB, nextDecodeRate, ringFill } from './play/load-progress';
export type { LoadPhase } from './play/load-progress';
export { decodeKeyCode, encodeKeyCode, FAMILY_KEY_BYTES } from './store/key-code';
export {
  decryptFile,
  ENCRYPTION_OVERHEAD,
  encryptFile,
  IV_BYTES,
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
export { readSetupMark, setupStep } from './download/setup';
export type { SetupMark, SetupStep } from './download/setup';
