const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { parseTest } = require('./test-parser');
const playwright = require('playwright');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/test-results', express.static(path.join(__dirname, 'test-results')));

// Store test files
const testDir = path.join(__dirname, 'tests');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Track active browser contexts
let activeBrowser = null;
let activePage = null;
let browserScreenshotInterval = null;
const screenshotInterval = 100; // milliseconds between screenshots (reduced from 200ms)
let isCapturing = false;
let errorCount = 0;

// Clean up function for browser resources
async function cleanupBrowserResources() {
  if (browserScreenshotInterval) {
    clearInterval(browserScreenshotInterval);
    browserScreenshotInterval = null;
  }
  
  if (activePage) {
    try {
      await activePage.close();
    } catch (e) {
      console.error('Error closing page:', e);
    }
    activePage = null;
  }
  
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
    activeBrowser = null;
  }
  
  isCapturing = false;
}

// Initialize browser if not already running
async function ensureBrowserInitialized() {
  if (!activeBrowser) {
    console.log('Initializing browser...');
    
    // Modern Chrome user agent that's less likely to be detected as a bot
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    
    // Determine if we should use headless mode based on environment
    // In production or CI environments, use headless: "new" which is better at avoiding detection
    // In development environments, we can use non-headless mode for better compatibility
    const isProduction = process.env.NODE_ENV === 'production';
    const isCI = !!process.env.CI;
    
    // Use enhanced headless mode ('new') by default, which is better at avoiding detection
    // but allow overriding with environment variable
    const headlessMode = process.env.BROWSER_HEADLESS === 'false' ? false : 
                         process.env.BROWSER_HEADLESS === 'true' ? true : 
                         isProduction || isCI ? 'new' : false;
    
    console.log(`Browser headless mode: ${headlessMode}`);
    
    activeBrowser = await playwright.chromium.launch({
      headless: headlessMode,
      args: [
        '--disable-web-security', 
        '--disable-features=IsolateOrigins,site-per-process', 
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled', // Prevents detection via automation flags
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--window-size=1280,800',
        '--hide-scrollbars'
      ]
    });
    
    const context = await activeBrowser.newContext({
      userAgent: userAgent,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      hasTouch: false,
      javaScriptEnabled: true,
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles',
      geolocation: { longitude: -122.403, latitude: 37.789 }, // San Francisco coordinates
      permissions: ['geolocation', 'notifications'],
      // Set extra HTTP headers to appear more like a real browser
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });
    
    // Add browser fingerprint evasion script
    await context.addInitScript(() => {
      // Override the navigator properties commonly used for fingerprinting
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Add a fake WebGL renderer and vendor for fingerprinting
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Open Source Technology Center';
        }
        if (parameter === 37446) {
          return 'Mesa DRI Intel(R) HD Graphics 630 (Kaby Lake GT2)';
        }
        return getParameter.apply(this, arguments);
      };
    });
    
    activePage = await context.newPage();
    
    // Navigate to a default page
    try {
      await activePage.goto('https://www.google.com');
      console.log('Browser initialized with Google homepage');
    } catch (error) {
      console.error('Error navigating to default page:', error);
    }
  }
  return { browser: activeBrowser, page: activePage };
}

// Function to start browser screenshot streaming
async function startBrowserScreenshotStreaming(socket) {
  if (isCapturing) {
    console.log('Screenshot streaming already in progress, not starting a new one');
    return; // Don't start multiple capture processes
  }
  
  isCapturing = true;
  console.log('Starting browser screenshot streaming...');
  
  try {
    await ensureBrowserInitialized();
    console.log('Browser is initialized, starting screenshot captures');
    
    // Add a longer delay to make sure the browser is fully initialized
    console.log('Waiting 1000ms before starting screenshot interval...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Configure screenshot parameters for best quality
    const screenshotOptions = {
      type: 'jpeg',
      quality: 85,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 800 },
      omitBackground: false,
      timeout: 5000
    };
    
    // Position the browser window off-screen if we're in non-headless mode
    // This avoids having the browser window visible to the user while still getting good screenshots
    try {
      if (activeBrowser && !process.env.HEADLESS) {
        const windows = await activeBrowser.windows();
        if (windows && windows.length > 0) {
          // Move browser window off-screen but don't minimize it
          // as minimizing can affect rendering quality
          await windows[0].setBounds({ left: -10000, top: -10000 });
        }
      }
    } catch (windowError) {
      console.log('Note: Could not position browser window off-screen:', windowError.message);
      // Non-fatal error, continue with screenshot capturing
    }
    
    // Capture screenshots at regular intervals
    browserScreenshotInterval = setInterval(async () => {
      try {
        if (!isCapturing) {
          clearInterval(browserScreenshotInterval);
          return;
        }
        
        console.log('Capturing screenshot...');
        const screenshot = await activePage.screenshot(screenshotOptions);
        const url = await activePage.url();
        console.log(`Captured screenshot of size ${screenshot.length} bytes`);
        console.log(`Current page URL: ${url}`);
        
        // Send the screenshot data to the client
        console.log('Emitting browser-screenshot event to client');
        socket.emit('browser-screenshot', {
          screenshot: screenshot.toString('base64'),
          url: url
        });
        console.log('Screenshot sent to client');
      } catch (error) {
        console.error('Error capturing browser screenshot:', error);
        
        // If we consistently get errors, we might want to reinitialize the browser
        errorCount++;
        if (errorCount > 5) {
          console.log('Too many errors, reinitializing browser');
          await cleanupBrowserResources();
          await ensureBrowserInitialized();
          errorCount = 0;
        }
      }
    }, 100); // Capture a screenshot every 100ms for smoother experience
  } catch (error) {
    console.error('Error in startBrowserScreenshotStreaming:', error);
    isCapturing = false;
  }
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Start screenshot streaming when the client signals it's ready
  socket.on('ready-for-screenshots', () => {
    console.log('Client is ready for screenshots, starting streaming');
    startBrowserScreenshotStreaming(socket);
  });
  
  // Handle client disconnection
  socket.on('disconnect', async () => {
    console.log('User disconnected');
    
    // We don't close the browser on disconnect anymore, as it stays alive
    // for the whole app session. But we do stop the screenshot streaming.
    if (browserScreenshotInterval) {
      clearInterval(browserScreenshotInterval);
      browserScreenshotInterval = null;
      isCapturing = false;
    }
  });
  
  // Handle browser navigation
  socket.on('browser-navigate', async (data) => {
    const { url } = data;
    
    try {
      await ensureBrowserInitialized();
      
      // Show the loading indicator to the user
      socket.emit('test-output', { data: `Navigating to: ${url}...\n` });
      
      // Configure navigation options with better timeout and waitUntil settings
      const navigationOptions = {
        waitUntil: 'networkidle', // Wait until network is idle
        timeout: 30000, // Longer timeout for slow websites
      };
      
      // Try to navigate to the URL
      try {
        await activePage.goto(url, navigationOptions);
        
        // Add a small delay after navigation completes to ensure full page initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if page has an error message about unsupported browsers
        const hasUnsupportedMessage = await activePage.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('browser not supported') || 
                 text.includes('unsupported browser') || 
                 text.includes('upgrade your browser');
        });
        
        if (hasUnsupportedMessage) {
          console.log('Browser compatibility issue detected on page');
          socket.emit('test-output', { data: `Warning: The site may have detected our browser as unsupported.\n` });
        }
        
        // Report success to the client
        socket.emit('test-output', { data: `Successfully navigated to: ${url}\n` });
      } catch (navigationError) {
        console.error('Navigation error:', navigationError);
        
        // Check if the page partially loaded despite the error
        const url = await activePage.url();
        const title = await activePage.title().catch(() => 'Unknown');
        
        socket.emit('test-output', { 
          data: `Navigation encountered an error: ${navigationError.message}\nPartially loaded: ${url} (${title})\n` 
        });
      }
    } catch (error) {
      console.error('Browser navigation error:', error);
      socket.emit('test-output', { data: `Browser navigation error: ${error.message}\n` });
    }
  });
  
  // Handle click events from the UI
  socket.on('browser-click', async (data) => {
    try {
      const { x, y } = data;
      await ensureBrowserInitialized();
      
      // Perform the click at the specified coordinates
      await activePage.mouse.click(x, y);
      socket.emit('test-output', { data: `Clicked at position: (${x}, ${y})\n` });
    } catch (error) {
      socket.emit('test-output', { data: `Click error: ${error.message}\n` });
    }
  });
  
  // Handle keyboard input from the UI
  socket.on('browser-type', async (data) => {
    try {
      const { text } = data;
      await ensureBrowserInitialized();
      
      // Type the text
      await activePage.keyboard.type(text);
      socket.emit('test-output', { data: `Typed text: ${text}\n` });
    } catch (error) {
      socket.emit('test-output', { data: `Type error: ${error.message}\n` });
    }
  });
  
  // Handle keyboard press events (Enter, Tab, etc.)
  socket.on('browser-key', async (data) => {
    try {
      const { key } = data;
      await ensureBrowserInitialized();
      
      // Press the key
      await activePage.keyboard.press(key);
      socket.emit('test-output', { data: `Pressed key: ${key}\n` });
    } catch (error) {
      socket.emit('test-output', { data: `Key press error: ${error.message}\n` });
    }
  });
  
  // Handle individual step execution with the real browser
  socket.on('run-step', async (data) => {
    const { step } = data;
    
    try {
      await ensureBrowserInitialized();
      
      if (step.type === 'goto') {
        await activePage.goto(step.data.url, { waitUntil: 'domcontentloaded' });
        socket.emit('test-output', { data: `Navigated to: ${step.data.url}\n` });
      } else if (step.type === 'click') {
        // Handle different selector types
        let selector;
        if (step.data.method === 'locator') {
          selector = step.data.selector;
        } else if (step.data.method === 'getByRole') {
          // This is a simplification, real implementation would be more complex
          if (step.data.selector.includes('link')) {
            selector = `a:has-text("${step.data.selector.replace(/link|button/g, '').trim()}")`;
          } else {
            selector = `text=${step.data.selector}`;
          }
        } else if (step.data.method === 'getByText') {
          selector = `text=${step.data.selector}`;
        } else {
          selector = step.data.selector;
        }
        
        await activePage.click(selector);
        socket.emit('test-output', { data: `Clicked element: ${selector}\n` });
      } else if (step.type === 'fill') {
        const selector = step.data.method === 'locator' ? step.data.selector : step.data.selector;
        await activePage.fill(selector, step.data.value);
        socket.emit('test-output', { data: `Filled ${selector} with "${step.data.value}"\n` });
      }
    } catch (error) {
      socket.emit('test-output', { data: `Step execution error: ${error.message}\n` });
    }
  });
});

// Endpoint to list all test files
app.get('/test-files', (req, res) => {
  try {
    const files = fs.readdirSync(testDir)
      .filter(file => file.endsWith('.spec.js') || file.endsWith('.test.js'));
    
    return res.json(files);
  } catch (error) {
    console.error('Error reading test files:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint to get content of a test file
app.get('/test-file/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(testDir, filename);
  
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return res.send(content);
  } catch (error) {
    console.error('Error reading test file:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Parse test endpoint
app.post('/parse-test', async (req, res) => {
  const { script } = req.body;
  
  if (!script) {
    return res.status(400).json({ error: 'No test script provided' });
  }
  
  try {
    // Parse the test script to extract steps
    const steps = parseTest(script);
    
    return res.json({
      success: true,
      steps
    });
  } catch (error) {
    console.error('Error parsing test:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Run test endpoint - for running complete test
app.post('/run-test', (req, res) => {
  const { script } = req.body;
  
  if (!script) {
    return res.status(400).json({ error: 'No test script provided' });
  }
  
  // Save script to a temporary test file
  const timestamp = Date.now();
  const testFile = path.join(testDir, `temp-test.spec.js`);
  
  fs.writeFileSync(testFile, script);
  
  // Notify client that the test is starting
  io.emit('test-status', { status: 'starting' });
  
  // Create a video directory
  const videoDir = path.join(__dirname, 'public', 'videos');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  
  // Run the test with Playwright CLI
  const command = `npx playwright test ${testFile} --headed --video on`;
  
  const childProcess = exec(command);
  
  childProcess.stdout.on('data', (data) => {
    io.emit('test-output', { data });
  });
  
  childProcess.stderr.on('data', (data) => {
    io.emit('test-output', { data });
  });
  
  childProcess.on('close', (exitCode) => {
    if (exitCode === 0) {
      io.emit('test-status', { status: 'completed', exitCode });
    } else {
      io.emit('test-status', { status: 'failed', exitCode });
    }
    
    // Find the video file and serve it
    const testResultsDir = path.join(__dirname, 'test-results');
    if (fs.existsSync(testResultsDir)) {
      try {
        // Recursively find video files
        const findVideos = (dir) => {
          let results = [];
          const files = fs.readdirSync(dir);
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              results = results.concat(findVideos(filePath));
            } else if (file.endsWith('.webm')) {
              results.push(filePath);
            }
          }
          
          return results;
        };
        
        const videos = findVideos(testResultsDir);
        
        if (videos.length > 0) {
          // Get the most recent video
          const videoFile = videos.sort((a, b) => {
            return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
          })[0];
          
          // Copy to public directory
          const publicVideoPath = path.join(videoDir, `video-${timestamp}.webm`);
          fs.copyFileSync(videoFile, publicVideoPath);
          
          // Notify client of video
          io.emit('test-video', {
            path: `/videos/video-${timestamp}.webm`,
            timestamp
          });
        }
      } catch (error) {
        console.error('Error processing video:', error);
      }
    }
  });
  
  return res.json({ success: true });
});

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 