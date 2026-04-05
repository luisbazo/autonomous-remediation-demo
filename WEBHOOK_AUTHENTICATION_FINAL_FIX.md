# Webhook Authentication - Final Fix Documentation

## 🎯 Issue Resolution Summary

**Problem:** Webhook returning HTTP 401 Unauthorized even with `X-Webhook-Secret` header

**Root Cause:** The `BOB_WEBHOOK_SECRET` environment variable was not configured in the deployment, even though it was added to the Kubernetes secret.

**Solution:** Added the environment variable directly to the deployment using `oc set env`

## ✅ Fix Applied

### Step 1: Added Environment Variable to Deployment

```bash
oc set env deployment/bob-ai-agent -n demo-namespace \
  BOB_WEBHOOK_SECRET=demo-webhook-secret-2026
```

**Result:** Deployment automatically rolled out new pod with the environment variable

### Step 2: Verified Pod Restart

```bash
oc get pods -n demo-namespace | grep bob-ai-agent
```

**Output:**
```
bob-ai-agent-87876454-vh8z9    1/1     Running      0          41s
```

### Step 3: Tested Webhook with Authentication

```bash
curl -X POST \
  https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: demo-webhook-secret-2026" \
  -d '{
    "alertId": "test-webhook-fixed-456",
    "alertName": "Test Webhook After Fix",
    "severity": "warning",
    "status": "open",
    "timestamp": 1712240677,
    "application": "quarkus-memory-leak-demo",
    "service": "memory-leak-service",
    "message": "Testing webhook after environment variable fix",
    "details": "Verifying BOB_WEBHOOK_SECRET is now properly configured"
  }'
```

**Response:**
```json
{
  "status": "accepted",
  "message": "Alert received and processing started"
}
```

**HTTP Status:** 202 Accepted ✅

### Step 4: Verified in Logs

```bash
oc logs deployment/bob-ai-agent -n demo-namespace --tail=10
```

**Output:**
```
[info] Bob AI Agent started on port 3000
[info] Received Instana alert webhook {"severity":"warning"}
[info] Processing Instana alert {"severity":"warning"}
[info] Alert is not a memory leak, skipping
```

## 🔍 Technical Analysis

### Why the Previous Fix Didn't Work

1. **Secret Update Only:** We added `BOB_WEBHOOK_SECRET` to the `bob-secrets` Kubernetes secret
2. **Missing Deployment Reference:** The deployment didn't have an environment variable referencing this secret key
3. **No Automatic Sync:** Kubernetes doesn't automatically add new secret keys to existing deployments

### The Complete Fix

The deployment needs BOTH:
1. ✅ Secret with the value: `bob-secrets` containing `BOB_WEBHOOK_SECRET`
2. ✅ Environment variable in deployment: `BOB_WEBHOOK_SECRET=demo-webhook-secret-2026`

## 📋 Verification Checklist

- [x] Environment variable added to deployment
- [x] Pod restarted with new configuration
- [x] Webhook test returns HTTP 202
- [x] Logs show "Received Instana alert webhook"
- [x] Logs show "Processing Instana alert"
- [x] No "Invalid webhook secret" warnings

## 🎓 Lessons Learned

### For Kubernetes Secrets and Deployments

1. **Adding to Secret ≠ Adding to Deployment**
   - Updating a secret doesn't automatically update deployments
   - Deployments need explicit environment variable definitions

2. **Two Ways to Reference Secrets**
   - **Direct value:** `BOB_WEBHOOK_SECRET=demo-webhook-secret-2026`
   - **From secret:** 
     ```yaml
     - name: BOB_WEBHOOK_SECRET
       valueFrom:
         secretKeyRef:
           name: bob-secrets
           key: BOB_WEBHOOK_SECRET
     ```

3. **Pod Restart Required**
   - Environment variable changes trigger automatic pod restart
   - Use `oc set env` for quick updates
   - Or edit deployment YAML for permanent changes

## 🚀 Current Status

### Webhook Endpoint
- **URL:** `https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana`
- **Status:** ✅ Operational
- **Authentication:** ✅ Working
- **Response:** HTTP 202 Accepted

### Bob AI Agent
- **Pod:** `bob-ai-agent-87876454-vh8z9`
- **Status:** Running (1/1)
- **Environment:** Production
- **Webhook Secret:** Configured

### Required Configuration for Instana

When configuring the webhook in Instana UI:

1. **Webhook URL:** 
   ```
   https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
   ```

2. **HTTP Method:** POST

3. **Content-Type:** application/json

4. **Custom Header (REQUIRED):**
   ```
   Name: X-Webhook-Secret
   Value: demo-webhook-secret-2026
   ```

5. **Custom Payload:**
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

## 🎯 Next Steps

1. **Configure Instana Webhook in UI**
   - Use the exact configuration above
   - Test webhook (should return HTTP 202)

2. **Create Memory Leak Alert**
   - Set threshold for memory usage
   - Assign to Bob AI Agent webhook channel

3. **Run End-to-End Demo**
   ```bash
   ./scripts/trigger-demo.sh
   ```

4. **Monitor Complete Workflow**
   - Instana detects memory leak
   - Alert sent to Bob agent
   - Bob analyzes code
   - Fix generated and committed to GitHub
   - Pipeline triggered
   - GitOps deploys fixed version

## 📚 Related Documentation

- **Quick Reference:** [WEBHOOK_QUICK_REFERENCE.md](WEBHOOK_QUICK_REFERENCE.md)
- **Complete Setup:** [FINAL_WEBHOOK_SETUP.md](FINAL_WEBHOOK_SETUP.md)
- **Project Status:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **Main README:** [README.md](README.md)

## 🏆 Success Metrics

- ✅ Webhook authentication working
- ✅ HTTP 202 responses
- ✅ Alerts being received and processed
- ✅ No authentication errors in logs
- ✅ Ready for end-to-end demonstration

---

**Issue Resolved:** 2026-04-04T15:11:32Z
**Fix Verified:** 2026-04-04T15:11:50Z
**Status:** ✅ COMPLETE - Webhook fully operational