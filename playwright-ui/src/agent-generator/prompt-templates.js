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
9. For search boxes and forms on complex websites like Investing.com, Yahoo Finance, or similar financial sites, USE THE TYPE METHOD instead of FILL: \`await page.type('input#searchBox', 'search term')\` as this works better with dynamic sites that have advanced input handling.
10. When generating scripts for LinkedIn.com that require authentication, use the Human Handoff Mode by including a special step: \`{ type: 'linkedin-login' }\`. This will trigger a human interaction prompt allowing the user to manually log in.
11. For LinkedIn-specific scripts, ALWAYS include the human handoff mode to allow manual login - never skip this step
12. For LinkedIn search, sales prospecting, or connection-related tasks, ensure you provide detailed steps after login for navigating to the correct search interface

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
 * Example-based prompt with specific examples for different types of tasks
 * @param {string} task - The user's task description
 * @param {string} taskTitle - A short title derived from the task
 * @returns {string} - The formatted prompt
 */
function generateExampleBasedPrompt(task, taskTitle) {
  // Determine if this is a LinkedIn-related task
  const isLinkedInTask = task.toLowerCase().includes('linkedin');
  
  // Use specialized LinkedIn sales prospecting example if relevant
  const isLinkedInSalesTask = isLinkedInTask && (
    task.toLowerCase().includes('sales') ||
    task.toLowerCase().includes('prospect') ||
    task.toLowerCase().includes('lead') ||
    task.toLowerCase().includes('company') ||
    task.toLowerCase().includes('search for') ||
    task.toLowerCase().includes('find')
  );
  
  // LinkedIn sales prospecting example - SIMPLIFIED VERSION
  const linkedInSalesExample = `
===ACTION SEQUENCE===
1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Use Human Handoff Mode for login
4. Search for CTOs in Austin, TX
5. Extract the results
6. Close the browser

===PLAYWRIGHT SCRIPT===
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to LinkedIn
    console.log('Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/');
    
    // Human handoff for login
    console.log('Waiting for user to manually log in...');
    await page.evaluate(() => {
      return new Promise(resolve => {
        window.runStep({ type: 'linkedin-login' }).then(resolve);
      });
    });
    
    // Search for CTOs in Austin, TX
    console.log('Searching for CTOs in Austin, TX...');
    await page.goto('https://www.linkedin.com/search/results/people/');
    
    // Click filters
    await page.click('[data-control-name="all_filters"]');
    
    // Set job title
    await page.fill('[placeholder="Add a title"]', 'CTO');
    
    // Set location
    await page.fill('[placeholder="Add a location"]', 'Austin, Texas');
    
    // Apply filters
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
    console.error('Error occurred:', error);
  } finally {
    await browser.close();
  }
}

run();`;

  // Standard LinkedIn example
  const linkedInExample = `
===ACTION SEQUENCE===
1. Start a Chrome browser
2. Navigate to LinkedIn.com
3. Trigger human handoff mode for the user to manually log in
4. Wait for the user to complete login
5. Search for "software engineer" jobs
6. Extract job titles and companies
7. Close the browser

===PLAYWRIGHT SCRIPT===
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/');
    
    // Use Human Handoff Mode for LinkedIn login
    console.log('Waiting for user to manually log in...');
    // This special step type will prompt the user to log in manually
    // and pause the script until they confirm completion
    await page.evaluate(() => {
      return new Promise(resolve => {
        // This will be replaced by the server-side human handoff implementation
        window.runStep({ type: 'linkedin-login' }).then(resolve);
      });
    });
    console.log('User has completed login');
    
    // Now we can continue with the automation
    console.log('Searching for software engineer jobs...');
    await page.goto('https://www.linkedin.com/jobs/');
    await page.fill('input[aria-label="Search job titles or companies"]', 'software engineer');
    await page.press('input[aria-label="Search job titles or companies"]', 'Enter');
    
    // Wait for search results
    await page.waitForSelector('.jobs-search-results');
    
    // Extract job information
    const jobs = await page.$$eval('.job-card-container', (cards) => {
      return cards.map(card => {
        const title = card.querySelector('.job-card-list__title')?.textContent.trim() || 'No title';
        const company = card.querySelector('.job-card-container__company-name')?.textContent.trim() || 'No company';
        return { title, company };
      });
    });
    
    console.log('Found jobs:', jobs);
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

run();`;

  // Choose the appropriate example based on task
  const example = isLinkedInSalesTask ? linkedInSalesExample : isLinkedInTask ? linkedInExample : `
===ACTION SEQUENCE===
1. Start a Chrome browser
2. Navigate to example.com
3. Fill out a contact form
4. Submit the form
5. Extract and log the confirmation message
6. Close the browser

===PLAYWRIGHT SCRIPT===
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to example.com...');
    await page.goto('https://example.com/contact');
    
    console.log('Filling out the contact form...');
    await page.fill('#name', 'John Doe');
    await page.fill('#email', 'john.doe@example.com');
    await page.fill('#message', 'This is a test message sent via Playwright automation.');
    
    console.log('Submitting the form...');
    await page.click('#submit-button');
    
    console.log('Waiting for confirmation message...');
    const confirmationSelector = '.confirmation-message';
    await page.waitForSelector(confirmationSelector);
    
    const confirmationText = await page.textContent(confirmationSelector);
    console.log('Confirmation message:', confirmationText);
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

run();`;

  return `
${SYSTEM_PROMPT}

TASK: ${task}

Create a comprehensive Playwright script that accomplishes this task efficiently.

Here's an example of the expected output format for a similar task:

${example}

Now, create a script for the current task following the same format. The script should:

1. Be complete and ready to run
2. Include proper error handling
3. Use reliable selectors
4. Include logging
5. Follow the same structure as the example
6. ${isLinkedInTask ? 'Use the Human Handoff Mode for LinkedIn login instead of hardcoded credentials' : 'Handle authentication if needed'}
7. Implement all requirements from the task description

Remember to provide your response in the specified format with the ACTION SEQUENCE first, followed by the PLAYWRIGHT SCRIPT.`;
}

/**
 * Determines the best prompt to use based on the task
 * @param {string} task - The user's task description
 * @param {Object} options - Additional options
 * @returns {string} - The appropriate prompt
 */
function getPromptForTask(task, options = {}) {
  const taskTitle = generateTaskTitle(task);
  
  // Always use example-based prompt for LinkedIn tasks
  if (task.toLowerCase().includes('linkedin')) {
    // Enforce example-based prompt for LinkedIn
    options.useExampleBasedPrompt = true;
    // Use a more specialized system prompt for LinkedIn
    const linkedInPrompt = generateExampleBasedPrompt(task, taskTitle);
    console.log("Generating LinkedIn-specific script with human handoff mode");
    return linkedInPrompt;
  }
  
  // Determine task type
  const isDataExtractionTask = task.toLowerCase().includes('extract') || 
                               task.toLowerCase().includes('scrape') || 
                               task.toLowerCase().includes('collect data');
                               
  const isFinancialTask = task.toLowerCase().includes('stock') || 
                          task.toLowerCase().includes('finance') ||
                          task.toLowerCase().includes('investing.com') ||
                          task.toLowerCase().includes('yahoo finance');
  
  // Select appropriate prompt template based on task type
  if (isFinancialTask) {
    return generateFinancialDataPrompt(task, taskTitle);
  } else if (isDataExtractionTask) {
    return generateDataExtractionPrompt(task, taskTitle);
  } else if (options.useExampleBasedPrompt) {
    return generateExampleBasedPrompt(task, taskTitle);
  } else {
    return generateScriptPrompt(task, taskTitle);
  }
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