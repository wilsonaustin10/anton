const EventEmitter = require('events');

class TaskSupervisor extends EventEmitter {
  constructor(openaiClient, screenshotManager, actionExecutor) {
    super();
    this.openaiClient = openaiClient;
    this.screenshotManager = screenshotManager;
    this.actionExecutor = actionExecutor;
    this.activeTasks = new Map();
    this.pausedTasks = new Set();
    this.browserPage = null;
  }

  setBrowserPage(page) {
    this.browserPage = page;
  }

  async syncBrowserState(targetPage) {
    if (!this.browserPage || !targetPage) return;
    
    try {
      // Get current URL and viewport
      const targetUrl = await targetPage.url();
      const viewport = await targetPage.viewportSize();
      
      // Sync URL if different
      const currentUrl = await this.browserPage.url();
      if (currentUrl !== targetUrl) {
        await this.browserPage.goto(targetUrl, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        }).catch(error => {
          console.warn('URL sync warning:', error.message);
        });
      }
      
      // Sync viewport if different
      if (viewport) {
        const currentViewport = await this.browserPage.viewportSize();
        if (JSON.stringify(currentViewport) !== JSON.stringify(viewport)) {
          await this.browserPage.setViewportSize(viewport);
        }
      }
      
      // Wait for page to stabilize
      await this.browserPage.waitForLoadState('networkidle', {
        timeout: 5000
      }).catch(() => {}); // Ignore timeout
      
      console.log('Browser state synced:', {
        url: targetUrl,
        viewport: viewport
      });
    } catch (error) {
      console.error('Error syncing browser state:', error);
      // Don't throw - we want to continue even if sync fails
    }
  }

  validateTaskCompletion(task, aiResponse, actionResults) {
    // Check if any actions were actually executed
    if (actionResults.length === 0) {
      console.log('No actions were executed, task cannot be complete');
      return false;
    }

    // Check if all actions had real effects
    const allActionsHadEffect = actionResults.every(result => 
      result.success && (result.hadEffect || result.type === 'navigate')
    );
    
    if (!allActionsHadEffect) {
      console.log('Some actions had no visible effect, task may not be complete');
      return false;
    }

    // Check OpenAI's completion signals
    const aiSignalsComplete = 
      aiResponse.complete === true || 
      aiResponse.status === 'completed' ||
      (aiResponse.thinking && 
       aiResponse.thinking.toLowerCase().includes('task complete'));

    if (!aiSignalsComplete) {
      console.log('AI does not indicate task completion');
      return false;
    }

    return true;
  }

  async executeTaskLoop(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    
    this.setTaskStatus(taskId, 'running');
    
    try {
      let iteration = 0;
      const maxIterations = task.options.maxIterations || 50;
      
      // Initial sync
      await this.syncBrowserState(task.page);
      
      while (iteration < maxIterations && task.status === 'running') {
        if (this.pausedTasks.has(taskId)) {
          console.log(`Task ${taskId} is paused, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Get screenshot
        console.log(`[${taskId}] Getting screenshot for iteration ${iteration + 1}`);
        const screenshot = await this.screenshotManager.captureScreenshot(task.page);
        task.screenshots.push(screenshot);
        this.emit('screenshotCaptured', { taskId, screenshot });
        
        // Send to OpenAI
        console.log(`[${taskId}] Sending screenshot to OpenAI for analysis`);
        const aiResponse = await this.openaiClient.getComputerUseActions(
          task.page,
          task.description,
          { 
            extract_thinking: task.options.extract_thinking || true,
            messages: task.messages 
          }
        );

        console.log('OpenAI Response:', {
          complete: aiResponse.complete,
          status: aiResponse.status,
          actionCount: aiResponse.actions?.length || 0,
          thinking: aiResponse.thinking?.substring(0, 100) + '...'
        });
        
        const actionResults = [];
        
        // Execute actions
        if (aiResponse.actions && aiResponse.actions.length > 0) {
          console.log(`[${taskId}] Executing ${aiResponse.actions.length} actions`);
          for (const action of aiResponse.actions) {
            try {
              console.log('Executing action:', {
                type: action.type,
                selector: action.selector,
                position: action.position
              });

              // Clear screenshot cache before action
              this.screenshotManager.clearCache();
              
              // Execute action
              const result = await this.actionExecutor.executeAction(task.page, action);
              
              // Sync immediately after action
              await this.syncBrowserState(task.page);
              
              // Small delay to allow UI to update
              await new Promise(resolve => setTimeout(resolve, 100));
              
              actionResults.push(result);
              task.actions.push(result);
              this.emit('actionExecuted', { taskId, action: result });
              
              console.log(`[${taskId}] Action executed successfully:`, result);
            } catch (actionError) {
              console.error(`[${taskId}] Action execution failed:`, actionError);
              this.emit('actionError', { taskId, action, error: actionError });
              throw actionError;
            }
          }
        }
        
        // Update messages
        if (aiResponse.thinking) {
          task.messages.push({
            role: 'assistant',
            content: aiResponse.thinking,
            timestamp: Date.now()
          });
          this.emit('aiThinking', { taskId, thinking: aiResponse.thinking });
        }
        
        // Check completion
        const isComplete = this.validateTaskCompletion(task, aiResponse, actionResults);
        if (isComplete) {
          // Final sync before completing
          await this.syncBrowserState(task.page);
          
          this.setTaskStatus(taskId, 'completed', { 
            result: aiResponse.result || aiResponse.thinking
          });
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        iteration++;
      }
      
      if (iteration >= maxIterations && task.status === 'running') {
        this.setTaskStatus(taskId, 'timeout');
      }
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      this.setTaskStatus(taskId, 'failed', { error: error.message });
    }
  }
}

module.exports = TaskSupervisor; 