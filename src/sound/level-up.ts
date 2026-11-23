// The level-up sounds of the band energy (spec, "Band energy"): a soft rising bling from G5, A5, or B5 for steps 1
// to 3, and for gold a "ta-da" (a G4 pickup and a C major chord with a soft high shimmer). The sound layer makes
// them in code, as the clap, so they need no file and no licence.

export type LevelUpStep = 1 | 2 | 3 | 'gold';

/** One soft tone: its pitch, its start and length in seconds, its peak level, and its wave. */
type Tone = {
  readonly hz: number;
  readonly at: number;
  readonly sec: number;
  readonly gain: number;
  readonly wave: 'sine' | 'triangle';
};

const RATE = 44_100;
const G5 = 783.99;
/** A bling is a major arpeggio up to the octave, in semitones from its first note. */
const ARPEGGIO = [0, 4, 7, 12];
const ARPEGGIO_GAP = 0.07;
const ATTACK = 0.012;
/** An exponential fade ends at this share of the peak. */
const SILENT = 0.0001;

const semitones = (hz: number, steps: number): number => hz * 2 ** (steps / 12);

const TADA: readonly Tone[] = [
  { hz: 392, at: 0, sec: 0.14, gain: 0.07, wave: 'triangle' },
  ...[523.25, 659.25, 783.99, 1046.5].map((hz): Tone => ({ hz, at: 0.16, sec: 1.2, gain: 0.05, wave: 'triangle' })),
  { hz: 2093, at: 0.2, sec: 0.9, gain: 0.015, wave: 'sine' },
];

/** The tones of the level-up sound of a step. Each step up is one whole tone higher. */
export const levelUpTones = (step: LevelUpStep): readonly Tone[] => {
  if (step === 'gold') {
    return TADA;
  }
  const root = semitones(G5, (step - 1) * 2);
  return ARPEGGIO.map((steps, index) => ({
    hz: semitones(root, steps),
    at: index * ARPEGGIO_GAP,
    sec: 0.5,
    gain: 0.07,
    wave: 'sine',
  }));
};

/** The level of a tone at `time` seconds after its start: a fast rise and an exponential fade. */
const envelope = (tone: Tone, time: number): number => {
  if (time < ATTACK) {
    return tone.gain * (SILENT / tone.gain) ** (1 - time / ATTACK);
  }
  return tone.gain * (SILENT / tone.gain) ** ((time - ATTACK) / (tone.sec - ATTACK));
};

const wave = (tone: Tone, time: number): number => {
  const phase = (tone.hz * time) % 1;
  return tone.wave === 'sine' ? Math.sin(2 * Math.PI * phase) : 1 - 4 * Math.abs(phase - 0.5);
};

/** The sum of the tones at `time` seconds after the start of the sound. */
const mixAt = (tones: readonly Tone[], time: number): number =>
  tones.reduce((sum, tone) => {
    const own = time - tone.at;
    return own < 0 || own >= tone.sec ? sum : sum + envelope(tone, own) * wave(tone, own);
  }, 0);

const buffers = new Map<LevelUpStep, AudioBuffer>();

/** Makes the sound of a step one time. An AudioBuffer works in each context, so it stays good after a replacement. */
export const levelUpBuffer = (step: LevelUpStep): AudioBuffer => {
  const known = buffers.get(step);
  if (known) {
    return known;
  }
  const tones = levelUpTones(step);
  const seconds = Math.max(...tones.map((tone) => tone.at + tone.sec));
  const buffer = new AudioBuffer({ length: Math.ceil(seconds * RATE), sampleRate: RATE });
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = mixAt(tones, index / RATE);
  }
  buffers.set(step, buffer);
  return buffer;
};
