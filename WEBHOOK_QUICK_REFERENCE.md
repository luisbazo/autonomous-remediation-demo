# Instana Webhook Quick Reference

## Bob AI Agent Webhook Endpoint

```
https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana
```

## Quick Setup (Instana UI)

1. **Settings** → **Team Settings** → **Alert Channels**
2. Click **Add Alert Channel**
3. Select **Generic Webhook**
4. Configure:
   - **Name**: Bob AI Agent Webhook
   - **URL**: (see above)
   - **Method**: POST
   - **Content-Type**: application/json
   - **Custom Header**: `X-Webhook-Secret: demo-webhook-secret-2026` ⚠️ **REQUIRED**

## Quick Test

```bash
curl -X POST \
  https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: demo-webhook-secret-2026" \
  -d '{"test": "webhook", "timestamp": '$(date +%s)'}'
```

**Expected Response:** HTTP 202 Accepted

## Verify Bob Agent

```bash
# Check pod status
oc get pods -n demo-namespace -l app=bob-ai-agent

# View logs
oc logs -n demo-namespace -l app=bob-ai-agent --tail=50 -f
```

## Trigger Demo

```bash
# Run the demo script
./scripts/trigger-demo.sh

# Or manually trigger memory leak
curl http://quarkus-memory-leak-app-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/api/memory/leak?size=100&count=1000
```

## Expected Flow

1. Memory leak triggered → Instana detects high memory usage
2. Instana sends alert → Bob AI Agent webhook receives it
3. Bob analyzes code → Identifies memory leak pattern
4. Bob generates fix → Creates pull request on GitHub
5. GitOps detects change → ArgoCD syncs deployment
6. Fixed app deployed → Memory issue resolved

## Troubleshooting

```bash
# Check webhook connectivity
oc run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com/webhook/instana

# Check Bob agent logs for errors
oc logs -n demo-namespace deployment/bob-ai-agent --tail=100

# Verify secrets are configured
oc get secret bob-secrets -n demo-namespace
```

## Full Documentation

See [`docs/INSTANA_WEBHOOK_SETUP.md`](docs/INSTANA_WEBHOOK_SETUP.md) for complete setup instructions.