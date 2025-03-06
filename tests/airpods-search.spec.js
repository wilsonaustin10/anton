// @ts-check
const { test, expect } = require('@playwright/test');

test('AirPods search', async ({ page }) => {
  console.log('Starting Amazon AirPods search test');
  
  // Navigate to Amazon.com
  await page.goto('https://www.amazon.com');
  console.log('Navigated to Amazon website');
  
  // Wait for the page to load completely
  await page.waitForLoadState('networkidle');
  
  // Expect the title to contain "Amazon"
  await expect(page).toHaveTitle(/Amazon/);
  console.log('Amazon title verified');
  
  // Find the search input and type "apple airpods"
  await page.locator('#twotabsearchtextbox').fill('apple airpods');
  console.log('Entered "apple airpods" in search box');
  
  // Click the search button
  await page.locator('#nav-search-submit-button').click();
  console.log('Clicked search button');
  
  // Wait for search results to load
  await page.waitForSelector('[data-component-type="s-search-result"]');
  
  // Verify that search results contain "AirPods"
  const resultsText = await page.locator('.s-main-slot').textContent() || '';
  await expect(resultsText.toLowerCase()).toContain('airpods');
  console.log('Verified search results contain AirPods');
  
  // Take a screenshot of the search results
  await page.screenshot({ path: 'playwright-ui/test-results/amazon-airpods-search.png' });
  console.log('Screenshot captured');
  
  console.log('Amazon AirPods search test completed successfully');
}); 