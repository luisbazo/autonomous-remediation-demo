# Instana Memory Alert Configuration

This guide explains how to configure a memory leak alert in Instana that triggers when memory usage reaches 80%.

## Alert Configuration Methods

### Method 1: Using Instana UI (Recommended)

1. **Navigate to Instana Dashboard**
   - Log in to your Instana instance: `https://ingress-red-saas.instana.io`
   - Go to **Settings** → **Alerts**

2. **Create a New Alert**
   - Click **+ New Alert**
   - Select **Built-in Events** or **Custom Events**

3. **Configure Memory Alert**

   **Alert Name:** `High Memory Usage - 80% Threshold`

   **Event Type:** Select one of:
   - `Memory Usage High` (Built-in)
   - `JVM Memory Usage` (for Java applications)
   - `Container Memory Usage` (for containerized apps)

4. **Set Threshold Conditions**
   ```
   Metric: memory.used_percent
   Operator: >
   Threshold: 80
   Duration: 60 seconds (to avoid false positives)
   ```

5. **Scope Configuration**
   - **Application:** Select your application (e.g., `quarkus-memory-leak-demo`)
   - **Service:** Optionally filter by specific services
   - **Tags:** Add tags like `environment:demo` or `zone:demo-zone`

6. **Alert Channels**
   - Add webhook: `http://bob-agent.demo-namespace.svc.cluster.local:3000/webhook/instana`
   - Add email notifications (optional)
   - Add Slack/PagerDuty (optional)

7. **Save Alert**

### Method 2: Using Instana API

Create an alert using the Instana REST API:

```bash
curl -X POST "https://ingress-red-saas.instana.io/api/events/settings/alerts" \
  -H "Authorization: apiToken YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Memory Usage - 80% Threshold",
    "description": "Alert when memory usage exceeds 80%",
    "severity": 5,
    "triggering": true,
    "enabled": true,
    "tagFilterExpression": {
      "type": "TAG_FILTER",
      "name": "application.name",
      "operator": "EQUALS",
      "value": "quarkus-memory-leak-demo"
    },
    "ruleIds": ["memory-usage-high"],
    "alertChannelIds": ["webhook-channel-id"],
    "threshold": {
      "type": "threshold",
      "operator": ">=",
      "value": 80,
      "lastUpdated": 60000
    }
  }'
```

### Method 3: Using Custom Events

For more granular control, create a custom event:

```json
{
  "name": "Memory Leak Detection - 80%",
  "entityType": "jvm",
  "query": "entity.jvm.memory.heap.used / entity.jvm.memory.heap.max * 100",
  "conditionOperator": ">=",
  "conditionValue": 80,
  "aggregation": "avg",
  "window": 60000,
  "description": "Triggers when JVM heap memory usage exceeds 80% for 60 seconds"
}
```

## Alert Configuration for Different Scenarios

### 1. JVM/Java Application Memory Alert

```yaml
Alert Name: JVM Heap Memory High
Metric: jvm.memory.heap.used_percent
Threshold: >= 80%
Duration: 60 seconds
Scope: 
  - Application: quarkus-memory-leak-demo
  - Service: memory-leak-service
```

### 2. Container Memory Alert

```yaml
Alert Name: Container Memory High
Metric: container.memory.usage_percent
Threshold: >= 80%
Duration: 60 seconds
Scope:
  - Kubernetes Cluster: itz-74esdv
  - Namespace: demo-namespace
  - Pod: quarkus-app-*
```

### 3. Host Memory Alert

```yaml
Alert Name: Host Memory High
Metric: host.memory.used_percent
Threshold: >= 80%
Duration: 120 seconds
Scope:
  - Zone: demo-zone
  - Host: worker-*
```

## Alert Payload Structure

When the alert triggers, Instana sends a webhook payload to Bob Agent:

```json
{
  "id": "alert-id-123",
  "timestamp": 1234567890000,
  "severity": "WARNING",
  "state": "OPEN",
  "title": "High Memory Usage - 80% Threshold",
  "text": "Memory usage has exceeded 80% threshold",
  "entity": {
    "type": "jvm",
    "id": "jvm-instance-id",
    "label": "quarkus-app-pod-xyz"
  },
  "metric": {
    "name": "jvm.memory.heap.used_percent",
    "value": 85.5,
    "unit": "percent"
  },
  "application": {
    "name": "quarkus-memory-leak-demo",
    "id": "app-id-123"
  },
  "service": {
    "name": "memory-leak-service",
    "id": "service-id-456"
  }
}
```

## Best Practices

1. **Set Appropriate Duration**
   - Use 60-120 seconds to avoid alert fatigue from temporary spikes
   - For critical services, use shorter durations (30 seconds)

2. **Use Multiple Thresholds**
   - Warning: 80% (sends to Bob Agent for auto-remediation)
   - Critical: 90% (sends to PagerDuty/Slack for immediate attention)

3. **Scope Alerts Properly**
   - Use tags to filter specific applications or services
   - Avoid cluster-wide alerts that may be too noisy

4. **Test Alerts**
   - Use the memory leak endpoint to trigger alerts: `/api/memory-leak`
   - Verify webhook delivery to Bob Agent

5. **Alert Grouping**
   - Group related alerts to reduce noise
   - Use alert correlation to identify root causes

## Webhook Configuration for Bob Agent

Ensure your webhook is configured in Instana:

```yaml
Webhook Name: Bob AI Agent
URL: http://bob-agent.demo-namespace.svc.cluster.local:3000/webhook/instana
Method: POST
Headers:
  Content-Type: application/json
  X-Webhook-Secret: ${BOB_WEBHOOK_SECRET}
Events:
  - incident.triggered
  - incident.closed
  - alert.triggered
  - alert.closed
```

## Verification

After creating the alert:

1. **Trigger a Test Alert**
   ```bash
   curl -X POST http://quarkus-app-route/api/memory-leak
   ```

2. **Check Instana Events**
   - Go to **Events** in Instana UI
   - Verify the alert appears

3. **Verify Bob Agent Reception**
   ```bash
   oc logs -f deployment/bob-agent -n demo-namespace
   ```

4. **Check Alert Status**
   ```bash
   curl http://bob-agent-route/status
   ```

## Troubleshooting

### Alert Not Triggering

1. Check metric availability:
   ```
   Instana UI → Infrastructure → Select Host/Container → Metrics
   ```

2. Verify threshold is correct:
   - Memory might be reported in bytes, not percentage
   - Check metric units in Instana

3. Check alert scope:
   - Ensure tags match your application
   - Verify entity type is correct

### Webhook Not Receiving Alerts

1. Check webhook configuration in Instana
2. Verify Bob Agent is running:
   ```bash
   oc get pods -n demo-namespace | grep bob-agent
   ```
3. Check network connectivity:
   ```bash
   oc exec -it deployment/bob-agent -n demo-namespace -- curl -v http://localhost:3000/health
   ```

## Related Documentation

- [Instana Alert Configuration](https://www.ibm.com/docs/en/instana-observability/current?topic=instana-alerts)
- [Instana Webhook Integration](https://www.ibm.com/docs/en/instana-observability/current?topic=integrations-webhook)
- [Bob Agent Setup](./INSTANA_WEBHOOK_SETUP.md)