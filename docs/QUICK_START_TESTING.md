# Quick Start: Testing AI Vulnerability Analysis

**5-Minute Setup Guide** 🚀

---

## Prerequisites Check

```bash
# Check MongoDB
mongod --version

# Check RabbitMQ
rabbitmq-server --version

# Check Python
python3 --version  # Should be 3.11+

# Check Node.js
node --version  # Should be 18+
```

---

## Start Services (5 Terminals)

### Terminal 1: MongoDB
```bash
mongod --dbpath /usr/local/var/mongodb
# Or: brew services start mongodb-community
```

### Terminal 2: RabbitMQ
```bash
rabbitmq-server
# Or: brew services start rabbitmq
```

### Terminal 3: Python AI Service
```bash
cd /Users/sanjyot/projects/ai-dependency-management/python-service
source myenv/bin/activate
python run.py
```

Expected output:
```
✅ INFO: Uvicorn running on http://0.0.0.0:8000
```

### Terminal 4: Node.js Backend
```bash
cd /Users/sanjyot/projects/ai-dependency-management/node-service
npm run dev
```

Expected output:
```
✅ [INFO] RabbitMQ connection and queues initialized successfully
✅ [INFO] Server running on port 3001
```

### Terminal 5: Frontend
```bash
cd /Users/sanjyot/projects/ai-dependency-management/frontend
npm start
```

Expected output:
```
✅ webpack compiled successfully
```

---

## Quick Health Checks

```bash
# 1. Python Service Health
curl http://localhost:8000/health

# Expected: {"status":"healthy","service":"ai-vulnerability-analyzer"}

# 2. Backend API
curl http://localhost:3001/api/health

# 3. RabbitMQ Management
open http://localhost:15672
# Login: guest/guest
# Check: ai_vulnerability_analysis queue exists

# 4. Frontend
open http://localhost:3000
```

---

## Test the AI Feature

### Option 1: Via Frontend
1. Open http://localhost:3000
2. Login and select a repository
3. Click "Run Scan"
4. Wait for vulnerability scan to complete
5. Click on any vulnerability to view details
6. **Look for**: Blue "AI-Generated Summary" box

### Option 2: Via API
```bash
# 1. Trigger scan
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{"scanId": "YOUR_SCAN_ID"}'

# 2. Check RabbitMQ queue
open http://localhost:15672/#/queues/%2F/ai_vulnerability_analysis

# 3. Watch Python logs
# Terminal 3 should show:
# INFO: Received message for vulnerability: CVE-...
# INFO: Generating AI description...
# INFO: Successfully processed vulnerability

# 4. Check MongoDB for AI data
mongosh dependency-manager
db.scans.findOne(
  {"dependencies.vulnerabilities.aiGeneratedDescription": {$exists: true}},
  {"dependencies.vulnerabilities.$": 1}
)
```

---

## Expected AI Data in Frontend

When viewing a vulnerability, you should see:

```
┌─────────────────────────────────────────────┐
│ CVE-2024-12345                              │
│                                             │
│ CVSS: HIGH    |    AI: MEDIUM (85%)         │
│ ─────────────────────────────────────────── │
│                                             │
│ 🤖 AI-Generated Summary                     │
│ ┌───────────────────────────────────────┐   │
│ │ This vulnerability allows attackers   │   │
│ │ to execute code remotely. While the   │   │
│ │ CVSS score is high, a patch is        │   │
│ │ available and exploitation is low.    │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ 📊 AI Analysis Details ▼                    │
│   - Exploitability: Low                     │
│   - Patch Available: Yes                    │
│   - Package Criticality: Medium             │
│   - Age: 45 days                            │
│                                             │
│ Original Description                        │
│ Remote code execution vulnerability...      │
└─────────────────────────────────────────────┘
```

---

## Troubleshooting

### Python Service Won't Start
```bash
# Check dependencies
cd python-service
source myenv/bin/activate
pip install -r requirements.txt

# Check .env file
cat .env | grep OPENAI_API_KEY
```

### No AI Data Appearing
```bash
# 1. Check Python service is processing
tail -f python-service/logs/*.log

# 2. Check RabbitMQ queue has messages
curl -u guest:guest http://localhost:15672/api/queues/%2F/ai_vulnerability_analysis

# 3. Check MongoDB for AI fields
mongosh dependency-manager
db.scans.findOne({}, {"dependencies.vulnerabilities.aiGeneratedDescription": 1})
```

### Frontend Shows "AI analysis in progress..."
- **This is normal!** AI analysis is asynchronous
- Wait 5-10 seconds and refresh the page
- Check Python service logs for processing status

---

## Stop All Services

```bash
# Stop Python service
# Terminal 3: Ctrl+C

# Stop Node backend
# Terminal 4: Ctrl+C

# Stop Frontend
# Terminal 5: Ctrl+C

# Stop RabbitMQ
brew services stop rabbitmq
# Or Terminal 2: Ctrl+C

# Stop MongoDB
brew services stop mongodb-community
# Or Terminal 1: Ctrl+C
```

---

## Next Steps

Once basic testing works:
1. Read [PHASE4_TESTING_GUIDE.md](PHASE4_TESTING_GUIDE.md) for comprehensive tests
2. Check [PHASE3_TEST_RESULTS.md](PHASE3_TEST_RESULTS.md) for implementation details
3. Review [AI_IMPLEMENTATION_TASKS.md](AI_IMPLEMENTATION_TASKS.md) for complete feature overview

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Port 8000 in use | `lsof -ti:8000 \| xargs kill -9` |
| Port 3001 in use | `lsof -ti:3001 \| xargs kill -9` |
| MongoDB connection failed | Check MongoDB is running: `brew services list` |
| RabbitMQ connection failed | Check RabbitMQ is running: `rabbitmqctl status` |
| OpenAI API error | Verify API key in `python-service/.env` |
| No vulnerabilities found | Test with a repo that has known vulnerabilities |

---

**🎉 Happy Testing!**
