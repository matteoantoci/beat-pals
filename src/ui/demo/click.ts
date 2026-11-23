// The generated click of the demo song: a short tick on each beat of the demo chart, as a WAV file in memory. The
// demo decodes it like a song, so the song end and the progress beads use the length of the decoded audio, as in a
// real play (spec, "Sound and the audio clock").

const RATE = 22_050;
const CLICK_SEC = 0.03;
const PITCH_HZ = 1000;
const LOUDNESS = 0.6;
/** The click lasts this long after the last beat. */
const TAIL_SEC = 2;
const HEADER_BYTES = 44;
const ascii = new TextEncoder();

/** The header of a mono 16-bit PCM WAV file with this many samples. */
const writeHeader = (data: DataView, samples: number): void => {
  const bytes = new Uint8Array(data.buffer);
  bytes.set(ascii.encode('RIFF'), 0);
  data.setUint32(4, 36 + samples * 2, true);
  bytes.set(ascii.encode('WAVEfmt '), 8);
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, RATE, true);
  data.setUint32(28, RATE * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  bytes.set(ascii.encode('data'), 36);
  data.setUint32(40, samples * 2, true);
};

/** One click from the sample `start`, cut at the end of the file. */
const writeClick = (data: DataView, start: number, samples: number): void => {
  const end = Math.min(samples, start + Math.round(CLICK_SEC * RATE));
  for (let at = start; at < end; at += 1) {
    const wave = Math.sin((2 * Math.PI * PITCH_HZ * (at - start)) / RATE) * LOUDNESS;
    data.setInt16(HEADER_BYTES + at * 2, Math.round(wave * 0x7f_ff), true);
  }
};

/** A mono 16-bit WAV file with a click on each beat time. */
export const clickTrack = (beats: readonly number[]): ArrayBuffer => {
  const samples = Math.ceil((Math.max(0, ...beats) + TAIL_SEC) * RATE);
  const data = new DataView(new ArrayBuffer(HEADER_BYTES + samples * 2));
  writeHeader(data, samples);
  for (const beat of beats) {
    writeClick(data, Math.round(beat * RATE), samples);
  }
  return data.buffer;
};
