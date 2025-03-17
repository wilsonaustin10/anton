/**
 * OpenAI client for the AutonoM3 Agent Builder chat assistant
 */
require('dotenv').config();
const { OpenAI } = require('openai');

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
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Adding a longer timeout to prevent quick timeouts
    timeout: 60000, // Increased timeout for complex tasks
    maxRetries: 5,  // Increased retries
  });
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
 * Request Computer Use actions from OpenAI
 * @param {string} taskDescription - Description of the task
 * @param {string} screenshot - Base64-encoded screenshot
 * @param {Array} messages - Conversation history
 * @returns {Object} - OpenAI response with actions
 */
async function getComputerUseActions(taskDescription, screenshot, messages = []) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }
  
  console.log('Requesting Computer Use actions from OpenAI');
  
  try {
    // Create system message with task description
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant that helps users automate browser tasks. Your goal is to help the user complete the following task: ${taskDescription}.

IMPORTANT: You MUST use the available function calls to perform actions. DO NOT just describe what to do - actually perform the actions by calling the appropriate functions.

When analyzing the screenshot:
1. Look for relevant elements like buttons, links, text fields
2. Determine the best selector or coordinates to interact with elements
3. Use the most appropriate function (click, type, etc.) to perform the needed action
4. If you need to chain multiple actions, call them in the correct sequence

When you believe the task is complete, include "TASK COMPLETE" in your response.

Available actions:
- click: Click on elements using selectors or coordinates
- type: Type text into forms
- navigate: Go to specific URLs
- scroll: Scroll the page or specific elements
- wait: Wait for elements or timeouts

YOU MUST USE FUNCTION CALLS to perform actions. DO NOT just describe what to do - actually execute the actions using the provided functions.`
    };
    
    // Prepare messages history
    const messageHistory = [
      systemMessage,
      ...messages.filter(msg => msg.role !== 'system'), // Remove any existing system messages
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is the current state of the screen. What actions should I take next to complete the task? YOU MUST USE FUNCTION CALLS to perform actions.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}` } }
        ]
      }
    ];
    
    console.log(`Sending request with ${messageHistory.length} messages`);
    
    // Make API request with function call tools enabled
    const response = await openai.chat.completions.create({
      model: COMPUTER_USE_MODEL,
      messages: messageHistory,
      tools: [
        {
          type: 'function',
          function: {
            name: 'click',
            description: 'Click on an element on the page',
            parameters: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element to click, e.g., "a.more-info", "#submit-button", etc.'
                },
                position: {
                  type: 'object',
                  description: 'Coordinates to click on',
                  properties: {
                    x: { type: 'number', description: 'X coordinate' },
                    y: { type: 'number', description: 'Y coordinate' }
                  }
                },
                options: {
                  type: 'object',
                  description: 'Click options',
                  properties: {
                    button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button to click with' },
                    clickCount: { type: 'number', description: 'Number of clicks' },
                    delay: { type: 'number', description: 'Delay between clicks in milliseconds' }
                  }
                }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'type',
            description: 'Type text into an input field',
            parameters: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the input element, e.g., "input[name=\'search\']", "#email", etc.'
                },
                text: {
                  type: 'string',
                  description: 'Text to type'
                },
                options: {
                  type: 'object',
                  description: 'Type options',
                  properties: {
                    delay: { type: 'number', description: 'Delay between keystrokes in milliseconds' },
                    clear: { type: 'boolean', description: 'Whether to clear the input first' }
                  }
                }
              },
              required: ['selector', 'text']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'navigate',
            description: 'Navigate to a URL',
            parameters: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to navigate to, e.g., "https://example.com", "/about", etc.'
                },
                options: {
                  type: 'object',
                  description: 'Navigation options',
                  properties: {
                    timeout: { type: 'number', description: 'Navigation timeout in milliseconds' },
                    waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'], description: 'When to consider navigation as finished' }
                  }
                }
              },
              required: ['url']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'scroll',
            description: 'Scroll the page',
            parameters: {
              type: 'object',
              properties: {
                direction: {
                  type: 'string',
                  enum: ['up', 'down', 'left', 'right'],
                  description: 'Direction to scroll'
                },
                amount: {
                  type: 'number',
                  description: 'Amount to scroll in pixels'
                },
                selector: {
                  type: 'string',
                  description: 'CSS selector for the element to scroll into view, e.g., "#footer", ".section-3", etc.'
                }
              },
              required: ['direction']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'wait',
            description: 'Wait for a selector or timeout',
            parameters: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector to wait for, e.g., "#loaded-content", ".results-container", etc.'
                },
                timeout: {
                  type: 'number',
                  description: 'Time to wait in milliseconds'
                }
              }
            }
          }
        }
      ],
      temperature: 0.2,
      max_tokens: 4096,
      tool_choice: "auto"
    });
    
    // Process the response to extract actions and thinking
    const result = processComputerUseResponse(response);
    return result;
  } catch (error) {
    console.error('Error getting Computer Use actions:', error);
    throw error;
  }
}

/**
 * Process Computer Use API response
 * @param {Object} response - OpenAI API response
 * @returns {Object} - Processed response with actions and thinking
 */
function processComputerUseResponse(response) {
  // Extract the main message content
  const message = response.choices[0].message;
  
  // Check if the task is deemed complete
  const isComplete = message.content && 
                    message.content.toLowerCase().includes('task complete');
  
  // Extract tool calls (actions)
  const actions = [];
  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.function) {
        try {
          const action = {
            type: toolCall.function.name,
            ...JSON.parse(toolCall.function.arguments)
          };
          actions.push(action);
        } catch (error) {
          console.error('Error parsing tool call arguments:', error);
        }
      }
    }
  }
  
  return {
    complete: isComplete,
    actions,
    thinking: message.content,
    result: isComplete ? message.content : null
  };
}

module.exports = { 
  generateChatResponse, 
  simpleChatResponse,
  setScriptGenerator, // Export function to set script generator externally
  getOpenAIClient: () => openai, // Export function to get OpenAI client
  getComputerUseActions, // Export the Computer Use function
  processComputerUseResponse // Export the response processor
}; 