# Webhook Debugging Quick Reference

## 🚀 Quick Test

```bash
# Test the webhook with sample payload
./scripts/test-webhook-payload.sh
```

## 📋 View Logs

```bash
# Real-time logs (console)
cd bob-agent && npm start

# File logs
tail -f bob-agent/bob-agent-combined.log

# Search for webhook debug info
grep -A 20 "WEBHOOK REQUEST DEBUG START" bob-agent/bob-agent-combined.log
```

## 🔍 What to Look For

### ✅ Successful Webhook Receipt

```
=== WEBHOOK REQUEST DEBUG START ===
Request Headers: { ... "x-webhook-secret": "change_this_secret" ... }
Request Body (raw): { "id": "...", "severity": "...", ... }
Body Keys: ["id","severity","type","title","description",...]
Body Length: 402
Body Type: object
=== WEBHOOK REQUEST DEBUG END ===
```

### ❌ Empty Payload Problem

```
Body Keys: []
Body Length: 2
Body Type: object
```

**Fix:** Check Instana webhook configuration:
- Content-Type: `application/json`
- Method: POST
- Payload is being sent

### ❌ Authentication Problem

```
Invalid webhook secret received
```

**Fix:** Verify webhook secret matches:
```bash
# Check your secret
cat .env | grep BOB_WEBHOOK_SECRET

# Update Instana webhook header:
# x-webhook-secret: <your-secret-here>
```

## 🛠️ Manual Test with curl

```bash
curl -X POST http://localhost:3000/webhook/instana \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: change_this_secret" \
  -d '{
    "id": "test-123",
    "severity": "critical",
    "type": "memory_leak",
    "title": "Test Alert",
    "description": "Test",
    "timestamp": '$(date +%s000)'
  }'
```

## 📊 Check Agent Status

```bash
curl http://localhost:3000/status | jq '.'
```

## 🔧 Common Fixes

| Problem | Solution |
|---------|----------|
| Empty payload | Check Content-Type header in Instana |
| 401 Unauthorized | Verify webhook secret matches |
| Connection refused | Ensure Bob agent is running on port 3000 |
| Payload structure wrong | Compare with expected format in docs |

## 📖 Full Documentation

See [`docs/DEBUGGING_INSTANA_WEBHOOKS.md`](docs/DEBUGGING_INSTANA_WEBHOOKS.md) for complete guide.

## 🎯 Expected Instana Payload Format

```json
{
  "id": "alert-id",
  "severity": "critical",
  "type": "memory_leak",
  "title": "Alert Title",
  "description": "Alert Description",
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

## 🆘 Still Having Issues?

1. Collect logs: `tail -100 bob-agent/bob-agent-combined.log > debug.txt`
2. Check agent status: `curl http://localhost:3000/status`
3. Test with sample script: `./scripts/test-webhook-payload.sh`
4. Review full debugging guide in `docs/DEBUGGING_INSTANA_WEBHOOKS.md`