# POST Request Examples for Bob AI Agent

This document provides examples of POST requests that trigger the Bob AI Agent for automated remediation.

## Prerequisites

- Bob AI Agent running (default port: 3000)
- Webhook secret configured (default: `change_this_secret`)
- GitHub token configured
- Instana API token configured

## Endpoint URLs

### Main Webhook Endpoint
```
POST http://localhost:3000/webhook/instana
```

### Manual Trigger Endpoint
```
POST http://localhost:3000/trigger/analyze
```

### Health Check
```
GET http://localhost:3000/health
```

### Status Check
```
GET http://localhost:3000/status
```

---

## 1. Instana Alert Webhook (Primary Trigger)

This is the main endpoint that Instana webhooks should call when alerts are triggered.

### cURL Example

```bash
curl -X POST http://localhost:3000/webhook/instana \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: change_this_secret" \
  -d '{
    "id": "alert-12345",
    "severity": "critical",
    "type": "memory_leak",
    "title": "High Memory Usage Detected",
    "description": "JVM heap memory usage has exceeded 90% threshold for the past 10 minutes",
    "timestamp": 1712275200000,
    "application": {
      "name": "quarkus-memory-leak-app",
      "id": "app-67890"
    },
    "metrics": [
      {
        "name": "jvm.memory.heap.used",
        "value": 950000000,
        "threshold": 900000000
      }
    ],
    "metadata": {
      "namespace": "demo-namespace",
      "pod": "quarkus-memory-leak-app-7d8f9c5b6-xyz12",
      "container": "quarkus-memory-leak-app"
    }
  }'
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const alert = {
  id: 'alert-12345',
  severity: 'critical',
  type: 'memory_leak',
  title: 'High Memory Usage Detected',
  description: 'JVM heap memory usage has exceeded 90% threshold for the past 10 minutes',
  timestamp: Date.now(),
  application: {
    name: 'quarkus-memory-leak-app',
    id: 'app-67890'
  },
  metrics: [
    {
      name: 'jvm.memory.heap.used',
      value: 950000000,
      threshold: 900000000
    }
  ],
  metadata: {
    namespace: 'demo-namespace',
    pod: 'quarkus-memory-leak-app-7d8f9c5b6-xyz12',
    container: 'quarkus-memory-leak-app'
  }
};

axios.post('http://localhost:3000/webhook/instana', alert, {
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': 'change_this_secret'
  }
})
.then(response => {
  console.log('Alert accepted:', response.data);
})
.catch(error => {
  console.error('Error:', error.response?.data || error.message);
});
```

### Python Example

```python
import requests
import time

alert = {
    "id": "alert-12345",
    "severity": "critical",
    "type": "memory_leak",
    "title": "High Memory Usage Detected",
    "description": "JVM heap memory usage has exceeded 90% threshold for the past 10 minutes",
    "timestamp": int(time.time() * 1000),
    "application": {
        "name": "quarkus-memory-leak-app",
        "id": "app-67890"
    },
    "metrics": [
        {
            "name": "jvm.memory.heap.used",
            "value": 950000000,
            "threshold": 900000000
        }
    ],
    "metadata": {
        "namespace": "demo-namespace",
        "pod": "quarkus-memory-leak-app-7d8f9c5b6-xyz12",
        "container": "quarkus-memory-leak-app"
    }
}

headers = {
    "Content-Type": "application/json",
    "X-Webhook-Secret": "change_this_secret"
}

response = requests.post(
    "http://localhost:3000/webhook/instana",
    json=alert,
    headers=headers
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

### Expected Response

```json
{
  "status": "accepted",
  "message": "Alert received and processing started",
  "alertId": "alert-12345"
}
```

---

## 2. Manual Analysis Trigger

This endpoint allows you to manually trigger code analysis without an Instana alert.

### cURL Example

```bash
curl -X POST http://localhost:3000/trigger/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java",
    "repository": "autonomous-remediation-demo"
  }'
```

### JavaScript Example

```javascript
const axios = require('axios');

axios.post('http://localhost:3000/trigger/analyze', {
  filePath: 'quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java',
  repository: 'autonomous-remediation-demo'
})
.then(response => {
  console.log('Analysis completed:', response.data);
})
.catch(error => {
  console.error('Error:', error.response?.data || error.message);
});
```

### Expected Response

```json
{
  "status": "completed",
  "analysis": {
    "filePath": "quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java",
    "issues": [
      {
        "type": "memory_leak",
        "severity": "high",
        "line": 25,
        "message": "ArrayList grows unbounded without cleanup",
        "suggestion": "Implement cleanup mechanism or use bounded collection"
      }
    ]
  },
  "fix": {
    "filePath": "quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java",
    "fixedCode": "...",
    "explanation": "Added cleanup mechanism to prevent memory leak"
  }
}
```

---

## 3. Alert Payload Variations

### Warning Severity Alert

```json
{
  "id": "alert-67890",
  "severity": "warning",
  "type": "memory_usage_high",
  "title": "Memory Usage Above Normal",
  "description": "JVM heap memory usage is at 75%",
  "timestamp": 1712275200000,
  "application": {
    "name": "quarkus-memory-leak-app",
    "id": "app-67890"
  },
  "metrics": [
    {
      "name": "jvm.memory.heap.used",
      "value": 750000000,
      "threshold": 700000000
    }
  ]
}
```

### OOM (Out of Memory) Alert

```json
{
  "id": "alert-oom-001",
  "severity": "critical",
  "type": "out_of_memory",
  "title": "OutOfMemoryError Detected",
  "description": "Application crashed due to OutOfMemoryError: Java heap space",
  "timestamp": 1712275200000,
  "application": {
    "name": "quarkus-memory-leak-app",
    "id": "app-67890"
  },
  "metrics": [
    {
      "name": "jvm.memory.heap.used",
      "value": 1000000000,
      "threshold": 1000000000
    }
  ],
  "metadata": {
    "error": "java.lang.OutOfMemoryError: Java heap space",
    "stackTrace": "at com.ibm.demo.MemoryLeakResource.leak(...)"
  }
}
```

---

## 4. Testing with Postman

### Import Collection

Create a new Postman collection with these requests:

1. **Health Check**
   - Method: GET
   - URL: `http://localhost:3000/health`

2. **Status Check**
   - Method: GET
   - URL: `http://localhost:3000/status`

3. **Trigger Alert**
   - Method: POST
   - URL: `http://localhost:3000/webhook/instana`
   - Headers:
     - `Content-Type: application/json`
     - `X-Webhook-Secret: change_this_secret`
   - Body: (Use JSON from examples above)

4. **Manual Analysis**
   - Method: POST
   - URL: `http://localhost:3000/trigger/analyze`
   - Headers:
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "filePath": "quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java"
     }
     ```

---

## 5. What Happens After Triggering

When you send a POST request to trigger the Bob AI Agent:

1. **Alert Reception** (Immediate)
   - Agent validates webhook secret
   - Returns 202 Accepted response
   - Logs alert details

2. **Analysis Phase** (1-2 minutes)
   - Checks if alert is memory-related
   - Fetches additional context from Instana via MCP
   - Identifies affected files
   - Fetches source code from GitHub

3. **Code Analysis** (1-2 minutes)
   - Analyzes code for memory leaks
   - Identifies specific issues and line numbers
   - Generates detailed analysis report

4. **Fix Generation** (1-2 minutes)
   - Generates code fixes for identified issues
   - Creates explanations for each fix
   - Validates fix syntax

5. **GitHub Integration** (1-2 minutes)
   - Creates new branch: `fix/memory-leak-{alertId}-{timestamp}`
   - Commits fixed code
   - Creates Pull Request with detailed description

6. **Completion**
   - PR is ready for review
   - Logs contain full audit trail
   - Stats updated in `/status` endpoint

**Total Time:** ~5-10 minutes from alert to PR creation

---

## 6. Monitoring the Process

### Check Agent Status

```bash
curl http://localhost:3000/status
```

Response includes:
- Service uptime
- Connection status (Instana, GitHub, OpenShift)
- Processing statistics:
  - Total alerts received
  - Alerts processed
  - Fixes generated
  - Fixes committed
  - Errors encountered

### View Logs

```bash
# If running locally
tail -f bob-agent-combined.log

# If running in OpenShift
oc logs -f deployment/bob-agent -n demo-namespace
```

---

## 7. Troubleshooting

### 401 Unauthorized
- Check that `X-Webhook-Secret` header matches `BOB_WEBHOOK_SECRET` environment variable

### 400 Bad Request
- Verify JSON payload structure matches expected format
- Ensure required fields are present: `id`, `severity`, `type`, `title`, `description`, `timestamp`

### 500 Internal Server Error
- Check agent logs for detailed error messages
- Verify GitHub token has correct permissions
- Ensure Instana API token is valid
- Confirm network connectivity to external services

### Alert Not Processing
- Check if alert contains memory-related keywords (memory, heap, leak, oom, outofmemory)
- Verify GitHub repository configuration
- Check that target file exists in repository

---

## 8. Production Webhook URL

When deployed to OpenShift, use the route URL:

```bash
# Get the route URL
oc get route bob-agent -n demo-namespace -o jsonpath='{.spec.host}'

# Example production URL
https://bob-agent-demo-namespace.apps.your-cluster.com/webhook/instana
```

Configure this URL in Instana's webhook settings with the appropriate secret.

---

## Security Notes

1. **Always use HTTPS** in production
2. **Rotate webhook secrets** regularly
3. **Validate webhook signatures** (already implemented via X-Webhook-Secret header)
4. **Monitor for suspicious activity** in logs
5. **Limit GitHub token permissions** to only what's needed (repo read/write)
6. **Use secrets management** (OpenShift Secrets, Vault) for sensitive data

---

## Quick Test Script

Save this as `test-bob-agent.sh`:

```bash
#!/bin/bash

BOB_URL="${BOB_URL:-http://localhost:3000}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-change_this_secret}"

echo "Testing Bob AI Agent at $BOB_URL"
echo "================================"

# Health check
echo -e "\n1. Health Check:"
curl -s "$BOB_URL/health" | jq .

# Status check
echo -e "\n2. Status Check:"
curl -s "$BOB_URL/status" | jq .

# Trigger alert
echo -e "\n3. Triggering Memory Leak Alert:"
curl -X POST "$BOB_URL/webhook/instana" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "id": "test-alert-'$(date +%s)'",
    "severity": "critical",
    "type": "memory_leak",
    "title": "Test Memory Leak Alert",
    "description": "This is a test alert to trigger Bob AI Agent",
    "timestamp": '$(date +%s000)',
    "application": {
      "name": "quarkus-memory-leak-app",
      "id": "test-app"
    },
    "metrics": [{
      "name": "jvm.memory.heap.used",
      "value": 950000000,
      "threshold": 900000000
    }]
  }' | jq .

echo -e "\n================================"
echo "Check logs for processing details"
```

Make it executable and run:
```bash
chmod +x test-bob-agent.sh
./test-bob-agent.sh
```

---

## Made with Bob