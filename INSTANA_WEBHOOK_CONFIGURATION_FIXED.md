# Instana Webhook Configuration - CRITICAL FIX

## Issue Resolved: 401 Unauthorized Error

### Problem
When testing the Instana webhook, you received:
```
Failed to send message to Custom Webhook with status code: 401. Reason: Unauthorized
```

### Root Cause
The Bob AI Agent requires an **authentication header** that was missing from the webhook configuration.

## CORRECT Webhook Configuration

### Required Settings

**Webhook URL:**
```
https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
```

**HTTP Method:** POST

**Content-Type:** application/json

### CRITICAL: Required Custom Header

**Header Name:** `X-Webhook-Secret`  
**Header Value:** `demo-webhook-secret-2026`

## Step-by-Step Configuration in Instana UI

1. **Navigate to Alert Channels**
   - Go to: Settings → Team Settings → Alert Channels
   - Click: **Add Alert Channel**
   - Select: **Generic Webhook**

2. **Basic Configuration**
   - **Name**: `Bob AI Agent Webhook`
   - **Webhook URL**: `https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana`

3. **HTTP Configuration**
   - **Method**: POST
   - **Content-Type**: application/json

4. **Custom Headers** (CRITICAL STEP)
   - Click **Add Header** or **Custom Headers**
   - **Header Name**: `X-Webhook-Secret`
   - **Header Value**: `demo-webhook-secret-2026`

5. **Test the Webhook**
   - Click **Test Channel** button
   - Expected result: ✅ Success (HTTP 202 Accepted)

6. **Save**
   - Click **Save** or **Create**

## Verification

### Test with curl
```bash
curl -X POST \
  https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: demo-webhook-secret-2026" \
  -d '{
    "test": "webhook",
    "timestamp": '$(date +%s)'
  }'
```

**Expected Response:**
```json
{
  "status": "accepted",
  "message": "Alert received and processing started"
}
```

### Check Bob Agent Logs
```bash
oc logs -n demo-namespace -l app=bob-ai-agent --tail=50
```

**Expected Log Entry:**
```
Received Instana alert webhook
```

## What Was Fixed

1. ✅ **Added webhook secret to Kubernetes secret**
   ```bash
   oc patch secret bob-secrets -n demo-namespace \
     --type='json' \
     -p='[{"op": "add", "path": "/data/BOB_WEBHOOK_SECRET", "value": "ZGVtby13ZWJob29rLXNlY3JldC0yMDI2"}]'
   ```

2. ✅ **Restarted Bob AI Agent**
   ```bash
   oc rollout restart deployment/bob-ai-agent -n demo-namespace
   ```

3. ✅ **Bob Agent now validates the X-Webhook-Secret header**
   - Code location: `bob-agent/src/index.ts` lines 84-88
   - Returns 401 if header is missing or incorrect
   - Returns 202 if header is valid

## Security Note

The webhook secret (`demo-webhook-secret-2026`) provides basic authentication to ensure only authorized sources (Instana) can trigger the Bob AI Agent.

**For Production:**
- Use a strong, randomly generated secret
- Store in secure secret management system
- Rotate periodically
- Use HTTPS (already configured via OpenShift route)

## Troubleshooting

### Still Getting 401?

**Check 1: Header Name**
- Must be exactly: `X-Webhook-Secret` (case-sensitive)
- Not: `x-webhook-secret` or `X-WEBHOOK-SECRET`

**Check 2: Header Value**
- Must be exactly: `demo-webhook-secret-2026`
- No extra spaces or quotes

**Check 3: Bob Agent Logs**
```bash
oc logs -n demo-namespace -l app=bob-ai-agent --tail=100 | grep -i "webhook\|secret\|unauthorized"
```

### Getting Other Errors?

**Check Pod Status:**
```bash
oc get pods -n demo-namespace -l app=bob-ai-agent
```

**Check Secret:**
```bash
oc get secret bob-secrets -n demo-namespace -o jsonpath='{.data.BOB_WEBHOOK_SECRET}' | base64 -d
```

Expected output: `demo-webhook-secret-2026`

## Summary

The webhook configuration requires:
1. ✅ Correct URL
2. ✅ POST method
3. ✅ Content-Type: application/json
4. ✅ **X-Webhook-Secret: demo-webhook-secret-2026** (CRITICAL)

With these settings, the Instana webhook test should succeed with HTTP 202 Accepted.

## Next Steps

1. ✅ Configure webhook in Instana UI with the custom header
2. ✅ Test the webhook (should now succeed)
3. ✅ Create an alert that uses this webhook channel
4. ✅ Trigger the demo to test end-to-end flow

The Bob AI Agent is now properly configured and ready to receive Instana alerts!