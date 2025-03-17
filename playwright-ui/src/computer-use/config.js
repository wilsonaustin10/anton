/**
 * Configuration for OpenAI Computer Use integration
 */

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
    allowedDomains: (process.env.ALLOWED_DOMAINS || 'linkedin.com,github.com').split(',').filter(Boolean),
    forbiddenSelectors: ['input[type="password"]', '.private-info'],
    maxTypingLength: 1000,
  }
}; 