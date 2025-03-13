#!/bin/bash

# AutonoM3 Agent Builder Launcher
# This script launches the AutonoM3 Agent Builder server from the project root

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script is already in the playwright-ui directory
PLAYWRIGHT_UI_DIR="$SCRIPT_DIR"

echo "AutonoM3 Agent Builder directory: $PLAYWRIGHT_UI_DIR"

# Change to the playwright-ui directory
cd "$PLAYWRIGHT_UI_DIR"

# Command functions
function start_server() {
  echo "Starting AutonoM3 Agent Builder server..."
  npm start
}

function stop_server() {
  echo "Stopping AutonoM3 Agent Builder server..."
  pkill -f "node.*server.js" || echo "No server process found"
}

function restart_server() {
  echo "Restarting AutonoM3 Agent Builder server..."
  stop_server
  sleep 2
  start_server
}

# Process command line argument
if [ $# -eq 0 ]; then
  # No arguments, default to start
  start_server
else
  case "$1" in
    start)
      start_server
      ;;
    stop)
      stop_server
      ;;
    restart)
      restart_server
      ;;
    *)
      echo "Usage: $0 [start|stop|restart]"
      exit 1
      ;;
  esac
fi 