/**
 * Test script to verify OpenAI API connectivity
 * Run with: node test-openai.js
 */
require('dotenv').config();
const { OpenAI } = require('openai');

async function testOpenAIConnection() {
  console.log('Testing OpenAI API connection...');
  console.log(`API key: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'Not found'}`);
  console.log(`Model: ${process.env.OPENAI_MODEL || 'gpt-3.5-turbo'}`);
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    });
    
    console.log('Attempting to call OpenAI API...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, can you help me with Playwright?' }
      ],
      max_tokens: 100,
    });
    
    console.log('✅ Success! OpenAI API connection working properly.');
    console.log('Response:', response.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('❌ Error connecting to OpenAI API:');
    console.error('  Name:', error.name);
    console.error('  Message:', error.message);
    
    // Provide specific advice based on error type
    if (error.name === 'AuthenticationError') {
      console.error('\nThe API key appears to be invalid or expired.');
      console.error('1. Check that your API key is correctly copied from OpenAI dashboard');
      console.error('2. Ensure the key is properly saved in the .env file');
      console.error('3. If using an organization key (sk-proj-*), try switching to a standard key (sk-*)');
      console.error('4. Verify your OpenAI account is in good standing (no billing issues)');
    } else if (error.name === 'RateLimitError') {
      console.error('\nYou have hit a rate limit with the API.');
      console.error('1. Check your usage limits in the OpenAI dashboard');
      console.error('2. Consider upgrading your plan for higher rate limits');
      console.error('3. Implement rate limiting in your application');
    } else if (error.name === 'TimeoutError') {
      console.error('\nThe request to OpenAI timed out.');
      console.error('1. Check your internet connection');
      console.error('2. Try again in a few minutes');
      console.error('3. Consider using a longer timeout value');
    }
    
    return false;
  }
}

// Run the test
testOpenAIConnection().then(success => {
  if (!success) {
    console.log('\nFor more help, visit: https://help.openai.com/en/articles/7100284-api-keys');
  }
}); 