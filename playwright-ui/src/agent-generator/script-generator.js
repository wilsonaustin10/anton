/**
 * Script generator for creating Playwright automation scripts using OpenAI
 */

// Import the OpenAI client
const openaiClientModule = require('../../openai-client');
const openai = openaiClientModule.getOpenAIClient();

require('dotenv').config();
const { getPromptForTask, generateTaskTitle } = require('./prompt-templates');
const { analyzeMessage } = require('./task-detector');
const { performWebSearch, extractSearchContext, scrapeWebsite } = require('./web-search');

// Register this module with the OpenAI client
openaiClientModule.setScriptGenerator(module.exports);

// Default model to use (use the most capable model for script generation)
const SCRIPT_MODEL = process.env.OPENAI_SCRIPT_MODEL || 'gpt-3.5-turbo';
// Default model for simpler tasks
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
// Feature flag for web search
const ENABLE_WEB_SEARCH = process.env.ENABLE_WEB_SEARCH === 'true';

/**
 * Generate a Playwright script for the given task using OpenAI
 * @param {string} task - The automation task to generate a script for
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Generated script and metadata
 */
async function generateScript(task, options = {}) {
  try {
    console.log('=== STARTING SCRIPT GENERATION ===');
    console.log(`Task: ${task}`);
    
    if (!openai) {
      console.error('ERROR: OpenAI client not initialized');
      throw new Error('OpenAI client not initialized. Check your API key configuration.');
    }
    
    // Analyze the task
    const analysis = analyzeMessage(task);
    if (!analysis.isAutomationTask) {
      // Treat all inputs as automation tasks
      console.log('Input not detected as a task, but generating script anyway');
    }
    
    // Special handling for LinkedIn tasks to ensure they always get processed
    let isLinkedInTask = false;
    if (task.toLowerCase().includes('linkedin')) {
      console.log('LinkedIn task detected, ensuring specialized handling with human handoff mode');
      isLinkedInTask = true;
      analysis.isAutomationTask = true;
      // Ensure we mark this as a task that requires automation
      if (!analysis.taskInfo) {
        analysis.taskInfo = {
          originalMessage: task,
          targetSite: 'linkedin.com',
          actionType: 'web_automation',
          difficulty: 'moderate'
        };
      } else {
        analysis.taskInfo.targetSite = 'linkedin.com';
        analysis.taskInfo.actionType = 'web_automation';
      }
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
    
    // STEP 2: Prepare the prompt based on the task
    console.log('STEP 2: Preparing prompt for task');
    
    // Always use example-based prompt for LinkedIn
    if (isLinkedInTask) {
      options.useExampleBasedPrompt = true;
    }
    
    // Get appropriate prompt template based on task type
    const prompt = getPromptForTask(task, options);
    console.log(`Prompt ready, length: ${prompt.length} characters`);
    
    // STEP 3: Prepare API call parameters
    console.log(`STEP 3: Using model ${SCRIPT_MODEL} for script generation`);
    console.log(`Task info:`, JSON.stringify(taskInfo, null, 2));
    
    // Simplified API parameters for clarity
    const apiParams = {
      model: SCRIPT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a Playwright automation expert that generates high-quality scripts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: isLinkedInTask ? 2000 : 3000 // Use smaller token limit for LinkedIn to prevent errors
    };
    
    console.log(`API parameters prepared (prompt length: ${prompt.length} chars)`);
    
    // STEP 4: Call OpenAI to generate the script
    console.log('STEP 4: Calling OpenAI API to generate Playwright script...');
    try {
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
          timestamp: new Date().toISOString()
        }
      };
    } catch (openaiError) {
      console.error('ERROR IN OPENAI API CALL:', openaiError);
      console.error('Error details:', JSON.stringify(openaiError, null, 2));
      console.error('Stack trace:', openaiError.stack);
      throw openaiError; // Re-throw to be handled by caller
    }
  } catch (error) {
    console.error('ERROR in generateScript:', error);
    console.error('Stack trace:', error.stack);
    
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
 * Extracts the Playwright script from the response
 * @param {string} response - The response from the AI
 * @returns {string} - The extracted script or empty string
 */
function extractCodeFromResponse(response) {
  // Check if the response contains a script section
  if (!response.includes('===PLAYWRIGHT SCRIPT===')) {
    console.log('No script section found in response');
    return '';
  }
  
  // Extract the script section
  let scriptSection = response.split('===PLAYWRIGHT SCRIPT===')[1];
  
  // If there's something after the script, remove it
  if (scriptSection.includes('```')) {
    scriptSection = scriptSection.split('```')[0];
  }
  
  // Clean up the script: remove markdown code block syntax if present
  scriptSection = scriptSection.replace(/```(javascript|js)?\n/g, '').replace(/```\n?$/, '');
  
  // Trim leading/trailing whitespace
  scriptSection = scriptSection.trim();
  
  // Add special handling for LinkedIn human handoff
  if (scriptSection.includes('window.runStep({ type: \'linkedin-login\' })')) {
    console.log('Detected LinkedIn login handoff in script, adding proper implementation');
    
    // Replace the placeholder implementation with the correct one that will work with our server
    scriptSection = scriptSection.replace(
      /await page\.evaluate\(\(\) => \{\s*return new Promise\(resolve => \{\s*\/\/ This will be replaced by the server-side human handoff implementation\s*window\.runStep\(\{ type: 'linkedin-login' \}\)\.then\(resolve\);\s*\}\);\s*\}\);/g,
      `// Use the special LinkedIn login step that will trigger human handoff mode
await page.evaluate(() => {
  return new Promise(resolve => {
    // Send the linkedin-login step to the server
    const socket = io();
    socket.emit('run-step', { step: { type: 'linkedin-login' } });
    
    // Listen for when the handoff is complete
    socket.once('human-handoff-mode', (data) => {
      if (!data.active) {
        resolve();
      }
    });
  });
});`
    );
  }
  
  return scriptSection;
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
  console.log(`handleMessage called with: "${message.substring(0, 30)}..."`);
  
  try {
    // STEP 1: User enters action prompt (received as 'message')
    console.log('STEP 1: Received action prompt:', message);
    
    // Check if OpenAI client is available
    if (!openai) {
      console.error('ERROR: OpenAI client not initialized');
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
    
    // STEPS 2-4: Generate a script for the message
    console.log('STEPS 2-4: Generating script with OpenAI');
    
    // Special handling for LinkedIn
    const isLinkedInTask = message.toLowerCase().includes('linkedin');
    if (isLinkedInTask) {
      console.log('LinkedIn task detected in handleMessage');
    }
    
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
      console.error('Stack trace:', scriptError.stack);
      
      // Special handling for LinkedIn tasks
      if (isLinkedInTask) {
        console.log('LinkedIn task with error - returning fallback LinkedIn template');
        // Return a simple success message for LinkedIn
        return {
          type: 'error',
          message: 'I had trouble generating your LinkedIn script. Please try again with more specific details about what you want to do on LinkedIn.'
        };
      }
      
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
      }
      
      // Default error message
      return {
        type: 'error',
        message: `I encountered an error generating your script: ${scriptError.message}. Please try rephrasing your request.`
      };
    }
  } catch (error) {
    console.error('Unexpected error in handleMessage:', error);
    console.error('Stack trace:', error.stack);
    return {
      type: 'error',
      message: 'An unexpected error occurred. Please try again with a different task.'
    };
  }
}

// Make sure to export the module before using it
module.exports = {
  handleMessage,
  generateScript
}; 