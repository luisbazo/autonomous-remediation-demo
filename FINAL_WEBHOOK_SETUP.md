# Final Webhook Configuration - Critical Steps

## 🚨 CRITICAL: Authentication Header Required

The Bob AI agent **requires** authentication for webhook requests. Without this header, you will receive **HTTP 401 Unauthorized**.

## ✅ Complete Webhook Configuration

### Step 1: Access Instana UI

1. Navigate to: https://ibm-saas.instana.io
2. Go to **Settings** → **Team Settings** → **Alert Channels**
3. Click **Add Alert Channel**
4. Select **Generic Webhook**

### Step 2: Configure Webhook (EXACT VALUES)

```
Name: Bob AI Agent Webhook
Webhook URL: https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
HTTP Method: POST
```

### Step 3: Add Custom Headers (CRITICAL)

Click **Add Custom Header** and configure:

```
Header Name: X-Webhook-Secret
Header Value: demo-webhook-secret-2026
```

**⚠️ WITHOUT THIS HEADER, THE WEBHOOK WILL FAIL WITH 401 UNAUTHORIZED**

### Step 4: Configure Request Body

Select **Custom Payload** and use:

```json
{
  "alertId": "${alert.id}",
  "alertName": "${alert.name}",
  "severity": "${alert.severity}",
  "status": "${alert.status}",
  "timestamp": "${alert.timestamp}",
  "application": "${alert.application.name}",
  "service": "${alert.service.name}",
  "message": "${alert.message}",
  "details": "${alert.details}"
}
```

### Step 5: Test the Webhook

Click **Test** button in Instana UI.

**Expected Result:**
- Status: HTTP 202 Accepted
- Response: `{"status":"accepted","message":"Alert received and queued for processing"}`

**If you get 401 Unauthorized:**
- Verify the custom header `X-Webhook-Secret` is present
- Verify the value is exactly: `demo-webhook-secret-2026`
- Check Bob agent logs: `oc logs -f deployment/bob-ai-agent -n demo-namespace`

## 🧪 Manual Testing (Optional)

Test the webhook from command line:

```bash
curl -X POST \
  https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: demo-webhook-secret-2026" \
  -d '{
    "alertId": "test-123",
    "alertName": "Memory Leak Test",
    "severity": "warning",
    "status": "open",
    "timestamp": 1234567890,
    "application": "quarkus-memory-leak-demo",
    "service": "memory-leak-service",
    "message": "High memory usage detected",
    "details": "Memory usage exceeded threshold"
  }'
```

**Expected Response:**
```json
{
  "status": "accepted",
  "message": "Alert received and queued for processing"
}
```

## 📋 Verification Checklist

- [ ] Webhook URL is correct
- [ ] HTTP Method is POST
- [ ] Custom header `X-Webhook-Secret` is added
- [ ] Header value is `demo-webhook-secret-2026`
- [ ] Custom payload is configured
- [ ] Test returns HTTP 202 Accepted
- [ ] Bob agent logs show "Alert received from Instana"

## 🔍 Troubleshooting

### HTTP 401 Unauthorized
**Cause:** Missing or incorrect `X-Webhook-Secret` header
**Solution:** Add the custom header with exact value `demo-webhook-secret-2026`

### HTTP 404 Not Found
**Cause:** Incorrect webhook URL
**Solution:** Verify URL matches exactly (including `/webhook/instana` path)

### HTTP 500 Internal Server Error
**Cause:** Bob agent is not running or has errors
**Solution:** Check agent status: `oc get pods -n demo-namespace | grep bob-ai-agent`

### No Response
**Cause:** Network connectivity issue or route not accessible
**Solution:** Test route: `curl https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/health`

## 📊 View Bob Agent Logs

```bash
# Real-time logs
oc logs -f deployment/bob-ai-agent -n demo-namespace

# Recent logs
oc logs deployment/bob-ai-agent -n demo-namespace --tail=50
```

**Successful webhook receipt shows:**
```
[INFO] Alert received from Instana: test-123
[INFO] Processing alert: Memory Leak Test
[INFO] Alert queued for processing
```

## 🎯 Next Steps After Webhook Configuration

1. **Create Alert Configuration** in Instana:
   - Go to Settings → Alerts
   - Create new alert for "High Memory Usage"
   - Set threshold: Memory > 80%
   - Assign to Bob AI Agent Webhook channel

2. **Trigger Demo**:
   ```bash
   ./scripts/trigger-demo.sh
   ```

3. **Monitor End-to-End Flow**:
   - Watch Instana for alert generation
   - Check Bob agent logs for alert processing
   - Verify GitHub commit is created
   - Monitor Tekton pipeline execution
   - Confirm ArgoCD deployment

## 📚 Related Documentation

- **Complete Setup Guide:** `docs/INSTANA_WEBHOOK_SETUP.md`
- **Fix Documentation:** `INSTANA_WEBHOOK_CONFIGURATION_FIXED.md`
- **Quick Reference:** `WEBHOOK_QUICK_REFERENCE.md`
- **API Investigation:** `INSTANA_API_INVESTIGATION_FINAL.md`

## ✅ Configuration Status

- ✅ Bob AI Agent: Running with webhook secret configured
- ✅ Kubernetes Secret: Updated with BOB_WEBHOOK_SECRET
- ✅ Webhook Endpoint: Ready at `/webhook/instana`
- ✅ Authentication: Configured with `X-Webhook-Secret` header
- 🔄 **Instana UI Configuration: Awaiting user to add custom header**

---

**Last Updated:** 2026-04-04
**Bob Agent Version:** 1.0.0
**Webhook Secret:** demo-webhook-secret-2026