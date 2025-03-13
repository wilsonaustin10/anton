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
const { generateChatResponse } = require('./openai-client');

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
    
    // Define a modern user agent string
    const modernUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    
    // ========================= IMPORTANT - DO NOT MODIFY =========================
    // The headless option must be a boolean value (true) for compatibility with the
    // current Playwright version. Using string values like 'new' will cause errors.
    // If upgrading Playwright in the future, ensure you test browser initialization
    // thoroughly before deploying any changes to this configuration.
    // =========================================================================== 
    activeBrowser = await playwright.chromium.launch({
      headless: true, // Using boolean value for compatibility
      args: [
        '--disable-web-security', 
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--disable-blink-features=AutomationControlled', // Prevent detection as automated browser
        '--no-sandbox',
        '--window-size=1280,800'
      ]
    });
    // ========================= END CRITICAL SECTION =============================
    
    // Create a browser context with specific options to avoid detection
    const context = await activeBrowser.newContext({
      userAgent: modernUserAgent,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      hasTouch: false,
      defaultBrowserType: 'chromium',
      javaScriptEnabled: true,
      bypassCSP: true, // Bypass Content Security Policy
      ignoreHTTPSErrors: true,
      permissions: ['geolocation', 'notifications', 'camera', 'microphone']
    });
    
    // Add additional properties to avoid detection
    await context.addInitScript(() => {
      // Mask WebDriver
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Simulate normal plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [1, 2, 3, 4, 5];
        }
      });
      
      // Simulate normal languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'es']
      });
      
      // Overwrite the automation property
      window.navigator.chrome = { runtime: {} };
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
    
    // Add a small delay to make sure the browser is fully initialized
    console.log('Waiting 500ms before starting screenshot interval...');
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
        
        console.log('Capturing screenshot...');
        const screenshot = await activePage.screenshot({ 
          type: 'jpeg', 
          quality: 80,
          fullPage: false 
        });
        
        // Convert to base64 for transmission
        const base64Image = screenshot.toString('base64');
        console.log(`Captured screenshot of size ${base64Image.length} bytes`);
        
        // Get current URL
        const currentUrl = await activePage.url();
        console.log(`Current page URL: ${currentUrl}`);
        
        // Send screenshot to client
        console.log('Emitting browser-screenshot event to client');
        socket.emit('browser-screenshot', {
          screenshot: base64Image,
          url: currentUrl
        });
        
        console.log('Screenshot sent to client');
      } catch (error) {
        console.error('Error capturing browser screenshot:', error);
        // Don't stop capturing on errors, might be transient
      }
    }, screenshotInterval);
    
    console.log(`Screenshot interval started with ${screenshotInterval}ms delay`);
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
    const { url, action } = data;
    
    try {
      await ensureBrowserInitialized();
      
      if (action === 'back') {
        // Use the browser's back button functionality
        await activePage.goBack();
        const currentUrl = activePage.url();
        socket.emit('test-output', { data: `Navigated back to: ${currentUrl}\n` });
        
        // Notify the client about the new URL after navigation
        socket.emit('browser-url-change', { url: currentUrl });
      } 
      else if (action === 'forward') {
        // Use the browser's forward button functionality
        await activePage.goForward();
        const currentUrl = activePage.url();
        socket.emit('test-output', { data: `Navigated forward to: ${currentUrl}\n` });
        
        // Notify the client about the new URL after navigation
        socket.emit('browser-url-change', { url: currentUrl });
      }
      else {
        // Navigate to the URL
        await activePage.goto(url, { waitUntil: 'domcontentloaded' });
        socket.emit('test-output', { data: `Navigated to: ${url}\n` });
      }
    } catch (error) {
      socket.emit('test-output', { data: `Navigation error: ${error.message}\n` });
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
      
      // Type the text into the active page
      await activePage.keyboard.type(text);
      
      // Don't log every keystroke to avoid flooding the output
      // socket.emit('test-output', { data: `Typed text: ${text}\n` });
    } catch (error) {
      console.error(`Type error: ${error.message}`);
      socket.emit('test-output', { data: `Type error: ${error.message}\n` });
    }
  });
  
  // Handle wheel/scroll events from the UI
  socket.on('browser-wheel', async (data) => {
    try {
      const { deltaX, deltaY } = data;
      await ensureBrowserInitialized();
      
      // Execute a mousewheel event in the page context
      await activePage.mouse.wheel(deltaX, deltaY);
      
      // We don't send feedback for every scroll event to avoid flooding the output
    } catch (error) {
      console.error(`Scroll error: ${error.message}`);
    }
  });
  
  // Handle specific keyboard keys from the UI
  socket.on('browser-key', async (data) => {
    try {
      const { key } = data;
      await ensureBrowserInitialized();
      
      // Handle special keys
      if (key === 'Backspace') {
        await activePage.keyboard.press('Backspace');
      } else if (key === 'Delete') {
        await activePage.keyboard.press('Delete');
      } else if (key === 'Enter') {
        await activePage.keyboard.press('Enter');
      } else if (key === 'Tab') {
        await activePage.keyboard.press('Tab');
      } else if (key === 'Escape') {
        await activePage.keyboard.press('Escape');
      } else if (key === 'ArrowUp') {
        await activePage.keyboard.press('ArrowUp');
      } else if (key === 'ArrowDown') {
        await activePage.keyboard.press('ArrowDown');
      } else if (key === 'ArrowLeft') {
        await activePage.keyboard.press('ArrowLeft');
      } else if (key === 'ArrowRight') {
        await activePage.keyboard.press('ArrowRight');
      } else {
        // Handle any other key
        await activePage.keyboard.press(key);
      }
      
      // Don't log every key press to avoid flooding the output
      // socket.emit('test-output', { data: `Pressed key: ${key}\n` });
    } catch (error) {
      console.error(`Key press error: ${error.message}`);
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

// Chat endpoint for OpenAI integration
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is not configured in .env file');
    return res.status(500).json({ 
      error: 'OpenAI API key is not configured',
      type: 'error',
      response: "I'm sorry, the chat service is not available. The OpenAI API key is not configured." 
    });
  }
  
  try {
    console.log('Processing chat message:', message.substring(0, 30) + '...');
    const result = await generateChatResponse(message, history || []);
    
    // Format response based on the result type
    if (result.type === 'orchestrated_response') {
      // Orchestrated response with script and action sequence
      console.log('Orchestrated response received, routing to appropriate destinations');
      return res.json({
        success: true,
        type: 'orchestrated_response',
        script: result.script,
        actionSequence: result.actionSequence,
        metadata: result.metadata,
        response: result.message
      });
    } else if (result.type === 'script') {
      // Script generation result
      console.log('Script generation successful, returning to client');
      return res.json({
        success: true,
        type: 'script',
        script: result.script,
        metadata: result.metadata,
        response: result.message
      });
    } else if (result.type === 'error') {
      // Error result - but still return as 200 to handle on client
      console.error('Error in chat response:', result.message);
      return res.json({
        success: false,
        type: 'error',
        error: result.message,
        response: result.message
      });
    } else {
      // Regular chat response
      console.log('Returning regular chat response');
      return res.json({
        success: true,
        type: 'chat',
        response: result.message
      });
    }
  } catch (error) {
    console.error('Unhandled error in chat endpoint:', error);
    console.error('Error details:', error.stack);
    
    // Provide more useful error information
    let errorMessage = "I'm sorry, I encountered an error processing your request.";
    if (error.message && error.message.includes('API key')) {
      errorMessage += " There seems to be an issue with the OpenAI API key configuration.";
    } else if (error.message && error.message.includes('rate limit')) {
      errorMessage += " The API rate limit has been reached. Please try again in a moment.";
    } else if (error.message && error.message.includes('timeout')) {
      errorMessage += " The request timed out. You might try simplifying your query.";
    }
    
    return res.status(200).json({ 
      success: false,
      type: 'error',
      error: error.message,
      response: errorMessage
    });
  }
});

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 