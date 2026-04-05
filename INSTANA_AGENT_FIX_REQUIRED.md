# Instana Agent Configuration Issue - Fix Required

## 🔴 Problem Identified

The Instana agents are deployed but **not connecting** to your Instana SaaS instance due to two configuration issues:

### Issue 1: Wrong Endpoint ❌
**Current Configuration:**
```yaml
INSTANA_AGENT_ENDPOINT: ingress-red-saas.instana.io
```

**Should Be:**
```yaml
INSTANA_AGENT_ENDPOINT: integration-bobinstana.instana.io
```

The endpoint doesn't match your actual Instana SaaS instance.

### Issue 2: Wrong Key Type ❌
**Current Secret:**
- Contains: `i2Ca6eu8Rritkcp9LzInxQ` (API Token)
- Needs: **Agent Key** (also called Download Key)

**Agent Logs Show:**
```
authentication failed for https://artifact-public.instana.io/artifactory/...
status: 401 Unauthorized
```

This happens because the agent is using an API token instead of an Agent Key.

## 📋 What You Need

### 1. Get Your Instana Agent Key

The **Agent Key** is different from the API token. To find it:

1. Go to Instana UI: https://integration-bobinstana.instana.io
2. Click on **Settings** (gear icon)
3. Navigate to **Team Settings** → **Agent Keys**
4. Copy your **Agent Key** (it looks like: `xxxxxxxxxxxxxxxx`)

**Note:** If you don't see an Agent Key, you may need to create one:
- Click **Create Agent Key**
- Give it a name (e.g., "OpenShift Demo")
- Copy the generated key

### 2. Get the Correct Endpoint

From your Instana URL `https://integration-bobinstana.instana.io`, the agent endpoint should be:
- **Endpoint:** `integration-bobinstana.instana.io`
- **Port:** `443`

## 🔧 How to Fix

### Option 1: Quick Fix (Recommended)

Update the Instana agent configuration with the correct values:

```bash
# Replace YOUR_AGENT_KEY with the actual Agent Key from Instana UI
AGENT_KEY="YOUR_AGENT_KEY_HERE"

# Update the secret with the correct Agent Key
oc delete secret instana-agent -n instana-agent
oc create secret generic instana-agent \
  --from-literal=key=$AGENT_KEY \
  -n instana-agent

# Update the DaemonSet with the correct endpoint
oc set env daemonset/instana-agent \
  -n instana-agent \
  INSTANA_AGENT_ENDPOINT=integration-bobinstana.instana.io

# Restart the agents to pick up new configuration
oc rollout restart daemonset/instana-agent -n instana-agent

# Wait for agents to restart
oc rollout status daemonset/instana-agent -n instana-agent

# Check agent logs (should see successful connection)
oc logs -n instana-agent -l app=instana-agent --tail=20
```

### Option 2: Manual Fix via YAML

1. **Update the Secret:**
```bash
# Get your Agent Key from Instana UI first
AGENT_KEY="YOUR_AGENT_KEY_HERE"

# Encode it to base64
echo -n "$AGENT_KEY" | base64

# Edit the secret
oc edit secret instana-agent -n instana-agent

# Replace the 'key' value with your base64-encoded Agent Key
```

2. **Update the DaemonSet:**
```bash
oc edit daemonset instana-agent -n instana-agent

# Find and change:
# - name: INSTANA_AGENT_ENDPOINT
#   value: ingress-red-saas.instana.io
# 
# To:
# - name: INSTANA_AGENT_ENDPOINT
#   value: integration-bobinstana.instana.io
```

3. **Restart Agents:**
```bash
oc rollout restart daemonset/instana-agent -n instana-agent
```

## ✅ Verification

After applying the fix, verify the agents are working:

### 1. Check Agent Status
```bash
# All agents should be Running with 0 restarts
oc get pods -n instana-agent
```

### 2. Check Agent Logs
```bash
# Should see successful connection messages
oc logs -n instana-agent -l app=instana-agent --tail=50 | grep -i "connected\|started\|ready"
```

### 3. Check Instana UI
1. Go to: https://integration-bobinstana.instana.io
2. Navigate to **Infrastructure** → **Kubernetes**
3. You should now see your OpenShift cluster
4. Click on the cluster to see nodes, pods, and services

## 🎯 Expected Results

After the fix:
- ✅ Agents connect successfully to Instana
- ✅ No more 401 authentication errors
- ✅ Kubernetes cluster visible in Instana UI
- ✅ Pods and services appear in Infrastructure view
- ✅ Metrics start flowing to Instana

## 📊 Current Status

**Before Fix:**
```
Agents: Running but failing (30 restarts each)
Error: 401 Unauthorized
Endpoint: ingress-red-saas.instana.io (wrong)
Key Type: API Token (wrong)
Instana UI: No cluster visible
```

**After Fix:**
```
Agents: Running successfully (0 restarts)
Connection: Successful
Endpoint: integration-bobinstana.instana.io (correct)
Key Type: Agent Key (correct)
Instana UI: Cluster visible with all resources
```

## 🚀 Next Steps After Fix

Once the agents are connected:

1. **Verify Cluster Visibility**
   - Check Instana UI for your OpenShift cluster
   - Verify pods are visible

2. **Create Alert Configuration**
   - Go to Settings → Alerts
   - Create alert for Pod Memory > 80%
   - Assign to "Bob AI Agent Webhook" channel

3. **Run Demo**
   ```bash
   ./scripts/trigger-demo.sh
   ```

4. **Monitor Workflow**
   - Watch Instana for alert generation
   - Check Bob agent logs for processing
   - Verify GitHub commit
   - Monitor pipeline execution
   - Confirm GitOps deployment

## 📚 Additional Information

### Difference Between API Token and Agent Key

**API Token** (`i2Ca6eu8Rritkcp9LzInxQ`):
- Used for: API calls, webhooks, integrations
- Purpose: Query data, create alerts, manage configuration
- Location: Settings → API Tokens

**Agent Key** (Download Key):
- Used for: Agent authentication and downloads
- Purpose: Allow agents to connect and send data
- Location: Settings → Team Settings → Agent Keys

### Why This Matters

Without the correct Agent Key:
- Agents cannot authenticate with Instana
- No data is collected from your cluster
- Applications don't appear in Instana UI
- Alerts cannot be generated
- The autonomous remediation workflow cannot function

## 🔍 Troubleshooting

### If agents still fail after fix:

1. **Check the Agent Key is correct:**
   ```bash
   oc get secret instana-agent -n instana-agent -o jsonpath='{.data.key}' | base64 -d
   ```

2. **Verify endpoint is correct:**
   ```bash
   oc get daemonset instana-agent -n instana-agent -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="INSTANA_AGENT_ENDPOINT")].value}'
   ```

3. **Check agent logs for specific errors:**
   ```bash
   oc logs -n instana-agent -l app=instana-agent --tail=100
   ```

4. **Test connectivity to Instana:**
   ```bash
   oc run test-curl --image=curlimages/curl --rm -it --restart=Never -- \
     curl -v https://integration-bobinstana.instana.io
   ```

## 📞 Support

If you continue to have issues:
1. Verify your Instana SaaS instance is accessible
2. Confirm you have the correct Agent Key from Instana UI
3. Check network connectivity from OpenShift to Instana
4. Review Instana documentation for agent installation

---

**Status:** Configuration fix required
**Priority:** HIGH - Blocks demo execution
**Estimated Time:** 5-10 minutes
**Required:** Agent Key from Instana UI