import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1440, height: 1000 },
    channel: process.platform === 'darwin' ? 'chrome' : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    timeout: 120_000,
    command:
      'npx wrangler dev --config ../../wrangler.jsonc --local --port 4174 --inspector-port 9239',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
