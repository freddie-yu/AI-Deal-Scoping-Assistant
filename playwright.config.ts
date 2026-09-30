import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'tests/e2e', globalSetup: './tests/e2e/global-setup.ts', use: { baseURL: 'http://127.0.0.1:3001', channel: process.env.PLAYWRIGHT_CHANNEL } });
