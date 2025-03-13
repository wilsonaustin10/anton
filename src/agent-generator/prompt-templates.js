/**
 * OpenAI prompt templates for generating Playwright scripts
 */

/**
 * Base system prompt that defines the AI's role and general guidelines
 */
const SYSTEM_PROMPT = `You are an AI assistant specialized in generating Playwright automation scripts.
Your goal is to convert user tasks into functional, robust Playwright scripts that can automate web interactions.

IMPORTANT: Your response MUST be structured in the following specific format:

===ACTION SEQUENCE===
[Provide a clear, step-by-step description of what the script will do in plain English. Make this understandable to non-technical users. Use bullet points or numbered steps.]

===PLAYWRIGHT SCRIPT===
[Generate the complete Playwright script code here, with no explanations or markdown formatting within this section]

Follow these guidelines for the script:
1. Generate complete, working code that includes error handling
2. Use reliable selectors that won't break easily
3. Include informative console logs explaining each step
4. Follow best practices for Playwright automation
5. Structure code in a clean, readable way
6. ONLY generate valid JavaScript code that works with Playwright
7. ASSUME PLAYWRIGHT IS ALREADY INSTALLED - do not include any npm install commands or installation instructions
8. The script must be ready to copy and paste without any markdown formatting or explanations mixed in

The ACTION SEQUENCE should explain the steps in plain language, while the PLAYWRIGHT SCRIPT should contain only valid code.`;

/**
 * Main prompt template for converting a task into a script
 * @param {string} task - The user's task description
 * @param {string} taskTitle - A short title derived from the task
 * @returns {string} - The formatted prompt
 */
function generateScriptPrompt(task, taskTitle) {
  return `
${SYSTEM_PROMPT}

TASK: ${task}

Create a comprehensive Playwright script that accomplishes this task efficiently. The script should include:

1. Proper initialization of Playwright browser
2. Navigation to the required website(s)
3. Handling of any dialogs, popups, or consent forms
4. Performing the necessary interactions (clicking, typing, etc.)
5. Extracting and processing any required data
6. Proper error handling and cleanup
7. Informative logging throughout the process

Remember to provide your response in the specified format with the ACTION SEQUENCE first, followed by the PLAYWRIGHT SCRIPT.

Here's an example of the expected output format:

===ACTION SEQUENCE===
1. Start a Chrome browser in non-headless mode
2. Navigate to example.com
3. Perform actions specific to the task
4. Extract any necessary data
5. Handle errors gracefully
6. Close the browser when done

===PLAYWRIGHT SCRIPT===
// The complete, ready-to-run Playwright script goes here
`;
}

/**
 * Specialized prompt for data extraction tasks
 * @param {string} task - The user's task description
 * @param {string} taskTitle - A short title derived from the task
 * @returns {string} - The formatted prompt
 */
function generateDataExtractionPrompt(task, taskTitle) {
  return `
${SYSTEM_PROMPT}

TASK: ${task}

Create a Playwright script to extract data from a website. The script should:
1. Navigate to the target website
2. Handle any cookie consent or popup dialogs
3. Locate and extract the requested data
4. Save the extracted data to a local file (JSON or CSV)
5. Include proper error handling and logging
6. ASSUME PLAYWRIGHT IS ALREADY INSTALLED - do not include any npm install commands

Remember to provide your response in the following format:

===ACTION SEQUENCE===
[Provide a detailed step-by-step description of what the script will do to extract the data]

===PLAYWRIGHT SCRIPT===
[Your complete Playwright script here]
`;
}

/**
 * Specialized prompt for financial data extraction tasks
 * @param {string} task - The user's task description
 * @param {string} taskTitle - A short title derived from the task
 * @returns {string} - The formatted prompt
 */
function generateFinancialDataPrompt(task, taskTitle) {
  return `
${SYSTEM_PROMPT}

TASK: ${task}

Create a Playwright script to extract financial data from a website (such as Investing.com, Yahoo Finance, etc.). The script should:
1. Navigate to the financial website
2. Handle cookie consent popups, subscription modals, and any other common interruptions
3. Locate and extract the requested financial data (prices, rates, historical data, etc.)
4. Format the data appropriately and save it to a local file (financial-data.json)
5. Include proper error handling with specific attention to website-specific issues
6. Add detailed logging throughout the process
7. ASSUME PLAYWRIGHT IS ALREADY INSTALLED - do not include any npm install commands

Remember to provide your response in the following format:

===ACTION SEQUENCE===
[Provide a clear, step-by-step description of how the script will extract the financial data, including specific interactions and data handling]

===PLAYWRIGHT SCRIPT===
[Your complete Playwright script goes here]
`;
}

/**
 * Example-based template for more complex tasks
 * @param {string} task - The user's task description
 * @param {string} taskTitle - A short title derived from the task
 * @returns {string} - The formatted prompt
 */
function generateExampleBasedPrompt(task, taskTitle) {
  return `
${SYSTEM_PROMPT}

TASK: ${task}

Create a Playwright script based on this example but customized for the specific task.
Remember to:
1. Adapt the example to accomplish the requested task
2. Modify all selectors and URLs to match the target website
3. Keep the robust error handling structure
4. Add detailed logging to track progress
5. ASSUME PLAYWRIGHT IS ALREADY INSTALLED - do not include any npm install commands

EXAMPLE OUTPUT FORMAT:

===ACTION SEQUENCE===
1. Start a Chrome browser in non-headless mode
2. Navigate to example.com
3. Accept any cookies or consent dialogs if present
4. Search for "example search" in the search input field
5. Wait for search results to load
6. Extract titles and descriptions from each search result
7. Output the collected data and close the browser

===PLAYWRIGHT SCRIPT===
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Starting automation task...');
    
    // Navigation
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    console.log('Navigated to website');
    
    // Handle common dialogs
    try {
      const acceptButton = page.locator('button:has-text("Accept"), .cookie-accept');
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        await acceptButton.click();
        console.log('Accepted cookies/terms');
      }
    } catch (dialogError) {
      console.log('No dialogs detected or failed to handle dialog:', dialogError.message);
    }
    
    // Interaction (customize this part for the specific task)
    await page.fill('#search-input', 'example search');
    await page.click('#search-button');
    console.log('Performed search');
    
    // Wait for results
    await page.waitForSelector('.results-container', { timeout: 10000 });
    console.log('Search results loaded');
    
    // Extract data (customize for the specific task)
    const results = await page.$$eval('.result-item', items => 
      items.map(item => ({
        title: item.querySelector('.title')?.textContent?.trim() || '',
        description: item.querySelector('.description')?.textContent?.trim() || ''
      }))
    );
    console.log(\`Extracted \${results.length} results\`);
    
    // Output or save results
    console.log('Results:', JSON.stringify(results, null, 2));
    
  } catch (error) {
    console.error('Error during automation:', error);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
})();

Now, please create your response for my specific task following this format exactly.`;
}

/**
 * Get the appropriate prompt template based on task analysis
 * @param {string} task - The user task
 * @param {object} options - Additional options
 * @returns {string} - The formatted prompt
 */
function getPromptForTask(task, options = {}) {
  const taskLower = task.toLowerCase();
  const taskTitle = options.taskTitle || generateTaskTitle(task);
  
  // Financial and investing tasks
  if ((taskLower.includes('investing.com') || 
      taskLower.includes('financial data') ||
      taskLower.includes('stock') ||
      taskLower.includes('forex') ||
      taskLower.includes('cryptocurrency') ||
      taskLower.includes('bitcoin') ||
      taskLower.includes('trading view')) &&
     (taskLower.includes('data') || 
      taskLower.includes('price') || 
      taskLower.includes('historical') || 
      taskLower.includes('chart'))) {
    return generateFinancialDataPrompt(task, taskTitle);
  }
  
  // Data extraction tasks
  if (taskLower.includes('extract') || 
      taskLower.includes('scrape') || 
      taskLower.includes('gather data') || 
      taskLower.includes('collect information')) {
    return generateDataExtractionPrompt(task, taskTitle);
  }
  
  // For complex tasks, include examples
  if (taskLower.includes('login') || 
      taskLower.includes('fill form') || 
      taskLower.includes('table') || 
      taskLower.length > 100) {
    return generateExampleBasedPrompt(task, taskTitle);
  }
  
  // Default prompt
  return generateScriptPrompt(task, taskTitle);
}

/**
 * Generate a concise title from the task description
 * @param {string} task - The original task
 * @returns {string} - A short title
 */
function generateTaskTitle(task) {
  // Extract key action words and subjects
  const words = task.split(/\s+/);
  
  // Remove filler words and keep only essential parts
  const keyWords = words.filter(word => 
    !['a', 'an', 'the', 'to', 'for', 'from', 'in', 'on', 'with', 'and', 'or', 'by', 'is', 'are', 'was', 'were'].includes(word.toLowerCase())
  );
  
  // Limit title to 5 words maximum
  const titleWords = keyWords.slice(0, 5);
  let title = titleWords.join(' ');
  
  // Ensure title is not too long
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  return title.charAt(0).toUpperCase() + title.slice(1);
}

module.exports = {
  SYSTEM_PROMPT,
  getPromptForTask,
  generateTaskTitle
}; 