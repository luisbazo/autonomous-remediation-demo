# Instana Alert Configuration Guide

This guide explains how to configure Instana alerts to trigger the autonomous remediation workflow.

## Prerequisites

- Access to Instana SaaS instance: https://integration-bobinstana.instana.io
- Bob AI Agent deployed and accessible
- Instana API token configured

## Bob AI Agent Webhook URL

```
https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
```

## Step 1: Access Instana UI

1. Navigate to https://integration-bobinstana.instana.io
2. Log in with your credentials
3. Go to **Settings** → **Alerts**

## Step 2: Create Alert Channel

1. Click **Add Alert Channel**
2. Select **Generic Webhook**
3. Configure the webhook:
   - **Name**: `Bob AI Agent Remediation`
   - **Webhook URL**: `https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana`
   - **Method**: `POST`
   - **Headers**:
     ```
     Content-Type: application/json
     ```

## Step 3: Create Memory Leak Alert

### Alert Configuration

1. Click **Create Alert** → **Built-in Events**
2. Select **Application Perspective**
3. Configure alert:

**Basic Settings:**
- **Name**: `Memory Leak Detection - Quarkus App`
- **Description**: `Detects memory leaks in the Quarkus memory leak demo application`
- **Severity**: `Warning`

**Scope:**
- **Application**: `quarkus-memory-leak-app`
- **Service**: `quarkus-memory-leak-app`

**Conditions:**
Select one or more of the following conditions:

#### Condition 1: High Memory Usage
- **Metric**: `Memory Usage`
- **Operator**: `>`
- **Threshold**: `80%`
- **Time Window**: `5 minutes`

#### Condition 2: Memory Growth Rate
- **Metric**: `Memory Growth Rate`
- **Operator**: `>`
- **Threshold**: `10 MB/min`
- **Time Window**: `5 minutes`

#### Condition 3: Garbage Collection Activity
- **Metric**: `GC Time Percentage`
- **Operator**: `>`
- **Threshold**: `30%`
- **Time Window**: `5 minutes`

**Alert Channels:**
- Select: `Bob AI Agent Remediation`

**Throttling:**
- **Throttle Period**: `15 minutes`
- **Max Alerts**: `3 per hour`

## Step 4: Create Custom Event (Alternative)

If built-in events don't meet your needs, create a custom event:

1. Go to **Settings** → **Events**
2. Click **New Event**
3. Configure:

```json
{
  "name": "Memory Leak Pattern",
  "entityType": "application",
  "query": "entity.application.name:quarkus-memory-leak-app",
  "description": "Detects memory leak patterns",
  "enabled": true,
  "triggering": true,
  "severity": 5,
  "conditions": [
    {
      "metric": "memory.used",
      "aggregation": "sum",
      "operator": ">",
      "value": 400000000,
      "timeWindow": 300000
    }
  ]
}
```

## Step 5: Test Alert Configuration

### Manual Test via Instana UI

1. Go to **Settings** → **Alert Channels**
2. Find `Bob AI Agent Remediation`
3. Click **Test** button
4. Verify Bob receives the test webhook

### Test via Demo Script

```bash
# Run the demo script to trigger memory leak
./scripts/trigger-demo.sh

# Monitor Bob logs
oc logs -n demo-namespace -l app=bob-ai-agent -f
```

## Step 6: Verify Webhook Payload

Bob AI Agent expects the following webhook payload structure:

```json
{
  "issue": {
    "id": "alert-id",
    "name": "Memory Leak Detection",
    "severity": 5,
    "text": "Memory usage exceeded threshold"
  },
  "application": {
    "name": "quarkus-memory-leak-app",
    "id": "app-id"
  },
  "service": {
    "name": "quarkus-memory-leak-app",
    "id": "service-id"
  },
  "timestamp": 1775307604546,
  "state": "OPEN"
}
```

## Webhook Response Codes

Bob AI Agent returns the following HTTP status codes:

- **200 OK**: Alert received and processing started
- **400 Bad Request**: Invalid payload format
- **500 Internal Server Error**: Processing error

## Monitoring Alert Processing

### Check Bob AI Agent Logs

```bash
# View recent logs
oc logs -n demo-namespace -l app=bob-ai-agent --tail=100

# Follow logs in real-time
oc logs -n demo-namespace -l app=bob-ai-agent -f

# Search for specific alert
oc logs -n demo-namespace -l app=bob-ai-agent | grep "alert-id"
```

### Check Bob Statistics

```bash
curl -k https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/stats
```

Expected response:
```json
{
  "totalAlerts": 5,
  "alertsProcessed": 5,
  "fixesGenerated": 3,
  "pullRequestsCreated": 3,
  "successRate": "60%",
  "averageProcessingTime": "45s",
  "lastAlertTime": "2026-04-04T13:00:00Z"
}
```

## Troubleshooting

### Alert Not Triggering

1. **Check Application Metrics**:
   ```bash
   curl -k https://quarkus-memory-leak-app-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/q/metrics
   ```

2. **Verify Instana Agent**:
   ```bash
   oc get pods -n instana-agent
   oc logs -n instana-agent -l app=instana-agent --tail=50
   ```

3. **Check Alert Configuration**:
   - Verify scope matches application name
   - Confirm thresholds are appropriate
   - Check time windows are not too long

### Webhook Not Received

1. **Verify Bob AI Agent is Running**:
   ```bash
   oc get pods -n demo-namespace -l app=bob-ai-agent
   ```

2. **Check Bob Health**:
   ```bash
   curl -k https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/health
   ```

3. **Test Webhook Manually**:
   ```bash
   curl -k -X POST \
     https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
     -H "Content-Type: application/json" \
     -d '{
       "issue": {
         "id": "test-alert",
         "name": "Test Alert",
         "severity": 5
       },
       "application": {
         "name": "quarkus-memory-leak-app"
       },
       "timestamp": 1775307604546,
       "state": "OPEN"
     }'
   ```

4. **Check Network Connectivity**:
   - Verify route is accessible from Instana
   - Check firewall rules
   - Confirm TLS certificate is valid

### Alert Processing Fails

1. **Check Bob Logs for Errors**:
   ```bash
   oc logs -n demo-namespace -l app=bob-ai-agent | grep ERROR
   ```

2. **Verify GitHub Token**:
   ```bash
   oc get secret bob-secrets -n demo-namespace -o jsonpath='{.data.github-token}' | base64 -d
   ```

3. **Verify Instana API Token**:
   ```bash
   oc get secret bob-secrets -n demo-namespace -o jsonpath='{.data.instana-api-token}' | base64 -d
   ```

## Alert Workflow

```
┌─────────────────┐
│ Memory Leak     │
│ Detected        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Instana Alert   │
│ Triggered       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Webhook Sent    │
│ to Bob Agent    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bob Analyzes    │
│ Code            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fix Generated   │
│ & PR Created    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pipeline Builds │
│ & Tests         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GitOps Deploys  │
│ Fixed Version   │
└─────────────────┘
```

## Best Practices

1. **Start with Conservative Thresholds**
   - Begin with higher thresholds (e.g., 90% memory)
   - Gradually lower based on observed patterns

2. **Use Appropriate Time Windows**
   - Too short: False positives
   - Too long: Delayed detection
   - Recommended: 5-10 minutes

3. **Configure Throttling**
   - Prevent alert storms
   - Recommended: 15-minute throttle period

4. **Monitor Alert Effectiveness**
   - Track false positive rate
   - Adjust thresholds as needed
   - Review Bob statistics regularly

5. **Test Regularly**
   - Run demo script weekly
   - Verify end-to-end workflow
   - Update configurations as needed

## Additional Resources

- [Instana Alert Documentation](https://www.ibm.com/docs/en/instana-observability/current?topic=instana-alerts)
- [Webhook Integration Guide](https://www.ibm.com/docs/en/instana-observability/current?topic=channels-generic-webhook)
- [Bob AI Agent API Documentation](../bob-agent/README.md)

---

*Last Updated: 2026-04-04*