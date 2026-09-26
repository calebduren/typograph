import { defineConfig } from '@playwright/test';

// Override when 4174 is taken, e.g. by a local dev server: PLAYWRIGHT_PORT=4175.
const port = process.env.PLAYWRIGHT_PORT ?? '4174';

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    channel: process.platform === 'darwin' ? 'chrome' : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    timeout: 120_000,
    command: `npx wrangler dev --config ../../wrangler.jsonc --local --port ${port} --inspector-port 9239`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
