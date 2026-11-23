// The start silence of a loop. The title music loops in Web Audio with the start silence trimmed
// (spec, "Sound and the audio clock"). The sound layer passes in the samples, so the model has no audio.

/** A sample at or below this level (about -60 dBFS) is silence. */
const SILENCE = 0.001;

/** The time in seconds of the first sample above the silence level. 0 when the samples are all silent. */
export const soundStart = (samples: Float32Array, sampleRate: number): number => {
  const first = samples.findIndex((sample) => Math.abs(sample) > SILENCE);
  return first < 0 ? 0 : first / sampleRate;
};
