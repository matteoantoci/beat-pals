import { render } from '@solidjs/web';
import { watchLifecycle } from './shell/lifecycle';
import { writeSave } from './shell/save';
import { checkForUpdate, watchUpdates } from './shell/update';
import { installSound } from './sound';
import { App } from './ui/App';
import { createSession } from './ui/session/controller';

const root = document.getElementById('app');
if (!root) {
  throw new Error('index.html has no #app element.');
}
// iOS Safari zooms on a two-finger pinch even with `touch-action: none`, so the gesture events are blocked too
// (docs/research/ios-pwa-audio.md §7).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

// The demo routes (`?demo=...` for the play screen, `?session=...` for the session scenes) of the dev server and the
// smoke build. The `deploy` build sets DEMO to false, so the bundler drops these branches, and the demo code and its
// fixture are not in the site.
const query = new URLSearchParams(location.search);
if (import.meta.env.DEMO && query.has('demo')) {
  import('./ui/demo/DemoScreen').then(
    ({ DemoScreen }) => render(() => <DemoScreen search={location.search} />, root),
    reportError
  );
} else if (import.meta.env.DEMO && query.has('session')) {
  import('./ui/demo/session/SessionDemo').then(
    ({ SessionDemo }) => render(() => <SessionDemo search={location.search} />, root),
    reportError
  );
} else {
  // Before the first touch: the audio session, the music preload, and the unlock on each touch.
  installSound();
  // The session state comes from storage before the first screen (play-sessions spec, "Storage").
  const session = createSession();
  render(() => <App session={session} />, root);

  // The service worker registers and checks for a new version. A new version waits for a safe point:
  // the title screen before the first touch, or the night title.
  watchUpdates();
  // iOS can end a hidden app with no other event, so the save and the session state are written at each hide, on
  // every screen (spec, "Save"). The session stops its count at a hide and applies the gap rule at a show.
  watchLifecycle({
    hidden: () => {
      writeSave();
      session.hide();
    },
    visible: () => {
      checkForUpdate();
      session.show();
    },
  });
}
