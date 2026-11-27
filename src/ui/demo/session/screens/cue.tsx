import { onSettled } from 'solid-js';
import { decodePals, decodeSessionPals } from '../../../pals/pal-svg';
import { cueRing } from '../../../play/cue-motion';
import { LastSongCue } from '../../../play/LastSongCue';
import type { SessionScreenProps, SessionScreens } from '../registry';
import type { JSX } from '@solidjs/web';

// The `cue` screen of the session demo: the last-song cue on the load scene (play-sessions spec, "Screens and
// motion"), frozen at the scene time `t`, with a loaded song: the ring shows the time out of 3.2 s. The cover is an
// invented flower picture, as in the sunset prototype.

const COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="oklch(0.67 0.17 345)"/>' +
      '<rect y="168" width="200" height="32" fill="oklch(0.62 0.15 145)"/>' +
      '<rect x="94" y="100" width="12" height="80" rx="6" fill="oklch(0.55 0.15 145)"/>' +
      '<ellipse cx="124" cy="146" rx="22" ry="10" transform="rotate(-30 124 146)" fill="oklch(0.62 0.17 145)"/>' +
      '<g transform="translate(100 82)">' +
      Array.from(
        { length: 10 },
        (_, k) => `<ellipse cx="0" cy="-34" rx="13" ry="28" transform="rotate(${String(k * 36)})" fill="#fff"/>`
      ).join('') +
      '<circle r="22" fill="oklch(0.86 0.17 80)"/><circle cx="-6" cy="-6" r="5" fill="#fff" opacity=".6"/></g></svg>'
  );

const CueScreen = (props: SessionScreenProps): JSX.Element => {
  // The scene showed `t` seconds ago, and the ring stays at its fill for `t`: the frame does not change after the freeze.
  const shownAt = performance.now() - props.t * 1000;
  const fill = cueRing(props.t, 1);
  let root: HTMLElement | undefined;
  /** Calls `ready` when the ring has reached its fill. */
  const whenRingFull = (): void => {
    const ring = root?.querySelector('.load-ring');
    if (ring?.getAttribute('data-fill') === String(Math.round(fill * 100))) {
      props.ready();
      return;
    }
    requestAnimationFrame(whenRingFull);
  };
  onSettled(() => {
    Promise.all([decodePals(), decodeSessionPals()]).then(whenRingFull, reportError);
  });
  return (
    <main
      class="demo-cue"
      ref={(el) => {
        root = el;
      }}
    >
      <LastSongCue picture={COVER} loadFill={() => fill} shownAt={shownAt} failed={false} reduce={props.reduce} />
    </main>
  );
};

export const screens: SessionScreens = { cue: CueScreen };
