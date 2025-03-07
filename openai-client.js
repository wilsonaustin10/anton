/**
 * OpenAI client for the AutonoM3 Agent Builder chat assistant
 */
require('dotenv').config();
const { OpenAI } = require('openai');

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
 * Generate a response to a user message using the OpenAI API
 * @param {string} userMessage - The message from the user
 * @param {Array} history - Previous messages in the conversation
 * @returns {Promise<string>} - The assistant's response
 */
async function generateChatResponse(userMessage, history = []) {
  // Check if OpenAI client is initialized
  if (!openai) {
    console.error('OpenAI client not initialized. Check your API key configuration.');
    return "I'm sorry, the chat service is not available. Please check your API key configuration.";
  }

  try {
    console.log(`Generating response for message: "${userMessage.substring(0, 30)}..."`);
    
    // Convert history to the format expected by OpenAI
    const messages = [...history];
    
    // Add system message for context
    if (messages.length === 0 || !messages.some(msg => msg.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: `You are an AI assistant for the AutonoM3 Agent Builder, a tool for creating and running Playwright automation scripts.
You help users write test scripts for web automation. Be concise, specific, and helpful with code examples where appropriate.
Focus on:
1. Playwright syntax and best practices
2. Web automation techniques
3. Test script debugging
4. Selector strategies (CSS, XPath, text, role)
5. Common automation scenarios`
      });
    }
    
    // Add the user's current message
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    console.log('Calling OpenAI API with model:', DEFAULT_MODEL);
    
    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    });
    
    console.log('Successfully received response from OpenAI API');
    
    // Return the response text
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // More specific error messages based on error type
    if (error.name === 'AuthenticationError') {
      return "Authentication error: The OpenAI API key is invalid or has expired. Please check your API key configuration.";
    } else if (error.name === 'RateLimitError') {
      return "Rate limit exceeded: The OpenAI API rate limit has been reached. Please try again later.";
    } else if (error.name === 'TimeoutError') {
      return "Request timed out: The OpenAI API request timed out. Please try again.";
    }
    
    // Provide a fallback response if the API call fails
    return "I'm sorry, I encountered an issue connecting to my knowledge base. Please check your API key configuration or try again later.";
  }
}

module.exports = { generateChatResponse }; 