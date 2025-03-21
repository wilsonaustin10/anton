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
    this.lastComputerUseScreenshot = null;
    this.lastScreenshotTimestamp = 0;
    this.isCapturing = false;
    this.captureQueue = [];
    this.cacheTimeout = 1000; // Increased to 1 second
    console.log(`Screenshot manager initialized with directory: ${this.screenshotDir}`);
  }
  
  /**
   * Queue a screenshot capture and return a promise that resolves with the screenshot
   * @param {Object} page - Playwright page object
   * @param {boolean} forceNew - Force capturing a new screenshot
   * @returns {Promise<Object>} - Screenshot data with metadata
   */
  async queueScreenshot(page, forceNew = false) {
    // If we have a recent cached screenshot and don't need to force new
    const now = Date.now();
    if (!forceNew && 
        this.lastComputerUseScreenshot && 
        (now - this.lastScreenshotTimestamp) < this.cacheTimeout) {
      return this.lastComputerUseScreenshot;
    }

    // Add to queue if capture is in progress
    if (this.isCapturing) {
      return new Promise((resolve, reject) => {
        this.captureQueue.push({ resolve, reject });
      });
    }

    return this.captureScreenshot(page, forceNew);
  }

  /**
   * Capture a screenshot of the current page
   * @param {Object} page - Playwright page object
   * @param {boolean} forceNew - Force capturing a new screenshot
   * @returns {Promise<Object>} - Screenshot data with metadata
   */
  async captureScreenshot(page, forceNew = false) {
    if (!page) throw new Error('No active page for screenshot capture');
    
    try {
      this.isCapturing = true;

      // Get page information first (in case page becomes invalid)
      const url = await page.url();
      const title = await page.title();
      const viewportSize = page.viewportSize();

      // Capture new screenshot
      const screenshot = await page.screenshot({ 
        type: 'jpeg', 
        quality: 90,
        fullPage: false 
      });

      const result = {
        buffer: screenshot,
        base64: screenshot.toString('base64'),
        metadata: {
          timestamp: Date.now(),
          url,
          title,
          viewportSize
        }
      };

      // Cache this screenshot for potential reuse
      this.lastComputerUseScreenshot = result;
      this.lastScreenshotTimestamp = Date.now();

      // Process queue
      while (this.captureQueue.length > 0) {
        const { resolve } = this.captureQueue.shift();
        resolve(result);
      }

      return result;
    } catch (error) {
      // Reject all queued captures
      while (this.captureQueue.length > 0) {
        const { reject } = this.captureQueue.shift();
        reject(error);
      }
      
      console.error('Error capturing screenshot:', error);
      if (!forceNew && this.lastComputerUseScreenshot) {
        console.log('Returning cached screenshot due to capture error');
        return this.lastComputerUseScreenshot;
      }
      throw error;
    } finally {
      this.isCapturing = false;
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
    }
  }

  /**
   * Clear the screenshot cache
   */
  clearCache() {
    this.lastComputerUseScreenshot = null;
    this.lastScreenshotTimestamp = 0;
  }
}

module.exports = ScreenshotManager; 