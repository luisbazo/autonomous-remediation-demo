# Autonomous Memory Leak Remediation Demo

## 🎯 Project Overview

This project demonstrates an end-to-end autonomous remediation workflow where an AI agent (Bob) automatically detects, analyzes, fixes, and deploys corrections for memory leaks in a Quarkus application running on OpenShift.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Complete Workflow                            │
└─────────────────────────────────────────────────────────────────────┘

1. Quarkus App (Memory Leak) → OpenShift Cluster
2. Instana Agent → Monitors App → Detects Memory Leak
3. Instana SaaS → Generates Alert
4. Alert Webhook → Bob AI Agent
5. Bob → Analyzes Alert → Fetches Code from GitHub
6. Bob → Identifies Leak → Generates Fix → Commits to GitHub
7. GitHub Webhook → Triggers OpenShift Pipeline
8. Pipeline → Builds & Tests → Creates Container Image
9. GitOps (ArgoCD) → Detects New Image → Deploys to OpenShift
10. Fixed Application Running → Instana Confirms Resolution
```

## 📋 Components

### 1. **Quarkus Application** (`quarkus-app/`)
- REST API with intentional memory leak
- Endpoint to trigger leak on demand
- Health checks and metrics endpoints
- Instana Java agent integration

### 2. **Instana Monitoring** (`instana-config/`)
- Agent configuration for OpenShift
- Custom alerts for memory issues
- Webhook configuration for Bob

### 3. **Bob AI Agent** (`bob-agent/`)
- Alert listener service
- Code analysis engine
- Automated fix generator
- GitHub integration

### 4. **OpenShift Resources** (`k8s/`)
- Deployment manifests
- Service definitions
- ConfigMaps and Secrets
- Instana agent DaemonSet

### 5. **CI/CD Pipeline** (`pipeline/`)
- OpenShift Pipeline (Tekton)
- Build and test tasks
- Image push to registry
- GitOps sync trigger

### 6. **GitOps Configuration** (`gitops/`)
- ArgoCD Application definitions
- Kustomize overlays
- Environment-specific configs

## 🚀 Quick Start

### Prerequisites

- OpenShift cluster (v4.12+)
- Instana SaaS account with API token
- GitHub account with personal access token
- `oc` CLI tool installed
- `kubectl` installed
- Node.js 18+ (for Bob agent)
- Java 17+ and Maven (for Quarkus app)

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/autonomous-remediation-demo.git
cd autonomous-remediation-demo
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# - INSTANA_BASE_URL
# - INSTANA_API_TOKEN
# - GITHUB_TOKEN
# - OCP_API_URL
# - OCP_TOKEN
```

### Step 3: Deploy Infrastructure

```bash
# Run the automated setup script
./scripts/setup-demo.sh
```

This script will:
1. Create OpenShift namespace
2. Deploy Instana agent
3. Build and deploy Quarkus application
4. Configure Bob AI agent
5. Set up OpenShift Pipeline
6. Configure ArgoCD/GitOps

### Step 4: Run Demonstration

```bash
# Execute the end-to-end demo
./scripts/run-demo.sh
```

This will:
1. Trigger the memory leak
2. Wait for Instana alert
3. Show Bob analyzing and fixing
4. Display pipeline execution
5. Verify GitOps deployment
6. Confirm leak resolution

## 📖 Detailed Documentation

- [Architecture Details](docs/ARCHITECTURE.md)
- [Quarkus Application](docs/QUARKUS_APP.md)
- [Instana Configuration](docs/INSTANA_SETUP.md)
- [Bob AI Agent](docs/BOB_AGENT.md)
- [CI/CD Pipeline](docs/PIPELINE.md)
- [GitOps Setup](docs/GITOPS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🔧 Manual Setup

If you prefer manual setup over the automated script, follow these guides:

1. [Manual Quarkus Deployment](docs/manual/DEPLOY_QUARKUS.md)
2. [Manual Instana Setup](docs/manual/SETUP_INSTANA.md)
3. [Manual Bob Configuration](docs/manual/CONFIGURE_BOB.md)
4. [Manual Pipeline Setup](docs/manual/SETUP_PIPELINE.md)
5. [Manual GitOps Configuration](docs/manual/SETUP_GITOPS.md)

## 📊 Monitoring the Demo

### View Application Logs
```bash
oc logs -f deployment/quarkus-memory-leak-app -n demo-namespace
```

### Check Instana Alerts
```bash
# Using MCP server
node bob-agent/check-instana-alerts.js
```

### Monitor Pipeline Execution
```bash
tkn pipelinerun list -n demo-namespace
tkn pipelinerun logs -f <pipelinerun-name> -n demo-namespace
```

### View ArgoCD Status
```bash
argocd app get quarkus-memory-leak-app
argocd app sync quarkus-memory-leak-app
```

## 🧪 Testing

### Unit Tests
```bash
# Test Quarkus application
cd quarkus-app
./mvnw test

# Test Bob agent
cd bob-agent
npm test
```

### Integration Tests
```bash
# Run full integration test suite
./scripts/run-integration-tests.sh
```

### Load Testing
```bash
# Generate load to trigger memory leak faster
./scripts/load-test.sh
```

## 📁 Project Structure

```
.
├── README.md
├── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   ├── diagrams/
│   │   ├── architecture.png
│   │   ├── sequence.png
│   │   └── component.png
│   └── manual/
├── quarkus-app/
│   ├── src/
│   ├── pom.xml
│   └── README.md
├── bob-agent/
│   ├── src/
│   ├── package.json
│   └── README.md
├── k8s/
│   ├── base/
│   └── overlays/
├── pipeline/
│   ├── tasks/
│   ├── pipeline.yaml
│   └── README.md
├── gitops/
│   ├── applications/
│   └── README.md
├── instana-config/
│   ├── agent-config.yaml
│   ├── alerts.json
│   └── README.md
└── scripts/
    ├── setup-demo.sh
    ├── run-demo.sh
    └── cleanup.sh
```

## 🎬 Demo Scenarios

### Scenario 1: Basic Memory Leak Detection
1. Deploy application with memory leak
2. Trigger leak endpoint
3. Wait for Instana alert
4. Bob fixes and commits
5. Pipeline deploys fix

### Scenario 2: Multiple Concurrent Leaks
1. Introduce multiple leak patterns
2. Bob identifies all issues
3. Creates comprehensive fix
4. Single commit resolves all

### Scenario 3: Failed Fix Attempt
1. Bob generates incorrect fix
2. Pipeline tests fail
3. Bob analyzes test results
4. Generates corrected fix
5. Pipeline succeeds

## 🔐 Security Considerations

- All secrets stored in OpenShift Secrets
- GitHub tokens with minimal required permissions
- Instana API tokens scoped appropriately
- Network policies restrict pod communication
- RBAC configured for least privilege

## 🤝 Contributing

This is a demonstration project. For improvements:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Quarkus framework
- Instana observability platform
- OpenShift/Kubernetes
- Tekton Pipelines
- ArgoCD
- Model Context Protocol (MCP)

## 📞 Support

For issues or questions:
- Open a GitHub issue
- Check the troubleshooting guide
- Review the documentation

---

**Made with ❤️ by Bob AI Agent**