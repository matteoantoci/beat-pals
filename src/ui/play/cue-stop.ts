// The oops moment of the last-song cue (./LastSongCue.tsx; play-sessions spec, "Screens and motion"): "A failed load
// of the cue: the wave and the hops stop, the pals show the oops state."

/** Ends the motions of an element where they are, and moves it from there to `keyframe` in `ms`. */
const settle = (el: Element, keyframe: Keyframe, ms: number): void => {
  for (const animation of el.getAnimations()) {
    animation.commitStyles();
    animation.cancel();
  }
  el.animate([keyframe], { duration: ms, fill: 'forwards', easing: 'ease-out' });
};

/** The time of a face change: a quick cut, or a fade with reduced motion. */
const faceChangeMs = (reduce: boolean): number => (reduce ? 250 : 80);

/** The oops moment of a failed load: each motion stops where it is, the pals land, their arms fade out, and the oops
 * face shows. The CSS animations of the disc stop through the class of the failed load scene (play.css). A load can
 * fail during the fade-in of the scene, so the fade-in ends first: then the oops pals show clearly. */
export const stopCue = (root: HTMLElement, reduce: boolean): void => {
  const fadeIn = root.getAnimations();
  for (const animation of fadeIn) {
    animation.finish();
  }
  const motions = root.getAnimations({ subtree: true });
  for (const animation of motions.filter((a) => !fadeIn.includes(a) && !(a instanceof CSSAnimation))) {
    animation.pause();
  }
  root.querySelectorAll('.session-pal').forEach((body) => settle(body, { translate: '0px 0px' }, 150));
  root.querySelectorAll('.session-pal-arm').forEach((arm) => settle(arm, { opacity: 0 }, 200));
  root.querySelectorAll('.session-pal-face[data-face="oops"]').forEach((face) => {
    face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: faceChangeMs(reduce), fill: 'forwards' });
  });
};
