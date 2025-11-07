# AI Vulnerability Analysis Service

Python microservice that uses OpenAI GPT-4 to analyze vulnerabilities and generate:
- User-friendly vulnerability descriptions
- AI-determined severity ratings with confidence scores
- Contextual risk analysis based on package metadata

## Architecture

This service:
1. **Consumes** messages from RabbitMQ queue `ai_vulnerability_analysis`
2. **Analyzes** vulnerabilities using OpenAI GPT-4
3. **Updates** MongoDB with AI-generated insights
4. **Exposes** health check and status endpoints via FastAPI

## Prerequisites

- Python 3.11+
- OpenAI API Key
- RabbitMQ running (default: `localhost:5672`)
- MongoDB running (default: `localhost:27017`)

## Setup

### 1. Install Dependencies

```bash
cd python-service

# Create virtual environment (macOS/Linux)
python3 -m venv venv
source venv/bin/activate

# Or use existing myenv (if compatible with your OS)
# Note: The existing myenv appears to be Windows-based
# You may need to recreate it on macOS:
# rm -rf myenv
# python3 -m venv myenv
# source myenv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Edit `.env` and set your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

### 3. Run the Service

```bash
python run.py
```

The service will start on `http://localhost:8000`

## API Endpoints

### Health Check
```bash
GET /health
```

Returns service health including RabbitMQ, MongoDB, and OpenAI configuration status.

**Example Response:**
```json
{
  "status": "healthy",
  "service": "ai-vulnerability-analysis",
  "version": "1.0.0",
  "rabbitmq": "connected",
  "mongodb": "connected",
  "openai": "configured"
}
```

### Status
```bash
GET /status
```

Returns detailed service status including queue statistics.

**Example Response:**
```json
{
  "service": "ai-vulnerability-analysis",
  "version": "1.0.0",
  "worker_running": true,
  "worker_thread_alive": true,
  "configuration": {
    "queue_name": "ai_vulnerability_analysis",
    "openai_model": "gpt-4",
    "openai_temperature": 0.3,
    "max_retries": 3,
    "mongodb_database": "dependency-manager"
  },
  "queue_stats": {
    "message_count": 5,
    "consumer_count": 1
  }
}
```

### Manual Analysis (Testing)
```bash
POST /analyze
Content-Type: application/json

{
  "scanId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439012",
  "packageName": "lodash",
  "vulnerabilityId": "GHSA-xxxx-xxxx-xxxx",
  "osvData": {
    "id": "GHSA-xxxx-xxxx-xxxx",
    "description": "Prototype pollution vulnerability...",
    "severity": [{"type": "CVSS_V3", "score": "7.5"}],
    "references": ["https://..."],
    "fixedIn": "4.17.21"
  },
  "packageContext": {
    "currentVersion": "4.17.20",
    "latestVersion": "4.17.21",
    "dependencyType": "dependencies",
    "ecosystem": "npm"
  }
}
```

## Docker Deployment

### Build Image

```bash
docker build -t ai-vulnerability-service .
```

### Run Container

```bash
docker run -d \
  --name ai-service \
  -p 8000:8000 \
  -e OPENAI_API_KEY=sk-your-key \
  -e RABBITMQ_URL=amqp://rabbitmq:5672 \
  -e MONGODB_URI=mongodb://mongo:27017/dependency-manager \
  ai-vulnerability-service
```

### Using Docker Compose

Add to your project's `docker-compose.yml`:

```yaml
services:
  python-ai-service:
    build: ./python-service
    container_name: python-ai-service
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - RABBITMQ_URL=amqp://rabbitmq:5672
      - MONGODB_URI=mongodb://mongodb:27017/dependency-manager
      - AI_ANALYSIS_ENABLED=true
    depends_on:
      - mongodb
      - rabbitmq
    restart: unless-stopped
```

## How It Works

### Message Flow

1. **Node.js service** publishes vulnerability data to `ai_vulnerability_analysis` queue
2. **Python AI Worker** consumes message from queue
3. **AI Analyzer** calls OpenAI GPT-4 with specialized prompts:
   - Description prompt: Generates user-friendly explanation
   - Severity prompt: Analyzes risk factors and determines severity
4. **MongoDB Client** updates vulnerability with AI results
5. **Message acknowledged** and removed from queue

### AI Analysis Components

**Description Generation:**
- Explains vulnerability in simple terms
- Highlights impact and risks
- Mentions fix availability
- 2-3 sentences, no technical jargon

**Severity Analysis:**
- CVSS Score (30% weight)
- Exploitability (25% weight)
- Package Context (20% weight)
- Patch Availability (15% weight)
- Vulnerability Age (10% weight)
- Returns: severity level, confidence score, reasoning

### Error Handling

- **OpenAI API failures**: Retries with exponential backoff (3 attempts)
- **Message processing errors**: Requeues message for retry
- **Malformed messages**: Rejects without requeue
- **Database errors**: Logs error but doesn't crash worker

## Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | **Required** OpenAI API key |
| `OPENAI_MODEL` | `gpt-4` | OpenAI model to use |
| `OPENAI_TEMPERATURE` | `0.3` | Sampling temperature (0-1) |
| `OPENAI_MAX_TOKENS` | `500` | Max tokens per response |
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection URL |
| `AI_QUEUE_NAME` | `ai_vulnerability_analysis` | Queue name |
| `MONGODB_URI` | `mongodb://localhost:27017/dependency-manager` | MongoDB connection |
| `LOG_LEVEL` | `INFO` | Logging level |
| `SERVICE_PORT` | `8000` | FastAPI server port |

## Monitoring

### Logs

```bash
# View logs
python run.py

# Output:
# 2025-10-21 12:00:00 - INFO - Starting AI Vulnerability Analysis Service...
# 2025-10-21 12:00:01 - INFO - RabbitMQ consumer thread started
# 2025-10-21 12:00:05 - INFO - Processing AI job: scan=..., package=lodash, vuln=GHSA-...
```

### Health Checks

```bash
# Health check
curl http://localhost:8000/health

# Queue status
curl http://localhost:8000/status
```

## Troubleshooting

### OpenAI API Key Not Set
```
ERROR: OPENAI_API_KEY not configured!
```
**Solution**: Set `OPENAI_API_KEY` in `.env` file

### RabbitMQ Connection Failed
```
Failed to connect to RabbitMQ: [Errno 61] Connection refused
```
**Solution**: Ensure RabbitMQ is running on port 5672

### MongoDB Connection Failed
```
Failed to connect to MongoDB: [Errno 61] Connection refused
```
**Solution**: Ensure MongoDB is running on port 27017

### Virtual Environment Issues (Windows venv on macOS)
The existing `myenv` directory contains Windows executables. On macOS:
```bash
rm -rf myenv
python3 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
```

## Development

### Project Structure

```
python-service/
├── src/
│   ├── __init__.py           # Package initialization
│   ├── config.py             # Configuration management
│   ├── prompts.py            # AI prompt templates
│   ├── ai_service.py         # OpenAI integration
│   ├── database.py           # MongoDB client
│   ├── queue_consumer.py     # RabbitMQ worker
│   └── main.py               # FastAPI application
├── run.py                    # Entry point
├── requirements.txt          # Dependencies
├── Dockerfile                # Container image
├── .env                      # Environment config (not in git)
├── .env.example              # Environment template
└── README.md                 # This file
```

### Running Tests

Manual testing via `/analyze` endpoint:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

## Cost Optimization

### OpenAI API Usage
- Typical vulnerability: ~500-700 tokens total (prompt + response)
- GPT-4 cost (as of 2025): ~$0.03 per vulnerability
- 100 vulnerabilities ≈ $3.00
- 1000 vulnerabilities ≈ $30.00

### Recommendations
- Use GPT-4 Turbo for lower costs
- Adjust `OPENAI_MAX_TOKENS` to reduce response size
- Cache results in MongoDB (already implemented)
- Consider batching similar vulnerabilities

## License

Part of AI Dependency Management System
