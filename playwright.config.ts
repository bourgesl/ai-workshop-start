// The web view in a real browser, with the data, viewport and fonts of the recorded demo
// (.agents/skills/process-tracks/sample_demo.ts). Every run records each test's video and
// screenshots in docs/tests.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'docs/tests',
  // One browser at a time, no retries: a run either passes as written or fails.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    screenshot: { mode: 'on', fullPage: false },
    launchOptions: {
      // The same glyphs on every run: no hinting, subpixel positioning or LCD text.
      args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'],
    },
  },
});
