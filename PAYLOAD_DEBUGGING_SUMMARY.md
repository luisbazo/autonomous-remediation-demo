# Payload Debugging Summary

## ✅ Complete Setup

The Bob AI agent now has **comprehensive payload debugging** at multiple levels:

### 1. Webhook Endpoint Level ([`bob-agent/src/index.ts`](bob-agent/src/index.ts:83-108))
Logs received at the HTTP endpoint:
- Complete HTTP headers
- Raw request body
- Payload metadata (keys, length, type)

### 2. Alert Handler Level ([`bob-agent/src/handlers/instana-alert-handler.ts`](bob-agent/src/handlers/instana-alert-handler.ts:52-70))
Logs when processing the alert:
- **Console output with clear formatting**
- Full payload structure
- All nested objects and arrays

## 📊 What You'll See in Console

When an Instana alert is received, you'll see:

```
=== WEBHOOK REQUEST DEBUG START ===
Request Headers: { ... }
Request Body (raw): { ... }
=== WEBHOOK REQUEST DEBUG END ===

========================================
INSTANA ALERT - FULL PAYLOAD RECEIVED
========================================
{
  "id": "test-alert-123",
  "severity": "critical",
  "type": "memory_leak",
  "title": "High Memory Usage Detected",
  "description": "Memory usage has exceeded threshold in quarkus-app",
  "timestamp": 1775350940000,
  "application": {
    "name": "quarkus-app",
    "id": "app-123"
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
    "pod": "quarkus-app-pod",
    "container": "quarkus-app"
  }
}
========================================
```

## 🧪 Testing

### Quick Test
```bash
./scripts/test-webhook-payload.sh
```

### Manual Test
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

## 📝 Log Locations

### Console Output
- Real-time in the terminal where `npm start` is running
- Shows formatted payload with clear boundaries

### Log Files
```bash
# All logs
tail -f bob-agent/bob-agent-combined.log

# Errors only
tail -f bob-agent/bob-agent-error.log

# Search for payloads
grep -A 30 "INSTANA ALERT - FULL PAYLOAD" bob-agent/bob-agent-combined.log
```

## 🔍 Debugging Empty Payloads

If you see an empty payload:

```
Body Keys: []
Body Length: 2
Body Type: object
```

**Check:**
1. ✅ Instana webhook has `Content-Type: application/json` header
2. ✅ Instana is actually sending data (check Instana webhook logs)
3. ✅ Network connectivity between Instana and Bob agent
4. ✅ Bob agent is running and accessible

## 📚 Documentation

- **Quick Reference**: [`WEBHOOK_DEBUG_QUICK_REFERENCE.md`](WEBHOOK_DEBUG_QUICK_REFERENCE.md)
- **Complete Guide**: [`docs/DEBUGGING_INSTANA_WEBHOOKS.md`](docs/DEBUGGING_INSTANA_WEBHOOKS.md)
- **Test Script**: [`scripts/test-webhook-payload.sh`](scripts/test-webhook-payload.sh)

## 🎯 Key Features

✅ **Dual-level logging**: Both at webhook receipt and alert processing
✅ **Console formatting**: Clear visual boundaries for easy reading
✅ **Complete payload**: Every field, nested object, and array
✅ **Structured logs**: JSON format in log files for parsing
✅ **Test script**: Easy testing without Instana
✅ **Comprehensive docs**: Multiple levels of documentation

## 🚀 Next Steps

1. **Run the agent**: `cd bob-agent && npm start`
2. **Test it**: `./scripts/test-webhook-payload.sh`
3. **Watch console**: See the formatted payload output
4. **Configure Instana**: Point webhook to your Bob agent
5. **Trigger alert**: Create a real alert in Instana
6. **Debug**: Use the console output to verify payload structure

The payload debugging is now complete and ready to help you troubleshoot any issues with Instana webhook integration!