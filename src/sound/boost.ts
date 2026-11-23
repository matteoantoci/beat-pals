// The song level boost of the sound effects (spec, "Sound effects"). A meter on the song path reads the level of the
// last 0.34 s, and each effect over the song plays louder when the song is loud, so a clap stays clear in a loud part.
import { outputOf } from './output';

/**
 * The song level with no boost, in dBFS RMS of the meter. The songs are prepared to about -13 LUFS and reach about
 * -9 LUFS in their loud parts. The full boost belongs to the loud parts, so the boost starts 10 dB lower, at about
 * -19 LUFS: the quiet passages, where the effects already sound right. On 8 of the prepared songs, the meter (the
 * RMS of the mono mix over 0.34 s, with no K-weighting) reads 2.5 to 4 dB below the momentary loudness M, so -19 LUFS
 * is about -22 dBFS on the meter. The middle of a song (about -17.5 dBFS) then gets about 4.5 dB, and a loud part
 * (-15 to -11 dBFS) gets 7 to 10 dB. First values to tune.
 */
const QUIET_REF_DB = -22;
/** The highest boost. The great clap peaks at -21.6 LUFS momentary, so at full boost it is about -11.6 LUFS, 2.6 LU
 * below a loud part of -9 LUFS: a short clap is clear at that level. The limiter catches the peaks. */
const MAX_BOOST_DB = 10;
/** The samples that the meter reads: 16384 are 0.34 s at 48 kHz and 0.37 s at 44.1 kHz. */
const METER_SAMPLES = 16_384;

/** The level of the samples in dBFS RMS. Silence gives -Infinity. */
export const levelDb = (samples: Float32Array): number => {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return 10 * Math.log10(sum / samples.length);
};

/** The boost in dB of an effect over a song at `songDb` dBFS RMS: 0 at the quiet reference and below, at most 10. */
export const boostDb = (songDb: number): number => Math.min(MAX_BOOST_DB, Math.max(0, songDb - QUIET_REF_DB));

/** The meter of one song source, in front of the output of `ctx`. The song passes through it. */
export const songMeter = (ctx: AudioContext): AnalyserNode => {
  const meter = new AnalyserNode(ctx, { fftSize: METER_SAMPLES });
  meter.connect(outputOf(ctx));
  return meter;
};

/** One buffer for each read, so a hit allocates nothing. */
const samples = new Float32Array(METER_SAMPLES);

/**
 * The boost of an effect from the song level now. A clap that an early tap schedules at the note time uses the
 * level at the tap, up to 0.25 s before it plays: the level changes little in that time.
 */
export const songBoostDb = (meter: AnalyserNode): number => {
  meter.getFloatTimeDomainData(samples);
  return boostDb(levelDb(samples));
};
