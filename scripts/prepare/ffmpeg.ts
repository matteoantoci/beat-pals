// The encoder of `prepare-song` with ffmpeg (spec, "The song pipeline"). It mixes the audio parts with
// `amix=normalize=0` and sets the loudness in 2 passes of `loudnorm`: pass 1 measures the mix, and pass 2 uses the
// measured values for one linear gain, so the song keeps its dynamics. `-ar 44100` sets the output rate, because
// `loudnorm` outputs 192 kHz and the AAC encoder then writes 96 kHz. The picture is scaled to one square size.
// ffmpeg runs with an argument list and no shell. Only `runFfmpeg` starts a process; the rest is pure.

import { spawn } from 'node:child_process';
import type { Encoder } from './run.ts';

/** The values of the `loudnorm` JSON report that pass 2 needs, and the result of pass 2. */
type Loudness = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  output_i: string;
  normalization_type: string;
  target_offset: string;
};

const KEYS = [
  'input_i',
  'input_tp',
  'input_lra',
  'input_thresh',
  'output_i',
  'normalization_type',
  'target_offset',
] as const;

// About -14 LUFS (P3). The true peak of -0.5 dBTP leaves room for a linear gain on a loud master. A wide range
// (LRA 20) keeps pass 2 linear: loudnorm changes to dynamic mode when the range of the song is wider than LRA.
const TARGET = 'I=-14:TP=-0.5:LRA=20';
/** The cover size: a square of 512 px. The picture fills it, and the overflow is cut off at both sides. */
const COVER = '512:512';
const BASE = ['-hide_banner', '-nostdin', '-loglevel', 'info'];
/** The last lines of the ffmpeg output in an error. */
const ERROR_LINES = 6;

/** Each part becomes stereo first, so a mono part and a stereo part mix. */
const filterGraph = (count: number, loudnorm: string): string => {
  const inputs = Array.from(
    { length: count },
    (_, at) => `[${String(at)}:a]aformat=channel_layouts=stereo[a${String(at)}]`
  );
  const labels = Array.from({ length: count }, (_, at) => `[a${String(at)}]`).join('');
  const mix = count === 1 ? '' : `amix=inputs=${String(count)}:normalize=0:duration=longest,`;
  return [...inputs, `${labels}${mix}loudnorm=${TARGET}:${loudnorm}:print_format=json[out]`].join(';');
};

const inputArgs = (parts: readonly string[]): string[] => parts.flatMap((part) => ['-i', part]);

/** Pass 1: measure the loudness of the mix. The output goes nowhere. */
export const measureArgs = (parts: readonly string[]): string[] => [
  ...BASE,
  ...inputArgs(parts),
  '-filter_complex',
  filterGraph(parts.length, 'linear=true'),
  '-map',
  '[out]',
  '-f',
  'null',
  '-',
];

/** Pass 2: mix again with the measured values, and write AAC at 44.1 kHz into an .m4a file. */
export const encodeArgs = (parts: readonly string[], measured: Loudness, out: string): string[] => {
  const values = [
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
  ].join(':');
  return [
    ...BASE,
    ...inputArgs(parts),
    '-filter_complex',
    filterGraph(parts.length, values),
    '-map',
    '[out]',
    '-map_metadata',
    '-1',
    '-ar',
    '44100',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    '-y',
    out,
  ];
};

const isReport = (value: unknown): value is Loudness => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  return KEYS.every((key) => typeof fields.get(key) === 'string');
};

/** Reads the JSON report that `loudnorm` prints at the end of the ffmpeg output. */
export const parseLoudnorm = (output: string): Loudness => {
  const report: unknown = JSON.parse(output.slice(output.lastIndexOf('{'), output.lastIndexOf('}') + 1));
  if (!isReport(report)) {
    throw new Error('The loudnorm report of ffmpeg has no loudness values.');
  }
  return report;
};

const pictureArgs = (input: string, out: string): string[] => [
  ...BASE,
  '-i',
  input,
  '-vf',
  `scale=${COVER}:force_original_aspect_ratio=increase,crop=${COVER},setsar=1`,
  '-frames:v',
  '1',
  '-update',
  '1',
  ...(out.endsWith('.jpg') ? ['-q:v', '2'] : []),
  '-y',
  out,
];

/** Runs ffmpeg with an argument list and no shell. Gives the ffmpeg log (stderr), or fails with its end. */
const runFfmpeg = async (args: readonly string[]): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const chunks: Buffer[] = [];
  ffmpeg.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
  ffmpeg.on('error', (error) => reject(new Error(`ffmpeg does not start: ${error.message}`)));
  ffmpeg.on('close', (code) => {
    const output = Buffer.concat(chunks).toString('utf8');
    if (code === 0) {
      resolve(output);
    } else {
      reject(new Error(`ffmpeg failed:\n${output.trim().split('\n').slice(-ERROR_LINES).join('\n')}`));
    }
  });
  return promise;
};

export const ffmpegEncoder: Encoder = {
  audio: async (parts, out) => {
    const measured = parseLoudnorm(await runFfmpeg(measureArgs(parts)));
    const result = parseLoudnorm(await runFfmpeg(encodeArgs(parts, measured, out)));
    return [
      `loudness: ${measured.input_i} LUFS (true peak ${measured.input_tp} dBTP) to ${result.output_i} LUFS, ${result.normalization_type} gain`,
    ];
  },
  picture: async (input, out) => {
    await runFfmpeg(pictureArgs(input, out));
  },
};
