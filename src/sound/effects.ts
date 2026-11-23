// The sound effects (spec, "Sound effects"): 7 recorded CC0 files in public/sounds/, mono WAV, 16-bit, 44.1 kHz,
// with the silence trimmed and the peak at -1 dBFS (credits in src/model/credits/credits.ts). The clap of a hit and
// the level-up sounds play on the song clock (./song.ts); the record, the star, and the join play in the end scene.
// The play gain follows the Pile Pals level rule (Pile Pals scripts/audio/prep.py): a file below 0.4 s gets a true
// peak of -6 dBTP, a longer file -18 LUFS with its true peak at -1 dBTP or lower; then no file has a higher maximum
// momentary loudness than the great clap (-21.6 LUFS), as the snap in Pile Pals. Over a song, the effects get a boost
// that follows the song level (./boost.ts). All effects go through the limiter of ./output.ts.
import { readyClip } from './engine';
import { outputOf } from './output';
import type { EnergyStep } from '../model';

/** The steps that a step up reaches. */
export type LevelUpStep = Exclude<EnergyStep, 0>;

/** The play gain in dB of each effect. Its file is `sounds/<effect>.wav`. */
const GAIN_DB = {
  clap: -5,
  'clap-great': -5,
  'level-up': -8.2,
  gold: -6.1,
  record: -3.8,
  star: -8.5,
  join: -5,
} as const;

type Effect = keyof typeof GAIN_DB;

const fileOf = (effect: string): string => `sounds/${effect}.wav`;

/** The files of all effects, for the preload at start. */
export const EFFECT_FILES: readonly string[] = Object.keys(GAIN_DB).map(fileOf);

/** One effect to play, its playbackRate (a rate above 1 plays it higher and shorter), and its boost in dB over its
 * play gain (the song level boost, 0 when absent). */
export type Shot = { readonly effect: Effect; readonly rate: number; readonly boostDb?: number };

/** A whole tone is 2 semitones. */
const WHOLE_TONE = 2 ** (2 / 12);

/** The level-up sound of a step: steps 1 to 3 play the same chime, each one whole tone higher; gold plays the bells. */
export const levelUpShot = (step: LevelUpStep): Shot =>
  step === 'gold' ? { effect: 'gold', rate: 1 } : { effect: 'level-up', rate: WHOLE_TONE ** (step - 1) };

/**
 * Starts an effect in `ctx` at the context time `when`. Gives its source, or undefined when the file is not decoded
 * yet: the files load at start, and a late sound is wrong, so it does not play.
 */
export const startEffect = (ctx: AudioContext, shot: Shot, when: number): AudioBufferSourceNode | undefined => {
  const buffer = readyClip(fileOf(shot.effect));
  if (!buffer) {
    return undefined;
  }
  const source = new AudioBufferSourceNode(ctx, { buffer, playbackRate: shot.rate });
  const gain = new GainNode(ctx, { gain: 10 ** ((GAIN_DB[shot.effect] + (shot.boostDb ?? 0)) / 20) });
  source.connect(gain).connect(outputOf(ctx));
  source.start(when);
  return source;
};
