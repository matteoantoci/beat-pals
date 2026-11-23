import { defineConfig } from 'vitest/config';

// Tests cover the game model, which has no DOM (spec, Testing Decisions), and the pure parts of the Mac scripts.
// This file keeps vite-plugin-solid out of the test run, because that plugin selects jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
