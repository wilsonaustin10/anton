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
const { generateChatResponse, getComputerUseActions } = require('./openai-client');

// Import Computer Use components
const { computerUseConfig } = require('./src/computer-use/config');
const ScreenshotManager = require('./src/computer-use/screenshot-manager');
const ActionExecutor = require('./src/computer-use/action-executor');
const TaskSupervisor = require('./src/computer-use/task-supervisor');
const SessionManager = require('./src/computer-use/session-manager');

// Import the task repository
const taskRepository = require('./src/computer-use/task-repository');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
global.io = io;  // Make io available globally for components like ActionExecutor

// Initialize Computer Use components
const screenshotManager = new ScreenshotManager(computerUseConfig);
const actionExecutor = new ActionExecutor(computerUseConfig);
const taskSupervisor = new TaskSupervisor(
  require('./openai-client'),
  screenshotManager,
  actionExecutor
);
const sessionManager = new SessionManager(computerUseConfig);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/test-results', express.static(path.join(__dirname, 'test-results')));

// Add API chat endpoint to handle frontend requests
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body.message);
    
    // If this is a LinkedIn task, log it specifically
    if (req.body.message.toLowerCase().includes('linkedin')) {
      console.log('LinkedIn task detected in API request');
    }
    
    // Call the generateChatResponse function to get a response from OpenAI
    const response = await generateChatResponse(req.body.message, req.body.history || []);
    console.log('Chat response type:', response.type);
    
    // Send the response back to the client
    return res.json(response);
  } catch (error) {
    console.error('Error handling chat request:', error);
    return res.status(500).json({
      type: 'error',
      message: 'Failed to generate response. Please try again.' 
    });
  }
});

// Add Computer Use API endpoints

// Start a new Computer Use task
app.post('/api/computer-use/start', async (req, res) => {
  try {
    console.log('Received Computer Use task request:', req.body);
    
    // Validate input
    const { taskDescription, userId } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ 
        error: 'Task description is required' 
      });
    }
    
    // Ensure browser is initialized
    await ensureBrowserInitialized();
    
    // Create a session if userId is provided
    let sessionId = null;
    if (userId) {
      sessionId = sessionManager.createSession(userId, {
        taskDescription,
        source: 'api_request'
      });
    }
    
    // Start a new task
    const taskId = await taskSupervisor.startTask(
      activePage, 
      taskDescription,
      {
        ...req.body.options || {},
        sessionId,
        userId
      }
    );
    
    // Add task to session if session was created
    if (sessionId) {
      sessionManager.addTaskToSession(sessionId, taskId);
      sessionManager.addSessionEvent(sessionId, 'task_started', { taskId });
    }
    
    return res.json({ 
      success: true, 
      taskId,
      sessionId,
      message: `Computer Use task started with ID: ${taskId}`
    });
  } catch (error) {
    console.error('Error starting Computer Use task:', error);
    return res.status(500).json({ 
      error: 'Failed to start Computer Use task',
      details: error.message
    });
  }
});

// Check task status
app.get('/api/computer-use/task/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = taskSupervisor.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    return res.json({
      taskId,
      status: task.status,
      description: task.description,
      progress: {
        actionsExecuted: task.actions.length,
        screenshotsTaken: task.screenshots.length,
        durationMs: Date.now() - task.startTime,
        isComplete: ['completed', 'failed', 'aborted', 'timeout'].includes(task.status)
      },
      result: task.result
    });
  } catch (error) {
    console.error('Error checking task status:', error);
    return res.status(500).json({ error: 'Failed to check task status' });
  }
});

// Pause a task
app.post('/api/computer-use/pause/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskSupervisor.pauseTask(taskId);
    
    if (success) {
      const task = taskSupervisor.getTask(taskId);
      if (task && task.options && task.options.sessionId) {
        sessionManager.addSessionEvent(task.options.sessionId, 'task_paused', { taskId });
      }
    }
    
    return res.json({
      success,
      message: `Task ${taskId} paused`
    });
  } catch (error) {
    console.error('Error pausing task:', error);
    return res.status(500).json({ error: 'Failed to pause task' });
  }
});

// Resume a task
app.post('/api/computer-use/resume/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskSupervisor.resumeTask(taskId);
    
    if (success) {
      const task = taskSupervisor.getTask(taskId);
      if (task && task.options && task.options.sessionId) {
        sessionManager.addSessionEvent(task.options.sessionId, 'task_resumed', { taskId });
      }
    }
    
    return res.json({
      success,
      message: `Task ${taskId} resumed`
    });
  } catch (error) {
    console.error('Error resuming task:', error);
    return res.status(500).json({ error: 'Failed to resume task' });
  }
});

// Abort a task
app.post('/api/computer-use/abort/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskSupervisor.abortTask(taskId);
    
    if (success) {
      const task = taskSupervisor.getTask(taskId);
      if (task && task.options && task.options.sessionId) {
        sessionManager.addSessionEvent(task.options.sessionId, 'task_aborted', { 
          taskId,
          reason: req.body.reason || 'user_request'
        });
      }
    }
    
    return res.json({
      success,
      message: `Task ${taskId} aborted`
    });
  } catch (error) {
    console.error('Error aborting task:', error);
    return res.status(500).json({ error: 'Failed to abort task' });
  }
});

// Execute a Computer Use task from command center
app.post('/api/computer-use/execute', async (req, res) => {
  try {
    console.log('Received Computer Use execute request:', req.body);
    
    // Validate input
    const { taskDescription, sessionId } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ 
        error: 'Task description is required' 
      });
    }
    
    // Ensure browser is initialized
    await ensureBrowserInitialized();
    
    // Use existing session or create a new one
    let session = sessionId ? sessionManager.getSession(sessionId) : null;
    let newSessionId = sessionId;
    
    if (!session) {
      newSessionId = sessionManager.createSession('command_center', {
        taskDescription,
        source: 'command_center'
      });
      console.log(`Created new session with ID: ${newSessionId}`);
    }
    
    // Start a task with complete execution settings
    const taskId = await taskSupervisor.startTask(
      activePage, 
      taskDescription,
      {
        sessionId: newSessionId,
        waitForCompletion: true,
        maxActions: 5, // Limit the number of actions for each execution
        extract_thinking: true // Ensure thinking is extracted during task execution
      }
    );
    
    // Wait for task to complete
    const taskResult = await taskSupervisor.waitForTaskCompletion(taskId);
    
    // Get the latest task data
    const task = taskSupervisor.getTask(taskId);
    
    // Get the thinking from the last message in the task if available
    let finalThinking = null;
    if (task.messages && task.messages.length > 0) {
      // Find the last assistant message with thinking content
      for (let i = task.messages.length - 1; i >= 0; i--) {
        const message = task.messages[i];
        if (message.role === 'assistant' && message.content) {
          finalThinking = message.content;
          break;
        }
      }
    }
    
    // Log the completion status
    console.log(`Task ${taskId} completed with status: ${task.status}`);
    console.log(`Task success: ${task.status === 'completed'}`);
    console.log(`Actions executed: ${task.actions ? task.actions.length : 0}`);
    
    return res.json({ 
      success: task.status === 'completed',
      complete: ['completed', 'failed', 'aborted', 'timeout'].includes(task.status),
      sessionId: newSessionId,
      taskId,
      thinking: finalThinking, // Use thinking from the completed task
      actions: task.actions,
      results: task.actionResults,
      error: task.error || null
    });
  } catch (error) {
    console.error('Error executing Computer Use task:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to execute Computer Use task',
      details: error.message
    });
  }
});

// List all active tasks
app.get('/api/computer-use/tasks', (req, res) => {
  try {
    const tasks = taskSupervisor.getAllTasks().map(task => ({
      id: task.id,
      description: task.description,
      status: task.status,
      startTime: task.startTime,
      lastUpdated: task.lastUpdated,
      actionsCount: task.actions.length
    }));
    
    return res.json({ tasks });
  } catch (error) {
    console.error('Error listing tasks:', error);
    return res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Save an action sequence
app.post('/api/sequences/save', (req, res) => {
  try {
    const { description, actions } = req.body;
    
    if (!description || !actions || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: 'Invalid sequence data. Description and actions array are required.' 
      });
    }
    
    // Create sequences directory if it doesn't exist
    const sequencesDir = path.join(__dirname, 'sequences');
    if (!fs.existsSync(sequencesDir)) {
      fs.mkdirSync(sequencesDir, { recursive: true });
    }
    
    // Generate a unique filename based on the description
    const filename = `${description.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.json`;
    const filePath = path.join(sequencesDir, filename);
    
    // Save the sequence data
    const sequenceData = {
      id: `seq_${Date.now()}`,
      description,
      actions,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(sequenceData, null, 2));
    
    console.log(`Saved sequence "${description}" to ${filePath}`);
    
    return res.json({
      success: true,
      sequenceId: sequenceData.id,
      filename
    });
  } catch (error) {
    console.error('Error saving sequence:', error);
    return res.status(500).json({ 
      error: 'Failed to save sequence',
      details: error.message 
    });
  }
});

// List saved sequences
app.get('/api/sequences', (req, res) => {
  try {
    const sequencesDir = path.join(__dirname, 'sequences');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(sequencesDir)) {
      fs.mkdirSync(sequencesDir, { recursive: true });
      return res.json({ sequences: [] });
    }
    
    // Read all sequence files
    const files = fs.readdirSync(sequencesDir)
      .filter(file => file.endsWith('.json'));
    
    const sequences = files.map(file => {
      try {
        const filePath = path.join(sequencesDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        return {
          id: data.id,
          filename: file,
          description: data.description,
          actionCount: data.actions.length,
          createdAt: data.createdAt
        };
      } catch (err) {
        console.error(`Error reading sequence file ${file}:`, err);
        return null;
      }
    }).filter(Boolean);
    
    return res.json({ sequences });
  } catch (error) {
    console.error('Error listing sequences:', error);
    return res.status(500).json({ 
      error: 'Failed to list sequences',
      details: error.message 
    });
  }
});

// Store test files
const testDir = path.join(__dirname, 'tests');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Track active browser contexts
let activeBrowser = null;
let activePage = null;
let browserScreenshotInterval = null;
const screenshotInterval = 2000; // milliseconds between screenshots (reduced from 200ms)
let isCapturing = false;
let isHumanHandoffMode = false;
let handoffPendingResolve = null;
let handoffPendingReject = null;

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

// Add new function for human handoff mode
async function enterHumanHandoffMode(socket, message = "Please complete this action manually, then click 'Continue'") {
  console.log('Entering human handoff mode');
  isHumanHandoffMode = true;
  
  // Notify client that we're entering human handoff mode
  socket.emit('human-handoff-mode', { 
    active: true, 
    message 
  });
  
  // Return a promise that will resolve when the user completes the action
  return new Promise((resolve, reject) => {
    handoffPendingResolve = resolve;
    handoffPendingReject = reject;
    
    // Set a timeout for the handoff (5 minutes)
    setTimeout(() => {
      if (isHumanHandoffMode) {
        exitHumanHandoffMode(socket);
        reject(new Error('Human handoff timed out after 5 minutes'));
      }
    }, 5 * 60 * 1000);
  });
}

function exitHumanHandoffMode(socket) {
  console.log('Exiting human handoff mode');
  isHumanHandoffMode = false;
  
  // Notify client that we're exiting human handoff mode
  socket.emit('human-handoff-mode', { active: false });
  
  // Clear the pending promises
  handoffPendingResolve = null;
  handoffPendingReject = null;
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Start screenshot streaming when the client signals it's ready
  socket.on('ready-for-screenshots', () => {
    console.log('Client is ready for screenshots, starting streaming');
    startBrowserScreenshotStreaming(socket);
  });
  
  // Handle client disconnection
  socket.on('disconnect', async () => {
    console.log('Client disconnected');
    
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
      
      // Log the received text, but truncate if it's long
      const displayText = text.length > 20 ? text.substring(0, 20) + '...' : text;
      console.log(`Received text to type: "${displayText}" (length: ${text.length})`);
      
      // Determine if this is a longer text (like from direct input) or a single character
      if (text.length > 1) {
        // For longer text, try various methods to ensure it works across different sites
        try {
          // First, try to use active element if it exists
          const activeElementExists = await activePage.evaluate(() => {
            return document.activeElement && 
                   (document.activeElement.tagName === 'INPUT' || 
                    document.activeElement.tagName === 'TEXTAREA' ||
                    document.activeElement.contentEditable === 'true');
          });
          
          if (activeElementExists) {
            // Use focused element - clear it first then type
            await activePage.evaluate((inputText) => {
              if (document.activeElement) {
                // For input and textarea elements
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                  document.activeElement.value = '';
                  document.activeElement.value = inputText;
                  // Trigger events
                  document.activeElement.dispatchEvent(new Event('input', {bubbles: true}));
                  document.activeElement.dispatchEvent(new Event('change', {bubbles: true}));
                } 
                // For contentEditable elements
                else if (document.activeElement.contentEditable === 'true') {
                  document.activeElement.textContent = inputText;
                  document.activeElement.dispatchEvent(new Event('input', {bubbles: true}));
                }
              }
            }, text);
            
            console.log(`Typed text into active element using JS evaluation`);
          } else {
            // No active element, use regular keyboard typing
            await activePage.keyboard.type(text);
            console.log(`Typed text using keyboard API`);
          }
        } catch (evalError) {
          console.error(`Error using active element: ${evalError.message}`);
          // Fallback to keyboard typing
          await activePage.keyboard.type(text);
        }
      } else if (text.length === 1) {
        // For single characters, including special characters like @
        // Use Playwright's keyboard API which handles special characters correctly
        await activePage.keyboard.type(text);
        console.log(`Typed single character: "${text}" using keyboard API`);
      }
      
      // Don't log every keystroke to avoid flooding the output
      if (text.length > 1) {
        socket.emit('test-output', { data: `Typed text: "${text}"\n` });
      }
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
  
  // Handle human handoff continuation
  socket.on('human-handoff-continue', () => {
    if (isHumanHandoffMode && handoffPendingResolve) {
      console.log('Human handoff completed by user');
      const resolve = handoffPendingResolve;
      exitHumanHandoffMode(socket);
      resolve();
    }
  });
  
  // Handle human handoff cancellation
  socket.on('human-handoff-cancel', () => {
    if (isHumanHandoffMode && handoffPendingReject) {
      console.log('Human handoff cancelled by user');
      const reject = handoffPendingReject;
      exitHumanHandoffMode(socket);
      reject(new Error('Human handoff cancelled by user'));
    }
  });
  
  // Handle individual step execution with the real browser
  socket.on('run-step', async (data) => {
    const { step } = data;
    
    try {
      await ensureBrowserInitialized();
      
      // Handle LinkedIn login with human handoff
      if (step.type === 'linkedin-login') {
        const url = step.data.url || 'https://www.linkedin.com/login';
        
        // Navigate to LinkedIn login page
        await activePage.goto(url, { waitUntil: 'domcontentloaded' });
        socket.emit('test-output', { data: `Navigated to LinkedIn login page\n` });
        
        // Enter human handoff mode for login
        await enterHumanHandoffMode(socket, 
          "Please login to LinkedIn with your credentials. Click 'Continue' when you're logged in.");
          
        // When the promise resolves, the user has completed login
        socket.emit('test-output', { data: `LinkedIn login completed by user\n` });
      } else if (step.type === 'goto') {
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
        } else if (step.data.method === 'getByTestId') {
          selector = `[data-testid="${step.data.selector}"]`;
        } else if (step.data.method === 'getByLabel') {
          selector = `text=${step.data.selector}`;
        } else if (step.data.method === 'getByPlaceholder') {
          selector = `[placeholder="${step.data.selector}"]`;
        } else if (step.data.method === 'direct') {
          selector = step.data.selector;
        } else {
          selector = step.data.selector;
        }
        
        await activePage.click(selector);
        socket.emit('test-output', { data: `Clicked element: ${selector}\n` });
      } else if (step.type === 'fill') {
        const selector = getEffectiveSelector(step.data);
        try {
          // Special handling for Investing.com search
          const currentUrl = await activePage.url();
          if (currentUrl.includes('investing.com')) {
            console.log('Detected Investing.com, using specialized approach for search');
            
            try {
              // Try a variety of known selectors for Investing.com search
              const searchSelectors = [
                'input[data-testid="search-input"]', 
                '#searchText', 
                '.searchText', 
                'input[placeholder*="Search"]',
                '#searchTextBox',
                '.js-main-search-field'
              ];
              
              // Try to find and click on the search icon/button first to open search field
              try {
                await activePage.click('[data-testid="search-button"], .searchGlassIcon, #searchIcon', { timeout: 3000 });
                console.log('Clicked on search icon');
                await activePage.waitForTimeout(500);
              } catch (e) {
                console.log('No search icon found or already in search state, continuing...');
              }
              
              // Try each selector until one works
              let searchSuccessful = false;
              for (const searchSelector of searchSelectors) {
                if (searchSuccessful) break;
                
                try {
                  // Check if the element exists
                  const isVisible = await activePage.isVisible(searchSelector, { timeout: 2000 });
                  if (!isVisible) continue;
                  
                  console.log(`Found search box with selector: ${searchSelector}`);
                  
                  // Clear and type using JS evaluation (more reliable for complex sites)
                  await activePage.evaluate(({selector, value}) => {
                    const element = document.querySelector(selector);
                    if (element) {
                      // Focus and clear
                      element.focus();
                      element.value = '';
                      // Set value and dispatch events
                      element.value = value;
                      element.dispatchEvent(new Event('input', {bubbles: true}));
                      element.dispatchEvent(new Event('change', {bubbles: true}));
                      return true;
                    }
                    return false;
                  }, {selector: searchSelector, value: step.data.value});
                  
                  // Press Enter to submit search
                  await activePage.waitForTimeout(500);
                  await activePage.keyboard.press('Enter');
                  
                  console.log(`Typed "${step.data.value}" into search box and pressed Enter`);
                  socket.emit('test-output', { data: `Successfully searched for "${step.data.value}" on Investing.com\n` });
                  
                  searchSuccessful = true;
                  
                  // Give time for search results to appear
                  await activePage.waitForTimeout(2000);
                  
                  return; // Exit early as we've handled the search
                } catch (err) {
                  console.log(`Attempt with selector ${searchSelector} failed: ${err.message}`);
                }
              }
              
              if (!searchSuccessful) {
                console.log('All specialized search attempts failed, falling back to normal methods');
              }
            } catch (investingError) {
              console.log(`Investing.com specialized handling failed: ${investingError.message}`);
            }
          }
        
          // First attempt: Try the standard fill method
          console.log(`Attempting to fill ${selector} with value "${step.data.value}" using standard fill method`);
          await activePage.fill(selector, step.data.value);
          socket.emit('test-output', { data: `Filled ${selector} with "${step.data.value}"\n` });
        } catch (fillError) {
          console.log(`Standard fill method failed for ${selector}: ${fillError.message}`);
          socket.emit('test-output', { data: `Standard fill failed, trying alternative methods...\n` });
          
          try {
            // Second attempt: Try clicking first, then type
            console.log(`Attempting to click and then type into ${selector}`);
            await activePage.click(selector, { clickCount: 3 }); // Triple click to select all existing text
            await activePage.waitForTimeout(100); // Small delay
            
            // Clear the field first
            await activePage.keyboard.press('Backspace');
            await activePage.waitForTimeout(100); // Small delay
            
            // Type the value
            await activePage.keyboard.type(step.data.value);
            socket.emit('test-output', { data: `Filled ${selector} with "${step.data.value}" using click and type method\n` });
          } catch (clickTypeError) {
            console.log(`Click and type method failed: ${clickTypeError.message}`);
            
            try {
              // Third attempt: JavaScript injection approach - fixed by passing a single object parameter
              console.log(`Attempting to fill ${selector} with JS evaluation`);
              await activePage.evaluate(({selector, value}) => {
                const element = document.querySelector(selector);
                if (element) {
                  // Set the value property
                  element.value = value;
                  
                  // Dispatch events to trigger any listeners
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
                return false;
              }, {selector, value: step.data.value});
              
              socket.emit('test-output', { data: `Filled ${selector} with "${step.data.value}" using JavaScript injection\n` });
            } catch (jsError) {
              // If all attempts fail, report the error
              console.error(`All fill methods failed for ${selector}: ${jsError.message}`);
              socket.emit('test-output', { data: `Failed to fill ${selector}: ${jsError.message}\n` });
              throw new Error(`Could not fill ${selector} with "${step.data.value}" after multiple attempts`);
            }
          }
        }
      } else if (step.type === 'type') {
        const selector = getEffectiveSelector(step.data);
        try {
          console.log(`Attempting to type into ${selector}: "${step.data.value}"`);
          
          // First clear any existing content with a click and select all
          await activePage.click(selector, { clickCount: 3 });
          await activePage.waitForTimeout(100);
          
          // Clear with backspace
          await activePage.keyboard.press('Backspace');
          await activePage.waitForTimeout(100);
          
          // Type the new content
          await activePage.keyboard.type(step.data.value);
          socket.emit('test-output', { data: `Typed "${step.data.value}" into ${selector}\n` });
        } catch (error) {
          console.error(`Error typing into ${selector}: ${error.message}`);
          
          try {
            // Fallback method: try JavaScript injection
            console.log(`Attempting type with JS evaluation for ${selector}`);
            const success = await activePage.evaluate(({selector, value}) => {
              const element = document.querySelector(selector);
              if (element) {
                // Focus the element
                element.focus();
                
                // Clear existing value
                element.value = '';
                
                // Set new value
                element.value = value;
                
                // Dispatch events to trigger any listeners
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
              return false;
            }, {selector, value: step.data.value});
            
            if (success) {
              socket.emit('test-output', { data: `Typed "${step.data.value}" into ${selector} using JavaScript\n` });
            } else {
              throw new Error(`Could not find element ${selector} for typing`);
            }
          } catch (jsError) {
            socket.emit('test-output', { data: `Failed to type into ${selector}: ${jsError.message}\n` });
            throw jsError;
          }
        }
      } else if (step.type === 'keyboard') {
        // Direct keyboard typing without a specific element focus
        try {
          console.log(`Typing with keyboard: "${step.data.value}"`);
          await activePage.keyboard.type(step.data.value);
          socket.emit('test-output', { data: `Typed "${step.data.value}" using keyboard\n` });
        } catch (error) {
          console.error(`Error typing with keyboard: ${error.message}`);
          socket.emit('test-output', { data: `Failed to type with keyboard: ${error.message}\n` });
          throw error;
        }
      } else if (step.type === 'wait') {
        if (step.data.method === 'selector') {
          await activePage.waitForSelector(step.data.target);
          socket.emit('test-output', { data: `Waited for selector: ${step.data.target}\n` });
        } else if (step.data.method === 'navigation') {
          await activePage.waitForNavigation();
          socket.emit('test-output', { data: 'Waited for navigation to complete\n' });
        } else if (step.data.method === 'timeout') {
          await activePage.waitForTimeout(step.data.timeout);
          socket.emit('test-output', { data: `Waited for ${step.data.timeout}ms\n` });
        }
      } else if (step.type === 'check' || step.type === 'uncheck') {
        const selector = getEffectiveSelector(step.data);
        if (step.type === 'check') {
          await activePage.check(selector);
          socket.emit('test-output', { data: `Checked checkbox: ${selector}\n` });
        } else {
          await activePage.uncheck(selector);
          socket.emit('test-output', { data: `Unchecked checkbox: ${selector}\n` });
        }
      } else if (step.type === 'select') {
        const selector = getEffectiveSelector(step.data);
        await activePage.selectOption(selector, step.data.value);
        socket.emit('test-output', { data: `Selected option "${step.data.value}" in ${selector}\n` });
      } else if (step.type === 'press') {
        const selector = getEffectiveSelector(step.data);
        await activePage.press(selector, step.data.key);
        socket.emit('test-output', { data: `Pressed key "${step.data.key}" on ${selector}\n` });
      } else if (step.type === 'hover') {
        const selector = getEffectiveSelector(step.data);
        await activePage.hover(selector);
        socket.emit('test-output', { data: `Hovered over ${selector}\n` });
      } else if (step.type === 'scroll') {
        const selector = getEffectiveSelector(step.data);
        // Using evaluate to scroll element into view
        await activePage.evaluate(selector => {
          const element = document.querySelector(selector);
          if (element) element.scrollIntoView();
        }, selector);
        socket.emit('test-output', { data: `Scrolled to ${selector}\n` });
      } else if (step.type === 'waitFor') {
        if (step.data.method === 'selector') {
          await activePage.waitForSelector(step.data.target);
          socket.emit('test-output', { data: `Waited for selector: ${step.data.target}\n` });
        } else if (step.data.method === 'navigation') {
          await activePage.waitForNavigation();
          socket.emit('test-output', { data: 'Waited for navigation to complete\n' });
        } else if (step.data.method === 'timeout') {
          await activePage.waitForTimeout(step.data.timeout);
          socket.emit('test-output', { data: `Waited for ${step.data.timeout}ms\n` });
        }
      } else {
        socket.emit('test-output', { data: `Unknown step type: ${step.type}\n` });
      }
    } catch (error) {
      socket.emit('test-output', { data: `Step execution error: ${error.message}\n` });
    }
  });
  
  // Add Computer Use specific events
  socket.on('join-task', (taskId) => {
    socket.join(`task-${taskId}`);
    console.log(`Client joined task room: ${taskId}`);
  });
  
  // Handle task events
  taskSupervisor.on('taskStarted', (task) => {
    io.to(`task-${task.id}`).emit('task-started', { 
      taskId: task.id, 
      description: task.description 
    });
  });
  
  taskSupervisor.on('screenshotCaptured', ({ taskId, screenshot }) => {
    io.to(`task-${taskId}`).emit('task-screenshot', { 
      taskId, 
      screenshot: screenshot.base64, 
      metadata: screenshot.metadata 
    });
  });
  
  taskSupervisor.on('actionExecuted', ({ taskId, action }) => {
    io.to(`task-${taskId}`).emit('task-action', { taskId, action });
  });
  
  taskSupervisor.on('actionError', ({ taskId, action, error }) => {
    io.to(`task-${taskId}`).emit('task-action-error', { taskId, action, error: error.message });
  });
  
  taskSupervisor.on('aiThinking', ({ taskId, thinking }) => {
    io.to(`task-${taskId}`).emit('task-thinking', { taskId, thinking });
  });
  
  taskSupervisor.on('taskStatusChanged', ({ taskId, status, task }) => {
    io.to(`task-${taskId}`).emit('task-status-changed', { 
      taskId, 
      status, 
      result: task.result
    });
  });
  
  taskSupervisor.on('taskPaused', ({ taskId }) => {
    io.to(`task-${taskId}`).emit('task-paused', { taskId });
  });
  
  taskSupervisor.on('taskResumed', ({ taskId }) => {
    io.to(`task-${taskId}`).emit('task-resumed', { taskId });
  });
  
  taskSupervisor.on('taskAborted', ({ taskId }) => {
    io.to(`task-${taskId}`).emit('task-aborted', { taskId });
  });
});

/**
 * Helper function to get the effective selector based on method
 * @param {Object} data - Step data containing method and selector
 * @returns {string} - The effective selector to use
 */
function getEffectiveSelector(data) {
  const { method, selector } = data;
  
  if (method === 'locator' || method === 'direct') {
    return selector;
  } else if (method === 'getByRole') {
    // Simple conversion for role selectors
    if (selector.includes('link')) {
      return `a:has-text("${selector.replace(/link|button/g, '').trim()}")`;
    } else {
      return `text=${selector}`;
    }
  } else if (method === 'getByText') {
    return `text=${selector}`;
  } else if (method === 'getByTestId') {
    return `[data-testid="${selector}"]`;
  } else if (method === 'getByLabel') {
    return `text=${selector}`;
  } else if (method === 'getByPlaceholder') {
    return `[placeholder="${selector}"]`;
  }
  
  return selector;
}

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

// Add the missing parse-test endpoint
app.post('/parse-test', (req, res) => {
  try {
    const { script } = req.body;
    
    if (!script) {
      return res.status(400).json({ error: 'No script provided' });
    }
    
    console.log('Parsing test script...');
    const steps = parseTest(script);
    console.log(`Parsed ${steps.length} steps from script`);
    
    return res.json({ steps });
  } catch (error) {
    console.error('Error parsing test script:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint to execute Computer Use actions directly on the active browser page
app.post('/api/computer-use/execute-direct', async (req, res) => {
  try {
    const { taskDescription, screenshotBase64, messages } = req.body;
    
    if (!taskDescription) {
      return res.status(400).json({ error: 'Task description is required' });
    }
    
    const result = await executeComputerUseOnActiveBrowser(taskDescription, screenshotBase64, messages);
    return res.json(result);
  } catch (error) {
    console.error('Error executing Computer Use actions:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Execute Computer Use actions directly on the active browser page 
 * For frontend integration with the embedded browser
 * @param {string} taskDescription - The task description
 * @param {string} screenshotBase64 - Base64 encoded screenshot (optional)
 * @param {Array} messages - Conversation history (optional)
 * @returns {Object} - Result of the execution
 */
async function executeComputerUseOnActiveBrowser(taskDescription, screenshotBase64, messages = []) {
  try {
    console.log('========== COMPUTER USE TASK START ==========');
    console.log(`Task: "${taskDescription}"`);
    console.log('=========================================');
    
    // Initialize browser if not already running
    await ensureBrowserInitialized();
    
    if (!activePage) {
      throw new Error('No active page available');
    }
    
    // Capture screenshot if not provided
    let screenshot = screenshotBase64;
    if (!screenshot) {
      const capturedScreenshot = await activePage.screenshot({
        type: 'jpeg',
        quality: 80,
        fullPage: false
      });
      screenshot = capturedScreenshot.toString('base64');
      console.log('Screenshot captured for Computer Use task');
    }
    
    // Get page information for logging
    const currentUrl = await activePage.url();
    const pageTitle = await activePage.title();
    console.log(`Current page: ${currentUrl}`);
    console.log(`Page title: ${pageTitle}`);
    
    // Get actions from OpenAI
    console.log('Requesting Computer Use actions from OpenAI...');
    const aiResponse = await getComputerUseActions(
      activePage,
      taskDescription,
      { 
        extract_thinking: true,
        messages: messages 
      }
    );
    
    // Log response details
    console.log('OpenAI Response Details:');
    console.log(`- Complete flag: ${aiResponse.complete}`);
    console.log(`- Status: ${aiResponse.status || 'not provided'}`);
    console.log(`- Actions count: ${aiResponse.actions ? aiResponse.actions.length : 0}`);
    if (aiResponse.thinking) {
      console.log('- Thinking excerpt: ' + aiResponse.thinking.substring(0, 100) + '...');
    }
    
    // Track execution results
    const actionResults = [];
    let allActionsSuccessful = true;
    
    // Execute actions if available
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      console.log(`Executing ${aiResponse.actions.length} Computer Use actions...`);
      
      for (const action of aiResponse.actions) {
        console.log(`Executing action: ${action.type} - ${JSON.stringify(action)}`);
        try {
          // For click actions, use more lenient timeout settings
          if (action.type === 'click' && action.selector) {
            try {
              await activePage.waitForSelector(action.selector, { 
                timeout: 10000, // 10 second timeout
                state: 'visible' 
              });
              console.log(`Selector ${action.selector} found and visible`);
            } catch (selectorError) {
              console.log(`Warning: Selector ${action.selector} not visible within timeout, but will still try to click`);
              // Continue with execution
            }
          }
          
          const result = await actionExecutor.executeAction(activePage, action);
          console.log(`Action executed successfully`);
          actionResults.push({
            action,
            success: true,
            result
          });
        } catch (actionError) {
          console.error(`Action execution failed: ${actionError.message}`);
          actionResults.push({
            action,
            success: false,
            error: actionError.message
          });
          allActionsSuccessful = false;
          // No longer break on first error - collect all results
          // This allows partial task completion
        }
      }
    }
    
    // Get final page state
    const finalUrl = await activePage.url();
    const finalTitle = await activePage.title();
    console.log(`Final page after actions: ${finalUrl}`);
    console.log(`Final page title: ${finalTitle}`);
    
    // Generate task ID for validation system
    const taskId = require('crypto').randomBytes(8).toString('hex');
    
    // Enhanced task success determination with better logging
    // Check multiple indicators for task success
    const aiIndicatesSuccess = aiResponse.complete === true || 
                              (aiResponse.status === 'complete') ||
                              (aiResponse.thinking && aiResponse.thinking.toLowerCase().includes('task complete'));
                              
    const taskSuccess = allActionsSuccessful && aiIndicatesSuccess;
    
    // Detailed logging for task completion status
    console.log('==== TASK COMPLETION STATUS ====');
    console.log(`All actions successful: ${allActionsSuccessful}`);
    console.log(`AI 'complete' flag: ${aiResponse.complete}`);
    console.log(`AI 'status': ${aiResponse.status || 'not set'}`);
    console.log(`Contains completion phrase in thinking: ${aiResponse.thinking && aiResponse.thinking.toLowerCase().includes('task complete')}`);
    console.log(`Final determination - Task ${taskSuccess ? 'SUCCEEDED' : 'FAILED'}`);
    console.log('===============================');
    
    // Return final result with all metadata for UI
    return {
      success: taskSuccess,
      complete: aiResponse.complete,
      status: aiResponse.status,
      thinking: aiResponse.thinking,
      actions: aiResponse.actions,
      actionResults: actionResults,
      messages: messages,
      url: finalUrl,
      title: finalTitle,
      taskId,
      sessionId: Date.now().toString() // Add session ID for validation
    };
  } catch (error) {
    console.error('Error in Computer Use execution:', error);
    console.log('========== COMPUTER USE TASK END (ERROR) ==========');
    return {
      success: false,
      error: error.message
    };
  }
}

// Find similar tasks
app.post('/api/computer-use/similar-tasks', async (req, res) => {
  try {
    console.log('Searching for similar tasks');
    
    // Validate input
    const { taskDescription } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ 
        error: 'Task description is required' 
      });
    }
    
    // Find similar tasks
    const tasks = await taskRepository.findSimilarTasks(taskDescription);
    
    return res.json({ 
      success: true, 
      tasks
    });
  } catch (error) {
    console.error('Error finding similar tasks:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to find similar tasks',
      details: error.message
    });
  }
});

// Validate task completion
app.post('/api/computer-use/validate', async (req, res) => {
  try {
    console.log('Received task validation request');
    
    // Validate input
    const { taskId, success, description, actions, sessionId } = req.body;
    if (!taskId || typeof success !== 'boolean' || !description) {
      return res.status(400).json({ 
        error: 'Task ID, success status, and description are required' 
      });
    }
    
    // Get current page URL and title
    let pageInfo = {};
    try {
      const url = await activePage.url();
      const title = await activePage.title();
      pageInfo = { url, title };
    } catch (e) {
      console.error('Error getting page info:', e);
      pageInfo = { url: 'unknown', title: 'unknown' };
    }
    
    if (success) {
      // Save validated task
      await taskRepository.saveValidatedTask({
        id: taskId,
        description,
        actions,
        url: pageInfo.url,
        title: pageInfo.title,
        sessionId
      });
      
      console.log(`Task ${taskId} validated and saved to repository`);
    } else {
      console.log(`Task ${taskId} marked as failed by user`);
      // Could save failed tasks for analysis if needed
    }
    
    return res.json({ 
      success: true, 
      message: success ? 'Task validated and saved' : 'Task marked as failed'
    });
  } catch (error) {
    console.error('Error validating task:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to validate task',
      details: error.message
    });
  }
});

// Execute validated task
app.post('/api/computer-use/execute-validated', async (req, res) => {
  try {
    console.log('Executing validated task');
    
    // Validate input
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ 
        error: 'Task ID is required' 
      });
    }
    
    // Get the validated task
    const task = await taskRepository.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    // Ensure browser is initialized
    await ensureBrowserInitialized();
    
    // Execute each action in the validated sequence
    console.log(`Executing ${task.actions.length} actions from validated task`);
    
    const results = [];
    for (const action of task.actions) {
      try {
        // Execute the action using the action executor
        const result = await actionExecutor.executeAction(activePage, action);
        results.push({ success: true, ...result });
      } catch (actionError) {
        console.error('Error executing action:', actionError);
        results.push({ 
          success: false, 
          error: actionError.message
        });
      }
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Update task frequency
    await taskRepository.saveValidatedTask({
      id: taskId,
      description: task.description,
      actions: task.actions,
      url: task.url,
      title: task.title
    });
    
    return res.json({
      success: true,
      taskId,
      description: task.description,
      actions: task.actions,
      results
    });
  } catch (error) {
    console.error('Error executing validated task:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to execute validated task',
      details: error.message
    });
  }
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});

// Export the necessary functions for external use
module.exports = {
  ensureBrowserInitialized,
  getBrowserInfo: () => ({ activeBrowser, activePage }),
  startBrowserScreenshotStreaming,
  cleanupBrowserResources,
  executeComputerUseOnActiveBrowser
};