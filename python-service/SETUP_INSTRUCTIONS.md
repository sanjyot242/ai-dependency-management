# Python AI Service - Setup Instructions

## Quick Start Guide

### 1. Fix Virtual Environment (macOS)

Your existing `myenv` contains Windows executables. Recreate it for macOS:

```bash
cd python-service

# Remove old venv
rm -rf myenv

# Create new venv for macOS
python3 -m venv myenv

# Activate it
source myenv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure OpenAI API Key

Edit `.env` file and add your OpenAI API key:

```bash
# Open .env in your editor
nano .env

# Update this line:
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 3. Start the Service

Make sure MongoDB and RabbitMQ are running, then:

```bash
# With venv activated:
python run.py
```

Or run directly:

```bash
myenv/bin/python run.py
```

### 4. Verify Service is Running

```bash
# Health check
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","service":"ai-vulnerability-analysis",...}
```

## Testing the Complete Flow

### 1. Start All Services

```bash
# Terminal 1: MongoDB (if not running)
mongod

# Terminal 2: RabbitMQ (if not running)
rabbitmq-server

# Terminal 3: Node.js backend
cd node-service
npm start

# Terminal 4: Python AI service
cd python-service
source myenv/bin/activate
python run.py
```

### 2. Trigger a Vulnerability Scan

Use your frontend or API to trigger a scan. The flow will be:

1. Node.js performs vulnerability scan
2. Publishes AI jobs to RabbitMQ
3. Python service processes jobs
4. Updates MongoDB with AI results

### 3. Monitor the Logs

Watch Python service logs for:
```
Processing AI job: scan=..., package=lodash, vuln=GHSA-...
Generating description for vulnerability GHSA-...
Analyzing severity for vulnerability GHSA-...
Successfully updated AI analysis for scan=...
```

## Docker Alternative

If you prefer Docker:

```bash
# Build image
docker build -t ai-service .

# Run container
docker run -d \
  --name ai-service \
  -p 8000:8000 \
  -e OPENAI_API_KEY=sk-your-key \
  -e RABBITMQ_URL=amqp://host.docker.internal:5672 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/dependency-manager \
  ai-service
```

## Troubleshooting

### "OPENAI_API_KEY not configured"
- Edit `.env` and set your actual OpenAI API key
- Make sure `.env` file exists in `python-service/` directory

### "Failed to connect to RabbitMQ"
- Start RabbitMQ: `rabbitmq-server`
- Check it's running on port 5672: `lsof -i :5672`

### "Failed to connect to MongoDB"
- Start MongoDB: `mongod`
- Check it's running on port 27017: `lsof -i :27017`

### Virtual Environment Issues
- Make sure you're using macOS/Linux compatible venv
- Recreate with: `rm -rf myenv && python3 -m venv myenv`

## Next Steps

Once the Python service is running:

1. ✅ Phase 1 (Node.js Backend) - COMPLETE
2. ✅ Phase 2 (Python AI Service) - COMPLETE
3. ⏭️ Phase 3 (Frontend Integration) - Ready to start
4. ⏭️ Phase 4 (Testing & Deployment) - After Phase 3

See `../docs/AI_IMPLEMENTATION_TASKS.md` for full roadmap.
