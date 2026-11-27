import { For, onSettled } from 'solid-js';
import { loadSoundOn } from '../../shell/settings';
import { playSceneSounds } from '../../sound';
import { playStep, RAYS, SUN_COLORS } from './sky-motion';
import { Sun, type SunFace } from './Sun';
import { STAGE_FACE, STEP_SOUNDS, stepPlan, SUN_PLACES, type SunPlace } from './sun-step';
import type { SunStage, SunStep } from '../../model';
import type { JSX } from '@solidjs/web';

// The sky strip at the top of the song list (play-sessions spec, "Screens and motion"; sunset prototype, screens
// "Song list" and "Return to the list"): a sky with the colours of the stage, clouds, the sun with its face, and 2
// hills. The front hill has the colour of the list, so the strip melts into it. The strip starts at the top of the
// list, which is the top safe area: the area under the status bar keeps the app colour (spec, "Further Notes").
// The strip takes no taps, so the song cards stay tappable during a step.
// With a step, the strip shows the new stage, and the old sky and the old sun change into it from 0.5 s to 3.1 s
// (./sky-motion.ts). The sun-step sound plays at 0.5 s.

/** A cloud: x as a share of the width, y and width in px, colour, opacity. */
type Cloud = readonly [number, number, number, string, number];

const CLOUDS: Readonly<Record<SunStage, readonly Cloud[]>> = {
  day: [
    [0.33, 14, 70, '#fff', 0.92],
    [0.86, 50, 52, '#fff', 0.8],
  ],
  afternoon: [[0.38, 40, 62, 'oklch(0.95 0.04 60)', 0.6]],
  sunset: [[0.42, 34, 84, 'oklch(0.8 0.1 10)', 0.32]],
};

const Sky = (props: { readonly stage: SunStage; readonly from?: boolean }): JSX.Element => (
  <div class={`sky sky-${props.stage}${props.from ? ' sky-from' : ''}`}>
    <For each={CLOUDS[props.stage]}>
      {([x, y, width, fill, opacity]) => (
        <svg
          class="sky-cloud"
          viewBox="0 0 80 34"
          style={`left:calc(${x * 100}% - ${width / 2}px);top:${y}px;width:${width}px;opacity:${opacity}`}
        >
          <g fill={fill}>
            <circle cx="27" cy="19" r="12" />
            <circle cx="45" cy="14" r="13" />
            <circle cx="60" cy="21" r="9" />
            <rect x="14" y="20" width="56" height="12" rx="6" />
          </g>
        </svg>
      )}
    </For>
  </div>
);

/** The back hill rises to the right, where the sun sets. Its rim glows at sunset. */
const Hills = (props: { readonly rim: boolean }): JSX.Element => (
  <svg class="sky-hills" viewBox="0 0 390 44" preserveAspectRatio="none">
    <path d="M0 44 V30 C70 24 140 22 200 24 S330 16 390 14 V44Z" fill="oklch(0.37 0.15 287)" />
    <path
      class="sky-rim"
      d="M0 30 C70 24 140 22 200 24 S330 16 390 14"
      fill="none"
      stroke="oklch(0.8 0.14 55)"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
      opacity={props.rim ? 0.7 : 0}
    />
    <path class="sky-front-hill" d="M0 44 V35 C80 30 170 36 260 33 S360 30 390 31 V44Z" />
  </svg>
);

const placeVars = (name: string, place: SunPlace): string =>
  `--${name}x:${place.x * 100}%;--${name}y:${place.y}px;--${name}d:${place.d}px`;

const StripSun = (props: {
  readonly stage: SunStage;
  readonly faces: readonly SunFace[];
  readonly class?: string;
}): JSX.Element => (
  <Sun
    class={props.class ? `sky-sun ${props.class}` : 'sky-sun'}
    faces={props.faces}
    color={SUN_COLORS[props.stage]}
    rays={RAYS[props.stage]}
    // Both orientations: the CSS picks one (./sky.css).
    style={`${placeVars('p', SUN_PLACES.portrait[props.stage])};${placeVars('l', SUN_PLACES.landscape[props.stage])}`}
  />
);

const StepSun = (props: { readonly step: SunStep; readonly reduce: boolean }): JSX.Element =>
  props.reduce ? (
    <>
      <StripSun stage={props.step.from} faces={[STAGE_FACE[props.step.from]]} class="sky-sun-old" />
      <StripSun stage={props.step.to} faces={[STAGE_FACE[props.step.to]]} class="sky-sun-new" />
    </>
  ) : (
    // One sun for the whole step: it starts with the face of the old stage, and the step moves it from the old place.
    <StripSun stage={props.step.to} faces={stepPlan(props.step).faces.map(({ face }) => face)} />
  );

export type SkyStripProps = {
  /** The stage that the list shows. */
  readonly stage: SunStage;
  /** The step that plays one time when the list opens, or null. */
  readonly step: SunStep | null;
  readonly reduce: boolean;
};

export const SkyStrip = (props: SkyStripProps): JSX.Element => {
  let strip: HTMLDivElement | undefined;
  const { stage, step, reduce } = props;
  onSettled(() => {
    if (!step || !strip) {
      return undefined;
    }
    playStep(strip, step, reduce);
    // A tap on a card during the step closes the list: the sound that did not start yet stops.
    return playSceneSounds(STEP_SOUNDS, loadSoundOn());
  });
  return (
    <div
      class="sky-strip"
      aria-hidden="true"
      ref={(el) => {
        strip = el;
      }}
    >
      <Sky stage={stage} />
      {step ? <Sky stage={step.from} from /> : undefined}
      {step ? <StepSun step={step} reduce={reduce} /> : <StripSun stage={stage} faces={[STAGE_FACE[stage]]} />}
      <Hills rim={stage === 'sunset' && !step} />
    </div>
  );
};
