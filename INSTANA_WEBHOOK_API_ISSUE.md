# Instana Webhook API Configuration Issue

## Problem Identified

When attempting to create an Instana webhook via API, the following error occurs:

```json
{
  "code": 500,
  "message": "There was an error processing your request. It has been logged (ID 39ddb9d2ba3d828a)."
}
```

## Root Cause

The API token being used (`i2Ca6eu8Rritkcp9LzInxQ`) likely lacks the necessary permissions to create alert channels programmatically.

### Required Permission
- **Configuration of Integrations** - Allows creating and managing alert channels

### Current Token Permissions
The token has read access (verified by successful GET requests) but appears to lack write permissions for alert channel configuration.

## API Attempts Made

### Attempt 1: Using webhookUrls
```bash
curl -X POST "https://integration-bobinstana.instana.io/api/events/settings/alertingChannels" \
  -H "Authorization: apiToken i2Ca6eu8Rritkcp9LzInxQ" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob AI Agent Webhook",
    "kind": "WEBHOOK",
    "webhookUrls": ["https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana"],
    "webhookHeaders": {
      "Content-Type": "application/json"
    }
  }'
```
**Result**: HTTP 500 Error

### Attempt 2: Using webhooks array
```bash
curl -X POST "https://integration-bobinstana.instana.io/api/events/settings/alertingChannels" \
  -H "Authorization: apiToken i2Ca6eu8Rritkcp9LzInxQ" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob AI Agent Webhook",
    "kind": "WEBHOOK",
    "webhooks": [
      {
        "url": "https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana",
        "httpHeaders": {
          "Content-Type": "application/json"
        }
      }
    ]
  }'
```
**Result**: HTTP 500 Error

## Solutions

### Solution 1: Update API Token Permissions (Recommended)

1. Log into Instana UI: https://integration-bobinstana.instana.io
2. Navigate to **Settings** → **Team Settings** → **API Tokens**
3. Find the token or create a new one
4. Ensure the following permissions are enabled:
   - ✅ **Configuration of Integrations** (required for alert channels)
   - ✅ **Configuration of applications**
   - ✅ **Read access**
5. Save the token
6. Retry the API call with the updated token

### Solution 2: Manual Configuration via UI (Current Workaround)

Since the API approach is blocked by permissions, configure the webhook manually:

1. Navigate to **Settings** → **Team Settings** → **Alert Channels**
2. Click **Add Alert Channel**
3. Select **Generic Webhook**
4. Configure:
   - **Name**: Bob AI Agent Webhook
   - **URL**: `https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana`
   - **Method**: POST
   - **Content-Type**: application/json
5. Test and save

**Time Required**: ~5 minutes

### Solution 3: Use Terraform/IaC (For Production)

For production deployments, use Infrastructure as Code:

```hcl
# terraform/instana_webhook.tf
resource "instana_alerting_channel_webhook" "bob_agent" {
  name = "Bob AI Agent Webhook"
  webhook_urls = [
    "https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana"
  ]
  headers = {
    "Content-Type" = "application/json"
  }
}
```

## Verification After Configuration

Once the webhook is configured (via any method), verify it works:

### 1. Test Webhook Endpoint
```bash
curl -X POST \
  https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -d '{
    "test": "webhook",
    "timestamp": '$(date +%s)'
  }'
```

Expected: HTTP 200 response

### 2. Check Bob Agent Logs
```bash
oc logs -n demo-namespace -l app=bob-ai-agent --tail=50
```

Expected output:
```
Webhook endpoint listening on port 3000
Received webhook: POST /webhook/instana
```

### 3. Verify in Instana UI
```bash
# List configured channels via API
curl -X GET "https://integration-bobinstana.instana.io/api/events/settings/alertingChannels" \
  -H "Authorization: apiToken i2Ca6eu8Rritkcp9LzInxQ"
```

Expected: JSON array containing the Bob AI Agent webhook

## Next Steps

1. **Choose a solution** (Manual UI configuration is fastest)
2. **Configure the webhook** following the chosen method
3. **Test the webhook** using the verification steps above
4. **Create an alert** that uses this webhook channel
5. **Trigger the demo** to test end-to-end flow

## Documentation References

- **Quick Setup**: See `WEBHOOK_QUICK_REFERENCE.md`
- **Detailed Guide**: See `docs/INSTANA_WEBHOOK_SETUP.md`
- **API Documentation**: https://www.ibm.com/docs/en/instana-observability/current?topic=apis-web-rest-api

## Conclusion

The API token permission issue prevents programmatic webhook creation. The recommended approach is to:
1. Configure the webhook manually via Instana UI (5 minutes)
2. Update API token permissions for future automation
3. Consider Terraform for production deployments

The webhook endpoint is ready and waiting at:
```
https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana