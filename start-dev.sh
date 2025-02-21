#!/bin/bash
# start-dev.sh
# This script starts the Node, Python, and Frontend services in development mode.

# Load environment variables if .env file exists
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  source .env
fi

# Function to start a service in a new terminal process with logs
start_service() {
  local service_name=$1
  local service_dir=$2
  local install_cmd=$3
  local run_cmd=$4
  local log_file="${service_name}.log"

  echo "----------------------------"
  echo "Installing dependencies in ${service_dir}..."
  ( cd "${service_dir}" && ${install_cmd} )

  echo "Starting ${service_name}..."
  
  # Run the service in a separate process, pipe logs to a file and to terminal
  ( cd "${service_dir}" && ${run_cmd}  ) &
  
  echo $!  # Print the PID
}

# Start the Node service
start_service "Node-Service" "node-service" "npm install" "npm start"
NODE_PID=$!

# Start the Python service
start_service "Python-Service" "python-service" "pip install -r requirements.txt" "uvicorn main:app --reload --port 3002"
PYTHON_PID=$!

# Start the Frontend service
start_service "Frontend" "frontend" "npm install" "npm run dev"
FRONTEND_PID=$!

echo "----------------------------"
echo "Services are starting..."
echo "Node service PID: ${NODE_PID}"
echo "Python service PID: ${PYTHON_PID}"
echo "Frontend service PID: ${FRONTEND_PID}"
echo "Ensure your local MongoDB is running if you are not using Docker."

# Wait for all background processes to keep the script running
wait ${NODE_PID} ${PYTHON_PID} ${FRONTEND_PID}
