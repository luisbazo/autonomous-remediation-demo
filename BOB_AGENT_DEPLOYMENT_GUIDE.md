# Bob AI Agent Deployment Guide

## Overview

This guide explains how to deploy the Bob AI Agent with enhanced payload debugging to OpenShift.

## What's New in This Version

### Enhanced Debugging Features
- **Dual-level payload logging**: Captures payloads at both webhook endpoint and alert handler levels
- **Console formatting**: Clear visual boundaries for easy reading in pod logs
- **Complete payload visibility**: Every field, nested object, and array is logged
- **Structured logging**: JSON format in log files for parsing and analysis

### Code Changes
1. **Webhook Endpoint** ([`bob-agent/src/index.ts`](bob-agent/src/index.ts:83-108))
   - Logs complete HTTP headers
   - Logs raw request body with metadata
   - Tracks payload structure (keys, length, type)

2. **Alert Handler** ([`bob-agent/src/handlers/instana-alert-handler.ts`](bob-agent/src/handlers/instana-alert-handler.ts:52-70))
   - Prints formatted payload to console
   - Clear visual boundaries for easy identification
   - Full JSON structure with 2-space indentation

## Deployment Methods

### Method 1: OpenShift Binary Build (Recommended)

Uses OpenShift's built-in build system - no local Docker/Podman required.

```bash
./scripts/deploy-bob-agent-oc.sh
```

**What it does:**
1. Builds TypeScript application
2. Creates/updates OpenShift BuildConfig
3. Uploads source code to OpenShift
4. Builds container image in OpenShift
5. Deploys to the cluster
6. Verifies deployment health

**Requirements:**
- OpenShift CLI (`oc`) installed
- Logged into OpenShift cluster
- Appropriate permissions in target namespace

### Method 2: Docker/Podman Build

Uses local container runtime to build and push images.

```bash
./scripts/deploy-bob-agent.sh
```

**Requirements:**
- Docker or Podman installed and running
- OpenShift CLI (`oc`) installed
- Logged into OpenShift cluster
- Access to OpenShift image registry

## Pre-Deployment Checklist

- [ ] OpenShift CLI installed: `oc version`
- [ ] Logged into OpenShift: `oc whoami`
- [ ] Target namespace exists or will be created
- [ ] Secrets configured (or will use placeholders)

## Secrets Configuration

The Bob AI Agent requires these secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: bob-secrets
type: Opaque
stringData:
  github-token: "your-github-token"
  github-owner: "your-github-username"
  github-repo: "your-repo-name"
  instana-api-token: "your-instana-token"
  instana-base-url: "https://your-instana-instance.com"
  openshift-api-url: "https://api.your-cluster.com:6443"
  openshift-token: "your-openshift-token"
```

### Create/Update Secrets

```bash
# Create secret
oc create secret generic bob-secrets \
  --from-literal=github-token="your-token" \
  --from-literal=github-owner="your-username" \
  --from-literal=github-repo="your-repo" \
  --from-literal=instana-api-token="your-instana-token" \
  --from-literal=instana-base-url="https://your-instana.com" \
  --from-literal=openshift-api-url="https://api.cluster.com:6443" \
  --from-literal=openshift-token="your-ocp-token" \
  -n demo

# Or edit existing secret
oc edit secret bob-secrets -n demo
```

## Post-Deployment Verification

### 1. Check Pod Status

```bash
oc get pods -n demo -l app=bob-ai-agent
```

Expected output:
```
NAME                            READY   STATUS    RESTARTS   AGE
bob-ai-agent-xxxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### 2. Check Logs

```bash
# Follow logs in real-time
oc logs -f deployment/bob-ai-agent -n demo

# View recent logs
oc logs deployment/bob-ai-agent -n demo --tail=50
```

### 3. Test Health Endpoint

```bash
# Get route URL
ROUTE_URL=$(oc get route bob-ai-agent -n demo -o jsonpath='{.spec.host}')

# Test health
curl -k https://$ROUTE_URL/health

# Expected response:
# {"status":"UP","timestamp":"...","service":"bob-ai-agent","version":"1.0.0"}
```

### 4. Test Status Endpoint

```bash
curl -k https://$ROUTE_URL/status | jq '.'
```

## Viewing Debug Output

When an Instana alert is received, you'll see this in the pod logs:

```bash
oc logs -f deployment/bob-ai-agent -n demo
```

Output will include:

```
========================================
INSTANA ALERT - FULL PAYLOAD RECEIVED
========================================
{
  "id": "alert-123",
  "severity": "critical",
  "type": "memory_leak",
  "title": "High Memory Usage",
  ...
}
========================================
```

## Troubleshooting

### Build Fails

```bash
# Check build logs
oc logs -f bc/bob-ai-agent -n demo

# Describe build
oc describe bc/bob-ai-agent -n demo
```

### Pod Not Starting

```bash
# Check pod details
oc describe pod -l app=bob-ai-agent -n demo

# Check events
oc get events -n demo --sort-by='.lastTimestamp' | tail -20

# Check pod logs
POD_NAME=$(oc get pods -n demo -l app=bob-ai-agent -o jsonpath='{.items[0].metadata.name}')
oc logs $POD_NAME -n demo
```

### Secret Issues

```bash
# Verify secret exists
oc get secret bob-secrets -n demo

# Check secret keys
oc get secret bob-secrets -n demo -o jsonpath='{.data}' | jq 'keys'
```

### Route Not Accessible

```bash
# Check route
oc get route bob-ai-agent -n demo

# Describe route
oc describe route bob-ai-agent -n demo

# Test from within cluster
oc run test-pod --image=curlimages/curl --rm -it -- \
  curl http://bob-ai-agent.demo.svc.cluster.local:3000/health
```

## Updating the Deployment

### Rebuild and Redeploy

```bash
# Using OpenShift build
./scripts/deploy-bob-agent-oc.sh

# Or manually trigger rebuild
cd bob-agent
npm run build
oc start-build bob-ai-agent --from-dir=. --follow -n demo
```

### Restart Without Rebuild

```bash
oc rollout restart deployment/bob-ai-agent -n demo
```

### Update Configuration

```bash
# Update secrets
oc edit secret bob-secrets -n demo

# Restart to pick up changes
oc rollout restart deployment/bob-ai-agent -n demo
```

## Monitoring

### Watch Deployment Status

```bash
watch oc get pods -n demo -l app=bob-ai-agent
```

### Stream Logs

```bash
oc logs -f deployment/bob-ai-agent -n demo
```

### Check Resource Usage

```bash
oc adm top pod -n demo -l app=bob-ai-agent
```

## Webhook Configuration

Once deployed, configure Instana to send alerts to:

```
https://<route-url>/webhook/instana
```

Headers:
- `Content-Type: application/json`
- `x-webhook-secret: <your-secret>`

## Testing the Deployment

### From Local Machine

```bash
# Get route URL
ROUTE_URL=$(oc get route bob-ai-agent -n demo -o jsonpath='{.spec.host}')

# Test webhook
curl -X POST https://$ROUTE_URL/webhook/instana \
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

### From Within Cluster

```bash
oc run test-curl --image=curlimages/curl --rm -it -- \
  curl -X POST http://bob-ai-agent.demo.svc.cluster.local:3000/webhook/instana \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: change_this_secret" \
  -d '{"id":"test","severity":"critical","type":"test","title":"Test","description":"Test","timestamp":1234567890}'
```

## Useful Commands

```bash
# Get all resources
oc get all -n demo -l app=bob-ai-agent

# Delete deployment
oc delete all -n demo -l app=bob-ai-agent

# Scale deployment
oc scale deployment/bob-ai-agent --replicas=2 -n demo

# View deployment history
oc rollout history deployment/bob-ai-agent -n demo

# Rollback deployment
oc rollout undo deployment/bob-ai-agent -n demo
```

## Next Steps

1. ✅ Deploy Bob AI Agent
2. ✅ Verify health endpoints
3. ✅ Configure Instana webhook
4. ✅ Test with sample alert
5. ✅ Monitor logs for payload debugging
6. ✅ Trigger real alert from Instana
7. ✅ Verify automatic remediation

## Support

For issues or questions:
- Check pod logs: `oc logs -f deployment/bob-ai-agent -n demo`
- Review events: `oc get events -n demo`
- See documentation: [`docs/DEBUGGING_INSTANA_WEBHOOKS.md`](docs/DEBUGGING_INSTANA_WEBHOOKS.md)