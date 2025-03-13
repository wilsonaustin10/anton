/**
 * OpenAI client for the AutonoM3 Agent Builder chat assistant
 */
require('dotenv').config();
const { OpenAI } = require('openai');

// Lazy-load the script generator module to avoid circular dependencies
let scriptGeneratorModule;
function getScriptGenerator() {
  if (!scriptGeneratorModule) {
    try {
      scriptGeneratorModule = require('./src/agent-generator/script-generator');
      console.log('Script generator module loaded successfully');
    } catch (loadError) {
      console.error('Failed to load script generator module:', loadError);
      scriptGeneratorModule = null;
    }
  }
  return scriptGeneratorModule;
}

// Initialize OpenAI client with proper configuration
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Adding a longer timeout to prevent quick timeouts
    timeout: 30000,
    maxRetries: 3,
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
  openai = null;
}

// Default model to use
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
console.log(`Using OpenAI model: ${DEFAULT_MODEL}`);

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
    return {
      type: 'error',
      message: "I'm having trouble connecting to my knowledge base. Please try again later."
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
    // SIMPLE MODE: Skip complex processing for simple queries or debug mode
    if (userMessage.toLowerCase().includes('help') || 
        userMessage.toLowerCase().includes('hello') ||
        process.env.SIMPLE_MODE === 'true') {
      return await simpleChatResponse(userMessage);
    }
    
    // Get the script generator module
    const scriptGenerator = getScriptGenerator();
    if (!scriptGenerator) {
      console.error('Script generator module not available. Using simple chat fallback.');
      return await simpleChatResponse(userMessage);
    }
    
    try {
      console.log('Attempting to generate script...');
      const messageResult = await scriptGenerator.handleMessage(userMessage);
      
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
      
      // Use fallback for any script generation error
      console.log('Using simple chat response due to script generation error');
      return await simpleChatResponse(userMessage);
    }
  } catch (error) {
    console.error('Unhandled error in message processing:', error);
    
    // Final fallback
    return {
      type: 'error',
      message: "I encountered an unexpected error. Please try a different query or contact support."
    };
  }
}

module.exports = { generateChatResponse }; 