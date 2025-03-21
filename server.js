// Inside startBrowserScreenshotStreaming function
async function startBrowserScreenshotStreaming(socket) {
  if (isCapturing) {
    console.log('Screenshot streaming already in progress, not starting a new one');
    return;
  }
  
  isCapturing = true;
  console.log('Starting browser screenshot streaming...');
  
  try {
    await ensureBrowserInitialized();
    console.log('Browser is initialized, starting screenshot captures');
    
    // Add a small delay to make sure the browser is fully initialized
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capture screenshots at regular intervals
    browserScreenshotInterval = setInterval(async () => {
      try {
        if (!activePage) {
          console.error('activePage is null, stopping screenshot interval');
          clearInterval(browserScreenshotInterval);
          isCapturing = false;
          return;
        }
        
        // First check if the page is still valid
        let isPageValid = true;
        try {
          await activePage.evaluate('1');
        } catch (pageError) {
          console.error('Page is no longer valid:', pageError.message);
          isPageValid = false;
          clearInterval(browserScreenshotInterval);
          isCapturing = false;
          return;
        }
        
        if (!isPageValid) return;

        // Use the new queueing mechanism
        const screenshot = await screenshotManager.queueScreenshot(activePage, false);
        
        // Get current URL
        const currentUrl = await activePage.url();
        
        // Send screenshot to client
        socket.emit('browser-screenshot', {
          screenshot: screenshot.base64,
          url: currentUrl
        });
        
      } catch (error) {
        console.error('Error capturing browser screenshot:', error);
        
        if (error.message.includes('Target page, context or browser has been closed') || 
            error.message.includes('Protocol error') || 
            error.message.includes('Target closed')) {
          console.log('Browser appears to be closed, stopping screenshot interval');
          clearInterval(browserScreenshotInterval);
          isCapturing = false;
        }
      }
    }, screenshotInterval);
    
  } catch (error) {
    console.error('Error in startBrowserScreenshotStreaming:', error);
    isCapturing = false;
  }
} 

// Global variables for browser management
let interactiveBrowser = null;
let interactivePage = null;
let isCapturing = false;
let screenshotInterval = null;

async function initializeInteractiveBrowser() {
  try {
    if (interactiveBrowser) {
      await interactiveBrowser.close().catch(() => {});
    }

    interactiveBrowser = await playwright.chromium.launch({
      headless: true
    });
    
    const context = await interactiveBrowser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: true,
      deviceScaleFactor: 1
    });

    // Add persistent cursor visualization
    await context.addInitScript(`
      window.addEventListener('load', () => {
        if (!document.querySelector('.pw-cursor')) {
          const style = document.createElement('style');
          style.innerHTML = \`
            .pw-cursor {
              position: fixed;
              width: 20px;
              height: 20px;
              background: rgba(0, 136, 255, 0.3);
              border: 2px solid rgb(0, 136, 255);
              border-radius: 50%;
              pointer-events: none;
              z-index: 999999;
              transition: all 0.05s ease;
              transform: translate(-50%, -50%);
            }
            .pw-cursor.clicking {
              background: rgba(255, 64, 64, 0.5);
              transform: translate(-50%, -50%) scale(0.8);
            }
          \`;
          document.head.appendChild(style);
          
          const cursor = document.createElement('div');
          cursor.className = 'pw-cursor';
          document.body.appendChild(cursor);
          
          window.__playwrightMouseX = 0;
          window.__playwrightMouseY = 0;
          
          function updateCursor() {
            const cursor = document.querySelector('.pw-cursor');
            if (cursor) {
              cursor.style.left = window.__playwrightMouseX + 'px';
              cursor.style.top = window.__playwrightMouseY + 'px';
            }
            requestAnimationFrame(updateCursor);
          }
          updateCursor();
        }
      });
    `);

    interactivePage = await context.newPage();
    await interactivePage.goto('about:blank');
    
    // Set up mouse tracking
    await interactivePage.mouse.move(0, 0);
    
    // Share the page with task supervisor
    if (taskSupervisor) {
      taskSupervisor.setBrowserPage(interactivePage);
    }
    
    console.log('Interactive browser initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize interactive browser:', error);
    return false;
  }
}

// Pause screenshot capture during actions
async function pauseScreenshots() {
  isCapturing = false;
  await new Promise(resolve => setTimeout(resolve, 100)); // Wait for any in-progress captures
}

// Resume screenshot capture after actions
async function resumeScreenshots() {
  isCapturing = true;
}

// Improved screenshot capture function
async function captureAndEmitScreenshot() {
  if (!isCapturing) return;
  
  try {
    if (!interactivePage || !interactivePage.isConnected()) {
      console.log('Interactive page not available, reinitializing...');
      await initializeInteractiveBrowser();
      return;
    }

    const screenshot = await interactivePage.screenshot({
      type: 'jpeg',
      quality: 75,
      animations: 'disabled'
    }).catch(error => {
      console.error('Screenshot error:', error);
      return null;
    });

    if (screenshot) {
      const currentUrl = await interactivePage.url();
      io.emit('browser-screenshot', {
        image: screenshot.toString('base64'),
        url: currentUrl
      });
    }
  } catch (error) {
    console.error('Error in screenshot capture:', error);
    // Don't stop capturing, just log the error
  }
}

// Start screenshot stream with proper synchronization
async function startScreenshotStream() {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
  }
  
  isCapturing = true;
  screenshotInterval = setInterval(captureAndEmitScreenshot, 500); // Reduced to 2 FPS for stability
  console.log('Screenshot stream started');
}

// Export these functions for use in action-executor.js
module.exports = {
  pauseScreenshots,
  resumeScreenshots,
  interactivePage
};

// Ensure browser stays alive during server lifetime
process.on('SIGINT', async () => {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
  }
  
  if (interactiveBrowser) {
    await interactiveBrowser.close().catch(() => {});
  }
  
  process.exit();
});

// Initialize when server starts
app.listen(3000, async () => {
  console.log('Server started on port 3000');
  await initializeInteractiveBrowser();
  startScreenshotStream();
}); 