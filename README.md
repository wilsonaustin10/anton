# AutonoM3 - Automated Browser Task Agent

AutonoM3 is an intelligent automation platform that converts natural language instructions into executable Playwright scripts. It allows users to automate browser tasks like web scraping, form filling, and data extraction through a simple chat interface.

## Features

- **Natural Language Processing**: Convert plain English instructions into executable automation scripts
- **Visual Script Execution**: Watch browser automation in real-time
- **Script Management**: Save, edit, and reuse generated scripts
- **LinkedIn Automation**: Specialized handling for LinkedIn tasks with human handoff for login
- **OpenAI Integration**: Leverages OpenAI's models to generate accurate and robust Playwright code

## Project Structure

```
anton/
├── playwright-ui/              # Main application directory
│   ├── public/                 # Frontend assets and HTML
│   ├── src/                    # Source code
│   │   ├── agent-generator/    # Script generation logic
│   │   └── agent-storage/      # Script storage and management
│   ├── server.js               # Express server implementation
│   └── openai-client.js        # OpenAI API integration
├── LICENSE                     # MIT License
└── README.md                   # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- NPM or Yarn
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
npx playwright install
cd playwright-ui
```

2. Set up the environment:
```bash
cd playwright-ui
cp .env.example .env
```

3. Edit the `.env` file to add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Install dependencies:
```bash
npm install
```

5. Start the server:
```bash
./launcher.sh start
```

6. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Create an Agent**: Type a task in the chat interface (e.g., "Find CTOs in Austin, TX on LinkedIn")
2. **Run the Agent**: Click the "Run Agent" button to execute the generated script
3. **Watch the Automation**: The browser will automate the task in real-time
4. **Save Scripts**: Generated scripts are saved for future use

## Example Tasks

- "Search for MacBook Pro 16 on Amazon and collect the top 5 results"
- "Find CTOs in Austin, TX on LinkedIn"
- "Fill out the contact form on website X with my information"
- "Log into my Gmail account and find emails from a specific sender"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 