/**
 * Test script for Computer Use functionality
 */
require('dotenv').config();
const { getComputerUseActions } = require('./openai-client');
const fs = require('fs');
const path = require('path');

// Import Computer Use components
const { computerUseConfig } = require('./src/computer-use/config');
const ScreenshotManager = require('./src/computer-use/screenshot-manager');
const ActionExecutor = require('./src/computer-use/action-executor');

// Import the ensureBrowserInitialized function from server.js
const { ensureBrowserInitialized } = require('./server');

async function testComputerUse() {
  console.log('Starting Computer Use test...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.');
    return;
  }
  
  // Initialize components
  const screenshotManager = new ScreenshotManager(computerUseConfig);
  const actionExecutor = new ActionExecutor(computerUseConfig);
  
  try {
    // Get the existing browser instance instead of creating a new one
    console.log('Getting existing browser instance...');
    const { browser, page } = await ensureBrowserInitialized();
    
    // Navigate to a test website
    console.log('Navigating to test website...');
    await page.goto('https://example.com');
    
    // Capture screenshot
    console.log('Capturing screenshot...');
    const screenshot = await screenshotManager.captureScreenshot(page);
    
    // Save screenshot for reference
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const screenshotPath = path.join(tempDir, 'test-screenshot.jpg');
    fs.writeFileSync(screenshotPath, screenshot.buffer);
    console.log(`Screenshot saved to ${screenshotPath}`);
    
    // Get Computer Use actions from OpenAI
    console.log('Requesting actions from OpenAI...');
    const taskDescription = 'On the example.com website, find and click the "More information..." link';
    const aiResponse = await getComputerUseActions(taskDescription, screenshot.base64, []);
    
    console.log('AI Response:');
    console.log('- Thinking:', aiResponse.thinking);
    console.log('- Actions:', JSON.stringify(aiResponse.actions, null, 2));
    console.log('- Complete:', aiResponse.complete);
    
    // Execute first action if available
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      console.log('Executing first action...');
      const result = await actionExecutor.executeAction(page, aiResponse.actions[0]);
      console.log('Action result:', result);
    } else {
      console.log('No actions received from OpenAI');
    }
    
    // Wait a bit to see the result
    console.log('Waiting 5 seconds to see the result...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Error during Computer Use test:', error);
  }
  // We don't close the browser since it's the shared instance
}

testComputerUse().catch(console.error); 