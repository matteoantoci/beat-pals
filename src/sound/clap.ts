// The clap that a hit plays (spec, "Play rules": hit sound). The sound layer makes it from noise, so it needs no
// file and no licence. A great hit adds a short bright layer, so it sounds a little bigger (story 13; prototype
// play-style A `clap(great)`, C8).

const RATE = 44_100;
const SECONDS = 0.2;
/** 3 short noise bursts and a short tail, as a hand clap. */
const BURSTS = [0, 0.011, 0.023];
const TAIL_AT = 0.031;
const BURST_DECAY = 0.003;
const TAIL_DECAY = 0.035;
const LEVEL = 0.25;
/**
 * The bright layer of a great hit: a burst of noise around 4.2 kHz on the third burst. The filter keeps about a
 * quarter of the noise, so a level of 1.5 makes the layer about half as loud as the clap, as in the prototype.
 */
const BRIGHT = { at: 0.022, decay: 0.01, hz: 4200, q: 1.2, level: 1.5 } as const;

const claps = new Map<boolean, AudioBuffer>();

/** The loudness of the clap at a time, from 0 to 1. */
const envelope = (time: number): number => {
  const tail = time < TAIL_AT ? 0 : Math.exp(-(time - TAIL_AT) / TAIL_DECAY);
  const bursts = BURSTS.reduce((sum, at) => (time < at ? sum : sum + Math.exp(-(time - at) / BURST_DECAY)), 0);
  return Math.min(1, tail + bursts);
};

/** A band-pass filter (RBJ biquad, 0 dB peak gain) for one stream of samples. */
const bandPass = (hz: number, q: number): ((sample: number) => number) => {
  const w = (2 * Math.PI * hz) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b2, a1, a2] = [alpha / a0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  return (sample) => {
    const out = b0 * sample + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, sample, y1, out];
    return out;
  };
};

/** The bright layer at a time, from a new noise sample through the band-pass filter. */
const brightAt = (time: number, filtered: number): number =>
  time < BRIGHT.at ? 0 : filtered * BRIGHT.level * Math.exp(-(time - BRIGHT.at) / BRIGHT.decay);

/**
 * Makes the clap sound one time: the plain clap, or the great clap with its bright layer. An AudioBuffer works in
 * each context, so it stays good after a replacement.
 */
export const clapBuffer = (great: boolean): AudioBuffer => {
  const known = claps.get(great);
  if (known) {
    return known;
  }
  const clap = new AudioBuffer({ length: RATE * SECONDS, sampleRate: RATE });
  const samples = clap.getChannelData(0);
  const filter = bandPass(BRIGHT.hz, BRIGHT.q);
  let last = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / RATE;
    const noise = Math.random() * 2 - 1;
    // The difference of 2 noise samples removes the low sound, so the clap is bright.
    const plain = (noise - last) * envelope(time);
    const bright = great ? brightAt(time, filter(Math.random() * 2 - 1)) : 0;
    samples[index] = (plain + bright) * LEVEL;
    last = noise;
  }
  claps.set(great, clap);
  return clap;
};
