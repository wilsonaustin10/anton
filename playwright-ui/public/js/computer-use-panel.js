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
      executeComputerUseTask(taskDescription);
    } else {
      updateStatus('Please enter a task description', 'error');
    }
  });
  
  // Also trigger on Enter key
  document.getElementById('computer-use-task').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const taskDescription = e.target.value.trim();
      if (taskDescription) {
        executeComputerUseTask(taskDescription);
      } else {
        updateStatus('Please enter a task description', 'error');
      }
    }
  });
}

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

// Execute a Computer Use task
async function executeComputerUseTask(taskDescription) {
  updateStatus('Executing Computer Use task...', 'info');
  updateThinking('');
  clearActions();
  
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
    
    if (result.success) {
      updateStatus('Task executed successfully', 'success');
    } else {
      updateStatus(result.error || 'Failed to execute task', 'error');
    }
    
    // Display thinking
    if (result.thinking) {
      updateThinking(result.thinking);
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
    
    // Task completion
    if (result.complete) {
      updateStatus('Task complete!', 'success');
    }
    
  } catch (error) {
    console.error('Error executing Computer Use task:', error);
    updateStatus(`Error: ${error.message}`, 'error');
  }
}

// Add Computer Use panel to browser.html
document.addEventListener('DOMContentLoaded', initComputerUsePanel);

// Export for external use
window.ComputerUsePanel = {
  init: initComputerUsePanel,
  execute: executeComputerUseTask
}; 