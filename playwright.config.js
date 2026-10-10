import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:4173/PrivnetAI/',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --base /PrivnetAI/',
    url: 'http://127.0.0.1:4173/PrivnetAI/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
