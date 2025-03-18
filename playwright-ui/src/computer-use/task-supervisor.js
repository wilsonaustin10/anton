/**
 * Task Supervisor for OpenAI Computer Use integration
 * Manages long-running computer use tasks
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class TaskSupervisor extends EventEmitter {
  /**
   * Create a new task supervisor
   * @param {Object} openaiClient - OpenAI client
   * @param {Object} screenshotManager - Screenshot manager
   * @param {Object} actionExecutor - Action executor
   */
  constructor(openaiClient, screenshotManager, actionExecutor) {
    super();
    this.openaiClient = openaiClient;
    this.screenshotManager = screenshotManager;
    this.actionExecutor = actionExecutor;
    this.activeTasks = new Map();
    this.pausedTasks = new Set();
    console.log('Task supervisor initialized');
  }
  
  /**
   * Start a new computer use task
   * @param {Object} page - Playwright page object
   * @param {string} taskDescription - Description of the task
   * @param {Object} options - Task options
   * @returns {string} - Task ID
   */
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
      actionResults: [],
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
  
  /**
   * Execute the task loop
   * @param {string} taskId - Task ID
   */
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
        // Check if task is paused
        if (this.pausedTasks.has(taskId)) {
          console.log(`Task ${taskId} is paused, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // 1. Capture screenshot
        console.log(`[${taskId}] Capturing screenshot for iteration ${iteration + 1}`);
        const screenshot = await this.screenshotManager.captureScreenshot(task.page);
        task.screenshots.push(screenshot);
        this.emit('screenshotCaptured', { taskId, screenshot });
        
        // Save screenshot for debugging
        await this.screenshotManager.saveScreenshot(screenshot, taskId);
        
        // 2. Send to OpenAI with current context
        console.log(`[${taskId}] Sending screenshot to OpenAI for analysis`);
        const aiResponse = await this.openaiClient.getComputerUseActions(
          task.page,
          task.description,
          { 
            extract_thinking: task.options.extract_thinking || true,
            messages: task.messages 
          }
        );
        
        // 3. If task complete, finish
        if (aiResponse.complete) {
          console.log(`[${taskId}] Task marked as complete by AI`);
          
          // Save thinking to messages for final task context
          if (aiResponse.thinking) {
            console.log(`[${taskId}] Saving final AI thinking`);
            task.messages.push({
              role: 'assistant',
              content: aiResponse.thinking,
              timestamp: Date.now()
            });
            this.emit('aiThinking', { taskId, thinking: aiResponse.thinking });
          }
          
          this.setTaskStatus(taskId, 'completed', { 
            result: aiResponse.result 
          });
          break;
        }
        
        // 4. Execute actions from AI
        if (aiResponse.actions && aiResponse.actions.length > 0) {
          console.log(`[${taskId}] Executing ${aiResponse.actions.length} actions`);
          for (const action of aiResponse.actions) {
            try {
              // Add more detailed logging for each action
              console.log(`[${taskId}] Executing action: ${action.type} ${JSON.stringify(action)}`);
              
              // For click actions, use a longer timeout and retry mechanism
              if (action.type === 'click' && action.selector) {
                console.log(`[${taskId}] Click action with selector: ${action.selector}`);
                try {
                  // First try to ensure element is visible with longer timeout
                  await task.page.waitForSelector(action.selector, { 
                    state: 'visible',
                    timeout: 10000 // Increase timeout to 10 seconds
                  });
                  console.log(`[${taskId}] Selector ${action.selector} is now visible`);
                } catch (selectorError) {
                  console.log(`[${taskId}] Selector ${action.selector} not visible after timeout, will still try to click`);
                  // Continue trying to execute the action anyway
                }
              }
              
              const result = await this.actionExecutor.executeAction(task.page, action);
              task.actions.push(action);
              task.actionResults.push({
                success: true,
                result
              });
              this.emit('actionExecuted', { taskId, action: result });
              console.log(`[${taskId}] Action executed successfully`);
            } catch (actionError) {
              console.error(`[${taskId}] Error executing action:`, actionError);
              this.emit('actionError', { taskId, action, error: actionError });
              
              // Add error to messages for context
              task.messages.push({
                role: 'system',
                content: `Error executing action: ${actionError.message}`,
                timestamp: Date.now()
              });
              
              // Track the failed action
              task.actions.push(action);
              task.actionResults.push({
                success: false,
                error: actionError.message
              });
              
              // Don't fail the entire task on a single action failure unless it's a critical error
              // Just continue to the next iteration to get new instructions
              console.log(`[${taskId}] Will continue task despite action failure`);
              // Don't break the execution loop here
            }
          }
        } else {
          console.log(`[${taskId}] No actions received from AI`);
        }
        
        // 5. Update task messages with AI thinking
        if (aiResponse.thinking) {
          console.log(`[${taskId}] Received AI thinking: ${aiResponse.thinking.substring(0, 100)}...`);
          task.messages.push({
            role: 'assistant',
            content: aiResponse.thinking,
            timestamp: Date.now()
          });
          this.emit('aiThinking', { taskId, thinking: aiResponse.thinking });
        }
        
        // Wait briefly between iterations
        console.log(`[${taskId}] Waiting before next iteration`);
        await new Promise(resolve => setTimeout(resolve, task.options.iterationDelay || 1000));
        iteration++;
      }
      
      // If we reached max iterations but task is still running
      if (iteration >= maxIterations && task.status === 'running') {
        console.log(`[${taskId}] Reached maximum iterations (${maxIterations}), marking as timeout`);
        this.setTaskStatus(taskId, 'timeout');
      }
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      this.setTaskStatus(taskId, 'failed', { error: error.message });
    }
  }
  
  /**
   * Set task status
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @param {Object} extras - Extra properties
   * @returns {Object} - Updated task
   */
  setTaskStatus(taskId, status, extras = {}) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    const oldStatus = task.status;
    task.status = status;
    task.lastUpdated = Date.now();
    
    if (status === 'completed' || status === 'failed' || status === 'timeout') {
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
    }
    
    // Add any extra properties
    Object.assign(task, extras);
    
    console.log(`Task ${taskId} status changed: ${oldStatus} -> ${status}`);
    this.emit('taskStatusChanged', { taskId, status, task });
    return task;
  }
  
  /**
   * Pause a task
   * @param {string} taskId - Task ID
   * @returns {boolean} - Success
   */
  pauseTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    this.pausedTasks.add(taskId);
    console.log(`Task ${taskId} paused`);
    this.emit('taskPaused', { taskId });
    return true;
  }
  
  /**
   * Resume a paused task
   * @param {string} taskId - Task ID
   * @returns {boolean} - Success
   */
  resumeTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    this.pausedTasks.delete(taskId);
    console.log(`Task ${taskId} resumed`);
    this.emit('taskResumed', { taskId });
    return true;
  }
  
  /**
   * Abort a task
   * @param {string} taskId - Task ID
   * @returns {boolean} - Success
   */
  abortTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    this.setTaskStatus(taskId, 'aborted', {
      endTime: Date.now(),
      duration: Date.now() - task.startTime
    });
    
    console.log(`Task ${taskId} aborted`);
    this.emit('taskAborted', { taskId });
    return true;
  }
  
  /**
   * Get a task by ID
   * @param {string} taskId - Task ID
   * @returns {Object} - Task
   */
  getTask(taskId) {
    return this.activeTasks.get(taskId);
  }
  
  /**
   * Get all active tasks
   * @returns {Array} - Active tasks
   */
  getAllTasks() {
    return Array.from(this.activeTasks.values());
  }
  
  /**
   * Wait for a task to complete
   * @param {string} taskId - Task ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} - Task result
   */
  waitForTaskCompletion(taskId, options = {}) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    const timeout = options.timeout || 60000; // Default 60 seconds
    const pollInterval = options.pollInterval || 500; // Default 500ms
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // If already complete, resolve immediately
      if (['completed', 'failed', 'aborted', 'timeout'].includes(task.status)) {
        return resolve(task);
      }
      
      // Set up completion event listener
      const completionListener = ({ taskId: id, status }) => {
        if (id === taskId && ['completed', 'failed', 'aborted', 'timeout'].includes(status)) {
          this.removeListener('taskStatusChanged', completionListener);
          clearInterval(pollInterval);
          resolve(this.activeTasks.get(taskId));
        }
      };
      
      // Listen for status changes
      this.on('taskStatusChanged', completionListener);
      
      // Also poll for completion in case we miss the event
      const interval = setInterval(() => {
        const currentTask = this.activeTasks.get(taskId);
        if (['completed', 'failed', 'aborted', 'timeout'].includes(currentTask.status)) {
          this.removeListener('taskStatusChanged', completionListener);
          clearInterval(interval);
          resolve(currentTask);
        }
        
        // Check for timeout
        if (Date.now() - startTime > timeout) {
          this.removeListener('taskStatusChanged', completionListener);
          clearInterval(interval);
          
          // Mark as timeout if still running
          if (currentTask.status === 'running') {
            this.setTaskStatus(taskId, 'timeout');
          }
          
          resolve(this.activeTasks.get(taskId));
        }
      }, pollInterval);
    });
  }
  
  /**
   * Clean up completed tasks
   * @param {number} olderThan - Age in milliseconds
   * @returns {number} - Number of tasks cleaned up
   */
  cleanupTasks(olderThan = 3600000) { // Default: 1 hour
    let cleaned = 0;
    const now = Date.now();
    
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (['completed', 'failed', 'aborted', 'timeout'].includes(task.status)) {
        if (task.endTime && (now - task.endTime) > olderThan) {
          this.activeTasks.delete(taskId);
          cleaned++;
        }
      }
    }
    
    console.log(`Cleaned up ${cleaned} completed tasks`);
    return cleaned;
  }
}

module.exports = TaskSupervisor; 