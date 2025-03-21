/**
 * Computer Use Panel for AutonoM3
 * Manages Computer Use interaction with the embedded browser
 */

// Initialize the Computer Use panel
function initComputerUsePanel() {
  console.log('Initializing Computer Use panel...');
  
  // Create the panel container if it doesn't exist
  if (!document.getElementById('computer-use-panel')) {
    createComputerUsePanel();
  }
  
  // Add event listeners
  setupEventListeners();
}

// Create the Computer Use panel DOM structure
function createComputerUsePanel() {
  const panel = document.createElement('div');
  panel.id = 'computer-use-panel';
  panel.className = 'computer-use-panel';
  
  panel.innerHTML = `
    <div class="panel-header">
      <h3>Computer Use</h3>
      <button id="toggle-computer-use-panel" class="toggle-button">Minimize</button>
    </div>
    <div class="panel-content">
      <div class="task-input-container">
        <input type="text" id="computer-use-task" placeholder="Describe what you want the AI to do..." />
        <button id="execute-computer-use" class="primary-button">Execute</button>
      </div>
      <div class="status-container">
        <div id="computer-use-status" class="status-message">Ready</div>
        <div id="computer-use-thinking" class="thinking-output"></div>
      </div>
      <div class="actions-container">
        <h4>Actions</h4>
        <div id="computer-use-actions" class="actions-list"></div>
      </div>
      <div id="validation-container" class="validation-container" style="display: none;">
        <h4>Task Validation</h4>
        <div class="validation-question">Did the agent successfully complete the task?</div>
        <div class="validation-buttons">
          <button id="validate-success" class="validation-button success">Yes, Save This Sequence</button>
          <button id="validate-failure" class="validation-button failure">No, Task Failed</button>
        </div>
      </div>
      <div id="similar-tasks-container" class="similar-tasks-container" style="display: none;">
        <h4>Similar Tasks</h4>
        <div id="similar-tasks-list" class="similar-tasks-list"></div>
      </div>
    </div>
  `;
  
  // Style the panel
  const style = document.createElement('style');
  style.textContent = `
    .computer-use-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      overflow: hidden;
      font-family: Arial, sans-serif;
      transition: height 0.3s ease;
    }
    
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #4a69bd;
      color: white;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: bold;
    }
    
    .toggle-button {
      background: transparent;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 12px;
    }
    
    .panel-content {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .task-input-container {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    #computer-use-task {
      flex-grow: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .primary-button {
      background: #4a69bd;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .primary-button:hover {
      background: #3c5aa3;
    }
    
    .status-container {
      margin-bottom: 16px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    
    .status-message {
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .thinking-output {
      font-size: 12px;
      color: #666;
      white-space: pre-wrap;
      max-height: 100px;
      overflow-y: auto;
    }
    
    .actions-container {
      border-top: 1px solid #eee;
      padding-top: 12px;
    }
    
    .actions-container h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
    }
    
    .actions-list {
      font-size: 13px;
    }
    
    .action-item {
      margin-bottom: 8px;
      padding: 8px;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 3px solid #4a69bd;
    }
    
    .action-item.success {
      border-left-color: #2ecc71;
    }
    
    .action-item.error {
      border-left-color: #e74c3c;
    }
    
    .minimized .panel-content {
      display: none;
    }
    
    /* Validation styles */
    .validation-container {
      margin-top: 16px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px solid #eee;
    }
    
    .validation-question {
      font-size: 14px;
      margin-bottom: 12px;
      font-weight: bold;
    }
    
    .validation-buttons {
      display: flex;
      gap: 8px;
    }
    
    .validation-button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      flex: 1;
    }
    
    .validation-button.success {
      background: #2ecc71;
      color: white;
    }
    
    .validation-button.failure {
      background: #e74c3c;
      color: white;
    }
    
    /* Similar tasks styles */
    .similar-tasks-container {
      margin-top: 16px;
      padding: 12px;
      background: #f0f8ff;
      border-radius: 8px;
      border: 1px solid #d0e8ff;
    }
    
    .similar-task-item {
      padding: 8px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border-left: 3px solid #4a69bd;
      cursor: pointer;
    }
    
    .similar-task-item:hover {
      background: #f5f9ff;
    }
    
    .similar-task-description {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .similar-task-actions {
      font-size: 11px;
      color: #666;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(panel);
}

// Set up event listeners for the panel
function setupEventListeners() {
  // Toggle panel visibility
  document.getElementById('toggle-computer-use-panel').addEventListener('click', (e) => {
    const panel = document.getElementById('computer-use-panel');
    const button = e.target;
    
    if (panel.classList.contains('minimized')) {
      panel.classList.remove('minimized');
      button.textContent = 'Minimize';
    } else {
      panel.classList.add('minimized');
      button.textContent = 'Expand';
    }
  });
  
  // Execute Computer Use task
  document.getElementById('execute-computer-use').addEventListener('click', () => {
    const taskInput = document.getElementById('computer-use-task');
    const taskDescription = taskInput.value.trim();
    
    if (taskDescription) {
      // Check for similar tasks first
      checkForSimilarTasks(taskDescription);
    } else {
      updateStatus('Please enter a task description', 'error');
    }
  });
  
  // Also trigger on Enter key
  document.getElementById('computer-use-task').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const taskDescription = e.target.value.trim();
      if (taskDescription) {
        // Check for similar tasks first
        checkForSimilarTasks(taskDescription);
      } else {
        updateStatus('Please enter a task description', 'error');
      }
    }
  });
  
  // Task validation buttons
  document.getElementById('validate-success').addEventListener('click', () => {
    validateTask(true);
  });
  
  document.getElementById('validate-failure').addEventListener('click', () => {
    validateTask(false);
  });
}

// Current task state
let currentTask = {
  description: '',
  actions: [],
  results: [],
  status: 'idle',
  sessionId: null,
  taskId: null
};

// Update status display
function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('computer-use-status');
  statusEl.textContent = message;
  statusEl.className = 'status-message';
  statusEl.classList.add(type);
}

// Update thinking display
function updateThinking(thinking) {
  const thinkingEl = document.getElementById('computer-use-thinking');
  thinkingEl.textContent = thinking || '';
}

// Clear actions list
function clearActions() {
  const actionsEl = document.getElementById('computer-use-actions');
  actionsEl.innerHTML = '';
}

// Add action to the display
function addAction(action, success, result) {
  const actionsEl = document.getElementById('computer-use-actions');
  const actionEl = document.createElement('div');
  actionEl.className = `action-item ${success ? 'success' : 'error'}`;
  
  let actionText = '';
  
  if (action.type === 'click') {
    if (action.selector) {
      actionText = `Click on "${action.selector}"`;
    } else if (action.position) {
      actionText = `Click at position (${action.position.x}, ${action.position.y})`;
    }
  } else if (action.type === 'type') {
    const displayText = action.text.length > 20 ? 
      `${action.text.substring(0, 20)}...` : action.text;
    actionText = `Type "${displayText}" into "${action.selector}"`;
  } else if (action.type === 'navigate') {
    actionText = `Navigate to "${action.url}"`;
  } else if (action.type === 'scroll') {
    if (action.selector) {
      actionText = `Scroll element "${action.selector}" into view`;
    } else {
      actionText = `Scroll ${action.direction} by ${action.amount || 'default'} pixels`;
    }
  } else if (action.type === 'wait') {
    if (action.selector) {
      actionText = `Wait for "${action.selector}"`;
    } else {
      actionText = `Wait for ${action.timeout || 1000}ms`;
    }
  } else {
    actionText = `${action.type} action`;
  }
  
  actionEl.textContent = actionText;
  
  if (!success && result?.error) {
    const errorEl = document.createElement('div');
    errorEl.className = 'action-error';
    errorEl.textContent = result.error;
    actionEl.appendChild(errorEl);
  }
  
  actionsEl.appendChild(actionEl);
}

// Show validation UI
function showValidationUI() {
  const validationContainer = document.getElementById('validation-container');
  validationContainer.style.display = 'block';
}

// Hide validation UI
function hideValidationUI() {
  const validationContainer = document.getElementById('validation-container');
  validationContainer.style.display = 'none';
}

// Check for similar tasks before executing
async function checkForSimilarTasks(taskDescription) {
  try {
    console.debug('Checking for similar tasks...');
    const response = await fetch('/api/computer-use/similar-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ taskDescription })
    });
    
    
    const result = await response.json();
    
    if (response.ok && result.tasks && result.tasks.length > 0) {
      // Show similar tasks
      console.debug("Similar tasks found, displaying...");
      displaySimilarTasks(result.tasks, taskDescription);
    } else {
      // No similar tasks, proceed with execution
      console.debug("No similar tasks found, proceeding with execution...");
      executeComputerUseTask(taskDescription);
    }
  } catch (error) {
    console.error('Error checking for similar tasks:', error);
    // Proceed with execution if API fails
    executeComputerUseTask(taskDescription);
  }
}

// Display similar tasks
function displaySimilarTasks(tasks, originalDescription) {
  const container = document.getElementById('similar-tasks-container');
  const listEl = document.getElementById('similar-tasks-list');
  
  // Clear previous tasks
  listEl.innerHTML = '';
  
  // Add tasks
  tasks.forEach(task => {
    const taskItem = document.createElement('div');
    taskItem.className = 'similar-task-item';
    taskItem.innerHTML = `
      <div class="similar-task-description">${task.description}</div>
      <div class="similar-task-actions">
        ${task.actions.length} action${task.actions.length !== 1 ? 's' : ''}
        • Used ${task.taskFrequency} time${task.taskFrequency !== 1 ? 's' : ''}
      </div>
    `;
    
    // Add click event to use this task
    taskItem.addEventListener('click', () => {
      container.style.display = 'none';
      executeValidatedTask(task.id);
    });
    
    listEl.appendChild(taskItem);
  });
  
  // Add option to proceed with original task
  const createNewItem = document.createElement('div');
  createNewItem.className = 'similar-task-item';
  createNewItem.style.borderLeftColor = '#e67e22';
  createNewItem.innerHTML = `
    <div class="similar-task-description">Create new task</div>
    <div class="similar-task-actions">Proceed with original description</div>
  `;
  
  createNewItem.addEventListener('click', () => {
    container.style.display = 'none';
    executeComputerUseTask(originalDescription);
  });
  
  listEl.appendChild(createNewItem);
  
  // Show the container
  container.style.display = 'block';
}

// Execute a validated task by ID
async function executeValidatedTask(taskId) {
  updateStatus('Executing validated task...', 'info');
  updateThinking('');
  clearActions();
  
  try {
    const response = await fetch('/api/computer-use/execute-validated', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ taskId })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      updateStatus('Validated task executed successfully', 'success');
    } else {
      updateStatus(result.error || 'Failed to execute validated task', 'error');
    }
    
    // Display actions
    if (result.actions && result.actions.length > 0) {
      for (let i = 0; i < result.actions.length; i++) {
        const action = result.actions[i];
        const actionResult = result.results && result.results[i];
        const success = actionResult ? actionResult.success : false;
        
        addAction(action, success, actionResult);
      }
    }
    
  } catch (error) {
    console.error('Error executing validated task:', error);
    updateStatus(`Error: ${error.message}`, 'error');
  }
}

// Validate a task
async function validateTask(isSuccess) {
  if (!currentTask.taskId) {
    updateStatus('No task to validate', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/computer-use/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskId: currentTask.taskId,
        success: isSuccess,
        description: currentTask.description,
        actions: currentTask.actions,
        sessionId: currentTask.sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      updateStatus(isSuccess ? 'Task validated and saved!' : 'Task marked as failed', isSuccess ? 'success' : 'error');
    } else {
      updateStatus(result.error || 'Failed to validate task', 'error');
    }
    
    // Hide validation UI
    hideValidationUI();
    
  } catch (error) {
    console.error('Error validating task:', error);
    updateStatus(`Validation error: ${error.message}`, 'error');
  }
}

// Execute a Computer Use task
async function executeComputerUseTask(taskDescription) {
  // Clear previous task state
  clearActions();
  clearThinking();
  updateStatus('Executing task...', 'info');
  
  // Reset current task
  currentTask = {
    description: taskDescription,
    actions: [],
    results: [],
    status: 'in_progress',
    sessionId: null,
    taskId: null
  };
  
  try {
    const response = await fetch('/api/computer-use/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskDescription,
        messages: [] // Could add conversation history here
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Task execution result:", result);
    
    // Update current task
    currentTask.sessionId = result.sessionId;
    currentTask.taskId = result.taskId;
    currentTask.actions = result.actions || [];
    currentTask.results = result.actionResults || result.results || [];
    
    // CRITICAL CHANGE: Always display thinking FIRST before any success/failure messages
    if (result.thinking) {
      console.log("Displaying AI thinking:", result.thinking.substring(0, 100) + "...");
      currentTask.thinking = result.thinking;
      displayThinking(result.thinking);
    }
    
    // Then display actions AFTER thinking
    let allActionsSuccessful = true;
    if (result.actions && result.actions.length > 0) {
      console.log(`Displaying ${result.actions.length} actions`);
      for (let i = 0; i < result.actions.length; i++) {
        const action = result.actions[i];
        // Get result from either actionResults (new format) or results (old format)
        const actionResult = (result.actionResults && result.actionResults[i]) || 
                             (result.results && result.results[i]);
        const success = actionResult ? actionResult.success : false;
        
        if (!success) {
          allActionsSuccessful = false;
        }
        
        addAction(action, success, actionResult);
      }
    }
    
    // Store important metadata for validation
    if (result.url) currentTask.url = result.url;
    if (result.title) currentTask.title = result.title;
    
    // ONLY AFTER displaying thinking and actions, determine task success
    // 1. Was the OpenAI response marked as complete?
    // 2. Did all actions execute successfully?
    // 3. Did we successfully navigate to a URL that matches the task?
    const taskSuccess = result.success || 
                       (allActionsSuccessful && result.complete) || 
                       (result.thinking && result.thinking.toLowerCase().includes('task complete'));
    
    currentTask.status = taskSuccess ? 'completed' : 'failed';
    
    // Update the UI status message AFTER showing thinking and actions
    if (taskSuccess) {
      updateStatus('Task executed successfully', 'success');
    } else {
      // Show a more helpful message if we executed actions but didn't get a success signal
      if (result.actions && result.actions.length > 0 && allActionsSuccessful) {
        updateStatus('Task likely successful, but needs validation', 'warning');
      } else {
        // Only show error AFTER showing thinking and actions
        updateStatus(result.error || 'Task may not be complete. Please verify and provide feedback.', 'warning');
      }
    }
    
    // Always show validation UI regardless of reported success
    // Let the user determine if the task was actually successful
    showValidationUI();
    
  } catch (error) {
    console.error('Error executing Computer Use task:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    currentTask.status = 'error';
  }
}

// Add Computer Use panel to browser.html
document.addEventListener('DOMContentLoaded', initComputerUsePanel);

// Export for external use
window.ComputerUsePanel = {
  init: initComputerUsePanel,
  execute: executeComputerUseTask
}; 