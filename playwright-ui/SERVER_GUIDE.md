# AutonoM3 Agent Builder Server Guide

This document provides instructions for starting, stopping, and managing the AutonoM3 Agent Builder server.

## Directory Structure

The project has a specific directory structure:

```
/Users/austinwilson/AntonoM3/          # Project root
├── playwright-ui/                     # Main application directory (where the server runs)
│   ├── package.json                   # NPM configuration
│   ├── server.js                      # Server entry point 
│   ├── openai-client.js               # OpenAI integration
│   ├── public/                        # Static assets
│   │   ├── index.html                 # Main application HTML
│   │   └── ...
│   └── ...
└── try-playwright/                    # Reference project (not used for server)
```

## Starting the Server

### First Time Setup

1. Make sure you're in the correct directory:
   ```bash
   cd /Users/austinwilson/AntonoM3/playwright-ui
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Configure the OpenAI API key in the `.env` file:
   ```bash
   # Check if the .env file exists
   cat .env
   
   # If it doesn't exist or needs updating, edit it
   # Make sure OPENAI_API_KEY is set to a valid API key
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Verify the server is running by checking:
   - The terminal should show: "Server is running on http://localhost:3000"
   - Open http://localhost:3000 in your browser

### Starting After Updates

If you've made updates to the code:

1. Make sure you're in the correct directory:
   ```bash
   cd /Users/austinwilson/AntonoM3/playwright-ui
   ```

2. If you've updated dependencies, install them:
   ```bash
   npm install
   ```

3. Stop any running server instances (see "Stopping the Server" section)

4. Start the server:
   ```bash
   npm start
   ```

## Stopping the Server

To properly stop the server:

1. Find the server process:
   ```bash
   ps aux | grep node
   ```

2. Look for the process running `server.js` and note its Process ID (PID)

3. Kill the process:
   ```bash
   kill <PID>
   ```

   Alternatively, if you started the server in the foreground, you can press `Ctrl+C` in the terminal where it's running.

## Checking Server Status

To check if the server is running:

1. Check if port 3000 is in use:
   ```bash
   lsof -i :3000
   ```
   
   If the server is running, you'll see output showing the Node.js process.

2. Try accessing the server in your browser:
   - Open http://localhost:3000

3. Check the logs to see if the server is sending screenshot data:
   ```bash
   # This will show recent log lines that may indicate the server is running
   ps aux | grep node
   ```

## Troubleshooting

### "No such file or directory: package.json" Error

This error occurs when you try to run npm commands from the wrong directory.

**Solution**: 
```bash
cd /Users/austinwilson/AntonoM3/playwright-ui
npm start
```

### Already in Use Errors

If you see an error like "port 3000 is already in use":

1. Find the process using the port:
   ```bash
   lsof -i :3000
   ```

2. Kill the process:
   ```bash
   kill <PID>
   ```

3. Try starting the server again.

### OpenAI API Key Issues

If the chat assistant isn't working:

1. Check that your OpenAI API key is correctly set in the `.env` file:
   ```bash
   cat .env
   ```

2. Run the OpenAI test script to verify API connectivity:
   ```bash
   npm run test-openai
   ```

3. If there are issues, update the API key in the `.env` file and restart the server.

## Quick Reference

```bash
# Navigate to the correct directory
cd /Users/austinwilson/AntonoM3/playwright-ui

# Start the server
npm start

# Start with visible logs (better for debugging)
node server.js

# Check if server is running
lsof -i :3000

# Stop the server (replace <PID> with actual process ID)
kill <PID>

# Test OpenAI integration
npm run test-openai

# Create backup of index.html
npm run backup

# Fix index.html if corrupted
npm run fix-index
```

## After Making Code Changes

After you make code changes:

1. If you modified the `index.html` file:
   ```bash
   npm run backup   # Create a backup first
   ```

2. Restart the server:
   ```bash
   # First kill any running instances
   lsof -i :3000    # Find the PID
   kill <PID>       # Stop the server
   
   # Then start it again
   npm start
   ```

Remember that the server must be running from the `playwright-ui` directory, not from the project root. 