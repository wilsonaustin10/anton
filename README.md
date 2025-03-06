# Interactive Playwright Test Runner

This project provides an interactive web-based UI for Playwright tests with an embedded browser. It allows you to:

1. Write and parse Playwright test scripts
2. Run tests step-by-step with an embedded browser
3. Interact directly with the browser during test execution
4. Execute tests automatically or manually

## Features

- **Interactive Browser**: Test execution in an embedded browser within the UI
- **Step-by-Step Execution**: Run test steps one at a time or automatically
- **Manual Mode**: Directly interact with the browser during testing
- **Real-Time Output**: See test output in real time
- **Multiple Example Tests**: Pre-built examples to get started quickly

## Getting Started

### Prerequisites

- Node.js 14+ installed
- NPM 6+ installed

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

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Writing Tests

The test editor supports standard Playwright syntax. Write your test in the editor, then click "Parse Test" to extract the executable steps.

### Running Tests

1. **Parse Test**: Click the "Parse Test" button to analyze the test and extract steps
2. **Execute Test**: Run the entire test automatically
3. **Step-by-Step**: Use "Run Next Step" to execute one step at a time
4. **Run All Steps**: Execute all steps automatically (with option to stop)
5. **Reset**: Reset the test execution to start over

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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 