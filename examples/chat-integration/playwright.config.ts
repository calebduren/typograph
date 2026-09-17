import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: process.platform === 'darwin' ? 'chrome' : undefined,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run worker',
      url: 'http://127.0.0.1:8788/health',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:4175',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
