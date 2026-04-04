# Quick Start Guide

Get the autonomous remediation demo running in under 30 minutes!

## Prerequisites

Before starting, ensure you have:

- ✅ OpenShift cluster (v4.12+) with admin access
- ✅ Instana SaaS account with API token
- ✅ GitHub account with personal access token
- ✅ Local machine with:
  - `oc` CLI tool
  - `kubectl`
  - Node.js 18+
  - Java 17+
  - Maven 3.8+
  - `git`
  - `curl` and `jq`

## Step 1: Clone and Configure (5 minutes)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/autonomous-remediation-demo.git
cd autonomous-remediation-demo

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Configuration:**
```bash
# Instana
INSTANA_BASE_URL=https://your-tenant.instana.io
INSTANA_API_TOKEN=your_api_token_here

# OpenShift
OCP_API_URL=https://api.your-cluster.com:6443
OCP_TOKEN=your_ocp_token_here
OCP_NAMESPACE=demo-namespace

# GitHub
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=autonomous-remediation-demo

# Bob AI Agent
BOB_WEBHOOK_SECRET=change_this_to_a_secure_random_string
```

## Step 2: Automated Setup (15 minutes)

Run the automated setup script:

```bash
./scripts/setup-demo.sh
```

This script will:
1. ✅ Verify prerequisites
2. ✅ Login to OpenShift
3. ✅ Create namespaces
4. ✅ Deploy Instana agent
5. ✅ Build and deploy Bob AI agent
6. ✅ Build and deploy Quarkus application
7. ✅ Configure CI/CD pipeline
8. ✅ Setup GitOps with ArgoCD

**Expected Output:**
```
========================================
Setup Complete!
========================================

Application URL: https://quarkus-memory-leak-app-demo-namespace.apps.your-cluster.com
Bob Agent: http://bob-agent.demo-namespace.svc.cluster.local:3000

Next steps:
1. Run the demo: ./scripts/run-demo.sh
2. Monitor Instana: https://your-tenant.instana.io
3. Check GitHub PRs: https://github.com/your-username/autonomous-remediation-demo/pulls
```

## Step 3: Run the Demo (10 minutes)

Execute the end-to-end demonstration:

```bash
./scripts/run-demo.sh
```

**What Happens:**

1. **Health Check** - Verifies application is running
2. **Baseline Metrics** - Records initial memory usage
3. **Trigger Leak** - Calls the leak endpoint 5 times (50MB total)
4. **Monitor Growth** - Watches memory usage increase
5. **Wait for Alert** - Instana detects high memory usage
6. **Bob Analyzes** - AI agent receives alert and analyzes code
7. **Fix Generated** - Bob creates a fix and opens PR
8. **Pipeline Runs** - CI/CD builds and tests the fix
9. **GitOps Deploys** - ArgoCD deploys the fixed version
10. **Verification** - Confirms memory leak is resolved

## Step 4: Monitor the Workflow

### Watch Application Logs
```bash
oc logs -f deployment/quarkus-memory-leak-app -n demo-namespace
```

### Watch Bob AI Agent
```bash
oc logs -f deployment/bob-agent -n demo-namespace
```

### Watch Instana Agent
```bash
oc logs -f daemonset/instana-agent -n instana-agent
```

### Check Memory Stats
```bash
APP_URL=$(oc get route quarkus-memory-leak-app -n demo-namespace -o jsonpath='{.spec.host}')
curl https://$APP_URL/api/memory-stats | jq
```

### View Pipeline Status
```bash
tkn pipelinerun list -n demo-namespace
tkn pipelinerun logs -f <pipelinerun-name> -n demo-namespace
```

### Check GitOps Status
```bash
oc get application quarkus-memory-leak-app -n openshift-gitops -o yaml
```

## Step 5: Verify the Fix

After the pipeline completes and GitOps deploys:

```bash
# Check memory usage is stable
curl https://$APP_URL/api/memory-stats | jq '.memoryUsagePercent'

# Verify no new alerts in Instana
# Check your Instana dashboard

# View the auto-generated PR
# Visit: https://github.com/YOUR_USERNAME/autonomous-remediation-demo/pulls
```

## Troubleshooting

### Application Not Starting

```bash
# Check pod status
oc get pods -n demo-namespace

# View pod events
oc describe pod <pod-name> -n demo-namespace

# Check logs
oc logs <pod-name> -n demo-namespace
```

### Instana Not Detecting Leak

```bash
# Verify agent is running
oc get pods -n instana-agent

# Check agent logs
oc logs daemonset/instana-agent -n instana-agent

# Manually trigger more leaks
for i in {1..10}; do
  curl -X POST https://$APP_URL/api/trigger-leak?size=10
  sleep 5
done
```

### Bob Not Receiving Alerts

```bash
# Check Bob agent logs
oc logs deployment/bob-agent -n demo-namespace

# Verify webhook configuration in Instana UI
# Check webhook secret matches

# Test Bob health endpoint
oc port-forward deployment/bob-agent 3000:3000 -n demo-namespace
curl http://localhost:3000/health
```

### Pipeline Not Triggering

```bash
# Check GitHub webhook configuration
# Verify webhook secret

# Manually trigger pipeline
tkn pipeline start quarkus-memory-leak-app-pipeline \
  --workspace name=shared-workspace,claimName=pipeline-pvc \
  -n demo-namespace
```

### GitOps Not Syncing

```bash
# Check ArgoCD application
oc get application -n openshift-gitops

# Force sync
argocd app sync quarkus-memory-leak-app

# Check ArgoCD logs
oc logs deployment/openshift-gitops-application-controller -n openshift-gitops
```

## Manual Testing

### Trigger Memory Leak Manually

```bash
# Trigger 10MB leak
curl -X POST https://$APP_URL/api/trigger-leak?size=10

# Trigger 50MB leak
curl -X POST https://$APP_URL/api/trigger-leak?size=50

# Check memory stats
curl https://$APP_URL/api/memory-stats | jq
```

### Test Bob Directly

```bash
# Port forward to Bob
oc port-forward deployment/bob-agent 3000:3000 -n demo-namespace

# Trigger manual analysis
curl -X POST http://localhost:3000/trigger/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java",
    "repository": "autonomous-remediation-demo"
  }' | jq
```

### View Bob Status

```bash
curl http://localhost:3000/status | jq
```

## Cleanup

To remove all components:

```bash
# Delete application
oc delete all -l app=quarkus-memory-leak-app -n demo-namespace

# Delete Bob agent
oc delete all -l app=bob-agent -n demo-namespace

# Delete Instana agent
oc delete all -n instana-agent

# Delete namespaces
oc delete project demo-namespace
oc delete project instana-agent

# Delete GitOps application
oc delete application quarkus-memory-leak-app -n openshift-gitops
```

## Next Steps

After completing the quick start:

1. **Explore the Code**
   - Review [`MemoryLeakResource.java`](../quarkus-app/src/main/java/com/ibm/demo/MemoryLeakResource.java)
   - Examine Bob's [code analyzer](../bob-agent/src/analyzers/code-analyzer.ts)
   - Study the [fix generator](../bob-agent/src/generators/fix-generator.ts)

2. **Customize the Demo**
   - Add more memory leak patterns
   - Extend Bob to detect other issues
   - Integrate with your own applications

3. **Read the Documentation**
   - [Architecture Details](ARCHITECTURE.md)
   - [Instana Setup](INSTANA_SETUP.md)
   - [Bob AI Agent](BOB_AGENT.md)
   - [Pipeline Configuration](PIPELINE.md)
   - [GitOps Setup](GITOPS.md)

4. **Experiment**
   - Try different leak sizes
   - Test with multiple concurrent leaks
   - Simulate failed fixes
   - Test rollback scenarios

## Support

For issues or questions:
- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Review [GitHub Issues](https://github.com/YOUR_USERNAME/autonomous-remediation-demo/issues)
- Consult the [Architecture Documentation](ARCHITECTURE.md)

## Success Criteria

You've successfully completed the quick start when:

- ✅ Application is running and accessible
- ✅ Memory leak can be triggered via API
- ✅ Instana detects the memory issue
- ✅ Bob receives the alert and analyzes code
- ✅ Pull request is automatically created
- ✅ Pipeline builds and tests the fix
- ✅ GitOps deploys the corrected version
- ✅ Memory usage stabilizes after deployment

**Congratulations! You've completed the autonomous remediation demo!** 🎉