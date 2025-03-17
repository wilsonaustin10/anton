/**
 * Screenshot manager for OpenAI Computer Use integration
 * Handles capturing, formatting, and storing screenshots
 */

const fs = require('fs');
const path = require('path');

class ScreenshotManager {
  /**
   * Create a new screenshot manager
   * @param {Object} config - Configuration options
   */
  constructor(config) {
    this.config = config;
    this.screenshotDir = path.join(__dirname, '../../temp/screenshots');
    this.ensureDirectoryExists(this.screenshotDir);
    console.log(`Screenshot manager initialized with directory: ${this.screenshotDir}`);
  }
  
  /**
   * Capture a screenshot of the current page
   * @param {Object} page - Playwright page object
   * @returns {Object} - Screenshot data with metadata
   */
  async captureScreenshot(page) {
    if (!page) throw new Error('No active page for screenshot capture');
    
    try {
      // Capture the screenshot
      const screenshot = await page.screenshot({ 
        type: 'jpeg', 
        quality: 90,
        fullPage: false 
      });
      
      // Get additional context information
      const url = await page.url();
      const title = await page.title();
      const viewportSize = page.viewportSize();
      
      console.log(`Captured screenshot of page: ${title} at ${url}`);
      
      return {
        buffer: screenshot,
        base64: screenshot.toString('base64'),
        metadata: {
          timestamp: Date.now(),
          url,
          title,
          viewportSize
        }
      };
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw error;
    }
  }
  
  /**
   * Save screenshot with metadata for debugging and audit
   * @param {Object} screenshot - Screenshot data
   * @param {string} sessionId - Session identifier
   * @returns {string} - Path to saved screenshot
   */
  async saveScreenshot(screenshot, sessionId) {
    const filename = `${sessionId}_${screenshot.metadata.timestamp}.jpg`;
    const filepath = path.join(this.screenshotDir, filename);
    
    await fs.promises.writeFile(filepath, screenshot.buffer);
    await fs.promises.writeFile(
      `${filepath}.meta.json`, 
      JSON.stringify(screenshot.metadata, null, 2)
    );
    
    console.log(`Screenshot saved to: ${filepath}`);
    return filepath;
  }
  
  /**
   * Ensure the directory exists, create if it doesn't
   * @param {string} dir - Directory path
   */
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

module.exports = ScreenshotManager; 