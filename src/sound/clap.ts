// The clap that a hit plays (spec, "Play rules": hit sound). The sound layer makes it from noise, so it needs no
// file and no licence.

const RATE = 44_100;
const SECONDS = 0.2;
/** 3 short noise bursts and a short tail, as a hand clap. */
const BURSTS = [0, 0.011, 0.023];
const TAIL_AT = 0.031;
const BURST_DECAY = 0.003;
const TAIL_DECAY = 0.035;
const LEVEL = 0.25;

let clap: AudioBuffer | undefined;

/** The loudness of the clap at a time, from 0 to 1. */
const envelope = (time: number): number => {
  const tail = time < TAIL_AT ? 0 : Math.exp(-(time - TAIL_AT) / TAIL_DECAY);
  const bursts = BURSTS.reduce((sum, at) => (time < at ? sum : sum + Math.exp(-(time - at) / BURST_DECAY)), 0);
  return Math.min(1, tail + bursts);
};

/** Makes the clap sound one time. An AudioBuffer works in each context, so it stays good after a replacement. */
export const clapBuffer = (): AudioBuffer => {
  if (clap) {
    return clap;
  }
  clap = new AudioBuffer({ length: RATE * SECONDS, sampleRate: RATE });
  const samples = clap.getChannelData(0);
  let last = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const noise = Math.random() * 2 - 1;
    // The difference of 2 noise samples removes the low sound, so the clap is bright.
    samples[index] = (noise - last) * LEVEL * envelope(index / RATE);
    last = noise;
  }
  return clap;
};
