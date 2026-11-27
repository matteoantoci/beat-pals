import { For, onSettled, Show } from 'solid-js';
import { SessionPal } from '../pals/SessionPal';
import { Sun, type SunFace, type SunRays } from '../sun/Sun';
import { RAYS, SUN_COLORS } from '../sun/sun-step';
import { Logo } from '../title/logo';
import { GOODBYE_SUN_FACES, goodbyePlan } from './goodbye';
import { GOODBYE_FACES } from './goodbye-pals';
import { nightPlan, PALS, type Curve } from './motion';
import { Blanket, Moon, PlaySign, Stars, Zzz } from './night-parts';
import { playCurves } from './timeline';
import { WAKE_SUN_FACES, wakePlan } from './wake';
import { WAKE_FACES } from './wake-pals';
import type { PalFace } from '../pals/pal-svg';
import type { JSX } from '@solidjs/web';

// The stage of the session end and start (play-sessions spec, "Screens and motion"), as the title scenes of the
// sunset prototype: the skies (sunset, night with stars, first light, dawn), the moon, the big sun, the hill, the
// logo and the wordmark, and the pals with the blanket and the "Zzz". One stage shows 3 scenes:
// - `goodbye`: the scene after the last song, from the wave to the sleep (./goodbye.ts).
// - `night`: the night title. The pals sleep and breathe slowly. With `restTimeOver`, the first light shows behind
//   the hill and the moon is low. The change fades in while the night title shows.
// - `wake`: the wake-up scene (./wake.ts). The stage measures the logo to put the sun behind it.
// The stage plays the motion of its scene when it shows, and then calls `onShown`. The sounds, the length, and the
// taps belong to the scene components (src/ui/session/GoodbyeScene.tsx, src/ui/title/NightTitle.tsx,
// src/ui/session/WakeScene.tsx).

export type NightMode = 'goodbye' | 'night' | 'wake';

type NightStageProps = {
  readonly mode: NightMode;
  readonly reduce: boolean;
  /** The rest time is over (night title and wake-up scene). */
  readonly restTimeOver?: boolean;
  /** A 3-second hold on the logo (night title only). */
  readonly onLogoHold?: (() => void) | undefined;
  readonly onPointerUp?: () => void;
  /** The motion of the scene started. */
  readonly onShown?: () => void;
  readonly children?: JSX.Element;
};

/** The middle of an element in the box of `root`, and its width. */
const placeIn = (root: Element, el: Element): { x: number; y: number; width: number } => {
  const box = root.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2, width: rect.width };
};

/** The wake-up scene: puts the sun behind the logo, and gives the curves with the measured distances. */
const wakeCurves = (root: HTMLElement, reduce: boolean, restTimeOver: boolean): Curve[] => {
  const logo = root.querySelector('.logo');
  const sun = root.querySelector<HTMLElement>('.sun');
  const hill = root.querySelector<HTMLElement>('.night-hill');
  const brand = root.querySelector('[data-part="brand"]');
  if (!logo || !sun || !hill || !brand) {
    return [];
  }
  // In landscape, the brand starts in the middle and moves to its column at the end (./wake.ts), so the sun rises
  // behind the logo in the middle.
  const landscape = root.offsetWidth > root.offsetHeight;
  const brandShift = landscape ? root.offsetWidth / 2 - placeIn(root, brand).x : 0;
  const place = placeIn(root, logo);
  sun.style.left = `${String(place.x + brandShift)}px`;
  sun.style.top = `${String(place.y)}px`;
  sun.style.setProperty('--sun-d', `${String(Math.round(place.width * 0.52))}px`);
  const hillTop = root.offsetHeight - hill.offsetHeight;
  return wakePlan({ reduce, restTimeOver, rise: hillTop + place.width * 0.6 - place.y, brandShift });
};

/** What each scene of the stage has. */
type Scene = {
  /** The class of the scene, which the smoke test looks for. */
  readonly class: string;
  /** The faces of the stacks of the pals, bottom first. */
  readonly faces: readonly PalFace[];
  /** The sunset sky behind the night sky. */
  readonly sunsetSky: boolean;
  /** The big sun, if the scene has one. */
  readonly sun?: { readonly faces: readonly SunFace[]; readonly color: string; readonly rays: SunRays };
  /** The play button. */
  readonly play: boolean;
  /** The curves of the scene, for the stage that shows. */
  readonly plan: (stage: HTMLElement, props: NightStageProps) => Curve[];
};

const SCENES: Readonly<Record<NightMode, Scene>> = {
  goodbye: {
    class: 'goodbye',
    faces: GOODBYE_FACES,
    sunsetSky: true,
    sun: { faces: GOODBYE_SUN_FACES, color: SUN_COLORS.sunset, rays: RAYS.sunset },
    play: false,
    plan: (_, props) => goodbyePlan(props.reduce),
  },
  night: {
    class: 'night-title',
    faces: ['sleep'],
    sunsetSky: false,
    play: false,
    plan: (_, props) => nightPlan(props.reduce),
  },
  wake: {
    class: 'wake-up',
    faces: WAKE_FACES,
    sunsetSky: false,
    sun: { faces: WAKE_SUN_FACES, color: SUN_COLORS.day, rays: { opacity: 0, scale: 0.7 } },
    play: true,
    plan: (stage, props) => wakeCurves(stage, props.reduce, props.restTimeOver ?? false),
  },
};

/** The skies, the moon, the sun, and the hill: everything behind the logo and the pals. */
const Sky = (props: { readonly scene: Scene }): JSX.Element => (
  <>
    <div class="night-layer stage-backdrop" />
    <div class="night-layer night-sky-dawn" data-part="sky-dawn" />
    <div class="night-layer night-sky" data-part="sky-night">
      <Stars />
    </div>
    <div class="night-layer night-light" data-part="first-light" />
    <Show when={props.scene.sunsetSky}>
      <div class="night-layer night-sky-sunset" data-part="sky-sunset" />
    </Show>
    <div class="night-moon" data-part="moon">
      <Moon id="night-moon" />
    </div>
    <div class="night-moon night-moon-low">
      <Moon id="night-moon-low" />
    </div>
    <Show when={props.scene.sun} keyed>
      {(sun) => <Sun class="night-sun" faces={sun.faces} color={sun.color} rays={sun.rays} />}
    </Show>
    <div class="night-hill" data-part="hill" />
  </>
);

/** The logo with the wordmark, the play button of the wake-up scene, and the pals in their bed. */
const Content = (props: { readonly scene: Scene; readonly onLogoHold?: (() => void) | undefined }): JSX.Element => (
  <div class="night-content">
    <div class="title-brand night-brand" data-part="brand">
      <Logo sleepy onHold={props.onLogoHold} />
      <h1 class="title-word">
        Beat <span>Pals</span>
      </h1>
    </div>
    <Show when={props.scene.play}>
      <PlaySign />
    </Show>
    <div class="pal-band night-band" aria-hidden="true">
      <For each={PALS}>
        {(index) => (
          <span class="night-pal" data-pal={index}>
            <SessionPal index={index} faces={props.scene.faces} />
          </span>
        )}
      </For>
      <Blanket />
      <Zzz />
    </div>
  </div>
);

export const NightStage = (props: NightStageProps): JSX.Element => {
  let root: HTMLElement | undefined;
  onSettled(() => {
    if (!root) {
      return;
    }
    playCurves(root, SCENES[props.mode].plan(root, props));
    props.onShown?.();
  });
  return (
    <main
      ref={(el) => {
        root = el;
      }}
      class={[
        'night-stage',
        `night-${props.mode}`,
        SCENES[props.mode].class,
        { 'night-rest-time-over': props.restTimeOver ?? false, 'night-reduce': props.reduce },
      ]}
      onPointerUp={() => props.onPointerUp?.()}
    >
      <Sky scene={SCENES[props.mode]} />
      <Content scene={SCENES[props.mode]} onLogoHold={props.onLogoHold} />
      {props.children}
    </main>
  );
};
