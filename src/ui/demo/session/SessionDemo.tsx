import demoCss from '../demo.css?inline';
import { Device } from '../Device';
import { DEMO_MARKER } from '../marker';
import { readSessionDemo } from './params';
import { SESSION_SCREENS } from './registry';
import type { JSX } from '@solidjs/web';

// The session demo route of the dev server and the smoke build (play-sessions spec, "Demo route"): one screen of
// the session scenes from the screen registry (./registry.ts), frozen at the scene time `t`, for the screenshots of
// the manual check. With `sim`, every screen gets the iPhone 12 safe areas (../demo.css): the root holds the screen
// inside the safe areas as #app does, and a full-screen part reads them from its --inset-* properties. The root
// carries the demo marker, so the deploy gate refuses a site that holds the route.

export const SessionDemo = (props: { readonly search: string }): JSX.Element => {
  const read = readSessionDemo(props.search, Object.keys(SESSION_SCREENS));
  const demo = read.ok ? read.demo : undefined;
  const Screen = demo && SESSION_SCREENS[demo.screen];
  let root: HTMLElement | undefined;
  const ready = (): void => {
    requestAnimationFrame(() => {
      if (!root || !demo) {
        return;
      }
      for (const animation of root.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = demo.t * 1000;
      }
      root.setAttribute('data-demo-ready', '');
    });
  };
  return (
    <div
      class={demo?.sim ? 'session-demo demo-sim' : 'session-demo'}
      data-demo={DEMO_MARKER}
      ref={(el) => {
        root = el;
      }}
    >
      <style>{demoCss}</style>
      {demo && Screen ? (
        <Screen t={demo.t} reduce={demo.reduce} ready={ready} />
      ) : (
        <p class="demo-failure">{read.ok ? '' : read.reason}</p>
      )}
      {demo?.sim ? <Device /> : undefined}
    </div>
  );
};
