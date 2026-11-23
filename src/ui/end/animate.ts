// One Web Animation of the end scene, placed on the scene timeline in seconds.

/** When an animation runs on the scene timeline. `fill` is `both` by default: the animation holds its first frame
 * before it starts and its last frame after it ends. A later animation of the same property on the same element
 * uses `forwards`, so it does not hide the first one before it starts. */
export type Cue = {
  readonly at: number;
  readonly sec: number;
  readonly fill?: FillMode;
  readonly easing?: string;
  readonly iterations?: number;
};

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

export const animate = (el: Element, keyframes: Keyframe[], cue: Cue): void => {
  el.animate(keyframes, {
    delay: cue.at * 1000,
    duration: cue.sec * 1000,
    fill: cue.fill ?? 'both',
    easing: cue.easing ?? EASE_OUT,
    iterations: cue.iterations ?? 1,
  });
};
