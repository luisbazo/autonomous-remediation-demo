# Kubernetes Cluster Visibility Troubleshooting

## Current Status

### What's Working ✅
1. **Agents Connected**: All 7 Instana agents are running and connected to `ingress-red-saas.instana.io`
2. **Agents Visible in UI**: You can see the agents in Instana UI
3. **Kubernetes Sensor Activated**: `OTelK8SFactory activated` confirmed in logs
4. **Cluster Name Configured**: `INSTANA_KUBERNETES_CLUSTER_NAME=itz-74esdv.infra01-lb.fra02.techzone.ibm.com`
5. **RBAC Configured**: ClusterRole and ClusterRoleBinding exist
6. **Container Monitoring**: CRI-O sensors discovering containers

### What's Not Working ❌
- **Cluster Not Visible**: The OpenShift cluster is not appearing in Instana UI under Infrastructure → Kubernetes

## Investigation Results

### 1. Agent Configuration
```bash
# Verified environment variables
INSTANA_AGENT_KEY=UE1az4ZZRqSpyw7NcBMWhw (Agent Key - correct)
INSTANA_AGENT_ENDPOINT=ingress-red-saas.instana.io (correct)
INSTANA_AGENT_ZONE=demo-zone
INSTANA_AGENT_MODE=APM
INSTANA_KUBERNETES_CLUSTER_NAME=itz-74esdv.infra01-lb.fra02.techzone.ibm.com
```

### 2. Sensor Status
```
OTelK8SFactory activated ✅
```

### 3. Agent Logs Analysis
- No critical errors found
- Discovery taking ~43 seconds (within normal range)
- Some warnings about containerd sockets (expected in CRI-O environment)
- No Kubernetes API access errors

### 4. RBAC Permissions
```bash
ClusterRole: instana-agent ✅
ClusterRoleBinding: instana-agent ✅
```

## Possible Causes

### 1. **Timing Issue** (Most Likely)
Kubernetes cluster discovery can take 5-15 minutes on first connection. The agents need to:
- Discover all nodes
- Query all namespaces
- Collect pod information
- Build the cluster topology
- Send initial snapshot to backend

**Action**: Wait 10-15 minutes from agent restart time (17:35 UTC)

### 2. **Backend Processing Delay**
Even after agents send data, Instana backend needs time to:
- Process the cluster topology
- Index the data
- Make it available in UI

**Action**: Check again in 15-20 minutes

### 3. **Missing Leader Agent**
Some Instana deployments require a dedicated "leader" agent for cluster-level monitoring.

**Check**: Look for leader election in logs
```bash
oc logs -n instana-agent -l app=instana-agent | grep -i "leader"
```

**If needed**: Deploy a separate leader agent (StatefulSet instead of DaemonSet)

### 4. **Cluster Name Mismatch**
The cluster name in Instana might need to match exactly what OpenShift reports.

**Check actual cluster name**:
```bash
oc get infrastructure cluster -o jsonpath='{.status.infrastructureName}'
```

**If different**: Update `INSTANA_KUBERNETES_CLUSTER_NAME` to match

### 5. **Zone Configuration**
The `INSTANA_AGENT_ZONE` might need to be configured differently for cluster visibility.

**Try**: Remove or change zone configuration
```bash
oc set env daemonset/instana-agent -n instana-agent INSTANA_AGENT_ZONE-
```

### 6. **API Endpoint Configuration**
Some Instana SaaS instances require additional configuration for Kubernetes monitoring.

**Check**: Instana documentation for your specific SaaS region

## Recommended Actions

### Immediate Actions (Do Now)

1. **Wait and Monitor** (15 minutes from 17:35 UTC = check at 17:50 UTC)
   ```bash
   # Check agent uptime
   oc get pods -n instana-agent
   
   # Monitor logs for any new errors
   oc logs -n instana-agent -l app=instana-agent --tail=50 | grep -i "error\|warn"
   ```

2. **Verify Cluster Name**
   ```bash
   # Get actual cluster infrastructure name
   oc get infrastructure cluster -o jsonpath='{.status.infrastructureName}'
   
   # Compare with configured name
   oc get daemonset instana-agent -n instana-agent -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="INSTANA_KUBERNETES_CLUSTER_NAME")].value}'
   ```

3. **Check Instana UI Different Locations**
   - Infrastructure → Kubernetes (main location)
   - Infrastructure → Hosts (should show 7 nodes)
   - Infrastructure → Containers (should show containers)
   - Infrastructure → Map (topology view)

### If Still Not Visible After 15 Minutes

4. **Try Alternative Cluster Name**
   ```bash
   # Use short name
   oc set env daemonset/instana-agent -n instana-agent \
     INSTANA_KUBERNETES_CLUSTER_NAME=itz-74esdv
   ```

5. **Check Instana Backend Logs** (if accessible)
   - Look for cluster registration messages
   - Check for any backend errors processing cluster data

6. **Contact Instana Support**
   Provide:
   - Tenant: integration-bobinstana.instana.io
   - Agent Key: UE1az4ZZRqSpyw7NcBMWhw
   - Cluster Name: itz-74esdv.infra01-lb.fra02.techzone.ibm.com
   - Agent logs showing OTelK8SFactory activated
   - Confirmation that agents are visible in UI

## Alternative Approach: Manual Verification

### Check What Instana Can See

1. **Check Hosts**
   ```
   Navigate to: Infrastructure → Hosts
   Expected: 7 hosts (worker nodes)
   ```

2. **Check Containers**
   ```
   Navigate to: Infrastructure → Containers
   Expected: All running containers
   ```

3. **Check Applications**
   ```
   Navigate to: Applications
   Expected: Quarkus application if instrumented
   ```

If you can see hosts and containers but not the cluster view, it might be a UI/display issue rather than a data collection issue.

## Workaround: Use What's Available

Even without cluster view, you can still:

1. **Monitor Individual Hosts**
   - CPU, memory, disk, network metrics
   - All available in Infrastructure → Hosts

2. **Monitor Containers**
   - Container metrics and logs
   - Available in Infrastructure → Containers

3. **Monitor Applications**
   - JVM metrics for Quarkus app
   - HTTP endpoints and traces
   - Available in Applications view

4. **Create Alerts**
   - Alerts can be created on host-level metrics
   - Memory alerts for specific hosts/containers
   - Will still trigger Bob's autonomous remediation

## Next Steps for Demo

### Option 1: Wait for Cluster View
- Wait 15-20 minutes
- Check Instana UI periodically
- Proceed with demo once cluster appears

### Option 2: Proceed Without Cluster View
- Use host-level monitoring
- Create alerts on host memory usage
- Demo will still work end-to-end:
  1. Memory leak occurs
  2. Instana detects (host-level metric)
  3. Alert triggers
  4. Bob receives webhook
  5. Bob analyzes and fixes code
  6. CI/CD deploys fix
  7. Memory normalizes

### Option 3: Use Alternative Monitoring
- Focus on application-level monitoring
- JVM metrics show memory leak
- Create alert on JVM heap usage
- Demo autonomous remediation flow

## Documentation for Reference

- **Agent Configuration**: `INSTANA_AGENT_FINAL_CONFIGURATION.md`
- **Cluster Visibility Fix**: `KUBERNETES_CLUSTER_VISIBILITY_FIX.md`
- **Project Status**: `PROJECT_FINAL_STATUS.md`

## Timeline

- **17:30 UTC**: Added INSTANA_KUBERNETES_CLUSTER_NAME
- **17:35 UTC**: Agents restarted with new configuration
- **17:36 UTC**: OTelK8SFactory activated
- **17:40 UTC**: Cluster still not visible (5 minutes - too soon)
- **17:50 UTC**: Check again (15 minutes - reasonable wait)
- **18:00 UTC**: If still not visible, try alternative approaches

## Status

**Current Time**: 17:42 UTC  
**Agent Restart**: 17:35 UTC  
**Elapsed**: 7 minutes  
**Recommendation**: Wait until 17:50 UTC (15 minutes total) before taking further action

---

**Note**: Kubernetes cluster discovery is often the slowest part of Instana agent initialization. The fact that agents are connected, sensors are activated, and no errors are present is a good sign. The cluster data may simply still be processing.