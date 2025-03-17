// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: '**/*.spec.js',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    actionTimeout: 15000,
    navigationTimeout: 15000,
    trace: 'on',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 }
    },
    viewport: { width: 1280, height: 720 },
    headless: false,
    launchOptions: {
      slowMo: 500,
      args: ['--disable-web-security']
    }
  },
  
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        launchOptions: {
          args: ['--disable-web-security', '--start-maximized']
        }
      }
    }
  ],
  
  outputDir: 'test-results/',
  preserveOutput: 'always',
}); 