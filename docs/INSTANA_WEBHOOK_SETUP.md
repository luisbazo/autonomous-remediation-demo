# Instana Webhook Configuration Guide

## Overview
This guide provides step-by-step instructions for configuring the Instana webhook to send alerts to the Bob AI Agent for autonomous remediation.

## Prerequisites
- Instana SaaS instance access: https://integration-bobinstana.instana.io
- Bob AI Agent deployed and accessible
- Admin or appropriate permissions in Instana

## Bob AI Agent Webhook Endpoint

**Webhook URL**: `https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana`

**Method**: POST  
**Content-Type**: application/json  
**Authentication**: None (can be added via webhook secret if needed)

## Step-by-Step Configuration

### 1. Access Instana UI
1. Navigate to https://integration-bobinstana.instana.io
2. Log in with your credentials

### 2. Create Alert Channel
1. Go to **Settings** → **Team Settings** → **Alert Channels**
2. Click **Add Alert Channel**
3. Select **Generic Webhook** as the channel type

### 3. Configure Webhook Details
Fill in the following information:

**Channel Name**: `Bob AI Agent Webhook`

**Webhook URL**: 
```
https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
```

**HTTP Method**: POST

**Custom HTTP Headers** (optional):
```
Content-Type: application/json
X-Webhook-Source: Instana
```

**Webhook Secret** (optional):
```
demo-webhook-secret-2026
```

### 4. Test the Webhook
1. Click **Test Channel** button
2. Verify the test payload is received by Bob AI Agent
3. Check Bob AI Agent logs:
   ```bash
   oc logs -n demo-namespace -l app=bob-ai-agent --tail=50
   ```

### 5. Create Alert Configuration
1. Go to **Settings** → **Alerts**
2. Click **New Alert**
3. Configure alert for memory issues:

**Alert Name**: `Memory Leak Detection`

**Alert Type**: Built-in Event

**Condition**: 
- Metric: `memory.used`
- Operator: `>`
- Threshold: `80%` (or appropriate value)
- Duration: `5 minutes`

**Scope**: 
- Application: `quarkus-memory-leak-app`
- Or use tag filter: `app.name=quarkus-memory-leak-app`

**Alert Channels**: 
- Select `Bob AI Agent Webhook`

**Alert Severity**: `Warning` or `Critical`

### 6. Save and Activate
1. Review all settings
2. Click **Create Alert**
3. Ensure alert is **Active**

## Webhook Payload Format

The Bob AI Agent expects the following payload structure from Instana:

```json
{
  "alertId": "string",
  "alertName": "string",
  "severity": "WARNING|CRITICAL",
  "timestamp": 1234567890000,
  "application": {
    "name": "quarkus-memory-leak-app",
    "id": "string"
  },
  "issue": {
    "type": "memory_leak",
    "description": "string",
    "affectedService": "string"
  },
  "metrics": {
    "memory.used": 85.5,
    "memory.available": 14.5
  },
  "context": {
    "namespace": "demo-namespace",
    "pod": "quarkus-memory-leak-app-xxx",
    "container": "quarkus-memory-leak-app"
  }
}
```

## Verification Steps

### 1. Check Bob AI Agent is Running
```bash
oc get pods -n demo-namespace -l app=bob-ai-agent
```

Expected output:
```
NAME                           READY   STATUS    RESTARTS   AGE
bob-ai-agent-xxxxxxxxx-xxxxx   1/1     Running   0          XXm
```

### 2. Verify Route is Accessible
```bash
curl -X POST https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'
```

Expected response: HTTP 200 with acknowledgment

### 3. Monitor Bob AI Agent Logs
```bash
oc logs -n demo-namespace -l app=bob-ai-agent -f
```

Look for:
```
Webhook endpoint listening on port 3000
Received Instana alert: [alert details]
Processing alert...
```

### 4. Trigger Test Alert
Use the demo script to trigger a memory leak:
```bash
./scripts/trigger-demo.sh
```

Monitor for:
1. Memory usage increase in Instana
2. Alert triggered in Instana
3. Webhook received by Bob AI Agent
4. Code analysis initiated
5. Fix generated and committed to GitHub

## Troubleshooting

### Webhook Not Receiving Alerts

**Check 1: Network Connectivity**
```bash
# From within the cluster
oc run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -X POST https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
```

**Check 2: Bob AI Agent Logs**
```bash
oc logs -n demo-namespace -l app=bob-ai-agent --tail=100
```

**Check 3: Route Configuration**
```bash
oc get route bob-ai-agent -n demo-namespace -o yaml
```

**Check 4: Service Endpoints**
```bash
oc get endpoints bob-ai-agent -n demo-namespace
```

### Alert Not Triggering

**Check 1: Alert Configuration**
- Verify alert is active in Instana UI
- Check threshold values are appropriate
- Confirm scope/tags match the application

**Check 2: Application Metrics**
- Verify Instana is receiving metrics from the application
- Check agent status in Instana UI
- Confirm application is instrumented correctly

**Check 3: Memory Leak Trigger**
```bash
# Trigger memory leak manually
curl http://quarkus-memory-leak-app-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/api/memory/leak?size=100&count=1000
```

### Bob AI Agent Not Processing

**Check 1: Environment Variables**
```bash
oc get secret bob-secrets -n demo-namespace -o yaml
```

Verify all required secrets are present:
- GITHUB_TOKEN
- INSTANA_API_TOKEN
- OCP_TOKEN

**Check 2: GitHub Connectivity**
```bash
# Test from Bob AI Agent pod
oc exec -n demo-namespace deployment/bob-ai-agent -- \
  curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

**Check 3: Application Logs**
```bash
oc logs -n demo-namespace deployment/bob-ai-agent --tail=200
```

## Alternative: Manual Webhook Testing

If you want to test the webhook manually without waiting for a real alert:

```bash
curl -X POST https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "test-alert-001",
    "alertName": "Test Memory Leak Alert",
    "severity": "WARNING",
    "timestamp": '$(date +%s000)',
    "application": {
      "name": "quarkus-memory-leak-app",
      "id": "test-app-id"
    },
    "issue": {
      "type": "memory_leak",
      "description": "Memory usage exceeded threshold",
      "affectedService": "quarkus-memory-leak-app"
    },
    "metrics": {
      "memory.used": 85.5
    },
    "context": {
      "namespace": "demo-namespace",
      "pod": "quarkus-memory-leak-app-test",
      "container": "quarkus-memory-leak-app"
    }
  }'
```

## Security Considerations

### 1. Webhook Secret
Add a webhook secret for authentication:
- Configure in Instana webhook settings
- Update Bob AI Agent to validate the secret
- Store secret in Kubernetes Secret

### 2. TLS/SSL
- Webhook endpoint uses HTTPS (TLS edge termination)
- Certificate managed by OpenShift router
- No additional configuration needed

### 3. Network Policies
Consider adding NetworkPolicy to restrict access:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bob-ai-agent-ingress
  namespace: demo-namespace
spec:
  podSelector:
    matchLabels:
      app: bob-ai-agent
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 3000
```

## Next Steps

After webhook configuration:
1. ✅ Trigger memory leak using demo script
2. ✅ Verify alert is sent to Bob AI Agent
3. ✅ Confirm code analysis and fix generation
4. ✅ Check GitHub for automated commit
5. ✅ Validate GitOps deployment of fix

## Support

For issues or questions:
- Check Bob AI Agent logs: `oc logs -n demo-namespace -l app=bob-ai-agent`
- Review Instana alert history in UI
- Consult main README.md for architecture details
- See TROUBLESHOOTING.md for common issues

## References

- Instana Webhook Documentation: https://www.ibm.com/docs/en/instana-observability/current?topic=instana-webhooks
- Bob AI Agent Source: `bob-agent/src/index.ts`
- Alert Handler: `bob-agent/src/handlers/instana-alert-handler.ts`