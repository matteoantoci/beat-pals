import { createEffect, For, onCleanup, onSettled } from 'solid-js';
import { loadSoundOn } from '../../shell/settings';
import { fadeOutTitleMusic, playSceneSounds, type StopSounds } from '../../sound';
import { decodeSessionPals } from '../pals/pal-svg';
import { SessionPal } from '../pals/SessionPal';
import {
  armShowKeys,
  CUE_PALS,
  CUE_SOUNDS,
  cueRing,
  FADE_IN,
  GLOW,
  hopKeys,
  MUSIC_FADE_SEC,
  RAY_PULSE,
  RAY_TURN,
  SUN_SINK,
  waveKeys,
  type Key,
} from './cue-motion';
import { stopCue } from './cue-stop';
import { LoadDisc } from './LoadDisc';
import type { JSX } from '@solidjs/web';

// The last-song cue (play-sessions spec, "Screens and motion"): the load scene of the last song of a session, a
// sunset that the child cannot miss. The turning record with the cover is the sun, with rays and a glow behind it,
// and it sinks onto the horizon. The pals stand on the hill below at about 2 times their play size, wave together,
// and hop up and down. The title music fades out, and the music-box tune plays alone; the rays pulse on its notes
// (./cue-motion.ts). A failed load stops the wave and the hops, the pals show the oops face, and the tune stops.
// Reduced motion: the scene fades in, the arms stay raised, and nothing else moves. The ring still fills.
// The scene fills its positioned parent, and reads the safe areas from the --inset-* properties (play.css).

type LastSongCueProps = {
  /** The cover picture of the song, or undefined for the plain card. */
  readonly picture: string | undefined;
  /** The load fill (0 to 1) at the time `now` (ms, the clock of `performance.now()`). */
  readonly loadFill: (now: number) => number;
  /** The time when the scene showed (ms, the clock of `performance.now()`). The ring counts its 3.2 s from it. */
  readonly shownAt: number;
  readonly failed: boolean;
  /** Reduced motion, read when the scene starts. */
  readonly reduce: boolean;
};

/** The 16 rays around the sun, as lines from radius 62 to 80 in a box of 200 around the centre. */
const RAYS = Array.from({ length: 16 }, (_, k) => {
  const angle = ((k * 360) / 16 - 90) * (Math.PI / 180);
  const point = (radius: number): readonly [string, string] => [
    (Math.cos(angle) * radius).toFixed(1),
    (Math.sin(angle) * radius).toFixed(1),
  ];
  return [...point(62), ...point(80)] as const;
});

/** The motion of one property: its keys, and the CSS value of a key value. */
type Motion = { readonly property: string; readonly keys: readonly Key[]; readonly unit: (value: number) => string };

/** One Web Animation of a property along its keys, on the scene timeline. It holds its first value before the first
 * key and its last value after the last key. */
const track = (el: Element, { property, keys, unit }: Motion): void => {
  const start = keys[0]?.[0] ?? 0;
  const length = Math.max(0.001, (keys.at(-1)?.[0] ?? 0) - start);
  const frames = keys.map(([at, value, easing]) => ({
    offset: (at - start) / length,
    [property]: unit(value),
    easing: easing ?? 'linear',
  }));
  el.animate(frames, { delay: start * 1000, duration: length * 1000, fill: 'both' });
};

const px = (value: number): string => `0px ${String(value)}px`;
const deg = (value: number): string => `${String(value)}deg`;
const plain = (value: number): string => String(value);

/** A motion of each element that a selector finds in the scene. */
type PartMotion = { readonly selector: string; readonly motion: Motion };

/** The motion of the sky parts: the rays pulse and turn, the glow gets brighter, and the sun sinks. */
const SKY_MOTIONS: readonly PartMotion[] = [
  { selector: '.cue-rays', motion: { property: 'scale', keys: RAY_PULSE, unit: plain } },
  { selector: '.cue-rays', motion: { property: 'rotate', keys: RAY_TURN, unit: deg } },
  { selector: '.cue-glow', motion: { property: 'opacity', keys: GLOW, unit: plain } },
  { selector: '.cue-sun', motion: { property: 'translate', keys: SUN_SINK, unit: px } },
];

/** The arm of a session pal on one side: -1 turns it to the left, 1 to the right. */
const SIDES = [
  { arm: 'left', selector: '.session-pal-arm-left', turn: -1 },
  { arm: 'right', selector: '.session-pal-arm-right', turn: 1 },
] as const;

/** The hops of a pal, and the wave of its arms that show. */
const palMotions = (pal: (typeof CUE_PALS)[number]): readonly PartMotion[] => {
  const body = `.cue-pal-${pal.place} .session-pal`;
  return [
    { selector: body, motion: { property: 'translate', keys: hopKeys(pal.delay), unit: px } },
    ...SIDES.filter(({ arm }) => pal.arms.includes(arm)).flatMap(({ selector, turn }): PartMotion[] => [
      {
        selector: `${body} ${selector}`,
        motion: { property: 'rotate', keys: waveKeys(pal.delay), unit: (value) => deg(turn * value) },
      },
      { selector: `${body} ${selector}`, motion: { property: 'opacity', keys: armShowKeys(pal.delay), unit: plain } },
    ]),
  ];
};

/** Starts the motion of the scene. Reduced motion: only the fade-in. */
const playCue = (root: HTMLElement, reduce: boolean): void => {
  track(root, { property: 'opacity', keys: FADE_IN, unit: plain });
  const motions = reduce ? [] : [...SKY_MOTIONS, ...CUE_PALS.flatMap(palMotions)];
  for (const { selector, motion } of motions) {
    root.querySelectorAll(selector).forEach((el) => track(el, motion));
  }
};

/** The sky behind the sun: the sunset colours, the glow, and the rays. */
const Sky = (): JSX.Element => (
  <>
    <div class="cue-sky" />
    <div class="cue-glow" />
    <svg class="cue-rays" viewBox="-100 -100 200 200">
      <For each={RAYS}>{(ray) => <line x1={ray[0]} y1={ray[1]} x2={ray[2]} y2={ray[3]} />}</For>
    </svg>
  </>
);

/** The pals on the hill, with the happy face and the oops face for a failed load. */
const Band = (): JSX.Element => (
  <div class="cue-band">
    <For each={CUE_PALS}>
      {(pal) => (
        <span class={`cue-pal cue-pal-${pal.place}`}>
          <SessionPal index={pal.index} faces={['happy', 'oops']} />
        </span>
      )}
    </For>
  </div>
);

const noSounds: StopSounds = () => undefined;

export const LastSongCue = (props: LastSongCueProps): JSX.Element => {
  let root: HTMLElement | undefined;
  let stopTune = noSounds;
  // The reduced-motion choice holds for the whole scene, as the end scene reads it at its start.
  const reduce = props.reduce;
  onSettled(() => {
    fadeOutTitleMusic(MUSIC_FADE_SEC);
    stopTune = playSceneSounds(CUE_SOUNDS, loadSoundOn());
    decodeSessionPals().catch(() => undefined);
    if (root) {
      playCue(root, reduce);
    }
  });
  // The tune rings out when the song starts; it ends before the song can start.
  onCleanup(() => stopTune());
  createEffect(
    () => props.failed,
    (failed) => {
      if (failed && root) {
        stopTune('cut');
        stopCue(root, reduce);
      }
    }
  );
  return (
    <div
      class={['last-song-cue', { 'cue-reduce': reduce }]}
      ref={(el) => {
        root = el;
      }}
    >
      <div class="cue-scene">
        <Sky />
        <div class="cue-ground" />
        <div class="cue-shine" />
        <div class="cue-sun">
          <LoadDisc
            picture={props.picture}
            fill={(now) => cueRing((now - props.shownAt) / 1000, props.loadFill(now))}
            stopped={() => props.failed}
          />
        </div>
        <Band />
      </div>
    </div>
  );
};
