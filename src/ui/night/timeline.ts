import { playKeys } from '../motion/keys';
import { ARM_SIDES } from '../pals/session-pal-motion';
import type { Curve } from './motion';

// Plays the curves of a scene (./motion.ts) on the parts of the stage (./NightStage.tsx), with the one player of the
// scene motion (src/ui/motion/keys.ts).

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
  ...Object.fromEntries(ARM_SIDES.map(({ part, selector }) => [part, selector])),
};

/** The selector of a part of the stage, with no pal. */
const stageSelector = (part: string): string =>
  part.startsWith('sun-face-')
    ? `.sun-face[data-face="${part.slice('sun-face-'.length)}"]`
    : (SUN_PARTS[part] ?? `[data-part="${part}"]`);

const selectorOf = (curve: Curve): string => {
  if (curve.pal === undefined) {
    return stageSelector(curve.part);
  }
  const pal = `[data-pal="${String(curve.pal)}"] `;
  return curve.part.startsWith('face-')
    ? `${pal}.session-pal-face[data-face="${curve.part.slice('face-'.length)}"]`
    : pal + (PAL_PARTS[curve.part] ?? '');
};

/** Starts each curve of the list on the parts under `root`. A part that the stage does not have plays nothing. A curve
 * with `loop` plays again and again. */
export const playCurves = (root: Element, curves: readonly Curve[]): void => {
  for (const curve of curves) {
    root.querySelectorAll(selectorOf(curve)).forEach((el) => {
      const animation = playKeys(el, curve.prop, curve.keys);
      if (curve.loop) {
        animation?.effect?.updateTiming({ iterations: Infinity });
      }
    });
  }
};
