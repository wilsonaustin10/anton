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

// Clean up function for browser resources
async function cleanupBrowserResources() {
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
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Handle client disconnection
  socket.on('disconnect', async () => {
    console.log('User disconnected');
    await cleanupBrowserResources();
  });
  
  // Handle browser navigation commands
  socket.on('browser-navigate', async (data) => {
    const { url } = data;
    
    try {
      // Initialize browser if not already done
      if (!activeBrowser) {
        activeBrowser = await playwright.chromium.launch({
          headless: false,
          args: ['--start-maximized']
        });
        activePage = await activeBrowser.newPage();
      }
      
      // Navigate to the URL
      await activePage.goto(url);
      
      // Send browser command to the client
      io.emit('browser-command', {
        type: 'navigate',
        url: activePage.url()
      });
      
      socket.emit('test-output', { data: `Navigated to: ${url}\n` });
    } catch (error) {
      socket.emit('test-output', { data: `Navigation error: ${error.message}\n` });
    }
  });
  
  // Handle browser actions
  socket.on('browser-action', async (data) => {
    const { action, selector, value } = data;
    
    try {
      if (!activePage) {
        throw new Error('Browser not initialized');
      }
      
      if (action === 'click') {
        await activePage.click(selector);
        socket.emit('test-output', { data: `Clicked element: ${selector}\n` });
      } else if (action === 'fill') {
        await activePage.fill(selector, value);
        socket.emit('test-output', { data: `Filled ${selector} with "${value}"\n` });
      }
      
      // Send success response
      io.emit('browser-command', {
        type: 'action-result',
        action,
        success: true
      });
    } catch (error) {
      socket.emit('test-output', { data: `Action error: ${error.message}\n` });
      io.emit('browser-command', {
        type: 'action-result',
        action,
        success: false,
        error: error.message
      });
    }
  });
  
  // Handle individual step execution
  socket.on('run-step', async (data) => {
    const { step } = data;
    
    try {
      if (!activeBrowser) {
        activeBrowser = await playwright.chromium.launch({
          headless: false,
          args: ['--start-maximized']
        });
        activePage = await activeBrowser.newPage();
      }
      
      if (step.type === 'goto') {
        await activePage.goto(step.data.url);
        socket.emit('test-output', { data: `Navigated to: ${step.data.url}\n` });
        
        // Send browser command to the client
        io.emit('browser-command', {
          type: 'navigate',
          url: activePage.url()
        });
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
        
        // Send success response
        io.emit('browser-command', {
          type: 'action-result',
          action: 'click',
          success: true
        });
      } else if (step.type === 'fill') {
        const selector = step.data.method === 'locator' ? step.data.selector : step.data.selector;
        await activePage.fill(selector, step.data.value);
        socket.emit('test-output', { data: `Filled ${selector} with "${step.data.value}"\n` });
        
        // Send success response
        io.emit('browser-command', {
          type: 'action-result',
          action: 'fill',
          success: true
        });
      }
    } catch (error) {
      socket.emit('test-output', { data: `Step execution error: ${error.message}\n` });
      io.emit('browser-command', {
        type: 'action-result',
        action: step.type,
        success: false,
        error: error.message
      });
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
  const testFile = path.join(testDir, `test-${timestamp}.spec.js`);
  
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

// CORS Proxy for fetching external URLs
app.use('/proxy', createProxyMiddleware({
  changeOrigin: true,
  pathRewrite: (path) => {
    return path.replace(/^\/proxy\//, '');
  },
  router: (req) => {
    const url = req.query.url;
    if (url && typeof url === 'string') {
      return url.startsWith('http') ? url : `https://${url}`;
    }
    return 'https://example.com';
  }
}));

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 