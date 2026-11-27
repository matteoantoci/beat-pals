import { render } from '@solidjs/web';
import { watchLifecycle } from './shell/lifecycle';
import { playDayOf } from './shell/play-day';
import { createDeviceStorage, localStorageAdapter } from './shell/storage';
import { checkForUpdate, watchUpdates } from './shell/update';
import { installSound } from './sound';
import { App } from './ui/App';
import { createSession } from './ui/session/controller';
import { StorageContext } from './ui/storage';
import type { JSX } from '@solidjs/web';

const root = document.getElementById('app');
if (!root) {
  throw new Error('index.html has no #app element.');
}
// iOS Safari zooms on a two-finger pinch even with `touch-action: none`, so the gesture events are blocked too
// (docs/research/ios-pwa-audio.md §7).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}

// The one device storage of this run. The screens get it from the context, and the session controller gets it here.
const storage = createDeviceStorage(localStorageAdapter());
const withStorage = (screen: () => JSX.Element) => (): JSX.Element => (
  <StorageContext value={storage}>{screen()}</StorageContext>
);

// The demo routes (`?demo=...` for the play screen, `?session=...` for the session scenes) of the dev server and the
// smoke build. The `deploy` build sets DEMO to false, so the bundler drops these branches, and the demo code and its
// fixture are not in the site.
const query = new URLSearchParams(location.search);
if (import.meta.env.DEMO && query.has('demo')) {
  import('./ui/demo/DemoScreen').then(
    ({ DemoScreen }) =>
      render(
        withStorage(() => <DemoScreen search={location.search} />),
        root
      ),
    reportError
  );
} else if (import.meta.env.DEMO && query.has('session')) {
  import('./ui/demo/session/SessionDemo').then(
    ({ SessionDemo }) =>
      render(
        withStorage(() => <SessionDemo search={location.search} />),
        root
      ),
    reportError
  );
} else {
  // Before the first touch: the audio session, the music preload, and the unlock on each touch.
  installSound();
  // The session state comes from storage before the first screen (play-sessions spec, "Storage"). The controller gets
  // the clock, the timers, and the visibility of the page here.
  const session = createSession({
    clock: { now: Date.now, day: playDayOf },
    timers: window,
    visible: document.visibilityState === 'visible',
    store: storage.session,
  });
  render(
    withStorage(() => <App session={session} />),
    root
  );

  // The service worker registers and checks for a new version. A new version waits for a safe point:
  // the title screen before the first touch, or the night title.
  watchUpdates();
  // iOS can end a hidden app with no other event, so the save and the session state are written at each hide, on
  // every screen (spec, "Save"). The session stops its count at a hide and applies the gap rule at a show.
  watchLifecycle({
    hidden: () => {
      storage.save.write();
      session.hide();
    },
    visible: () => {
      checkForUpdate();
      session.show();
    },
  });
}
