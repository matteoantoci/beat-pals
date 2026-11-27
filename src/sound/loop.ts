// The title loop (spec, "Sound and the audio clock"): one file that plays as a loop with its start silence trimmed.
// It keeps its gain node, so the last-song cue can fade it out (play-sessions spec, "Screens and motion").
import { soundStart } from '../model';
import { currentContext, loadClip, onReplaced } from './engine';
import { outputOf } from './output';

const ignore = (): undefined => undefined;

/** The loop that the app wants to hear. It stays set while the file loads and after a context replacement. */
type Loop = { readonly file: string; readonly gainDb: number };
let wanted: Loop | undefined;
/** The loop that plays now, the context that plays it, and its gain node, so a fade can turn it down. */
type Playing = {
  readonly loop: Loop;
  readonly ctx: AudioContext;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
};
let looping: Playing | undefined;

/** Starts the wanted loop in the current context, if it does not play there yet. */
const startLoop = (loop: Loop): void => {
  const ctx = currentContext();
  if (looping?.loop === loop && looping.ctx === ctx) {
    return;
  }
  looping?.source.stop();
  looping = undefined;
  loadClip(loop.file)
    .then((buffer) => {
      if (wanted !== loop || ctx !== currentContext() || looping) {
        return;
      }
      const offset = soundStart(buffer.getChannelData(0), buffer.sampleRate);
      const source = new AudioBufferSourceNode(ctx, {
        buffer,
        loop: true,
        loopStart: offset,
        loopEnd: buffer.duration,
      });
      const gain = new GainNode(ctx, { gain: 10 ** (loop.gainDb / 20) });
      source.connect(gain).connect(outputOf(ctx));
      source.start(0, offset);
      looping = { loop, ctx, source, gain };
    })
    .catch(ignore);
};

/** Stops the loop, if one plays. */
export const stopLoop = (): void => {
  wanted = undefined;
  looping?.source.stop();
  looping = undefined;
};

/**
 * Turns the loop down to silence over `sec` seconds, then stops it. The loop is not wanted after this call, so a
 * context replacement does not start it again, and a load that is under way does not start it.
 */
export const fadeOutLoop = (sec: number): void => {
  wanted = undefined;
  const playing = looping;
  looping = undefined;
  if (!playing) {
    return;
  }
  const { ctx, source, gain } = playing;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + sec);
  source.stop(now + sec);
};

/**
 * Plays a file as a loop with its start silence trimmed. Call it from a tap. A loop of the same file continues.
 * After a context replacement, the loop starts again in the new context, until `stopLoop` or `fadeOutLoop`.
 */
export const playLoop = (file: string, gainDb: number): void => {
  if (wanted?.file !== file || wanted.gainDb !== gainDb) {
    wanted = { file, gainDb };
  }
  startLoop(wanted);
};

/** Call one time at start: a replacement closes the context of the loop, so the loop starts again in the new
 * context. */
export const installLoop = (): void => {
  onReplaced(() => {
    if (wanted) {
      startLoop(wanted);
    }
  });
};
