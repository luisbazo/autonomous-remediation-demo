#!/bin/bash

# Test script to send a sample Instana alert payload to Bob AI agent
# This helps debug what payload is being received

echo "Testing Bob AI Agent webhook with sample Instana alert payload..."
echo ""

# Bob agent webhook URL
WEBHOOK_URL="http://localhost:3000/webhook/instana"
WEBHOOK_SECRET="change_this_secret"

# Sample Instana alert payload (based on Instana webhook format)
PAYLOAD='{
  "id": "test-alert-123",
  "severity": "critical",
  "type": "memory_leak",
  "title": "High Memory Usage Detected",
  "description": "Memory usage has exceeded threshold in quarkus-app",
  "timestamp": '$(date +%s000)',
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
}'

echo "Sending payload to: $WEBHOOK_URL"
echo "Payload:"
echo "$PAYLOAD" | jq '.'
echo ""

# Send the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d "$PAYLOAD")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response Status: $HTTP_CODE"
echo "Response Body:"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "202" ]; then
  echo "✅ Webhook accepted successfully!"
  echo ""
  echo "Check the Bob agent logs for detailed payload debugging information."
  echo "Look for lines starting with '=== WEBHOOK REQUEST DEBUG START ==='"
else
  echo "❌ Webhook request failed with status $HTTP_CODE"
fi

echo ""
echo "To view Bob agent logs in real-time, check the terminal where npm start is running"
echo "Or check the log files:"
echo "  - bob-agent/bob-agent-combined.log"
echo "  - bob-agent/bob-agent-error.log"

# Made with Bob
