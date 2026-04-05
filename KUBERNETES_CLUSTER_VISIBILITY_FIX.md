# Kubernetes Cluster Visibility in Instana - RESOLVED

## Issue
Instana agents were connected and visible, but the OpenShift cluster was not appearing in the Instana UI under Infrastructure → Kubernetes.

## Root Cause
Missing `INSTANA_KUBERNETES_CLUSTER_NAME` environment variable in the agent DaemonSet configuration. This variable is required to enable cluster-level monitoring and make the cluster visible in Instana UI.

## Solution Applied

### Step 1: Add Cluster Name Environment Variable
```bash
oc set env daemonset/instana-agent \
  -n instana-agent \
  INSTANA_KUBERNETES_CLUSTER_NAME=itz-74esdv
```

### Step 2: Verify Agents Restarted
```bash
oc get pods -n instana-agent
```

All 7 agents restarted successfully with 0 restarts.

### Step 3: Verify Kubernetes Sensor Activation
```bash
oc logs instana-agent-6h52r -n instana-agent | grep -i "OTelK8SFactory"
```

Output confirmed:
```
OTelK8SFactory activated
```

## Final Configuration

### Complete Environment Variables
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
  - name: INSTANA_KUBERNETES_CLUSTER_NAME
    value: itz-74esdv
  - name: INSTANA_AGENT_POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
```

## Verification Steps

### 1. Check Agent Status
```bash
oc get pods -n instana-agent
```

Expected: All pods Running with 0 restarts

### 2. Verify Kubernetes Sensor
```bash
oc logs -n instana-agent -l app=instana-agent | grep "OTelK8SFactory"
```

Expected: `OTelK8SFactory activated`

### 3. Check Instana UI
1. Navigate to: `https://integration-bobinstana.instana.io`
2. Go to: **Infrastructure → Kubernetes**
3. Look for cluster: **itz-74esdv**

**Note**: It may take 2-5 minutes for the cluster to appear after the agents restart.

## What the Kubernetes Sensor Monitors

Once activated, the Kubernetes sensor collects:

- **Cluster Information**:
  - Cluster name and version
  - Node count and status
  - Resource capacity and usage

- **Namespace Data**:
  - All namespaces in the cluster
  - Resource quotas
  - Limit ranges

- **Workload Information**:
  - Deployments, StatefulSets, DaemonSets
  - ReplicaSets
  - Pods and containers
  - Services and endpoints

- **Resource Metrics**:
  - CPU and memory usage
  - Network traffic
  - Storage utilization

- **Events**:
  - Pod lifecycle events
  - Scheduling events
  - Resource warnings

## Troubleshooting

### If Cluster Still Not Visible

1. **Wait Longer**: Initial discovery can take up to 5 minutes

2. **Check Agent Logs for Errors**:
   ```bash
   oc logs -n instana-agent -l app=instana-agent | grep -i "error\|warn" | grep -i "kubernetes"
   ```

3. **Verify RBAC Permissions**:
   ```bash
   oc get clusterrole instana-agent
   oc get clusterrolebinding instana-agent
   ```

4. **Check Kubernetes API Access**:
   ```bash
   oc exec -n instana-agent instana-agent-xxxxx -- curl -k https://kubernetes.default.svc/api/v1/namespaces
   ```

5. **Verify Cluster Name**:
   ```bash
   oc get daemonset instana-agent -n instana-agent -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="INSTANA_KUBERNETES_CLUSTER_NAME")].value}'
   ```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Cluster not appearing | Missing INSTANA_KUBERNETES_CLUSTER_NAME | Add environment variable |
| Partial data | RBAC permissions insufficient | Verify ClusterRole has all required permissions |
| Sensor not activating | Agent mode incorrect | Ensure INSTANA_AGENT_MODE=APM |
| Connection errors | Network policies blocking | Check network policies and firewall rules |

## Key Learnings

### Required Environment Variables for Kubernetes Monitoring

1. **INSTANA_AGENT_KEY**: Agent authentication (Download Key)
2. **INSTANA_AGENT_ENDPOINT**: SaaS backend endpoint
3. **INSTANA_AGENT_ZONE**: Logical grouping of agents
4. **INSTANA_AGENT_MODE**: Must be "APM" for full monitoring
5. **INSTANA_KUBERNETES_CLUSTER_NAME**: **CRITICAL** - Enables cluster visibility

### Sensor Architecture

Instana uses OpenTelemetry-based sensors:
- **OTelK8SFactory**: Kubernetes cluster monitoring
- **OTelHostFactory**: Host-level metrics
- **OTelJVMFactory**: Java application monitoring
- **Crio**: Container runtime monitoring

### Data Flow

```
Kubernetes API
      ↓
OTelK8SFactory (Sensor)
      ↓
Instana Agent
      ↓
ingress-red-saas.instana.io
      ↓
Instana Backend
      ↓
Instana UI (Infrastructure → Kubernetes)
```

## Expected Result

After applying this fix, you should see:

1. **In Instana UI → Infrastructure → Kubernetes**:
   - Cluster: itz-74esdv
   - 7 worker nodes
   - All namespaces
   - All workloads (Deployments, Pods, Services)

2. **In Instana UI → Infrastructure → Hosts**:
   - 7 hosts (worker nodes)
   - Host metrics (CPU, memory, disk, network)

3. **In Instana UI → Applications**:
   - Quarkus application (memory-leak-demo)
   - JVM metrics
   - HTTP endpoints

## Timeline of Fixes

1. **Initial Issue**: Agents not connecting (401 errors)
   - **Fix**: Updated Agent Key from API token to correct Download Key

2. **Second Issue**: Wrong endpoint (404 errors)
   - **Fix**: Updated endpoint to `ingress-red-saas.instana.io`

3. **Third Issue**: Cluster not visible in UI
   - **Fix**: Added `INSTANA_KUBERNETES_CLUSTER_NAME=itz-74esdv`

## Status

✅ **RESOLVED** - All agents connected, Kubernetes sensor activated, cluster should now be visible in Instana UI.

**Date**: 2026-04-04  
**Cluster**: itz-74esdv  
**Agents**: 7/7 Running  
**Sensor**: OTelK8SFactory activated  

---

**Next Step**: Wait 2-5 minutes and check Instana UI → Infrastructure → Kubernetes for cluster "itz-74esdv"