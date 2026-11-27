import { defineConfig } from 'vitest/config';

// Tests cover the game model, which has no DOM (spec, Testing Decisions), and the pure parts of the Mac scripts.
// This file keeps the plugins of vite.config.ts (Solid, PWA, song store) out of the test run, because the tests have
// no JSX. Vitest gives an empty text for a CSS file by default. The test of the sun places reads the strip heights of
// the sky strip, so that file keeps its text.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    css: { include: [/\/src\/ui\/sun\/sky\.css/] },
  },
});
