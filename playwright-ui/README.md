# AutonoM3 Agent Builder

This project provides an interactive web-based UI for creating Playwright-based automation agents with an embedded browser. It allows you to:

1. Write and parse Playwright automation scripts
2. Run agents step-by-step with an embedded browser
3. Interact directly with the browser during execution
4. Execute agents automatically or manually
5. Get AI-powered assistance via the chat interface

## Features

- **Interactive Browser**: Test execution in an embedded browser within the UI
- **Step-by-Step Execution**: Run test steps one at a time or automatically
- **Manual Mode**: Directly interact with the browser during testing
- **Real-Time Output**: See test output in real time
- **Multiple Example Tests**: Pre-built examples to get started quickly
- **AI-Powered Chat Assistant**: Get help with Playwright and automation via OpenAI integration
- **Server Management Tools**: Reliable server startup and management scripts

## Getting Started

### Prerequisites

- Node.js 14+ installed
- NPM 6+ installed
- OpenAI API key (for chat assistant functionality)

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd playwright-ui
```

2. Install dependencies:
```bash
npm install
```

3. Configure OpenAI API (for chat assistant):
```bash
# Create a .env file with your OpenAI API key
echo "OPENAI_API_KEY=your_api_key_here" > .env
echo "OPENAI_MODEL=gpt-3.5-turbo" >> .env
```

4. Start the server using the startup script:
```bash
./start-server.sh
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Server Management

This project includes several tools to make server management easier:

### Startup Scripts

- **start-server.sh**: Comprehensive startup script with error handling
- **launcher.sh**: Root-level launcher script that can be placed in the parent directory

### Documentation

- **SERVER_GUIDE.md**: Detailed guide for starting, stopping, and managing the server

### Backup and Repair

- **backup**: Creates a backup of the `index.html` file (`npm run backup`)
- **fix-index**: Repairs a corrupted `index.html` file (`npm run fix-index`)
- **test-openai**: Tests the OpenAI API connection (`npm run test-openai`)

## Usage

### Writing Agent Scripts

The test editor supports standard Playwright syntax. Write your script in the editor, then click "Create Agent" to extract the executable steps.

### Running Agents

1. **Create Agent**: Click the "Create Agent" button to analyze the script and extract steps
2. **Run Agent**: Run the entire agent script automatically
3. **Step-by-Step**: Use "Run Next Step" to execute one step at a time
4. **Run All Steps**: Execute all steps automatically (with option to stop)
5. **Reset**: Reset the execution to start over

### AI Chat Assistant

The chat assistant can help you with:
- Writing Playwright syntax
- Debugging automation scripts
- Understanding selectors and locators
- Generating script templates for websites

### Manual Mode

Toggle the "Manual Mode" button to interact directly with the embedded browser. This allows you to:

- Click on elements
- Enter text
- Navigate through the application manually

### URL Navigation

You can directly navigate to any URL in the embedded browser by entering it in the URL bar and clicking "Go".

## Example Tests

The UI includes several example tests:

1. **Basic Example**: Simple navigation and interaction with the Playwright website
2. **Screenshot Example**: Example demonstrating navigation and screenshots
3. **Form Filling Example**: Example showing form interaction with TodoMVC

## How It Works

1. The test script is parsed to extract steps (navigation, clicks, form filling)
2. The embedded browser receives commands through a messaging system
3. Each step is executed in the browser and results are reported back to the UI
4. The browser state persists between steps, allowing for continuous testing

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **Backend**: Node.js, Express
- **Testing**: Playwright
- **Communication**: Socket.io for real-time updates
- **Parsing**: Babel for JavaScript parsing
- **Proxy**: HTTP-Proxy-Middleware for CORS handling

## Important Configuration Notes

### Browser Initialization

The application uses a specific browser configuration that must be maintained for proper functionality:

```javascript
// CRITICAL: This configuration must not be changed without thorough testing
activeBrowser = await playwright.chromium.launch({
  headless: true, // Must be boolean true, not string 'new'
  args: [
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-features=BlockInsecurePrivateNetworkRequests',
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--window-size=1280,800'
  ]
});
```

**IMPORTANT:** 
1. The `headless` option must be a boolean value (`true`), not a string ('new').
2. Using string values like `headless: 'new'` will cause browser initialization errors in the current Playwright version.
3. Always test browser initialization thoroughly after upgrading Playwright or modifying this configuration.
4. The browser arguments are carefully selected to maximize compatibility with various websites.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 