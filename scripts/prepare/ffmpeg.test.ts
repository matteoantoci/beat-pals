import { describe, expect, it } from 'vitest';
import { encodeArgs, measureArgs, parseLoudnorm } from './ffmpeg.ts';

const REPORT = `size=N/A time=00:03:03.60 bitrate=N/A speed=27.2x
[Parsed_loudnorm_2 @ 0x7c8b0189c0]
{
	"input_i" : "-11.35",
	"input_tp" : "1.92",
	"input_lra" : "6.80",
	"input_thresh" : "-21.55",
	"output_i" : "-14.02",
	"output_tp" : "-0.73",
	"output_lra" : "6.70",
	"output_thresh" : "-24.20",
	"normalization_type" : "linear",
	"target_offset" : "0.02"
}
[out#0/null @ 0x7c8b018240] video:0KiB audio:137684KiB`;

const graphOf = (args: readonly string[]) => args[args.indexOf('-filter_complex') + 1];

describe('the ffmpeg arguments', () => {
  it('mixes the parts with amix normalize=0 and measures the loudness in pass 1', () => {
    const args = measureArgs(['a.opus', 'b.opus']);

    expect(args.filter((_, at) => args[at - 1] === '-i')).toEqual(['a.opus', 'b.opus']);
    expect(graphOf(args)).toBe(
      '[0:a]aformat=channel_layouts=stereo[a0];[1:a]aformat=channel_layouts=stereo[a1];' +
        '[a0][a1]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-0.5:LRA=20:linear=true:print_format=json[out]'
    );
    expect(args.slice(-3)).toEqual(['-f', 'null', '-']);
  });

  it('gives the measured values to pass 2 for a linear gain, and writes AAC at 44.1 kHz', () => {
    const args = encodeArgs(['a.opus'], parseLoudnorm(REPORT), 'song.m4a');

    expect(graphOf(args)).toBe(
      '[0:a]aformat=channel_layouts=stereo[a0];[a0]loudnorm=I=-14:TP=-0.5:LRA=20:measured_I=-11.35:measured_TP=1.92:' +
        'measured_LRA=6.80:measured_thresh=-21.55:offset=0.02:linear=true:print_format=json[out]'
    );
    expect(args.join(' ')).toContain('-ar 44100 -c:a aac');
    expect(args.at(-1)).toBe('song.m4a');
  });
});

describe('parseLoudnorm', () => {
  it('reads the JSON report at the end of the ffmpeg output', () => {
    expect(parseLoudnorm(REPORT)).toMatchObject({
      input_i: '-11.35',
      output_i: '-14.02',
      normalization_type: 'linear',
    });
  });

  it('refuses output with no loudness report', () => {
    expect(() => parseLoudnorm('[out] {"size": "N/A"}')).toThrow('no loudness values');
  });
});
