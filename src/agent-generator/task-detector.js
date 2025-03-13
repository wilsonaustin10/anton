/**
 * Task detection logic for identifying automation requests
 */

/**
 * Keywords that suggest a message contains an automation task
 */
const TASK_KEYWORDS = [
  // Action verbs
  'automate', 'create', 'build', 'make', 'generate', 'write', 'develop',
  
  // Web automation actions
  'navigate', 'go to', 'visit', 'browse', 'open',
  'click', 'tap', 'press', 'select', 'check', 'uncheck',
  'fill', 'type', 'input', 'enter', 'submit', 'upload',
  'download', 'save', 'extract', 'scrape', 'get', 'fetch',
  'search', 'find', 'locate', 'look for',
  
  // Data-related
  'data', 'table', 'list', 'information', 'content',
  
  // Authentication
  'login', 'sign in', 'authenticate', 'register', 'sign up',
  
  // Special cases
  'agent for', 'script for', 'code for', 'test for',
  'bot', 'crawler', 'scraper', 'automation'
];

/**
 * Phrases that strongly indicate the user is asking for an agent/automation
 */
const STRONG_INDICATORS = [
  'can you create an agent',
  'write a script',
  'create a bot',
  'automate this',
  'build a crawler',
  'generate a test',
  'write code to',
  'make a scraper'
];

/**
 * Determines if a message is requesting an automation task
 * @param {string} message - User message to analyze
 * @returns {boolean} - Whether the message is an automation task
 */
function isAutomationTask(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }
  
  console.log('Analyzing message for task detection:', message);
  const messageLower = message.toLowerCase();
  
  // Check for strong indicators first
  for (const indicator of STRONG_INDICATORS) {
    if (messageLower.includes(indicator)) {
      console.log(`Strong task indicator found: "${indicator}"`);
      return true;
    }
  }
  
  // Any message containing "go to" and a website is almost certainly a task
  if ((messageLower.includes('go to') || messageLower.includes('navigate to')) && 
      (messageLower.includes('.com') || messageLower.includes('.org') || messageLower.includes('.net'))) {
    console.log('Navigation to website detected - treating as automation task');
    return true;
  }
  
  // Count the number of task-related keywords in the message
  let keywordCount = 0;
  const matchedKeywords = [];
  for (const keyword of TASK_KEYWORDS) {
    if (messageLower.includes(keyword)) {
      keywordCount++;
      matchedKeywords.push(keyword);
      
      // If we find 2 or more keywords, it's likely a task
      if (keywordCount >= 2) {
        console.log(`Found ${keywordCount} task keywords: ${matchedKeywords.join(', ')}`);
        return true;
      }
    }
  }
  
  // Special patterns: URL mention combined with an action keyword
  const hasUrl = /https?:\/\/\S+/.test(messageLower) || 
                 /\b\w+\.\w{2,}\/\S*\b/.test(messageLower) || 
                 /\b\w+\.(com|org|net|io|edu|gov)\b/.test(messageLower);
                 
  if (hasUrl && keywordCount >= 1) {
    console.log(`URL detected with ${keywordCount} task keywords - treating as automation task`);
    return true;
  }
  
  // IMPORTANT: For the MVP, we want to be more aggressive in identifying tasks
  // If there's a website mentioned at all, it's likely a task
  if (hasUrl) {
    console.log('URL detected in message - treating as automation task');
    return true;
  }
  
  // Question patterns that might be about automation but not direct tasks
  const isQuestion = messageLower.includes('how do i') || 
                    messageLower.includes('how to') || 
                    messageLower.includes('can i') ||
                    messageLower.endsWith('?');
  
  // If it's a question with automation keywords, it might not be a direct task request
  if (isQuestion && keywordCount < 3) {
    console.log('Detected question pattern - not treating as automation task');
    return false;
  }
  
  // Not enough evidence that this is an automation task
  console.log('Not enough evidence to classify as automation task');
  return false;
}

/**
 * Extracts the primary domain/site from a task description
 * @param {string} message - The task description
 * @returns {string|null} - The extracted domain or null if none found
 */
function extractTargetSite(message) {
  if (!message) return null;
  
  // Try to find a URL pattern
  const urlMatch = message.match(/https?:\/\/([a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)/i) || 
                  message.match(/\b([a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)\b/i);
  
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // Look for phrases that indicate a website
  const siteMatches = message.match(/(?:on|from|at|for|visit|to)\s+([a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|org|net|io|edu|gov))\b/i);
  if (siteMatches && siteMatches[1]) {
    return siteMatches[1];
  }
  
  // Check for common website names without the TLD
  const commonSites = ['google', 'facebook', 'twitter', 'amazon', 'youtube', 'instagram', 'linkedin', 'github'];
  for (const site of commonSites) {
    if (message.toLowerCase().includes(site)) {
      return `${site}.com`;
    }
  }
  
  return null;
}

/**
 * Detects the primary action in an automation task
 * @param {string} message - The task description
 * @returns {string} - The detected action type
 */
function detectPrimaryAction(message) {
  const messageLower = message.toLowerCase();
  
  // Extract data
  if (messageLower.includes('extract') || 
      messageLower.includes('scrape') ||
      messageLower.includes('get data') ||
      messageLower.includes('collect') ||
      messageLower.includes('gather')) {
    return 'data_extraction';
  }
  
  // Form filling
  if (messageLower.includes('fill') || 
      messageLower.includes('input') ||
      messageLower.includes('enter') ||
      messageLower.includes('type') ||
      messageLower.includes('form')) {
    return 'form_filling';
  }
  
  // Login/authentication
  if (messageLower.includes('login') || 
      messageLower.includes('sign in') ||
      messageLower.includes('authenticate') ||
      messageLower.includes('sign up') ||
      messageLower.includes('register')) {
    return 'authentication';
  }
  
  // Search
  if (messageLower.includes('search') || 
      messageLower.includes('find') ||
      messageLower.includes('look for') ||
      messageLower.includes('query')) {
    return 'search';
  }
  
  // Navigation
  if (messageLower.includes('navigate') || 
      messageLower.includes('go to') ||
      messageLower.includes('visit') ||
      messageLower.includes('open') ||
      messageLower.includes('browse')) {
    return 'navigation';
  }
  
  // Default
  return 'general_automation';
}

/**
 * Categorizes the difficulty level of a task
 * @param {string} message - The task description
 * @returns {string} - Difficulty level (simple, moderate, complex)
 */
function categorizeDifficulty(message) {
  // Count special characters, length, and technical terms as indicators of complexity
  const wordCount = message.split(/\s+/).length;
  const technicalTerms = [
    'xpath', 'css selector', 'regex', 'shadow dom', 'iframe', 'ajax', 
    'dynamic', 'javascript', 'event', 'callback', 'async', 'promise'
  ];
  
  let technicalScore = 0;
  for (const term of technicalTerms) {
    if (message.toLowerCase().includes(term)) {
      technicalScore++;
    }
  }
  
  // Multi-step indicators
  const hasMultipleSteps = 
    message.toLowerCase().includes('then') ||
    message.toLowerCase().includes('after that') ||
    message.toLowerCase().includes('next') ||
    message.toLowerCase().includes('finally') ||
    /\d+\s*\.\s*/.test(message); // numbered list
  
  if (wordCount > 50 || technicalScore >= 3 || hasMultipleSteps) {
    return 'complex';
  } else if (wordCount > 20 || technicalScore >= 1) {
    return 'moderate';
  } else {
    return 'simple';
  }
}

/**
 * Analyzes a user message to determine if it's an automation task and extracts key information
 * @param {string} message - The message to analyze
 * @returns {object} - Analysis results
 */
function analyzeMessage(message) {
  const isTask = isAutomationTask(message);
  
  if (!isTask) {
    return {
      isAutomationTask: false,
      taskInfo: null
    };
  }
  
  return {
    isAutomationTask: true,
    taskInfo: {
      originalMessage: message,
      targetSite: extractTargetSite(message),
      actionType: detectPrimaryAction(message),
      difficulty: categorizeDifficulty(message)
    }
  };
}

module.exports = {
  isAutomationTask,
  analyzeMessage,
  extractTargetSite,
  detectPrimaryAction,
  categorizeDifficulty
}; 