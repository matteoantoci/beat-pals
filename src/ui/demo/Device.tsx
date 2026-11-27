import type { JSX } from '@solidjs/web';

/** The iPhone 12 of `sim` in the demo routes: the notch, the home indicator, and the round screen corners
 * (./demo.css). */
export const Device = (): JSX.Element => (
  <div class="demo-device" aria-hidden="true">
    <i class="demo-notch" />
    <i class="demo-home" />
  </div>
);
