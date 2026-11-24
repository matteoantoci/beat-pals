import { defineConfig } from 'vitest/config';

// Tests cover the game model, which has no DOM (spec, Testing Decisions), and the pure parts of the Mac scripts.
// This file keeps the plugins of vite.config.ts (Solid, PWA, song store) out of the test run, because the tests have
// no JSX.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
