#!/bin/bash

# AutonoM3 Agent Builder Server Startup Script
# This script handles the startup process for the AutonoM3 Agent Builder server

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  AutonoM3 Agent Builder Server  ${NC}"
echo -e "${BLUE}=================================${NC}"

# Make sure we're in the right directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}Working directory: $(pwd)${NC}"

# Check if we have a package.json file
if [ ! -f "./package.json" ]; then
    echo -e "${RED}Error: package.json not found!${NC}"
    echo -e "${YELLOW}This script must be run from the playwright-ui directory.${NC}"
    exit 1
fi

# Check if the .env file exists
if [ ! -f "./.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo -e "${YELLOW}Creating a default .env file. Please update it with your OpenAI API key.${NC}"
    
    # Create a default .env file
    cat > "./.env" << EOF
# OpenAI API Configuration
# Replace with your actual API key
OPENAI_API_KEY=
# You can choose different models based on your OpenAI subscription
OPENAI_MODEL=gpt-3.5-turbo
EOF
    
    echo -e "${YELLOW}Default .env file created. Please edit it to add your API key.${NC}"
    exit 1
else
    # Check if the API key is set
    API_KEY=$(grep "OPENAI_API_KEY" .env | cut -d '=' -f2)
    if [ -z "$API_KEY" ]; then
        echo -e "${YELLOW}Warning: OPENAI_API_KEY is not set in .env${NC}"
        echo -e "${YELLOW}The chat assistant won't work without an API key.${NC}"
    else
        echo -e "${GREEN}OpenAI API key found in .env${NC}"
    fi
fi

# Check if port 3000 is already in use
PORT_PID=$(lsof -ti:3000)
if [ ! -z "$PORT_PID" ]; then
    echo -e "${YELLOW}Warning: Port 3000 is already in use by process $PORT_PID${NC}"
    echo -e "${YELLOW}Would you like to stop the running server? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Stopping existing server...${NC}"
        kill $PORT_PID
        sleep 2
        
        # Check if it was killed
        if lsof -ti:3000 > /dev/null; then
            echo -e "${RED}Failed to stop the server. Try manually with: kill -9 $PORT_PID${NC}"
            exit 1
        else
            echo -e "${GREEN}Successfully stopped existing server.${NC}"
        fi
    else
        echo -e "${YELLOW}Leaving existing server running. New server won't start.${NC}"
        exit 0
    fi
fi

# Check if dependencies are installed
if [ ! -d "./node_modules" ]; then
    echo -e "${YELLOW}Node modules not found. Installing dependencies...${NC}"
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error installing dependencies!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Dependencies installed successfully.${NC}"
else
    echo -e "${GREEN}Dependencies already installed.${NC}"
fi

# Create a backup of index.html
echo -e "${BLUE}Creating backup of index.html...${NC}"
npm run backup
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: Failed to create backup of index.html${NC}"
else
    echo -e "${GREEN}Backup created successfully.${NC}"
fi

# Check if index.html is valid
echo -e "${BLUE}Checking index.html integrity...${NC}"
if [ -f "./fix-index.js" ]; then
    node fix-index.js
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}Warning: There may be issues with index.html${NC}"
    else
        echo -e "${GREEN}index.html looks good.${NC}"
    fi
else
    echo -e "${YELLOW}Warning: fix-index.js not found, skipping index.html check.${NC}"
fi

# Start the server
echo -e "${BLUE}Starting the server...${NC}"
echo -e "${GREEN}The server will be available at: http://localhost:3000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server.${NC}"
echo

# Start with visible logs for better debugging
node server.js 