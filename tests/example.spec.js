// @ts-check
const { test, expect } = require('@playwright/test');

test('Example test', async ({ page }) => {
  // Go to Google
  await page.goto('https://www.google.com');
  
  // Expect the title to contain "Google"
  await expect(page).toHaveTitle(/Google/);
  
  console.log('Test is running correctly!');
}); 