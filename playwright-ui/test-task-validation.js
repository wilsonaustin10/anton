/**
 * Test script for task validation functionality
 */
const fs = require('fs');
const path = require('path');
const taskRepository = require('./src/computer-use/task-repository');

async function testTaskValidation() {
  console.log('Testing task validation functionality...');
  
  // 1. Initialize the repository
  await taskRepository.initialize();
  console.log('Task repository initialized');
  
  // 2. Create a sample validated task
  const sampleTask = {
    id: 'test-task-123',
    description: 'Navigate to investing.com and find GBP/USD historical data',
    actions: [
      { type: 'navigate', url: 'https://www.investing.com' },
      { type: 'navigate', url: 'https://www.investing.com/currencies/gbp-usd-historical-data' }
    ],
    url: 'https://www.investing.com/currencies/gbp-usd-historical-data',
    title: 'GBP/USD Historical Data - Investing.com'
  };
  
  // 3. Save the task
  console.log('Saving sample task...');
  await taskRepository.saveValidatedTask(sampleTask);
  
  // 4. Verify the task was saved
  const tasks = await taskRepository.getAllTasks();
  console.log(`Repository contains ${tasks.length} tasks`);
  
  // 5. Retrieve the saved task
  const savedTask = await taskRepository.getTaskById('test-task-123');
  if (savedTask) {
    console.log('Successfully retrieved saved task:');
    console.log(JSON.stringify(savedTask, null, 2));
  } else {
    console.error('Failed to retrieve saved task');
  }
  
  // 6. Search for similar tasks
  console.log('\nSearching for similar tasks...');
  
  const similarTasks1 = await taskRepository.findSimilarTasks('investing gbp usd historical');
  console.log(`Found ${similarTasks1.length} tasks matching 'investing gbp usd historical'`);
  
  const similarTasks2 = await taskRepository.findSimilarTasks('visit reddit');
  console.log(`Found ${similarTasks2.length} tasks matching 'visit reddit'`);
  
  // 7. Check data file
  const dataPath = path.join(__dirname, 'data', 'validated-tasks.json');
  if (fs.existsSync(dataPath)) {
    console.log(`\nData file exists at: ${dataPath}`);
    const fileSize = fs.statSync(dataPath).size;
    console.log(`File size: ${fileSize} bytes`);
  } else {
    console.error(`Data file not found at: ${dataPath}`);
  }
  
  console.log('\nTask validation test completed');
}

// Run the test
testTaskValidation().catch(error => {
  console.error('Error during task validation test:', error);
}); 