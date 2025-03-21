const { pauseScreenshots, resumeScreenshots } = require('../../server');

class ActionExecutor {
  constructor(config = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 500,
      scrollIntoViewTimeout: 2000,
      clickTimeout: 5000,
      ...config
    };
    this.actionHistory = [];
  }

  async executeAction(page, action) {
    if (!page || !page.isConnected()) {
      throw new Error('Invalid or disconnected page');
    }

    console.log('Executing action:', action);

    // Pause screenshots before action
    await pauseScreenshots();

    try {
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
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Wait for any animations or transitions to complete
      await page.waitForTimeout(500);
      
      // Resume screenshots after action
      await resumeScreenshots();
      
      return result;
    } catch (error) {
      // Resume screenshots even if action fails
      await resumeScreenshots();
      throw error;
    }
  }

  async executeClick(page, action) {
    const { selector, position } = action;
    
    try {
      let element;
      let targetX;
      let targetY;
      
      if (selector) {
        // Find the element with increased timeout
        element = await page.waitForSelector(selector, { 
          timeout: 10000,
          state: 'visible'
        });
        
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        
        // Get element position
        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Could not get element position: ${selector}`);
        }
        
        // Ensure element is in view
        await element.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500); // Wait for scroll to complete
        
        targetX = box.x + box.width / 2;
        targetY = box.y + box.height / 2;
        
      } else if (position) {
        targetX = position.x;
        targetY = position.y;
      }
      
      // Move mouse smoothly to target
      const currentPosition = await page.mouse.position();
      const steps = 10;
      const stepDelay = 50; // Increased for visibility
      
      // Calculate intermediate points
      for (let i = 1; i <= steps; i++) {
        const x = currentPosition.x + ((targetX - currentPosition.x) * (i / steps));
        const y = currentPosition.y + ((targetY - currentPosition.y) * (i / steps));
        
        // Update cursor position
        await page.evaluate(({ x, y }) => {
          window.__playwrightMouseX = x;
          window.__playwrightMouseY = y;
        }, { x, y });
        
        await page.mouse.move(x, y);
        await page.waitForTimeout(stepDelay);
      }
      
      // Show hover effect
      if (element) {
        await element.hover();
        await page.waitForTimeout(200);
        
        // Add clicking animation
        await page.evaluate(() => {
          const cursor = document.querySelector('.pw-cursor');
          if (cursor) cursor.classList.add('clicking');
        });
      }
      
      // Perform click
      if (element) {
        await element.click({ delay: 100 });
      } else {
        await page.mouse.click(targetX, targetY, { delay: 100 });
      }
      
      // Remove clicking animation
      await page.evaluate(() => {
        const cursor = document.querySelector('.pw-cursor');
        if (cursor) cursor.classList.remove('clicking');
      });
      
      // Wait for any navigation or dynamic content changes
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {}),
        page.waitForTimeout(1000)
      ]);
      
      return { success: true, action };
      
    } catch (error) {
      console.error('Click action failed:', error);
      throw error;
    }
  }

  generateSelectorStrategies(action) {
    const strategies = [];
    
    if (action.selector) {
      // Original selector
      strategies.push(action.selector);

      // Text-based selectors
      if (action.text) {
        strategies.push(
          `text="${action.text}"`,
          `text=${action.text}`,
          `:text("${action.text}")`,
          `[text="${action.text}"]`
        );
      }

      // Role-based selectors
      if (action.role) {
        strategies.push(
          `role=${action.role}`,
          `[role="${action.role}"]`
        );
      }

      // Link-based selectors
      if (action.text) {
        strategies.push(
          `a:has-text("${action.text}")`,
          `a:text-is("${action.text}")`,
          `a:text("${action.text}")`
        );
      }
    }

    // Position-based selector as last resort
    if (action.position) {
      strategies.push(`[style*="position: absolute"][style*="left: ${action.position.x}px"][style*="top: ${action.position.y}px"]`);
    }

    return [...new Set(strategies)].filter(Boolean);
  }

  async captureElementState(page, element) {
    try {
      const box = await element.boundingBox();
      const isVisible = await element.isVisible();
      const innerHTML = await element.innerHTML();
      const url = page.url();

      return { box, isVisible, innerHTML, url };
    } catch (error) {
      console.log('Failed to capture element state:', error);
      return null;
    }
  }

  async verifyClickEffect(page, element, preClickState) {
    if (!preClickState) return true; // If we couldn't get pre-state, assume success

    try {
      await page.waitForTimeout(500); // Wait for any animations/transitions

      // Check URL change
      if (page.url() !== preClickState.url) {
        return true;
      }

      // Check visibility change
      const isVisible = await element.isVisible().catch(() => null);
      if (isVisible !== null && isVisible !== preClickState.isVisible) {
        return true;
      }

      // Check content change
      const innerHTML = await element.innerHTML().catch(() => null);
      if (innerHTML !== null && innerHTML !== preClickState.innerHTML) {
        return true;
      }

      // Check position change
      const box = await element.boundingBox().catch(() => null);
      if (box && preClickState.box) {
        const hasMoved = 
          Math.abs(box.x - preClickState.box.x) > 1 ||
          Math.abs(box.y - preClickState.box.y) > 1;
        if (hasMoved) return true;
      }

      return false;
    } catch (error) {
      console.log('Failed to verify click effect:', error);
      return true; // Assume success if verification fails
    }
  }

  async executeHover(page, action) {
    const { selector, position } = action;
    
    try {
      if (selector) {
        const element = await page.waitForSelector(selector, { timeout: 5000 });
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        
        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Could not get element position: ${selector}`);
        }
        
        // Move mouse smoothly
        const currentPosition = await page.mouse.position();
        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        
        const steps = 10;
        const deltaX = (targetX - currentPosition.x) / steps;
        const deltaY = (targetY - currentPosition.y) / steps;
        
        for (let i = 1; i <= steps; i++) {
          await page.mouse.move(
            currentPosition.x + deltaX * i,
            currentPosition.y + deltaY * i,
            { steps: 1 }
          );
          await page.waitForTimeout(20);
        }
        
        await element.hover();
      } else if (position) {
        // Similar smooth movement to position
        const currentPosition = await page.mouse.position();
        const steps = 10;
        const deltaX = (position.x - currentPosition.x) / steps;
        const deltaY = (position.y - currentPosition.y) / steps;
        
        for (let i = 1; i <= steps; i++) {
          await page.mouse.move(
            currentPosition.x + deltaX * i,
            currentPosition.y + deltaY * i,
            { steps: 1 }
          );
          await page.waitForTimeout(20);
        }
      }
      
      return { success: true, action };
    } catch (error) {
      console.error('Hover action failed:', error);
      throw error;
    }
  }
}

module.exports = ActionExecutor; 