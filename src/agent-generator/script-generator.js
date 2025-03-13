/**
 * Script generator for creating Playwright automation scripts using OpenAI
 */

const openai = require('../lib/openai-client');
require('dotenv').config();
const { getPromptForTask, generateTaskTitle } = require('./prompt-templates');
const { analyzeMessage } = require('./message-analyzer');
const { performWebSearch, extractSearchContext, scrapeWebsite } = require('./web-search');

// Default model to use (use the most capable model for script generation)
const SCRIPT_MODEL = process.env.OPENAI_SCRIPT_MODEL || 'gpt-4o-mini'; 
// Feature flag for web search
const ENABLE_WEB_SEARCH = process.env.ENABLE_WEB_SEARCH === 'true';

/**
 * Generate a Playwright script for the given task using OpenAI
 * @param {string} task - The automation task to generate a script for
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Generated script and metadata
 */
async function generateScript(task, options = {}) {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Check your API key configuration.');
  }
  
  // Analyze the task
  const analysis = analyzeMessage(task);
  if (!analysis.isAutomationTask) {
    // Treat all inputs as automation tasks
    console.log('Input not detected as a task, but generating script anyway');
  }
  
  const taskInfo = analysis.taskInfo || {
    originalMessage: task,
    targetSite: null,
    actionType: 'general_automation',
    difficulty: 'moderate'
  };
  
  console.log(`Generating script for task: "${task.substring(0, 50)}..."`, taskInfo);
  
  // Generate a title for the task if not provided
  const taskTitle = options.title || generateTaskTitle(task);
  
  // STEP 2: Perform web search if enabled to get context
  let searchContext = '';
  let webSearchStatus = { used: false, success: false };
  
  if (ENABLE_WEB_SEARCH) {
    try {
      console.log('STEP 2: Web search enabled, fetching relevant information...');
      
      // Check if a specific website is mentioned in the task
      const targetSite = taskInfo.targetSite;
      
      if (targetSite && targetSite.includes('www.') && targetSite.includes('.com')) {
        // If we have a specific website that looks like a full domain, try direct scraping first
        console.log(`Detected specific website: ${targetSite}, attempting deep scrape...`);
        
        // Add http:// prefix if missing (Firecrawl requires full URLs)
        const url = targetSite.startsWith('http') ? targetSite : `https://${targetSite}`;
        
        // Perform deep scrape
        const scrapeResult = await scrapeWebsite(url, {
          crawlLinks: true,
          maxDepth: 2,
          maxPages: 5
        });
        
        if (scrapeResult.success && scrapeResult.content) {
          console.log(`Deep scrape successful for ${url}, content length: ${scrapeResult.content.length} chars`);
          searchContext = `# Website Content for: ${scrapeResult.title || url}\n\n${scrapeResult.content}\n\n`;
          webSearchStatus = { used: true, success: true, method: 'deep_scrape' };
        } else {
          console.log(`Deep scrape failed for ${url}, falling back to regular search`);
          // Fall back to regular search
          await performRegularSearch();
        }
      } else {
        // No specific website or incomplete domain, use regular search
        await performRegularSearch();
      }
    } catch (searchError) {
      console.error('Unexpected error during web search:', searchError);
      webSearchStatus = { used: true, success: false, error: searchError.message };
    }
  } else {
    console.log('Web search is disabled');
  }
  
  // Helper function for regular search
  async function performRegularSearch() {
    const searchQuery = taskInfo.targetSite 
      ? `${taskInfo.targetSite} ${task}` 
      : task;
    
    // Perform the web search to get context
    const searchResults = await performWebSearch(searchQuery);
    
    if (searchResults.success && searchResults.results && searchResults.results.length > 0) {
      searchContext = extractSearchContext(task, searchResults.results);
      console.log(`Web search successful, added ${searchResults.results.length} results to context`);
      webSearchStatus = { used: true, success: true, method: 'search' };
    } else {
      if (searchResults.error) {
        console.warn(`Web search failed: ${searchResults.error}`);
      } else {
        console.log('Web search returned no results');
      }
      webSearchStatus = { used: true, success: false, error: searchResults.error };
    }
  }
  
  // STEP 3: Select the appropriate prompt template and add search context
  const basePrompt = getPromptForTask(task, { 
    taskTitle, 
    taskType: taskInfo.actionType, 
    difficulty: taskInfo.difficulty 
  });
  
  // Add search context to the prompt if available
  const prompt = searchContext 
    ? `${basePrompt}\n\n# Web Search Context\n${searchContext}\n\nUse the information from the web search to create a more accurate and effective script. Pay special attention to the website structure, UI elements, and functionality described above.`
    : basePrompt;
  
  try {
    console.log(`STEP 3: Using model ${SCRIPT_MODEL} for script generation`);
    console.log(`Task info:`, JSON.stringify(taskInfo, null, 2));
    
    // Prepare API call parameters
    const apiParams = {
      model: SCRIPT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a Playwright automation expert that generates high-quality test scripts. 

RESPONSE FORMAT:
1. Start with "===ACTION SEQUENCE===" followed by a description of the steps in plain language
2. Then include "===PLAYWRIGHT SCRIPT===" followed by the complete script code
3. If you include a code example, ensure it's properly formatted with triple backticks like this:
\`\`\`javascript
// code here
\`\`\`

IMPORTANT: Your script will be extracted and run automatically, so ensure the code is complete and properly formatted.
ASSUME PLAYWRIGHT IS ALREADY INSTALLED - DO NOT INCLUDE ANY NPM INSTALL COMMANDS.`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    };
    
    console.log(`API parameters prepared (prompt length: ${prompt.length} chars)`);
    
    // STEP 4: Call OpenAI to generate the script
    console.log('STEP 4: Calling OpenAI API to generate Playwright script...');
    const response = await openai.chat.completions.create(apiParams);
    console.log('API response received successfully');
    
    const scriptContent = response.choices[0].message.content.trim();
    console.log(`Script content length: ${scriptContent.length} characters`);
    
    // Extract the code portion from the response
    const extractedCode = extractCodeFromResponse(scriptContent);
    console.log(`Extracted code length: ${extractedCode.length} characters`);
    console.log('STEP 5: Script generated successfully, ready for display');

    // Extract the action sequence directly from the response
    const actionSequence = extractActionSequence(scriptContent);
    console.log('Action sequence extracted from response');

    // Only generate an action sequence if one wasn't provided in the response
    const finalActionSequence = actionSequence || await generateActionSequence(task, extractedCode);
    
    // STEP 5: Return the script
    return {
      script: extractedCode,
      actionSequence: finalActionSequence,
      taskInfo: {
        title: taskTitle,
        description: task,
        targetSite: taskInfo.targetSite,
        actionType: taskInfo.actionType,
        difficulty: taskInfo.difficulty,
        timestamp: new Date().toISOString(),
        webSearchUsed: webSearchStatus.used,
        webSearchSuccess: webSearchStatus.success,
        webSearchMethod: webSearchStatus.method
      }
    };
  } catch (error) {
    console.error('Error generating script:', error);
    
    if (error.message.includes('max_tokens')) {
      throw new Error('The task is too complex. Please try a more specific or shorter task.');
    } else if (error.name === 'AuthenticationError') {
      throw new Error('OpenAI API authentication failed. Please check your API key.');
    } else if (error.name === 'RateLimitError') {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`Failed to generate script: ${error.message}`);
    }
  }
}

/**
 * Extract the actual code from the AI response, removing markdown and explanations
 * @param {string} response - The full AI response
 * @returns {string} - The extracted code
 */
function extractCodeFromResponse(response) {
  console.log('Extracting code from response...');
  
  // Check if the response contains the format markers
  if (response.includes('===PLAYWRIGHT SCRIPT===')) {
    // Extract only the code part from the response using the format markers
    const scriptPart = response.split('===PLAYWRIGHT SCRIPT===')[1].trim();
    console.log('Found ===PLAYWRIGHT SCRIPT=== marker, extracted code');
    return scriptPart;
  }
  
  // Check for markdown code blocks with ```javascript or ```js pattern
  const markdownJsRegex = /```(?:javascript|js)([\s\S]*?)```/;
  const markdownMatch = response.match(markdownJsRegex);
  
  if (markdownMatch && markdownMatch[1]) {
    console.log('Found markdown code block with javascript/js syntax');
    return markdownMatch[1].trim();
  }
  
  // Check for any markdown code blocks with ``` pattern
  const markdownRegex = /```([\s\S]*?)```/;
  const genericMarkdownMatch = response.match(markdownRegex);
  
  if (genericMarkdownMatch && genericMarkdownMatch[1]) {
    console.log('Found generic markdown code block');
    return genericMarkdownMatch[1].trim();
  }
  
  // Fallback for older format responses
  // Strip any markdown code formatting
  let code = response;
  console.log('No markdown blocks found, using fallback extraction logic');
  
  // Remove markdown code block markers if present (this is redundant now but kept for safety)
  code = code.replace(/```javascript|```js|```|`/g, '').trim();
  
  // Remove any potential explanatory text before or after the code
  // Look for common patterns in the beginning of script files
  const codeStarts = [
    'const {', 'const ', 'import ', '// @ts-check', '#!/usr/bin/env node',
    'require(', 'let ', 'var ', 'async ', 'function ', '(async', 'import('
  ];
  
  for (const startPattern of codeStarts) {
    const startIndex = code.indexOf(startPattern);
    if (startIndex > 0) {
      code = code.substring(startIndex);
      console.log(`Found code start pattern: ${startPattern}`);
      break;
    }
  }

  return code;
}

/**
 * Extract action sequence from the response
 * @param {string} response - The full response from the OpenAI API
 * @returns {string} - The extracted action sequence
 */
function extractActionSequence(response) {
  // Check if the response contains the new format markers
  if (response.includes('===ACTION SEQUENCE===') && response.includes('===PLAYWRIGHT SCRIPT===')) {
    // Extract the action sequence part
    const actionPart = response
      .split('===ACTION SEQUENCE===')[1]
      .split('===PLAYWRIGHT SCRIPT===')[0]
      .trim();
    return actionPart;
  }
  
  // If using the old format or no action sequence was provided, return empty string
  return '';
}

/**
 * Generate a user-friendly action sequence description from a task and script
 * @param {string} task - The original task
 * @param {string} script - The generated script
 * @returns {Promise<string>} - Action sequence description
 */
async function generateActionSequence(task, script) {
  try {
    const result = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains technical scripts in simple terms. Create a brief, numbered list of steps that this script will perform. Keep it concise and user-friendly.'
        },
        {
          role: 'user',
          content: `Task: ${task}\n\nScript:\n${script.substring(0, 1500)}`  // Limit script length to avoid token limits
        }
      ],
      temperature: 0.7,
      max_tokens: 300  // Keep the action sequence concise
    });
    
    return result.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating action sequence:', error);
    // Return a simple fallback if the action sequence generation fails
    return `Generated a script to: ${task}`;
  }
}

/**
 * Handle a user message by generating a script regardless of content
 * @param {string} message - The user message
 * @returns {Promise<object>} - Response with script
 */
async function handleMessage(message) {
  try {
    // STEP 1: User enters action prompt (received as 'message')
    console.log('STEP 1: Received action prompt:', message);
    
    // If OpenAI client is not initialized, return early
    if (!openai) {
      console.error('OpenAI client not initialized');
      return {
        type: 'error',
        message: 'OpenAI client is not available. Please check your API key configuration.'
      };
    }
    
    // Check if the message is valid
    if (!message || message.trim() === '') {
      return {
        type: 'error',
        message: 'Please provide a valid automation task.'
      };
    }
    
    // STEPS 2-4: Generate a script for the message using web search for context
    console.log('STEPS 2-4: Generating script with Firecrawl context and OpenAI');
    
    // Generate the script
    try {
      const result = await generateScript(message);
      
      // Validate the result
      if (!result || !result.script) {
        console.error('Script generation returned invalid result:', result);
        return {
          type: 'error',
          message: 'Failed to generate a valid script. Please try a different task.'
        };
      }
      
      // STEP 5: Return the script and action sequence
      console.log('STEP 5: Script and action sequence generated and ready for display');
      return {
        type: 'orchestrated_response',
        script: result.script,
        actionSequence: result.actionSequence,
        metadata: result.taskInfo,
        message: result.actionSequence  // Use the action sequence as the chat message
      };
    } catch (scriptError) {
      console.error('Error generating script:', scriptError);
      
      // Provide more specific error messages based on the error
      if (scriptError.message.includes('API key')) {
        return {
          type: 'error',
          message: 'Authentication error: Please check your OpenAI API key configuration.'
        };
      } else if (scriptError.message.includes('rate limit')) {
        return {
          type: 'error',
          message: 'Rate limit exceeded: Please try again in a few minutes.'
        };
      } else if (scriptError.message.includes('timeout')) {
        return {
          type: 'error',
          message: 'The request timed out. Please try a simpler task or try again later.'
        };
      } else if (scriptError.message.includes('web search') || scriptError.message.includes('search failed')) {
        return {
          type: 'error',
          message: 'I encountered an issue with web search. Please try again with a simpler query.'
        };
      }
      
      // Default error message
      return {
        type: 'error',
        message: `I encountered an error generating your script: ${scriptError.message}. Please try rephrasing your request.`
      };
    }
  } catch (error) {
    console.error('Unexpected error in handleMessage:', error);
    return {
      type: 'error',
      message: 'An unexpected error occurred. Please try again with a different task.'
    };
  }
}

module.exports = {
  generateScript,
  handleMessage,
  extractCodeFromResponse
}; 