#!/bin/bash
# start-dev.sh
# This script starts the Node, Python, and Frontend services in development mode.
# It first installs all necessary dependencies before launching each service.
#
# Usage:
#   chmod +x start-dev.sh
#   ./start-dev.sh
#
# Note: This script is for Unix-like environments (Linux, macOS, Git Bash/WSL on Windows).

# Optionally load environment variables from a .env file at the project root
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  source .env
fi

# Function to start a service: change to its directory, run the install command, then run the dev command in the background.
start_service() {
  local service_dir=$1
  local install_cmd=$2
  local run_cmd=$3

  echo "----------------------------"
  echo "Installing dependencies in ${service_dir}..."
  ( cd "${service_dir}" && ${install_cmd} )
  echo "Starting ${service_dir}..."
  ( cd "${service_dir}" && ${run_cmd} ) &
  echo $!  # Optionally print the process ID (PID)
}

# Start the Node service:
# It will install dependencies via "npm install" then run the dev script (assumed to be defined in package.json)
start_service "node-service" "npm install" "npm start"
NODE_PID=$!

# Start the Python service:
# It will install required packages using pip and then run the app with uvicorn.
start_service "python-service" "pip install -r requirements.txt" "uvicorn main:app --reload --port 3002"
PYTHON_PID=$!

# Start the Frontend service:
# It will install dependencies via "npm install" then run the dev server (e.g. using Vite or Create React App)
start_service "frontend" "npm install" "npm run dev"
FRONTEND_PID=$!

echo "----------------------------"
echo "Services are starting..."
echo "Node service PID: ${NODE_PID}"
echo "Python service PID: ${PYTHON_PID}"
echo "Frontend service PID: ${FRONTEND_PID}"
echo "Ensure your local MongoDB is running if you are not using Docker for it."

# Wait for all background processes to prevent the script from exiting
wait ${NODE_PID} ${PYTHON_PID} ${FRONTEND_PID}
