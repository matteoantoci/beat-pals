import { createEffect, For, onCleanup, onSettled } from 'solid-js';
import { fadeOutTitleMusic, playSceneSounds, type StopSounds } from '../../sound';
import { deg, keysIn, playKeys, px, type Key } from '../motion/keys';
import { decodeSessionPals } from '../pals/pal-svg';
import { ARM_SIDES } from '../pals/session-pal-motion';
import { SessionPal } from '../pals/SessionPal';
import { useStorage } from '../storage';
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

/** The motion of one property of each element that a selector finds in the scene. */
type PartMotion = { readonly selector: string; readonly prop: string; readonly keys: readonly Key[] };

const plain = (value: number): string => String(value);
const lift = (value: number): string => px(0, value);

/** The motion of the sky parts: the rays pulse and turn, the glow gets brighter, and the sun sinks. */
const SKY_MOTIONS: readonly PartMotion[] = [
  { selector: '.cue-rays', prop: 'scale', keys: keysIn(RAY_PULSE, plain) },
  { selector: '.cue-rays', prop: 'rotate', keys: keysIn(RAY_TURN, (angle) => deg(1, angle)) },
  { selector: '.cue-glow', prop: 'opacity', keys: keysIn(GLOW, plain) },
  { selector: '.cue-sun', prop: 'translate', keys: keysIn(SUN_SINK, lift) },
];

/** The hops of a pal, and the wave of its arms that show. */
const palMotions = (pal: (typeof CUE_PALS)[number]): readonly PartMotion[] => {
  const body = `.cue-pal-${pal.place} .session-pal`;
  return [
    { selector: body, prop: 'translate', keys: keysIn(hopKeys(pal.delay), lift) },
    ...ARM_SIDES.filter(({ arm }) => pal.arms.includes(arm)).flatMap(({ selector, side }): PartMotion[] => [
      {
        selector: `${body} ${selector}`,
        prop: 'rotate',
        keys: keysIn(waveKeys(pal.delay), (angle) => deg(side, angle)),
      },
      { selector: `${body} ${selector}`, prop: 'opacity', keys: keysIn(armShowKeys(pal.delay), plain) },
    ]),
  ];
};

/** Starts the motion of the scene. Reduced motion: only the fade-in. */
const playCue = (root: HTMLElement, reduce: boolean): void => {
  playKeys(root, 'opacity', keysIn(FADE_IN, plain));
  const motions = reduce ? [] : [...SKY_MOTIONS, ...CUE_PALS.flatMap(palMotions)];
  for (const { selector, prop, keys } of motions) {
    root.querySelectorAll(selector).forEach((el) => playKeys(el, prop, keys));
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
  const { sound } = useStorage();
  let root: HTMLElement | undefined;
  let stopTune = noSounds;
  // The reduced-motion choice holds for the whole scene, as the end scene reads it at its start.
  const reduce = props.reduce;
  onSettled(() => {
    fadeOutTitleMusic(MUSIC_FADE_SEC);
    stopTune = playSceneSounds(CUE_SOUNDS, sound.get());
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
