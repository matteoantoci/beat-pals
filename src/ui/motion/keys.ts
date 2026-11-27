// The shared parts of the scene motion (play-sessions spec, "Screens and motion"): the keys of a curve, the one
// player that turns keys into a Web Animation, the easings, the squash and stretch, and the face changes. The yawn of
// the end scene (src/ui/end/yawn.ts), the goodbye, night, and wake-up scenes (src/ui/night/), the last-song cue
// (src/ui/play/LastSongCue.tsx), and the sun step (src/ui/sun/sky-motion.ts) use them.

/** One key of a curve: the scene time in seconds, the value, and the easing to the next key (linear by default). */
export type Key<V = string> = readonly [at: number, value: V, easing?: string];

export const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  in: 'cubic-bezier(0.55, 0, 0.8, 0.4)',
  sine: 'cubic-bezier(0.37, 0, 0.63, 1)',
  set: 'cubic-bezier(0.45, 0, 0.75, 0.6)',
} as const;

/** A scale of the width and the height. The squash and stretch of the pals stay within 6% of 1.0 on each axis. */
export type Squash = readonly [width: number, height: number];

/** The CSS scale value of a squash. */
export const scale = ([width, height]: Squash): string => `${String(width)} ${String(height)}`;

/** An angle on one side, as a CSS rotate value: side -1 turns to the left, 1 to the right. */
export const deg = (side: number, angle: number): string => `${String(side * angle)}deg`;

/** A CSS translate value in px. */
export const px = (x: number, y: number): string => `${String(x)}px ${String(y)}px`;

/** Keys with values in a unit, for example angles in degrees, as keys with CSS values. */
export const keysIn = <V>(keys: readonly Key<V>[], unit: (value: V) => string): Key[] =>
  keys.map(([at, value, easing]) => (easing === undefined ? [at, unit(value)] : [at, unit(value), easing]));

/** A CSS property as a key of a Web Animation keyframe: `background-color` gives `backgroundColor`. A custom
 * property stays as it is. */
const keyOf = (prop: string): string =>
  prop.startsWith('--') ? prop : prop.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

/**
 * Plays the keys of one property on an element as one Web Animation on the scene clock, and gives the animation.
 * Before the first key the first value holds, and after the last key the last value holds (fill both). Thus 2 curves
 * of one property never hide each other when they do not overlap. One key holds its value from its time on, for
 * example a pose. No element plays nothing.
 */
export const playKeys = (el: Element | null | undefined, prop: string, keys: readonly Key[]): Animation | undefined => {
  const start = keys[0]?.[0] ?? 0;
  const end = keys.at(-1)?.[0] ?? start;
  const duration = Math.max(1, (end - start) * 1000);
  const frames = keys.map(([at, value, easing]) => ({
    offset: Math.min(1, Math.max(0, ((at - start) * 1000) / duration)),
    [keyOf(prop)]: value,
    easing: easing ?? 'linear',
  }));
  // A Web Animation with one keyframe goes to the value under the animation at its end, so one key gets a second
  // keyframe with the same value.
  const [only] = frames;
  const held = frames.length === 1 && only ? [only, { ...only, offset: 1 }] : frames;
  return el?.animate(held, { delay: start * 1000, duration, fill: 'both' });
};

/** The time of a face change in seconds (play-sessions spec): a 0.08 s cut, or a 0.25 s fade with reduced motion. */
export const faceChangeSec = (reduce: boolean): number => (reduce ? 0.25 : 0.08);

/**
 * The opacity keys of the faces of a stack, bottom first. Face k shows from `times[k]` (the first face from the start)
 * until `times[k + 1]`, and fades in during the `fade` before its time. With `over`, the face below goes out just
 * after the face above covers it: the faces of a pal share one outline, so the pal never turns see-through. Else the
 * face below fades out while the face above fades in (the sun and the logo).
 */
export const faceStackKeys = (times: readonly number[], fade: number, over: boolean): Key[][] =>
  times.map((on, k) => {
    const keys: Key[] =
      k === 0
        ? [[0, '1']]
        : [
            [on - fade, '0'],
            [on, '1'],
          ];
    const off = times[k + 1];
    if (off !== undefined) {
      keys.push(over ? [off, '1'] : [off - fade, '1'], over ? [off + 0.001, '0'] : [off, '0']);
    }
    return keys;
  });
