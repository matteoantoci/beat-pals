import { render } from 'solid-js/web';
import { watchLifecycle } from './shell/lifecycle';
import { writeSave } from './shell/save';
import { checkForUpdate, watchUpdates } from './shell/update';
import { installSound } from './sound';
import { App } from './ui/App';

const root = document.getElementById('app');
if (!root) {
  throw new Error('index.html has no #app element.');
}
// Before the first touch: the audio session, the music preload, and the unlock on each touch.
installSound();
// iOS Safari zooms on a two-finger pinch even with `touch-action: none`, so the gesture events are blocked too
// (docs/research/ios-pwa-audio.md §7).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
}
render(() => <App />, root);

// The service worker registers and checks for a new version. A new version waits for a safe point:
// the title screen before the first touch.
watchUpdates();
// iOS can end a hidden app with no other event, so the save is written at each hide, on every screen (spec, "Save").
watchLifecycle({
  hidden: () => {
    writeSave();
  },
  visible: checkForUpdate,
});
