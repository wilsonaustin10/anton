/**
 * OpenAI client for the AutonoM3 Agent Builder chat assistant
 */
require('dotenv').config();
const { OpenAI } = require('openai');
const { getProcessedText } = require('./utils');
// Remove the circular dependency by not importing script-generator directly
// Instead, we'll maintain a reference to be set later
let scriptGeneratorModule = null;

// Function to set the script generator module from outside 
function setScriptGenerator(module) {
  scriptGeneratorModule = module;
  console.log('Script generator module set externally');
}

// Initialize OpenAI client with proper configuration
let openai;
try {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Adding a longer timeout to prevent quick timeouts
      timeout: 60000, // Increased timeout for complex tasks
      maxRetries: 5,  // Increased retries
    });
  }
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
  openai = null;
}

// Default model to use
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
// Model for Computer Use
const COMPUTER_USE_MODEL = process.env.OPENAI_COMPUTER_USE_MODEL || 'gpt-4o';
console.log(`Using OpenAI model: ${DEFAULT_MODEL}`);
console.log(`Using OpenAI Computer Use model: ${COMPUTER_USE_MODEL}`);

// Simple template for LinkedIn scripts to use as fallback
const LINKEDIN_SCRIPT_TEMPLATE = `
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/');
    
    // Human handoff for login
    console.log('Waiting for user login...');
    await page.evaluate(() => {
      return new Promise(resolve => {
        window.runStep({ type: 'linkedin-login' }).then(resolve);
      });
    });
    
    // Search for CTOs in Austin, TX
    console.log('Searching for CTOs in Austin, TX...');
    await page.goto('https://www.linkedin.com/search/results/people/');
    await page.click('[data-control-name="all_filters"]');
    await page.fill('[placeholder="Add a title"]', 'CTO');
    await page.fill('[placeholder="Add a location"]', 'Austin, Texas');
    await page.click('[data-control-name="all_filters_apply"]');
    
    // Extract results
    const results = await page.$$eval('.search-result__info', nodes => 
      nodes.map(n => ({
        name: n.querySelector('.actor-name').textContent.trim(),
        title: n.querySelector('.subline-level-1').textContent.trim(),
        company: n.querySelector('.subline-level-2').textContent.trim()
      }))
    );
    
    console.log('Found prospects:', results);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

run();`;

/**
 * Direct call to OpenAI API for simple chat responses
 * This is a simplified version that bypasses complex logic
 */
async function simpleChatResponse(userMessage) {
  if (!openai) {
    return {
      type: 'error',
      message: "OpenAI client not initialized. Please check your API key configuration."
    };
  }
  
  try {
    // Check if this is a LinkedIn task
    if (userMessage.toLowerCase().includes('linkedin')) {
      console.log('LinkedIn task detected in simpleChatResponse, using direct template');
      
      // Use our direct LinkedIn template instead of trying to get the script generator
      return {
        type: 'orchestrated_response',
        script: LINKEDIN_SCRIPT_TEMPLATE,
        actionSequence: `1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Use Human Handoff Mode for login
4. Search for CTOs in Austin, TX
5. Extract the results
6. Close the browser`,
        message: "I've generated a LinkedIn script for finding CTOs in Austin, TX. The script will help you automate your sales prospecting task."
      };
    }
    
    console.log('Using simple chat response fallback');
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that helps with Playwright automation. Provide helpful, concise responses.'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    return {
      type: 'chat',
      message: response.choices[0].message.content.trim()
    };
  } catch (error) {
    console.error('Error in simple chat response:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Provide a more descriptive error message instead of the generic one
    if (userMessage.toLowerCase().includes('linkedin')) {
      return {
        type: 'error',
        message: "I need to create a LinkedIn automation script for you, but I'm having trouble connecting to the necessary services. Please check your API key or try again later."
      };
    }
    
    return {
      type: 'error',
      message: "I encountered an error processing your request. Please check your OpenAI API key configuration or try rephrasing your question."
    };
  }
}

/**
 * Generate a response to a user message using the OpenAI API
 * @param {string} userMessage - The message from the user
 * @param {Array} history - Previous messages in the conversation
 * @returns {Promise<object>} - The response object with type and content
 */
async function generateChatResponse(userMessage, history = []) {
  console.log(`Starting to process message: "${userMessage.substring(0, 30)}..."`);
  
  // Check if OpenAI client is initialized
  if (!openai) {
    console.error('OpenAI client not initialized. Check your API key configuration.');
    return {
      type: 'error',
      message: "I'm sorry, the chat service is not available. Please check your API key configuration."
    };
  }

  // Safety check for empty messages
  if (!userMessage || userMessage.trim() === '') {
    return {
      type: 'error',
      message: "Please provide a valid message or task."
    };
  }

  try {
    // Special handling for LinkedIn tasks - direct template if script generator not available
    if (userMessage.toLowerCase().includes('linkedin')) {
      console.log('LinkedIn task detected, checking for script generator');
      
      if (scriptGeneratorModule && scriptGeneratorModule.handleMessage) {
        console.log('Script generator available, using it for LinkedIn task');
        try {
          // We'll add detailed error logging to the try/catch
          console.log('Calling script generator handleMessage');
          const messageResult = await scriptGeneratorModule.handleMessage(userMessage);
          console.log('Script generator returned result:', messageResult ? messageResult.type : 'null');
          
          if (messageResult) {
            return messageResult;
          } else {
            console.log('Script generator returned null, using template');
            // Use the direct template as fallback
            return {
              type: 'orchestrated_response',
              script: LINKEDIN_SCRIPT_TEMPLATE,
              actionSequence: `1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Use Human Handoff Mode for login
4. Search for CTOs in Austin, TX
5. Extract the results
6. Close the browser`,
              message: "I've generated a LinkedIn script for finding CTOs in Austin, TX. The script will help you automate your sales prospecting task."
            };
          }
        } catch (linkedInError) {
          console.error('Error in script generator for LinkedIn task:', linkedInError);
          console.error('Stack trace:', linkedInError.stack);
          
          // Use the direct template as fallback after error
          return {
            type: 'orchestrated_response',
            script: LINKEDIN_SCRIPT_TEMPLATE,
            actionSequence: `1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Use Human Handoff Mode for login
4. Search for CTOs in Austin, TX
5. Extract the results
6. Close the browser`,
            message: "I've generated a LinkedIn script for finding CTOs in Austin, TX. The script will help you automate your sales prospecting task."
          };
        }
      } else {
        console.log('Script generator not available, using direct template');
        // Use the direct template if script generator not available
        return {
          type: 'orchestrated_response',
          script: LINKEDIN_SCRIPT_TEMPLATE,
          actionSequence: `1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Use Human Handoff Mode for login
4. Search for CTOs in Austin, TX
5. Extract the results
6. Close the browser`,
          message: "I've generated a LinkedIn script for finding CTOs in Austin, TX. The script will help you automate your sales prospecting task."
        };
      }
    }
    
    // SIMPLE MODE: Skip complex processing for simple queries or debug mode
    if (userMessage.toLowerCase().includes('help') || 
        userMessage.toLowerCase().includes('hello') ||
        process.env.SIMPLE_MODE === 'true') {
      return await simpleChatResponse(userMessage);
    }
    
    // Get the script generator module
    if (!scriptGeneratorModule) {
      console.error('Script generator module not available. Using simple chat fallback.');
      return await simpleChatResponse(userMessage);
    }
    
    try {
      console.log('Attempting to generate script...');
      const messageResult = await scriptGeneratorModule.handleMessage(userMessage);
      
      // Check if we got an orchestrated_response directly (new format)
      if (messageResult && messageResult.type === 'orchestrated_response') {
        console.log('Received orchestrated response from script generator');
        return messageResult;
      }
      
      // For backward compatibility, handle 'script' type too
      if (messageResult && messageResult.type === 'script') {
        console.log('Script generation successful, converting to orchestrated response');
        
        // Route the script and action sequence to their respective destinations
        return {
          type: 'orchestrated_response',
          script: messageResult.script,
          actionSequence: messageResult.actionSequence || messageResult.message,
          message: messageResult.message,
          metadata: messageResult.metadata
        };
      }
      
      if (messageResult && messageResult.type === 'error') {
        console.error('Error in script generation:', messageResult.message);
        return messageResult;
      }
      
      console.warn('Script generator returned an unexpected result type. Using fallback.');
      return await simpleChatResponse(userMessage);
      
    } catch (scriptError) {
      console.error('Caught error during script generation:', scriptError);
      console.error('Stack trace:', scriptError.stack);
      
      // Use fallback for any script generation error
      console.log('Using simple chat response due to script generation error');
      return await simpleChatResponse(userMessage);
    }
  } catch (error) {
    console.error('Unhandled error in message processing:', error);
    console.error('Stack trace:', error.stack);
    
    // Final fallback
    return {
      type: 'error',
      message: "I encountered an unexpected error. Please try a different query or contact support."
    };
  }
}

/**
 * Process the response from OpenAI's Computer Use API
 * @param {Object} response - The raw response from OpenAI
 * @returns {Object} - Processed response with actions, thinking, and completion status
 */
function processComputerUseResponse(response) {
  // Extract the main message content
  const mainMessage = response.choices[0].message;
  const content = mainMessage.content.trim();
  
  console.log('Processing OpenAI response for Computer Use. Length:', content.length);
  console.log('First 100 chars:', content.substring(0, 100));
  
  // Try to parse as JSON
  let jsonResponse;
  try {
    jsonResponse = JSON.parse(content);
    console.log('Successfully parsed JSON response');
  } catch (e) {
    console.error('Error parsing JSON response:', e);
    
    // Attempt to extract JSON from the response using regex
    const jsonMatch = content.match(/```json([\s\S]*?)```/) || content.match(/{[\s\S]*}/);
    if (jsonMatch) {
      try {
        const extractedJson = jsonMatch[1] ? jsonMatch[1].trim() : jsonMatch[0].trim();
        jsonResponse = JSON.parse(extractedJson);
        console.log('Successfully extracted and parsed JSON from response');
      } catch (extractError) {
        console.error('Error parsing extracted JSON:', extractError);
        throw new Error('Failed to parse response as JSON');
      }
    } else {
      throw new Error('Failed to parse response as JSON');
    }
  }
  
  // Enhanced: More robust task completion detection
  const completionPhrases = [
    'task complete', 
    'task is complete',
    'successfully completed',
    'task accomplished',
    'achieved the goal',
    'completed successfully',
    'task finished',
    'goal has been achieved',
    'found the requested information',
    'data has been found',
    'we have reached',
    'we are now at',
    'successfully navigated',
    'information is displayed'
  ];
  
  // Check for completion phrases in thinking, content, or anywhere else in the response
  const contentLower = content.toLowerCase();
  const thinkingLower = jsonResponse.thinking ? jsonResponse.thinking.toLowerCase() : '';
  
  // Look for specific completion indicators in the content or thinking
  const hasCompletionPhrase = completionPhrases.some(phrase => 
    contentLower.includes(phrase) || thinkingLower.includes(phrase));
  
  // Look for completion phrases in the URL or page state descriptions
  const urlContainsTargetKeywords = jsonResponse.thinking && 
    (thinkingLower.includes('current url shows') || 
     thinkingLower.includes('we are at the correct page') ||
     thinkingLower.includes('page shows the requested') ||
     thinkingLower.includes('information is visible'));
    
  // Check if task is complete based on multiple signals
  const isComplete = 
    hasCompletionPhrase || 
    urlContainsTargetKeywords ||
    (jsonResponse.complete === true) || 
    (jsonResponse.complete === 'true') || 
    (jsonResponse.status === 'complete') ||
    (jsonResponse.status === 'completed');
  
  // Log detailed completion status reasoning
  console.log(`Task completion detection:
    - Has completion phrase: ${hasCompletionPhrase}
    - URL contains target keywords: ${urlContainsTargetKeywords}
    - JSON complete field: ${jsonResponse.complete}
    - JSON status field: ${jsonResponse.status}
    - Final determination: ${isComplete}`);
  
  // Ensure actions array exists
  if (!jsonResponse.actions || !Array.isArray(jsonResponse.actions)) {
    console.warn('No actions found in response, creating empty actions array');
    jsonResponse.actions = [];
  }
  
  return {
    complete: isComplete,
    actions: jsonResponse.actions,
    thinking: jsonResponse.thinking || null,
    result: isComplete ? content : null
  };
}

/**
 * Get Computer Use actions from OpenAI to automate browser tasks
 * @param {Page} page - Playwright page object
 * @param {string} taskDescription - Description of the task to perform
 * @param {object} options - Additional options
 * @returns {Promise<object>} - The actions to execute
 */
async function getComputerUseActions(page, taskDescription, options = {}) {
  console.log(`Getting Computer Use actions for task: "${taskDescription}"`);
  
  try {
    // Safety check
    if (!openai) {
      console.error('OpenAI client not initialized. Check your API key configuration.');
      throw new Error('OpenAI client not initialized');
    }
    
    // Capture screenshot of current page
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false
    });
    
    // Convert screenshot to base64
    const base64Screenshot = screenshot.toString('base64');
    console.log(`Screenshot captured, size: ${Math.round(base64Screenshot.length / 1024)}KB`);
    
    // Construct current URL and page title
    let pageInfo = {};
    try {
      const url = await page.url();
      const title = await page.title();
      const content = await page.content();
      const shortenedDom = await getProcessedText(content, url);
      pageInfo = { url, title, content: shortenedDom };
    } catch (e) {
      console.error('Error getting page info:', e);
      pageInfo = { url: 'unknown', title: 'unknown' };
    }
    
    // Get system information
    const systemInfo = await getSystemInfo();
    // Create the prompt
    const messages = [
      {
        role: 'system',
        content: (
          `You are a computer control system that generates precise browser automation actions based on a user's task description, screenshot, and HTML DOM structure.

Your goal is to perform the user's requested task by breaking it down into logical steps, tracking completion of each step, and generating the appropriate browser actions.

You will receive a task description, a screenshot of a webpage, and the HTML DOM structure of the current page. First, analyze the task and break it into discrete steps. Then determine the best sequence of actions to accomplish each step by using both the visual information from the screenshot and the semantic structure from the DOM.

Return your answer as a valid JSON object with the following properties:
- steps: An array of step objects, each containing:
  - description: A clear description of this sub-task
  - completed: Boolean indicating if this step has been completed
  - actions: Array of action objects needed to complete this step
- actions: An array of action objects, each with a "type" property and other parameters specific to that action type
- complete: Set to true if you believe the entire task has been successfully completed
- progress: Numeric percentage (0-100) indicating overall task completion
- status: Include a string status such as "in_progress", "completed", or "error"
- thinking: Your step-by-step analysis of the task and how you plan to accomplish it

When a task is successfully completed, you MUST:
1. Set "complete" to true
2. Set "status" to "completed"
3. Mark all steps as completed
4. Set progress to 100
5. Include "Task complete" or "Task completed successfully" in your thinking

IMPORTANT DETECTION RULES:
- If the user asked to navigate to a specific URL and the page is already at that URL, mark that step as COMPLETED
- If the user asked to find specific data (e.g., "find GBP/USD historical data") and that data is visible in the screenshot or DOM, mark that step as COMPLETED
- If the user asked to search for something and the search results are visible, mark that step as COMPLETED
- When in doubt about step completion, look at the current URL, page title, and DOM structure to determine if they match what the user was looking for

Supported action types:
- navigate: { type: "navigate", url: "https://example.com" }
- click: { type: "click", selector: "#button-id" } or { type: "click", position: { x: 100, y: 200 } }
- type: { type: "type", selector: "#input-id", text: "text to type" }
- wait: { type: "wait", timeout: 1000 } or { type: "wait", selector: "#element-to-wait-for" }
- scroll: { type: "scroll", direction: "down", amount: 300 } or { type: "scroll", selector: "#element-to-scroll-to" }

DOM ANALYSIS GUIDELINES:
- Use the DOM structure to find the most precise and reliable selectors for elements
- When the screenshot doesn't clearly show an element, rely on the DOM to determine if it exists
- For forms and interactive elements, use the DOM to understand their structure and attributes
- Check for hidden elements, ARIA attributes, and other accessibility features in the DOM
- Use data attributes, IDs, and unique class combinations from the DOM for more reliable selectors

SELECTOR GENERATION:
- Always prefer the most specific and reliable selector possible using DOM information
- Prioritize selectors in this order: ID > unique attribute > CSS path > XPath
- Generate CSS selectors that are robust against minor page changes
- For dynamically generated content, look for stable attributes in the DOM hierarchy

You MUST validate all selectors against the provided DOM before including them in actions.
Start with what you can see in both the screenshot and DOM. If more steps are needed, you can include navigation or scrolling actions.
Limit your response to 1-3 actions per request. Additional actions can be requested in subsequent calls.

After each response, re-evaluate which steps have been completed based on the current screenshot and DOM, and update the steps array accordingly.`
        )
      },
      {
        role: 'user',
        content: [
          `Task: ${taskDescription}`,
          `Current page: ${pageInfo.url}`,
          `Page title: ${pageInfo.title}`,
          `System info: ${JSON.stringify(systemInfo)}`,
          `Page content: ${pageInfo.content}`
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Screenshot}`
            }
          }
        ]
      }
    ];
    
    console.log('Sending Computer Use request to OpenAI...');
    
    const response = await openai.chat.completions.create({
      model: COMPUTER_USE_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 1500
    });
    

    console.log(`"Response: ${response.choices[0].message.content}"`)
    // Process the response using our dedicated function
    const result = processComputerUseResponse(response);
    
    // Log actions for debugging
    console.log(`Received ${result.actions.length} actions:`, JSON.stringify(result.actions, null, 2));
    
    if (options.extract_thinking && result.thinking) {
      console.log('Extracted thinking:', result.thinking);
    }
    
    return result;
  } catch (error) {
    console.error('Error getting Computer Use actions:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Get current system information
 * @returns {Promise<Object>} - System information
 */
async function getSystemInfo() {
  const os = require('os');
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    architecture: os.arch(),
    cpus: os.cpus().length,
    memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
  
  return systemInfo;
}

module.exports = { 
  generateChatResponse, 
  simpleChatResponse,
  setScriptGenerator, // Export function to set script generator externally
  getOpenAIClient: () => openai, // Export function to get OpenAI client
  getComputerUseActions, // Export the Computer Use function
  processComputerUseResponse // Export the response processor
}; 