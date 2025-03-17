/**
 * Simple test script to check OpenAI client functionality
 */
require('dotenv').config();
const openaiClientModule = require('./openai-client');

async function testOpenAI() {
  console.log('Starting OpenAI client test...');
  
  // Test if the OpenAI client is initialized
  const openai = openaiClientModule.getOpenAIClient();
  console.log('OpenAI client initialized:', openai ? 'YES' : 'NO');
  
  // Test direct chat response
  try {
    console.log('\nTesting simple chat response:');
    const normalResponse = await openaiClientModule.simpleChatResponse('What is Playwright?');
    console.log('Response type:', normalResponse.type);
    console.log('Response message:', normalResponse.message.substring(0, 100) + '...');
  } catch (error) {
    console.error('Error in simple chat response:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
  
  // Test LinkedIn detection
  try {
    console.log('\nTesting LinkedIn detection:');
    const linkedinResponse = await openaiClientModule.simpleChatResponse('Create a Playwright script to search for CTOs in Austin, TX on LinkedIn. Use human handoff mode for login.');
    console.log('Response type:', linkedinResponse.type);
    console.log('Contains script:', linkedinResponse.script ? 'YES' : 'NO');
    console.log('Response message:', linkedinResponse.message.substring(0, 100) + '...');
  } catch (error) {
    console.error('Error in LinkedIn response:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
  
  console.log('\nTest completed.');
}

// Run the test
testOpenAI().catch(err => {
  console.error('Fatal error:', err);
}); 