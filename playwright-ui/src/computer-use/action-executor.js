/**
 * Action executor for OpenAI Computer Use integration
 * Translates OpenAI's action instructions into Playwright commands
 */

class ActionExecutor {
  /**
   * Create a new action executor
   * @param {Object} config - Configuration options
   */
  constructor(config) {
    this.config = config;
    this.actionHistory = [];
    console.log('Action executor initialized');
  }
  
  /**
   * Execute an action on the page
   * @param {Object} page - Playwright page object
   * @param {Object} action - Action to execute
   * @returns {Object} - Result of the action
   */
  async executeAction(page, action) {
    if (!page) throw new Error('No active page for action execution');
    
    console.log(`Executing action: ${action.type}`);
    
    try {
      // Validate action for safety
      this.validateAction(page, action);
      
      // Execute the appropriate action based on type
      let result;
      switch (action.type) {
        case 'click':
          result = await this.executeClick(page, action);
          break;
        case 'type':
          result = await this.executeType(page, action);
          break;
        case 'navigate':
          result = await this.executeNavigate(page, action);
          break;
        case 'scroll':
          result = await this.executeScroll(page, action);
          break;
        case 'wait':
          result = await this.executeWait(page, action);
          break;
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
      
      // Record action in history
      const actionRecord = {
        ...action,
        timestamp: Date.now(),
        success: true,
        result
      };
      
      this.actionHistory.push(actionRecord);
      
      return actionRecord;
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
      
      // Record failed action
      const failedAction = {
        ...action,
        timestamp: Date.now(),
        success: false,
        error: error.message
      };
      
      this.actionHistory.push(failedAction);
      throw error;
    }
  }
  
  /**
   * Validate action for safety
   * @param {Object} page - Playwright page object
   * @param {Object} action - Action to validate
   */
  validateAction(page, action) {
    // Ensure config and actionRestrictions exist
    if (!this.config) {
      console.warn('No configuration provided to ActionExecutor. Using default safety settings.');
      this.config = {
        actionRestrictions: {
          allowedDomains: [],
          forbiddenSelectors: ['input[type="password"]', '.private-info'],
          maxTypingLength: 1000
        }
      };
    } else if (!this.config.actionRestrictions) {
      console.warn('No actionRestrictions in config. Using default safety settings.');
      this.config.actionRestrictions = {
        allowedDomains: [],
        forbiddenSelectors: ['input[type="password"]', '.private-info'],
        maxTypingLength: 1000
      };
    }
    
    const { actionRestrictions } = this.config;
    
    // Check domain restrictions
    if (actionRestrictions.allowedDomains && actionRestrictions.allowedDomains.length > 0) {
      // Only check domain on navigation actions or if we have a page
      if (action.type === 'navigate' && action.url) {
        const isAllowed = this.isUrlAllowed(action.url, actionRestrictions.allowedDomains);
        if (!isAllowed) {
          throw new Error(`Navigation to ${action.url} is not allowed. Allowed domains: ${actionRestrictions.allowedDomains.join(', ')}`);
        }
      } else if (page) {
        // For other actions, check the current page URL
        const currentUrl = page.url();
        if (currentUrl && currentUrl !== 'about:blank') {
          const isAllowed = this.isUrlAllowed(currentUrl, actionRestrictions.allowedDomains);
          if (!isAllowed) {
            throw new Error(`Actions on ${currentUrl} are not allowed. Allowed domains: ${actionRestrictions.allowedDomains.join(', ')}`);
          }
        }
      }
    }
    
    // Check selector restrictions
    if (action.selector) {
      for (const forbidden of actionRestrictions.forbiddenSelectors) {
        if (action.selector.includes(forbidden)) {
          throw new Error(`Action uses forbidden selector: ${forbidden}`);
        }
      }
    }
    
    // Check typing length restrictions
    if (action.type === 'type' && action.text) {
      if (action.text.length > actionRestrictions.maxTypingLength) {
        throw new Error(`Text length exceeds maximum allowed (${actionRestrictions.maxTypingLength})`);
      }
    }
  }
  
  /**
   * Check if a URL is allowed based on allowed domain list
   * @param {string} url - URL to check
   * @param {Array<string>} allowedDomains - List of allowed domains
   * @returns {boolean} - Whether URL is allowed
   */
  isUrlAllowed(url, allowedDomains) {
    if (!url || !allowedDomains || allowedDomains.length === 0) return true;
    
    try {
      // Parse the URL to get the domain
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Check if hostname matches or is a subdomain of any allowed domain
      return allowedDomains.some(domain => {
        // Test exact match
        if (hostname === domain) return true;
        
        // Test if it's a subdomain (e.g. sub.domain.com matches domain.com)
        if (hostname.endsWith(`.${domain}`)) return true;
        
        return false;
      });
    } catch (error) {
      console.error(`Error parsing URL: ${url}`, error);
      return false;
    }
  }
  
  /**
   * Execute a click action
   * @param {Object} page - Playwright page
   * @param {Object} action - Click action details
   * @returns {Object} - Result details
   */
  async executeClick(page, action) {
    const { selector, position, options = {} } = action;
    
    if (selector) {
      // Wait for the selector to be available
      await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
      
      // Click the element
      await page.click(selector, options);
      console.log(`Clicked element with selector: ${selector}`);
      
      return { method: 'selector', target: selector };
    } else if (position) {
      // Click at specific coordinates
      await page.mouse.click(position.x, position.y);
      console.log(`Clicked at position: (${position.x}, ${position.y})`);
      
      return { method: 'position', target: position };
    } else {
      throw new Error('Click action requires either selector or position');
    }
  }
  
  /**
   * Execute a type action
   * @param {Object} page - Playwright page
   * @param {Object} action - Type action details
   * @returns {Object} - Result details
   */
  async executeType(page, action) {
    const { selector, text, options = {} } = action;
    
    if (!selector) throw new Error('Type action requires a selector');
    if (!text) throw new Error('Type action requires text to type');
    
    // Wait for the selector to be available
    await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
    
    // Clear the input if specified
    if (options.clear) {
      await page.fill(selector, '');
    }
    
    // Type the text
    await page.type(selector, text, options);
    console.log(`Typed "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}" into selector: ${selector}`);
    
    return { 
      target: selector,
      textLength: text.length,
      preview: text.length > 20 ? `${text.substring(0, 20)}...` : text
    };
  }
  
  /**
   * Execute a navigate action
   * @param {Object} page - Playwright page
   * @param {Object} action - Navigate action details
   * @returns {Object} - Result details
   */
  async executeNavigate(page, action) {
    const { url, options = {} } = action;
    
    if (!url) throw new Error('Navigate action requires a URL');
    
    // Navigate to the URL
    const response = await page.goto(url, options);
    console.log(`Navigated to: ${url}`);
    
    return { 
      url,
      status: response ? response.status() : null,
      success: response ? response.ok() : false
    };
  }
  
  /**
   * Execute a scroll action
   * @param {Object} page - Playwright page
   * @param {Object} action - Scroll action details
   * @returns {Object} - Result details
   */
  async executeScroll(page, action) {
    const { direction, amount, selector, options = {} } = action;
    
    if (selector) {
      // Scroll a specific element into view
      await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
      await page.evaluate(sel => {
        document.querySelector(sel).scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, selector);
      
      console.log(`Scrolled element into view: ${selector}`);
      return { method: 'element', target: selector };
    } else {
      // Scroll the page
      let x = 0;
      let y = 0;
      
      if (direction === 'down') y = amount || 300;
      else if (direction === 'up') y = -1 * (amount || 300);
      else if (direction === 'right') x = amount || 300;
      else if (direction === 'left') x = -1 * (amount || 300);
      
      await page.evaluate(({ x, y }) => {
        window.scrollBy(x, y);
      }, { x, y });
      
      console.log(`Scrolled page ${direction} by ${Math.abs(x || y)} pixels`);
      return { method: 'page', direction, amount: Math.abs(x || y) };
    }
  }
  
  /**
   * Execute a wait action
   * @param {Object} page - Playwright page
   * @param {Object} action - Wait action details
   * @returns {Object} - Result details
   */
  async executeWait(page, action) {
    const { timeout, selector, options = {} } = action;
    
    if (selector) {
      // Wait for selector
      await page.waitForSelector(selector, { 
        timeout: timeout || 5000,
        ...options 
      });
      console.log(`Waited for selector: ${selector}`);
      return { method: 'selector', target: selector };
    } else {
      // Wait for timeout
      const waitTime = timeout || 1000;
      await page.waitForTimeout(waitTime);
      console.log(`Waited for ${waitTime}ms`);
      return { method: 'timeout', duration: waitTime };
    }
  }
  
  /**
   * Get the action history
   * @returns {Array} - Action history
   */
  getActionHistory() {
    return this.actionHistory;
  }
}

module.exports = ActionExecutor; 