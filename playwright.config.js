import { defineConfig, devices } from '@playwright/test';

const useExistingServers = process.env.PLAYWRIGHT_USE_EXISTING_SERVERS === 'true';

export default defineConfig({
   testDir: './tests/e2e',
   fullyParallel: false,
   workers: 1,
   forbidOnly: !!process.env.CI,
   retries: process.env.CI ? 2 : 0,
   reporter: 'list',
   use: {
      baseURL: 'http://localhost:5000',
      trace: 'retain-on-failure',
   },
   projects: [
      {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
      },
   ],
   webServer: useExistingServers
      ? undefined
      : [
         {
            command: 'npm run dev -- --host 127.0.0.1',
            url: 'http://localhost:5000',
            reuseExistingServer: false,
            timeout: 30_000,
         },
      ],
});
