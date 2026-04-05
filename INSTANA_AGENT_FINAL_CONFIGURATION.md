# Instana Agent Final Configuration - RESOLVED

## Issue Resolution Summary

### Problem
The Instana agents were unable to connect to the Instana SaaS backend, preventing the OpenShift cluster from appearing in the Instana UI.

### Root Causes Identified

1. **Wrong Agent Key Type**: Secret contained API Token instead of Agent Key (Download Key)
   - Incorrect: `i2Ca6eu8Rritkcp9LzInxQ` (API Token)
   - Correct: `UE1az4ZZRqSpyw7NcBMWhw` (Agent Key)

2. **Wrong Endpoint**: Initially configured with incorrect endpoint
   - Incorrect attempts:
     - `integration-bobinstana.instana.io` (UI URL, not agent endpoint)
     - `ingress-integration-bobinstana-saas.instana.io` (DNS doesn't exist)
   - Correct: `ingress-red-saas.instana.io` (SaaS agent endpoint)

### Solution Applied

```bash
# Step 1: Update secret with correct Agent Key
oc delete secret instana-agent -n instana-agent
oc create secret generic instana-agent \
  --from-literal=key=UE1az4ZZRqSpyw7NcBMWhw \
  -n instana-agent

# Step 2: Update endpoint to correct SaaS ingress
oc set env daemonset/instana-agent \
  -n instana-agent \
  INSTANA_AGENT_ENDPOINT=ingress-red-saas.instana.io

# Step 3: Verify rollout
oc rollout status daemonset/instana-agent -n instana-agent
```

### Current Status

**All agents successfully connected:**
```
Connected using HTTP/2 to ingress-red-saas.instana.io:443 
with id '02:fa:ae:ff:fe:9f:da:23' and key '*** (redacted)'
```

**Agent Pods Status:**
```
NAME                  READY   STATUS    RESTARTS   AGE
instana-agent-bnv4l   1/1     Running   0          85s
instana-agent-lrds5   1/1     Running   0          87s
instana-agent-mp95c   1/1     Running   0          102s
instana-agent-qnvmn   1/1     Running   0          100s
instana-agent-rhdcx   1/1     Running   0          92s
instana-agent-sgzpr   1/1     Running   0          83s
instana-agent-zghtb   1/1     Running   0          98s
```

All 7 agents running with **0 restarts** - indicating stable connections.

## Final Configuration

### Environment Variables
```yaml
env:
  - name: INSTANA_AGENT_KEY
    valueFrom:
      secretKeyRef:
        key: key
        name: instana-agent
  - name: INSTANA_AGENT_ENDPOINT
    value: ingress-red-saas.instana.io
  - name: INSTANA_AGENT_ENDPOINT_PORT
    value: "443"
  - name: INSTANA_AGENT_ZONE
    value: demo-zone
  - name: INSTANA_AGENT_MODE
    value: APM
```

### Secret Configuration
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: instana-agent
  namespace: instana-agent
type: Opaque
stringData:
  key: UE1az4ZZRqSpyw7NcBMWhw  # Agent Key (Download Key)
```

## Key Learnings

### Instana SaaS Agent Configuration

1. **Agent Key vs API Token**
   - **Agent Key (Download Key)**: Used by agents to authenticate and download features
   - **API Token**: Used for API calls from applications/scripts
   - These are NOT interchangeable

2. **SaaS Endpoint Patterns**
   - **UI URL**: `{tenant}.instana.io` or `integration-{tenant}.instana.io`
   - **Agent Endpoint**: `ingress-red-saas.instana.io` (for SaaS installations)
   - The agent endpoint is typically different from the UI URL

3. **Agent Authentication Flow**
   ```
   Agent → ingress-red-saas.instana.io:443
         → Authenticate with Agent Key
         → Download agent features
         → Establish HTTP/2 connection
         → Start reporting metrics
   ```

## Verification Steps

### 1. Check Agent Connection Status
```bash
# View agent logs for connection confirmation
oc logs -n instana-agent -l app.kubernetes.io/name=instana-agent | grep "Connected"
```

Expected output:
```
Connected using HTTP/2 to ingress-red-saas.instana.io:443
```

### 2. Verify No Authentication Errors
```bash
# Check for 401 errors
oc logs -n instana-agent -l app.kubernetes.io/name=instana-agent | grep "401"
```

Should return no results (no 401 errors).

### 3. Check Agent Pod Health
```bash
# Verify all pods are running
oc get pods -n instana-agent
```

All pods should show:
- STATUS: Running
- READY: 1/1
- RESTARTS: 0

### 4. Verify in Instana UI

1. Log in to Instana UI: `https://integration-bobinstana.instana.io`
2. Navigate to: **Infrastructure → Kubernetes**
3. Verify cluster appears with name matching `INSTANA_AGENT_ZONE` (demo-zone)
4. Check that all 7 nodes are visible
5. Verify applications are being discovered

## Troubleshooting Guide

### If agents show connection errors:

1. **Verify Agent Key**
   ```bash
   oc get secret instana-agent -n instana-agent -o jsonpath='{.data.key}' | base64 -d
   ```
   Should output: `UE1az4ZZRqSpyw7NcBMWhw`

2. **Verify Endpoint**
   ```bash
   oc get daemonset instana-agent -n instana-agent -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="INSTANA_AGENT_ENDPOINT")].value}'
   ```
   Should output: `ingress-red-saas.instana.io`

3. **Test Network Connectivity**
   ```bash
   oc run test-curl --image=curlimages/curl -it --rm -- \
     curl -v https://ingress-red-saas.instana.io
   ```
   Should successfully connect (may get 404, but connection should work).

4. **Check Agent Logs for Errors**
   ```bash
   oc logs -n instana-agent -l app.kubernetes.io/name=instana-agent --tail=100 | grep -i "error\|warn"
   ```

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Wrong Agent Key | Update secret with correct Agent Key |
| 404 Not Found | Wrong endpoint | Use `ingress-red-saas.instana.io` |
| Name or service not known | DNS resolution failure | Verify endpoint spelling |
| Connection timeout | Network/firewall issue | Check network policies and firewall rules |
| Frequent restarts | Configuration error | Review all environment variables |

## Next Steps

Now that agents are connected:

1. **Wait 2-5 minutes** for data to appear in Instana UI
2. **Verify cluster visibility** in Infrastructure → Kubernetes
3. **Configure alerts** for memory leak detection
4. **Test end-to-end workflow**:
   ```bash
   ./scripts/trigger-demo.sh
   ```

## Related Documentation

- [INSTANA_AGENT_FIX_REQUIRED.md](./INSTANA_AGENT_FIX_REQUIRED.md) - Initial troubleshooting
- [PROJECT_COMPLETION_SUMMARY.md](./PROJECT_COMPLETION_SUMMARY.md) - Complete project overview
- [DEMO_EXECUTION_GUIDE.md](./DEMO_EXECUTION_GUIDE.md) - How to run the demo

## Configuration Files Updated

All configuration files have been updated with the correct values:

- `k8s/instana-agent/daemonset.yaml` - Agent DaemonSet with correct endpoint
- `k8s/instana-agent/secret.yaml` - Secret with correct Agent Key
- `.env` - Environment variables for Bob AI agent

---

**Status**: ✅ RESOLVED - All agents connected successfully
**Date**: 2026-04-04
**Agent Version**: 1.2.52
**Cluster**: itz-74esdv (7 worker nodes)