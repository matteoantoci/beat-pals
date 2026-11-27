import type { Key, Track } from './motion';

// Plays the tracks of a scene (./motion.ts) on the parts of the stage (./NightStage.tsx) as Web Animations, on the
// scene clock. Each track is one animation with `fill: both`: before its first key the first value holds, and after
// its last key the last value holds, so 2 tracks of one property never hide each other when they do not overlap.

/** The element of a part: `data-part` on the stage, the parts of the sun (src/ui/sun/Sun.tsx), and the parts of a
 * session pal, by their classes. */
const SUN_PARTS: Readonly<Record<string, string>> = {
  sun: '.sun',
  'sun-rise': '.sun-y',
  'sun-rays': '.sun-rays',
};
const PAL_PARTS: Readonly<Record<string, string>> = {
  body: '.session-pal',
  stack: '.session-pal-stack',
  'arm-left': '.session-pal-arm-left',
  'arm-right': '.session-pal-arm-right',
};

/** The selector of a part of the stage, with no pal. */
const stageSelector = (part: string): string =>
  part.startsWith('sun-face-')
    ? `.sun-face[data-face="${part.slice('sun-face-'.length)}"]`
    : (SUN_PARTS[part] ?? `[data-part="${part}"]`);

const selectorOf = (track: Track): string => {
  if (track.pal === undefined) {
    return stageSelector(track.part);
  }
  const pal = `[data-pal="${String(track.pal)}"] `;
  return track.part.startsWith('face-')
    ? `${pal}.session-pal-face[data-face="${track.part.slice('face-'.length)}"]`
    : pal + (PAL_PARTS[track.part] ?? '');
};

/** A CSS property as a key of a Web Animation keyframe: `background-color` gives `backgroundColor`. A custom
 * property stays as it is. */
const keyOf = (prop: string): string =>
  prop.startsWith('--') ? prop : prop.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

const framesOf = (prop: string, keys: readonly Key[]): { frames: Keyframe[]; delay: number; duration: number } => {
  const start = keys[0]?.[0] ?? 0;
  const end = keys.at(-1)?.[0] ?? start;
  const duration = Math.max(1, (end - start) * 1000);
  const frames = keys.map(([at, value, easing]) => ({
    offset: Math.min(1, Math.max(0, ((at - start) * 1000) / duration)),
    [keyOf(prop)]: value,
    easing: easing ?? 'linear',
  }));
  return { frames, delay: start * 1000, duration };
};

/** Starts each track of the list on the parts under `root`. A part that the stage does not have plays nothing. */
export const playTracks = (root: Element, tracks: readonly Track[]): void => {
  for (const track of tracks) {
    const { frames, delay, duration } = framesOf(track.prop, track.keys);
    const timing: KeyframeAnimationOptions = { delay, duration, fill: 'both', iterations: track.loop ? Infinity : 1 };
    root.querySelectorAll(selectorOf(track)).forEach((el) => el.animate(frames, timing));
  }
};
