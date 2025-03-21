/**
 * Agent Command Center
 * Unified interface for controlling the AutonoM3 agent
 */

// Initialize the agent interface
function initAgentCommandCenter() {
  // DOM elements
  const agentInput = document.getElementById('agent-input');
  const sendTaskButton = document.getElementById('send-task-button');
  const chatHistory = document.getElementById('chat-history');
  const agentThinking = document.getElementById('agent-thinking');
  const currentAction = document.getElementById('current-action');
  const actionProgress = document.getElementById('action-progress');
  const pauseButton = document.getElementById('pause-action');
  const resumeButton = document.getElementById('resume-action');
  const stopButton = document.getElementById('stop-action');
  const saveButton = document.getElementById('save-sequence');
  
  // State
  let currentSession = null;
  let currentSequence = null;
  let isExecuting = false;
  
  // Event listeners
  sendTaskButton.addEventListener('click', () => {
    const task = agentInput.value.trim();
    if (task) {
      executeTask(task);
      agentInput.value = '';
    }
  });
  
  agentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const task = agentInput.value.trim();
      if (task) {
        executeTask(task);
        agentInput.value = '';
      }
    }
  });
  
  pauseButton.addEventListener('click', pauseExecution);
  resumeButton.addEventListener('click', resumeExecution);
  stopButton.addEventListener('click', stopExecution);
  saveButton.addEventListener('click', saveCurrentSequence);
  
  // Execute a task
  async function executeTask(task) {
    if (isExecuting) {
      addMessage('Please wait for the current task to complete or stop it first.', 'system');
      return;
    }
    
    isExecuting = true;
    updateControls();
    
    // Add user message
    addMessage(task, 'user');
    
    // Show thinking indicator
    agentThinking.textContent = 'Analyzing task...';
    
    try {
      // For now, we'll use the Computer Use API endpoint
      const response = await fetch('/api/computer-use/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskDescription: task,
          sessionId: currentSession
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update session
      currentSession = result.sessionId;
      
      // Store sequence
      currentSequence = {
        description: task,
        actions: result.actions
      };
      
      // Show thinking
      if (result.thinking) {
        agentThinking.textContent = result.thinking;
      }
      
      // Show actions being executed
      if (result.actions && result.actions.length > 0) {
        updateActionDisplay(result.actions, result.results);
      }
      
      // Add result message
      const resultMessage = result.success ? 
        'Task completed successfully.' : 
        `Task execution failed: ${result.error || 'Unknown error'}`;
      
      addMessage(resultMessage, 'agent');
      
      // Update final state
      isExecuting = !result.complete;
      updateControls();
    } catch (error) {
      console.error('Error executing task:', error);
      addMessage(`Error: ${error.message}`, 'system');
      isExecuting = false;
      updateControls();
    }
  }
  
  // Add a message to the chat history
  function addMessage(content, sender) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}`;
    messageEl.innerHTML = `<div class="message-content">${content}</div>`;
    chatHistory.appendChild(messageEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
  
  // Update the action display
  function updateActionDisplay(actions, results) {
    actionProgress.innerHTML = '';
    
    actions.forEach((action, index) => {
      const result = results ? results[index] : null;
      const actionEl = document.createElement('div');
      actionEl.className = `action-item ${result?.success ? 'success' : result?.error ? 'error' : 'pending'}`;
      
      let actionText = getActionDescription(action);
      actionEl.textContent = actionText;
      
      if (result?.error) {
        const errorEl = document.createElement('div');
        errorEl.className = 'action-error';
        errorEl.textContent = result.error;
        actionEl.appendChild(errorEl);
      }
      
      actionProgress.appendChild(actionEl);
    });
  }
  
  // Get a human-readable description of an action
  function getActionDescription(action) {
    switch (action.type) {
      case 'click':
        return action.selector ? 
          `Click on "${action.selector}"` : 
          `Click at position (${action.position?.x}, ${action.position?.y})`;
      case 'type':
        return `Type "${action.text.substring(0, 20)}${action.text.length > 20 ? '...' : ''}" into "${action.selector}"`;
      case 'navigate':
        return `Navigate to "${action.url}"`;
      case 'scroll':
        if (action.selector) {
          return `Scroll element "${action.selector}" into view`;
        } else {
          return `Scroll ${action.direction} by ${action.amount || 'default'} pixels`;
        }
      case 'wait':
        if (action.selector) {
          return `Wait for "${action.selector}"`;
        } else {
          return `Wait for ${action.timeout || 1000}ms`;
        }
      default:
        return `${action.type} action`;
    }
  }
  
  // Update the control buttons based on state
  function updateControls() {
    pauseButton.disabled = !isExecuting;
    resumeButton.disabled = !isExecuting;
    stopButton.disabled = !isExecuting;
    saveButton.disabled = !currentSequence;
    
    sendTaskButton.disabled = isExecuting;
    agentInput.disabled = isExecuting;
  }
  
  // Pause execution
  function pauseExecution() {
    if (currentSession) {
      fetch(`/api/computer-use/pause/${currentSession}`, { method: 'POST' })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            addMessage('Task execution paused.', 'system');
          }
        })
        .catch(error => {
          console.error('Error pausing execution:', error);
        });
    }
  }
  
  // Resume execution
  function resumeExecution() {
    if (currentSession) {
      fetch(`/api/computer-use/resume/${currentSession}`, { method: 'POST' })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            addMessage('Task execution resumed.', 'system');
          }
        })
        .catch(error => {
          console.error('Error resuming execution:', error);
        });
    }
  }
  
  // Stop execution
  function stopExecution() {
    if (currentSession) {
      fetch(`/api/computer-use/abort/${currentSession}`, { method: 'POST' })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            addMessage('Task execution stopped.', 'system');
            isExecuting = false;
            updateControls();
          }
        })
        .catch(error => {
          console.error('Error stopping execution:', error);
        });
    }
  }
  
  // Save the current action sequence
  function saveCurrentSequence() {
    if (!currentSequence) return;
    
    const sequenceName = prompt('Enter a name for this action sequence:', currentSequence.description);
    if (!sequenceName) return;
    
    currentSequence.description = sequenceName;
    
    fetch('/api/sequences/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(currentSequence)
    })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          addMessage(`Action sequence saved as "${sequenceName}".`, 'system');
        }
      })
      .catch(error => {
        console.error('Error saving sequence:', error);
        addMessage(`Error saving sequence: ${error.message}`, 'system');
      });
  }
  
  // Initialize
  updateControls();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAgentCommandCenter); 