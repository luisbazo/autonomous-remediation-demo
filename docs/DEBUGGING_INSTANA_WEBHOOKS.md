# Debugging Instana Webhook Payloads

This guide explains how to debug the payloads being sent from Instana to the Bob AI agent.

## Overview

The Bob AI agent has been enhanced with comprehensive payload debugging capabilities that log:
- Complete HTTP headers
- Full request body/payload
- Payload structure and metadata
- Processing steps and errors

## Quick Start

### 1. Test with Sample Payload

Use the provided test script to send a sample Instana alert:

```bash
./scripts/test-webhook-payload.sh
```

This will:
- Send a properly formatted Instana alert payload
- Display the response from Bob AI agent
- Trigger detailed logging in the agent

### 2. View Debug Logs

The Bob AI agent logs detailed information in multiple places:

#### Console Output (Real-time)
Watch the terminal where `npm start` is running:
```bash
cd bob-agent && npm start
```

#### Log Files
```bash
# View all logs
tail -f bob-agent/bob-agent-combined.log

# View only errors
tail -f bob-agent/bob-agent-error.log

# Search for webhook debug sections
grep -A 20 "WEBHOOK REQUEST DEBUG START" bob-agent/bob-agent-combined.log
```

## Debug Output Format

When a webhook is received, you'll see output like this:

```
=== WEBHOOK REQUEST DEBUG START ===

Request Headers:
{
  "host": "localhost:3000",
  "user-agent": "curl/8.7.1",
  "content-type": "application/json",
  "x-webhook-secret": "change_this_secret",
  "content-length": "512"
}

Request Body (raw):
{
  "id": "test-alert-123",
  "severity": "critical",
  "type": "memory_leak",
  "title": "High Memory Usage Detected",
  "description": "Memory usage has exceeded threshold",
  "timestamp": 1775348282000,
  "application": {
    "name": "quarkus-app",
    "id": "app-123"
  },
  "metrics": [...],
  "metadata": {...}
}

Body Keys: ["id","severity","type","title","description","timestamp","application","metrics","metadata"]
Body Length: 402
Body Type: object

=== WEBHOOK REQUEST DEBUG END ===
```

## Common Issues and Solutions

### Issue 1: Empty Payload

**Symptoms:**
- `bodyKeys: []`
- `bodyLength: 2` (just `{}`)
- `bodyType: "object"` but no data

**Possible Causes:**
1. **Content-Type header missing or incorrect**
   - Instana must send `Content-Type: application/json`
   - Check the webhook configuration in Instana

2. **Payload not being sent**
   - Verify Instana webhook is configured correctly
   - Check Instana's webhook test feature

3. **Express middleware issue**
   - Ensure `express.json()` middleware is active
   - Check for middleware ordering issues

**Solution:**
```javascript
// Verify middleware is configured (already in index.ts)
app.use(express.json());
```

### Issue 2: Authentication Failures

**Symptoms:**
- `Invalid webhook secret received`
- HTTP 401 responses

**Solution:**
1. Check the webhook secret in Instana matches your `.env`:
   ```bash
   echo $BOB_WEBHOOK_SECRET
   ```

2. Verify the header name in Instana webhook config:
   - Header name: `x-webhook-secret`
   - Header value: Your secret from `.env`

### Issue 3: Payload Structure Mismatch

**Symptoms:**
- Payload received but fields are missing
- `alertId: undefined` in logs

**Solution:**
Compare the actual Instana payload structure with the expected interface in `instana-alert-handler.ts`:

```typescript
export interface InstanaAlert {
  id: string;
  severity: 'warning' | 'critical';
  type: string;
  title: string;
  description: string;
  timestamp: number;
  application?: {
    name: string;
    id: string;
  };
  metrics?: {
    name: string;
    value: number;
    threshold: number;
  }[];
  metadata?: Record<string, any>;
}
```

## Testing from Instana

### Configure Instana Webhook

1. **In Instana UI:**
   - Go to Settings → Alerts → Alert Channels
   - Create a new Generic Webhook channel
   - URL: `http://your-bob-agent-url:3000/webhook/instana`
   - Method: POST
   - Headers:
     - `Content-Type: application/json`
     - `x-webhook-secret: your_secret_here`

2. **Test the Webhook:**
   - Use Instana's "Test" button
   - Check Bob agent logs for the debug output

3. **Create an Alert:**
   - Configure an alert for memory usage
   - Set the webhook as the notification channel
   - Trigger the alert condition

## Debugging Checklist

When debugging webhook issues, check:

- [ ] Bob AI agent is running (`npm start`)
- [ ] Port 3000 is accessible
- [ ] Webhook secret matches between Instana and `.env`
- [ ] Content-Type header is `application/json`
- [ ] Instana can reach the Bob agent URL
- [ ] Firewall/network allows incoming connections
- [ ] Check both console output and log files
- [ ] Verify payload structure matches expected interface

## Advanced Debugging

### Enable Verbose Logging

Set the log level to debug in `.env`:
```bash
LOG_LEVEL=debug
```

### Capture Raw HTTP Traffic

Use `tcpdump` or `wireshark` to capture the actual HTTP traffic:

```bash
# Capture traffic on port 3000
sudo tcpdump -i any -s 0 -A 'tcp port 3000'
```

### Test with curl

Send a manual test request:

```bash
curl -X POST http://localhost:3000/webhook/instana \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: change_this_secret" \
  -d '{
    "id": "test-123",
    "severity": "critical",
    "type": "memory_leak",
    "title": "Test Alert",
    "description": "Test description",
    "timestamp": '$(date +%s000)'
  }'
```

### Inspect Instana Webhook Logs

In Instana UI:
1. Go to the webhook configuration
2. Check the "Recent Deliveries" or "Webhook History"
3. Look for:
   - HTTP status codes
   - Response times
   - Error messages

## Expected Payload from Instana

Instana typically sends payloads in this format:

```json
{
  "id": "alert-id-here",
  "severity": "critical",
  "type": "memory_leak",
  "title": "High Memory Usage",
  "description": "Memory usage exceeded threshold",
  "timestamp": 1775348282000,
  "application": {
    "name": "app-name",
    "id": "app-id"
  },
  "metrics": [
    {
      "name": "jvm.memory.heap.used",
      "value": 850,
      "threshold": 800
    }
  ],
  "metadata": {
    "namespace": "demo",
    "pod": "pod-name",
    "container": "container-name"
  }
}
```

## Getting Help

If you're still experiencing issues:

1. **Collect Debug Information:**
   ```bash
   # Get recent logs
   tail -100 bob-agent/bob-agent-combined.log > debug-logs.txt
   
   # Get agent status
   curl http://localhost:3000/status > agent-status.json
   ```

2. **Check the payload structure:**
   - Look for the "WEBHOOK REQUEST DEBUG" sections
   - Verify all expected fields are present
   - Check data types match the interface

3. **Verify network connectivity:**
   ```bash
   # From Instana server, test connectivity
   curl -v http://bob-agent-url:3000/health
   ```

## Summary

The enhanced debugging capabilities provide complete visibility into:
- ✅ What Instana is sending (headers + payload)
- ✅ How Bob AI agent is receiving it
- ✅ What processing steps are occurring
- ✅ Any errors that occur

Use the test script and log files to quickly identify and resolve webhook payload issues.
