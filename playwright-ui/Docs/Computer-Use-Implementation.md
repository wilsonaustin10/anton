# OpenAI Computer Use Implementation Plan for AutonoM3

## Overview

OpenAI's Computer Use API allows AI assistants to remotely control a computer by seeing screenshots and performing actions to complete complex tasks. This enhancement will significantly boost our existing agent automation capabilities by providing a more robust, intelligent way to handle complex tasks that require real-time adaptation.

The goal is to implement Computer Use functionality while preserving all existing features and capabilities of the AutonoM3 Agent Builder.

## Architecture Design

### New Components Structure

```
playwright-ui/
├── src/
│   ├── computer-use/              # New module for OpenAI Computer Use integration
│   │   ├── screenshot-manager.js  # Screenshot capture and processing
│   │   ├── action-executor.js     # Execute actions from OpenAI
│   │   ├── task-supervisor.js     # Manage long-running tasks
│   │   └── session-manager.js     # Manage computer use sessions
│   ├── agent-generator/           # Existing code
│   └── agent-storage/             # Existing code
```

### Data Flow

```
User Request -> Task Analysis -> Computer Use Session Initialization
  -> Screenshot Capture -> OpenAI Analysis -> Action Execution
  -> Feedback Loop (repeat until task completion) -> Results Delivery
```

## Detailed Implementation Steps

### Phase 1: Foundation Setup

1. **Update OpenAI SDK**
   - Ensure we're using the latest OpenAI SDK with Computer Use support
   - Update `package.json` to include any necessary dependencies

2. **Create Screenshot Manager**
   - Enhance existing screenshot functionality in `server.js` to work with Computer Use
   - Implement proper formatting of screenshots for OpenAI's Computer Use API
   - Add metadata to screenshots (resolution, cursor position, etc.)

3. **Build Action Executor**
   - Create a module to translate OpenAI's action instructions into Playwright commands
   - Support all basic actions: clicks, typing, navigation, scrolling, etc.
   - Add validation and safety checks for all actions

### Phase 2: Core Functionality

1. **Task Supervision System**
   - Create a system to manage long-running tasks
   - Implement state management for tasks in progress
   - Add timeout and error recovery mechanisms

2. **Session Management**
   - Build a session manager to handle Computer Use sessions
   - Implement session persistence for longer tasks
   - Add user authentication and session security

3. **OpenAI Integration**
   - Modify the existing OpenAI client to support Computer Use tools
   - Create specialized prompts for Computer Use scenarios
   - Implement feedback processing from the actions

### Phase 3: UI and UX Enhancements

1. **Progress Visualization**
   - Add a visual task progress indicator
   - Implement a timeline of actions taken
   - Create a debug view showing the AI's "thought process"

2. **User Controls**
   - Add pause/resume functionality for long-running tasks
   - Implement manual intervention options
   - Create an abort mechanism for tasks

3. **Result Reporting**
   - Enhance the reporting of completed tasks
   - Add session recording/playback functionality
   - Implement task success/failure metrics

## Technical Implementation Details

### 1. OpenAI Computer Use Configuration

```javascript
// src/computer-use/config.js
module.exports = {
  // OpenAI Computer Use configuration
  computerUseConfig: {
    enabled: process.env.ENABLE_COMPUTER_USE === 'true',
    maxSessionDuration: parseInt(process.env.MAX_SESSION_DURATION || '3600', 10), // 1 hour default
    screenshotInterval: parseInt(process.env.SCREENSHOT_INTERVAL || '1000', 10), // 1 second default
    maxActions: parseInt(process.env.MAX_ACTIONS || '100', 10), // Maximum actions per session
    safeMode: process.env.SAFE_MODE !== 'false', // Default to safe mode
  },
  
  // Action restrictions for safety
  actionRestrictions: {
    allowedDomains: (process.env.ALLOWED_DOMAINS || '').split(',').filter(Boolean),
    forbiddenSelectors: ['input[type="password"]', '.private-info'],
    maxTypingLength: 1000,
  }
};
```

### 2. Screenshot Manager Implementation

```javascript
// src/computer-use/screenshot-manager.js
const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

class ScreenshotManager {
  constructor(config) {
    this.config = config;
    this.screenshotDir = path.join(__dirname, '../../temp/screenshots');
    this.ensureDirectoryExists(this.screenshotDir);
  }
  
  async captureScreenshot(page) {
    if (!page) throw new Error('No active page for screenshot capture');
    
    const screenshot = await page.screenshot({ 
      type: 'jpeg', 
      quality: 90,
      fullPage: false 
    });
    
    // Get additional context information
    const url = await page.url();
    const title = await page.title();
    const viewportSize = page.viewportSize();
    
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
  }
  
  // Save screenshot with metadata for debugging and audit
  async saveScreenshot(screenshot, sessionId) {
    const filename = `${sessionId}_${screenshot.metadata.timestamp}.jpg`;
    const filepath = path.join(this.screenshotDir, filename);
    
    await fs.promises.writeFile(filepath, screenshot.buffer);
    await fs.promises.writeFile(
      `${filepath}.meta.json`, 
      JSON.stringify(screenshot.metadata, null, 2)
    );
    
    return filepath;
  }
  
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = ScreenshotManager;
```

### 3. Action Executor

```javascript
// src/computer-use/action-executor.js
class ActionExecutor {
  constructor(config) {
    this.config = config;
    this.actionHistory = [];
  }
  
  async executeAction(page, action) {
    if (!page) throw new Error('No active page for action execution');
    
    console.log(`Executing action: ${action.type}`);
    
    // Validate action for safety
    this.validateAction(page, action);
    
    // Execute the appropriate action based on type
    switch (action.type) {
      case 'click':
        await this.executeClick(page, action);
        break;
      case 'type':
        await this.executeType(page, action);
        break;
      case 'navigate':
        await this.executeNavigate(page, action);
        break;
      case 'scroll':
        await this.executeScroll(page, action);
        break;
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
    
    // Record action in history
    this.actionHistory.push({
      ...action,
      timestamp: Date.now(),
      success: true
    });
    
    return { success: true, action };
  }
  
  validateAction(page, action) {
    // Implement safety checks based on config
    // Check for allowed domains, restricted selectors, etc.
  }
  
  async executeClick(page, action) {
    const { selector, position, options } = action;
    if (selector) {
      await page.click(selector, options);
    } else if (position) {
      await page.mouse.click(position.x, position.y);
    }
  }
  
  // Implement other action methods...
}

module.exports = ActionExecutor;
```

### 4. Task Supervisor

```javascript
// src/computer-use/task-supervisor.js
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class TaskSupervisor extends EventEmitter {
  constructor(openaiClient, screenshotManager, actionExecutor) {
    super();
    this.openaiClient = openaiClient;
    this.screenshotManager = screenshotManager;
    this.actionExecutor = actionExecutor;
    this.activeTasks = new Map();
  }
  
  async startTask(page, taskDescription, options = {}) {
    const taskId = uuidv4();
    console.log(`Starting new Computer Use task (${taskId}): ${taskDescription}`);
    
    const task = {
      id: taskId,
      description: taskDescription,
      startTime: Date.now(),
      status: 'initializing',
      page,
      options,
      actions: [],
      screenshots: [],
      messages: []
    };
    
    this.activeTasks.set(taskId, task);
    this.emit('taskStarted', task);
    
    // Start the task execution loop
    this.executeTaskLoop(taskId).catch(error => {
      console.error(`Error in task ${taskId}:`, error);
      this.setTaskStatus(taskId, 'failed', { error: error.message });
    });
    
    return taskId;
  }
  
  async executeTaskLoop(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    // Set task to running status
    this.setTaskStatus(taskId, 'running');
    
    try {
      // Loop until task is complete or max iterations reached
      let iteration = 0;
      const maxIterations = task.options.maxIterations || 50;
      
      while (iteration < maxIterations && task.status === 'running') {
        // 1. Capture screenshot
        const screenshot = await this.screenshotManager.captureScreenshot(task.page);
        task.screenshots.push(screenshot);
        this.emit('screenshotCaptured', { taskId, screenshot });
        
        // 2. Send to OpenAI with current context
        const aiResponse = await this.openaiClient.getComputerUseActions(
          task.description,
          screenshot.base64,
          task.messages
        );
        
        // 3. If task complete, finish
        if (aiResponse.complete) {
          this.setTaskStatus(taskId, 'completed', { 
            result: aiResponse.result 
          });
          break;
        }
        
        // 4. Execute actions from AI
        if (aiResponse.actions && aiResponse.actions.length > 0) {
          for (const action of aiResponse.actions) {
            const result = await this.actionExecutor.executeAction(task.page, action);
            task.actions.push(result);
            this.emit('actionExecuted', { taskId, action: result });
          }
        }
        
        // 5. Update task messages with AI thinking
        if (aiResponse.thinking) {
          task.messages.push({
            role: 'assistant',
            content: aiResponse.thinking,
            timestamp: Date.now()
          });
          this.emit('aiThinking', { taskId, thinking: aiResponse.thinking });
        }
        
        // Wait briefly between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
        iteration++;
      }
      
      // If we reached max iterations but task is still running
      if (iteration >= maxIterations && task.status === 'running') {
        this.setTaskStatus(taskId, 'timeout');
      }
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      this.setTaskStatus(taskId, 'failed', { error: error.message });
    }
  }
  
  setTaskStatus(taskId, status, extras = {}) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    task.status = status;
    task.lastUpdated = Date.now();
    
    if (status === 'completed' || status === 'failed' || status === 'timeout') {
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
    }
    
    // Add any extra properties
    Object.assign(task, extras);
    
    this.emit('taskStatusChanged', { taskId, status, task });
    return task;
  }
  
  // Other methods for task management...
}

module.exports = TaskSupervisor;
```

### 5. OpenAI Client Modifications

```javascript
// Update to openai-client.js

// Add this method to the existing OpenAI client
async function getComputerUseActions(taskDescription, screenshot, messages = []) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }
  
  console.log('Requesting Computer Use actions from OpenAI');
  
  try {
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that can use a computer to complete tasks. 
      Your goal is to help the user complete the following task: ${taskDescription}.
      Analyze the screenshot and provide clear, specific actions to take.
      Be methodical and explain your reasoning.`
    };
    
    // Prepare messages history
    const messageHistory = [
      systemMessage,
      ...messages,
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is the current state of the screen. What actions should I take next?' },
          { type: 'image', image_url: { url: `data:image/jpeg;base64,${screenshot}` } }
        ]
      }
    ];
    
    // Make API request with computer_use tool enabled
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_COMPUTER_USE_MODEL || 'gpt-4-turbo',
      messages: messageHistory,
      tools: [
        {
          type: 'computer_use',
          computer_use: {
            allowed_actions: ['click', 'type', 'navigate', 'scroll'],
            // Configure the tool capabilities
          }
        }
      ],
      tool_choice: { type: 'computer_use' }
    });
    
    // Process the response to extract actions and thinking
    const result = processComputerUseResponse(response);
    return result;
  } catch (error) {
    console.error('Error getting Computer Use actions:', error);
    throw error;
  }
}

// Helper to process Computer Use API response
function processComputerUseResponse(response) {
  // Extract the main message content
  const mainMessage = response.choices[0].message;
  
  // Check if the task is deemed complete
  const isComplete = mainMessage.content && 
                    mainMessage.content.toLowerCase().includes('task complete');
  
  // Extract tool calls (actions)
  const actions = [];
  if (mainMessage.tool_calls && mainMessage.tool_calls.length > 0) {
    for (const toolCall of mainMessage.tool_calls) {
      if (toolCall.type === 'computer_use') {
        const action = JSON.parse(toolCall.computer_use.action);
        actions.push(action);
      }
    }
  }
  
  return {
    complete: isComplete,
    actions,
    thinking: mainMessage.content,
    result: isComplete ? mainMessage.content : null
  };
}

// Add these methods to the exports
module.exports = {
  // Existing exports...
  getComputerUseActions,
  processComputerUseResponse
};
```

### 6. Server Integration

```javascript
// Modifications to server.js

// Import new components
const ScreenshotManager = require('./src/computer-use/screenshot-manager');
const ActionExecutor = require('./src/computer-use/action-executor');
const TaskSupervisor = require('./src/computer-use/task-supervisor');
const { computerUseConfig } = require('./src/computer-use/config');

// Initialize components
const screenshotManager = new ScreenshotManager(computerUseConfig);
const actionExecutor = new ActionExecutor(computerUseConfig);
const taskSupervisor = new TaskSupervisor(
  require('./openai-client'),
  screenshotManager,
  actionExecutor
);

// Add new endpoint for Computer Use tasks
app.post('/api/computer-use/start', async (req, res) => {
  try {
    // Validate input
    const { taskDescription } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ 
        error: 'Task description is required' 
      });
    }
    
    // Ensure browser is initialized
    await ensureBrowserInitialized();
    
    // Start a new task
    const taskId = await taskSupervisor.startTask(
      activePage, 
      taskDescription,
      req.body.options || {}
    );
    
    return res.json({ 
      success: true, 
      taskId,
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

// Add endpoint to check task status
app.get('/api/computer-use/status/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = taskSupervisor.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    return res.json({
      taskId,
      status: task.status,
      progress: {
        actionsExecuted: task.actions.length,
        screenshotsTaken: task.screenshots.length,
        durationMs: Date.now() - task.startTime
      }
    });
  } catch (error) {
    console.error('Error checking task status:', error);
    return res.status(500).json({ error: 'Failed to check task status' });
  }
});

// Socket.io events for real-time updates
io.on('connection', (socket) => {
  // Existing socket handling...
  
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
});
```

## Client-Side UI Additions

New UI components will be added to handle and display Computer Use tasks:

1. Task status monitor
2. Real-time screenshot view
3. AI thinking display
4. Action history log
5. Controls for pausing/aborting tasks

## Necessary Environment Variables

```dotenv
# OpenAI API Configuration
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4-turbo
OPENAI_COMPUTER_USE_MODEL=gpt-4-turbo

# Computer Use Configuration
ENABLE_COMPUTER_USE=true
MAX_SESSION_DURATION=3600
SCREENSHOT_INTERVAL=1000
MAX_ACTIONS=100
SAFE_MODE=true

# Security Settings
ALLOWED_DOMAINS=linkedin.com,github.com
```

## Implementation Strategy and Timeline

### Accelerated 1-Week Implementation Plan
- Days 1-2: Foundation
  - Update OpenAI SDK and dependencies
  - Create the basic screenshot manager
  - Build the prototype action executor

- Days 3-4: Core Functionality
  - Implement task supervision system
  - Build session management
  - Create core OpenAI Computer Use integration

- Days 5-6: UI Development and Integration
  - Build UI components for Computer Use
  - Add progress visualization
  - Implement user controls
  
- Day 7: Testing and Optimization
  - Add safety mechanisms for actions
  - Optimize performance
  - Conduct thorough testing
  - Create documentation

This accelerated timeline requires focused effort and potentially parallel development tracks, but will deliver the complete Computer Use functionality within one week.

## Benefits of This Approach

1. **Improved Automation Capability**: The Computer Use feature will allow for more robust automation that can handle dynamic content and unexpected situations.

2. **Preservation of Existing Features**: This implementation maintains all current functionality while adding new capabilities.

3. **Enhanced User Experience**: Real-time visual feedback of what the AI is doing improves the user experience and builds trust.

4. **Scalable Architecture**: The modular design allows for future enhancements and optimizations.

5. **Safety-First Design**: Built-in safety mechanisms prevent malicious or dangerous actions.

## Integration with Existing Codebase

This implementation is designed to work alongside the existing AutonoM3 Agent Builder functionality. The current agent generation, script execution, and UI features will remain intact, with Computer Use providing an additional, more powerful automation option.

## Next Steps

1. Review this implementation plan with stakeholders
2. Prioritize features for initial implementation
3. Set up development environment with the latest OpenAI SDK
4. Begin incremental implementation starting with the foundation components
5. Plan testing strategy for each component

## Integration with Interactive Browser

The Computer Use functionality has been integrated with the existing interactive browser in the frontend application. This ensures that the OpenAI Computer Use features will operate on the same browser instance that users interact with, rather than creating separate browser instances.

Key integration points:

1. All Computer Use actions are executed on the active browser page (via `activePage` in `server.js`).
2. Screenshots are captured from the active browser page.
3. A user-friendly Computer Use panel has been added to the browser interface.
4. API endpoints process Computer Use actions on the active browser.

## Frontend Integration

A Computer Use panel has been added to the browser interface, allowing users to:

1. Enter a task description for OpenAI to execute.
2. View the thinking process and actions taken by the AI.
3. See the results of each action.
4. Receive feedback on task completion.

The panel is accessible directly within the embedded browser interface. 