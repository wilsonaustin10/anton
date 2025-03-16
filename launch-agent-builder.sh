#!/bin/bash

# AutonoM3 Agent Builder Launcher
# This script launches the AutonoM3 Agent Builder server from the project root

PLAYWRIGHT_UI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/playwright-ui"

if [ ! -d "$PLAYWRIGHT_UI_DIR" ]; then
  echo "Error: playwright-ui directory not found!"
  echo "Expected location: $PLAYWRIGHT_UI_DIR"
  exit 1
fi

cd "$PLAYWRIGHT_UI_DIR"
echo "Launching AutonoM3 Agent Builder from: $PLAYWRIGHT_UI_DIR"

if [ -f "./start-server.sh" ]; then
  echo "Starting server with start-server.sh..."
  ./start-server.sh
else
  echo "start-server.sh not found, using fallback method..."
  npm start
fi 