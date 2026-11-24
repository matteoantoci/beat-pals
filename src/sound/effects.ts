// The sound effects (spec, "Sound effects"): 8 recorded CC0 files in public/sounds/, mono WAV, 16-bit, 44.1 kHz,
// with the silence trimmed and the peak at -1 dBFS (credits in src/model/credits/credits.ts). The clap of a hit, the
// level-up sounds, and the star moment play on the song clock (./song.ts); the record, the star, and the join play in
// the end scene.
// The play gain follows the Pile Pals level rule (Pile Pals scripts/audio/prep.py): a file below 0.4 s gets a true
// peak of -6 dBTP, a longer file -18 LUFS with its true peak at -1 dBTP or lower; then no file has a higher maximum
// momentary loudness than the great clap (-21.6 LUFS), as the snap in Pile Pals. Over a song, the effects get a boost
// that follows the song level (./boost.ts). All effects go through the limiter of ./output.ts.
import { readyClip } from './engine';
import { outputOf } from './output';
import type { EnergyStep } from '../model';

/** The steps that a step up reaches. */
export type LevelUpStep = Exclude<EnergyStep, 0>;

/** The play gain in dB of each effect. Its file is `sounds/<effect>.wav`. The claps are 3 dB below the level rule:
 * the parent heard them too loud over the songs, in quiet and in loud parts. */
const GAIN_DB = {
  clap: -8,
  'clap-great': -8,
  'level-up': -8.2,
  gold: -6.1,
  record: -3.8,
  star: -8.5,
  join: -5,
  'star-moment': -10.1,
} as const;

type Effect = keyof typeof GAIN_DB;

const fileOf = (effect: string): string => `sounds/${effect}.wav`;

/** The files of all effects, for the preload at start. */
export const EFFECT_FILES: readonly string[] = Object.keys(GAIN_DB).map(fileOf);

/** One effect to play, its playbackRate (a rate above 1 plays it higher and shorter), its boost in dB over its play
 * gain (the song level boost, 0 when absent), and a change in dB of its play gain (0 when absent). */
export type Shot = {
  readonly effect: Effect;
  readonly rate: number;
  readonly boostDb?: number;
  readonly gainDb?: number;
};

/** A whole tone is 2 semitones. */
const WHOLE_TONE = 2 ** (2 / 12);

/** A high shelf on the claps: their crack above 3 kHz is what pierces over a loud song. The plain clap is 6 dB softer
 * there. The great clap is only 3 dB softer, because its tambourine lives above 3 kHz and makes it sound bigger. */
const CLAP_SHELF_DB = { clap: -6, 'clap-great': -3 } as const;

const isClap = (effect: Effect): effect is keyof typeof CLAP_SHELF_DB => effect in CLAP_SHELF_DB;

/** The claps take this share of the song level boost: the full boost made them too loud in loud parts, while the
 * chimes need all of it. 0.5 gives the claps at most 5 dB. */
const CLAP_BOOST_SHARE = 0.5;

const clapShelves = new WeakMap<AudioContext, Record<keyof typeof CLAP_SHELF_DB, AudioNode>>();

/** The high shelf of a clap in `ctx`, in front of the output: one node for each clap, made at its first play. */
const clapShelfOf = (ctx: AudioContext, effect: keyof typeof CLAP_SHELF_DB): AudioNode => {
  const known = clapShelves.get(ctx);
  if (known) {
    return known[effect];
  }
  const shelf = (gain: number): AudioNode => {
    const node = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 3000, gain });
    node.connect(outputOf(ctx));
    return node;
  };
  const made = { clap: shelf(CLAP_SHELF_DB.clap), 'clap-great': shelf(CLAP_SHELF_DB['clap-great']) };
  clapShelves.set(ctx, made);
  return made[effect];
};

/** The level-up sound of a step: steps 1 to 3 play the same chime, each one whole tone higher; gold plays the bells. */
export const levelUpShot = (step: LevelUpStep): Shot =>
  step === 'gold' ? { effect: 'gold', rate: 1 } : { effect: 'level-up', rate: WHOLE_TONE ** (step - 1) };

/** The star moment plays about 9 times in a song, so each time it plays up to 1 semitone higher or lower and up to
 * 1.5 dB louder or softer. */
const STAR_MOMENT_SPREAD = { semitones: 1, db: 1.5 } as const;

/** The star moment sound with its random change. `random` gives a number from 0 to 1. */
export const starMomentShot = (random: () => number): Shot => ({
  effect: 'star-moment',
  rate: 2 ** ((STAR_MOMENT_SPREAD.semitones * (2 * random() - 1)) / 12),
  gainDb: STAR_MOMENT_SPREAD.db * (2 * random() - 1),
});

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
  const boost = (shot.boostDb ?? 0) * (isClap(shot.effect) ? CLAP_BOOST_SHARE : 1);
  const gain = new GainNode(ctx, { gain: 10 ** ((GAIN_DB[shot.effect] + (shot.gainDb ?? 0) + boost) / 20) });
  source.connect(gain).connect(isClap(shot.effect) ? clapShelfOf(ctx, shot.effect) : outputOf(ctx));
  source.start(when);
  return source;
};
