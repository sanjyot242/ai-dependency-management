# Docker Deployment Guide - AI Vulnerability Analysis

**Quick guide to deploy the AI Dependency Management system using Docker**

---

## ✅ What's Been Updated

The `docker-compose.yaml` has been updated to include the Python AI service with all necessary configurations:

- ✅ Python AI service enabled (previously commented out)
- ✅ Correct port (8000 instead of 3002)
- ✅ OpenAI API key configuration
- ✅ RabbitMQ connection configured
- ✅ MongoDB connection configured
- ✅ All environment variables set

---

## 🚀 Quick Start with Docker

### 1. Prerequisites

Make sure you have:
- Docker installed and running
- Docker Compose installed
- OpenAI API key (already in `.env` file)

### 2. Build and Start All Services

```bash
# From project root
docker-compose up --build
```

This will start:
- **MongoDB** (port 27017)
- **RabbitMQ** (port 5672, management UI on 15672)
- **Python AI Service** (port 8000)
- **Node.js Backend** (port 3001)
- **React Frontend** (port 8080)

### 3. Verify Services Are Running

```bash
# Check all containers are running
docker-compose ps

# Should show:
# - python-ai-service (healthy)
# - node-service (healthy)
# - frontend (healthy)
# - db (healthy)
# - dependency-scanner-rabbitmq (healthy)
```

### 4. Access the Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **Python AI Service**: http://localhost:8000
- **RabbitMQ Management**: http://localhost:15672 (user/password)

---

## 🔍 Service Health Checks

### Python AI Service
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"ai-vulnerability-analyzer"}

curl http://localhost:8000/status
# Expected: JSON with rabbitmq_connected, mongodb_connected, etc.
```

### RabbitMQ Queue
```bash
# Open RabbitMQ Management UI
open http://localhost:15672

# Login: user / password
# Check: Queue 'ai_vulnerability_analysis' should exist
```

### MongoDB
```bash
# Connect to MongoDB container
docker exec -it db mongosh

# In MongoDB shell
use dependency-manager
db.scans.findOne()
```

---

## 📝 Environment Variables

All required environment variables are configured in `docker-compose.yaml`:

### Python AI Service
- `OPENAI_API_KEY` - Your OpenAI API key (from `.env`)
- `OPENAI_MODEL=gpt-4` - Model to use
- `RABBITMQ_URL=amqp://user:password@rabbitmq:5672` - RabbitMQ connection
- `MONGODB_URI=mongodb://db:27017/dependency-manager` - MongoDB connection
- `SERVICE_PORT=8000` - Service port

### Node.js Backend
- `RABBITMQ_URL=amqp://user:password@rabbitmq:5672` - RabbitMQ connection
- `MONGO_URL=mongodb://db:27017/dependencydb` - MongoDB connection
- GitHub OAuth credentials (from `.env`)

---

## 🧪 Testing the AI Feature with Docker

### 1. Run a Vulnerability Scan

```bash
# Via Frontend
# 1. Open http://localhost:8080
# 2. Login with GitHub
# 3. Select a repository
# 4. Click "Run Scan"

# Or via API
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{"scanId": "your-scan-id"}'
```

### 2. Monitor AI Processing

```bash
# Watch Python AI service logs
docker logs -f python-ai-service

# Expected output:
# INFO: Received message for vulnerability: CVE-...
# INFO: Generating AI description...
# INFO: Analyzing severity...
# INFO: Successfully processed vulnerability
```

### 3. Check RabbitMQ Queue

```bash
# Check queue stats
curl -u user:password http://localhost:15672/api/queues/%2F/ai_vulnerability_analysis

# Or use Management UI
open http://localhost:15672/#/queues/%2F/ai_vulnerability_analysis
```

### 4. Verify MongoDB Updates

```bash
# Connect to MongoDB
docker exec -it db mongosh dependency-manager

# Check for AI fields
db.scans.findOne(
  {"dependencies.vulnerabilities.aiGeneratedDescription": {$exists: true}},
  {"dependencies.vulnerabilities": 1}
)
```

---

## 🛠️ Common Docker Commands

### Start Services
```bash
# Start in background
docker-compose up -d

# Start with build
docker-compose up --build -d

# Start specific service
docker-compose up python-service
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f python-service
docker-compose logs -f node-service
docker-compose logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart python-service
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build python-service
```

---

## 🔧 Troubleshooting

### Python Service Won't Start

```bash
# Check logs
docker logs python-ai-service

# Common issues:
# 1. Missing OpenAI API key
#    - Check .env file has OPENAI_API_KEY
#    - Rebuild: docker-compose up --build python-service

# 2. Can't connect to RabbitMQ
#    - Check RabbitMQ is running: docker-compose ps
#    - Check connection string in docker-compose.yaml

# 3. Can't connect to MongoDB
#    - Check MongoDB is running: docker-compose ps
#    - Check connection string in docker-compose.yaml
```

### No AI Data Appearing

```bash
# 1. Check Python service is running
docker-compose ps python-service

# 2. Check Python service logs
docker logs -f python-ai-service

# 3. Check RabbitMQ queue has messages
curl -u user:password http://localhost:15672/api/queues/%2F/ai_vulnerability_analysis

# 4. Restart Python service
docker-compose restart python-service
```

### RabbitMQ Connection Failed

```bash
# Check RabbitMQ is running
docker-compose ps rabbitmq

# Check RabbitMQ logs
docker logs dependency-scanner-rabbitmq

# Restart RabbitMQ
docker-compose restart rabbitmq
```

### MongoDB Connection Failed

```bash
# Check MongoDB is running
docker-compose ps db

# Check MongoDB logs
docker logs db

# Restart MongoDB
docker-compose restart db
```

---

## 🔄 Update Deployment

If you make code changes:

```bash
# 1. Stop services
docker-compose down

# 2. Rebuild
docker-compose build

# 3. Start again
docker-compose up -d

# Or all in one:
docker-compose down && docker-compose up --build -d
```

---

## 📊 Monitor Performance

### Container Stats
```bash
# Real-time stats
docker stats

# Shows CPU, memory, network I/O for all containers
```

### Check Container Health
```bash
# List containers with status
docker-compose ps

# Inspect specific container
docker inspect python-ai-service
```

---

## 🌍 Environment-Specific Deployments

### Development
```bash
# Use default docker-compose.yaml
docker-compose up --build
```

### Production
```bash
# Create docker-compose.prod.yaml with:
# - Production MongoDB credentials
# - Production RabbitMQ credentials
# - Proper resource limits
# - Health checks
# - Logging configuration

docker-compose -f docker-compose.prod.yaml up -d
```

---

## 📦 What Each Container Does

| Container | Purpose | Port | Dependencies |
|-----------|---------|------|--------------|
| `db` | MongoDB database | 27017 | None |
| `rabbitmq` | Message queue | 5672, 15672 | None |
| `python-ai-service` | AI analysis with GPT-4 | 8000 | db, rabbitmq |
| `node-service` | Backend API | 3001 | db, rabbitmq |
| `frontend` | React UI | 8080 | node-service |

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Set production OpenAI API key in `.env`
- [ ] Set production MongoDB credentials
- [ ] Set production RabbitMQ credentials
- [ ] Configure resource limits in docker-compose
- [ ] Set up proper logging
- [ ] Configure health checks
- [ ] Set up monitoring/alerting
- [ ] Test with production-like data
- [ ] Review security settings
- [ ] Set up backup strategy for MongoDB

---

## 🎯 Quick Commands Reference

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f python-service

# Restart Python service
docker-compose restart python-service

# Stop everything
docker-compose down

# Rebuild and restart
docker-compose up --build -d

# Check health
curl http://localhost:8000/health

# View RabbitMQ
open http://localhost:15672
```

---

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Python Service README](../python-service/README.md)
- [Quick Start Testing Guide](docs/QUICK_START_TESTING.md)
- [Phase 4 Testing Guide](docs/PHASE4_TESTING_GUIDE.md)

---

**🎉 Your Docker deployment is ready! Run `docker-compose up --build` to start!**
