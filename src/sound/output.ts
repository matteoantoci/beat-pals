// The output of each AudioContext (spec, "Sound effects"): one limiter in front of the speakers for the song, the
// sound effects, and the title music, so a boosted clap over a loud part of a song does not clip.

/** Limiter-like settings: above -0.5 dBFS, each dB in gives 1/20 dB out, with the fastest attack and a short release
 * that keeps the dip of the song after a clap short. prepare-song sets the true peak of each song to -0.5 dBTP, so a
 * song alone passes unchanged; the limiter acts only when a boosted effect lands on a loud part. Chromium and WebKit
 * delay the whole output by about 6 ms (the look-ahead of the compressor), the song and the effects alike. */
const LIMITER = { threshold: -0.5, knee: 0, ratio: 20, attack: 0, release: 0.1 } as const;

/**
 * The compressor adds a makeup gain of its own (Web Audio spec, "Computing the makeup gain"): its curve at 0 dBFS,
 * inverted, to the power 0.6. Here the curve gives -0.475 dB at 0 dBFS, so the makeup is +0.285 dB. A gain after
 * the compressor takes it back, so a sound below the threshold (the song, and the title music with its peak at
 * -6.9 dBFS) keeps its loudness.
 */
const UNDO_MAKEUP_DB = 0.6 * LIMITER.threshold * (1 - 1 / LIMITER.ratio);

const outputs = new WeakMap<AudioContext, AudioNode>();

/** The node to connect each sound of `ctx` to, in place of `ctx.destination`. */
export const outputOf = (ctx: AudioContext): AudioNode => {
  const known = outputs.get(ctx);
  if (known) {
    return known;
  }
  const limiter = new DynamicsCompressorNode(ctx, LIMITER);
  limiter.connect(new GainNode(ctx, { gain: 10 ** (UNDO_MAKEUP_DB / 20) })).connect(ctx.destination);
  outputs.set(ctx, limiter);
  return limiter;
};
