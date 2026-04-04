# Architecture Documentation

## System Overview

The Autonomous Memory Leak Remediation system demonstrates a complete end-to-end workflow for detecting, analyzing, fixing, and deploying corrections for memory leaks in a Quarkus application running on OpenShift.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OpenShift Cluster                                  │
│                                                                              │
│  ┌──────────────────┐         ┌──────────────────┐                         │
│  │  Quarkus App     │         │  Instana Agent   │                         │
│  │  (Memory Leak)   │◄────────│  (DaemonSet)     │                         │
│  │                  │         │                  │                         │
│  │  - REST API      │         │  - Monitors JVM  │                         │
│  │  - Memory Leak   │         │  - Collects      │                         │
│  │  - Health Checks │         │    Metrics       │                         │
│  └────────┬─────────┘         └────────┬─────────┘                         │
│           │                            │                                    │
│           │                            │                                    │
│           │                            ▼                                    │
│           │                   ┌─────────────────┐                          │
│           │                   │  Instana SaaS   │                          │
│           │                   │                 │                          │
│           │                   │  - Alert Engine │                          │
│           │                   │  - Webhooks     │                          │
│           │                   └────────┬────────┘                          │
│           │                            │                                    │
│           │                            │ Alert Webhook                      │
│           │                            ▼                                    │
│           │                   ┌─────────────────┐                          │
│           │                   │   Bob AI Agent  │                          │
│           │                   │                 │                          │
│           │                   │  - Alert Handler│                          │
│           │                   │  - Code Analyzer│                          │
│           │                   │  - Fix Generator│                          │
│           │                   │  - GitHub Client│                          │
│           │                   └────────┬────────┘                          │
│           │                            │                                    │
└───────────┼────────────────────────────┼────────────────────────────────────┘
            │                            │
            │                            │ Fetch Code / Create PR
            │                            ▼
            │                   ┌─────────────────┐
            │                   │     GitHub      │
            │                   │                 │
            │                   │  - Source Code  │
            │                   │  - Pull Requests│
            │                   └────────┬────────┘
            │                            │
            │                            │ Webhook on PR Merge
            │                            ▼
            │                   ┌─────────────────┐
            │                   │ OpenShift       │
            │                   │ Pipeline        │
            │                   │ (Tekton)        │
            │                   │                 │
            │                   │  - Build        │
            │                   │  - Test         │
            │                   │  - Push Image   │
            │                   └────────┬────────┘
            │                            │
            │                            │ Update Image Tag
            │                            ▼
            │                   ┌─────────────────┐
            │                   │   ArgoCD        │
            │                   │   (GitOps)      │
            │                   │                 │
            │                   │  - Sync         │
            │                   │  - Deploy       │
            │                   └────────┬────────┘
            │                            │
            │                            │ Deploy Fixed App
            └────────────────────────────┘
```

## Component Details

### 1. Quarkus Application

**Purpose:** Demonstrates a memory leak that triggers the autonomous remediation workflow.

**Key Features:**
- REST API with multiple endpoints
- Intentional memory leak using static collections
- Health checks and metrics endpoints
- Instana Java agent integration

**Memory Leak Pattern:**
```java
private static final Map<String, List<byte[]>> LEAKED_MEMORY = new ConcurrentHashMap<>();
```

The `static` modifier prevents garbage collection, causing memory to accumulate indefinitely.

**Endpoints:**
- `GET /api/health` - Health check
- `POST /api/trigger-leak` - Trigger memory leak
- `GET /api/memory-stats` - Get memory statistics
- `DELETE /api/clear-leaks` - Attempt to clear leaks
- `POST /api/reset` - Reset application state

### 2. Instana Agent

**Purpose:** Monitors the Quarkus application and detects memory issues.

**Deployment:** DaemonSet on OpenShift cluster

**Configuration:**
- Monitors JVM heap memory usage
- Tracks garbage collection activity
- Detects memory leak patterns
- Sends alerts to Instana SaaS

**Alert Triggers:**
- Memory usage > 80% for 5 minutes (Warning)
- Memory usage > 90% for 2 minutes (Critical)
- Continuous memory growth pattern
- Excessive GC activity

### 3. Instana SaaS

**Purpose:** Central monitoring and alerting platform.

**Features:**
- Real-time metrics collection
- Alert rule engine
- Webhook notifications
- Historical data analysis

**Alert Configuration:**
```json
{
  "name": "Memory Leak Detection",
  "threshold": 80,
  "duration": 300,
  "action": "webhook to Bob AI Agent"
}
```

### 4. Bob AI Agent

**Purpose:** Autonomous agent that analyzes alerts and fixes code issues.

**Architecture:**
```
┌─────────────────────────────────────┐
│         Bob AI Agent                │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   Express Web Server         │  │
│  │   - Webhook Endpoint         │  │
│  │   - Health Check             │  │
│  │   - Status API               │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │   Instana Alert Handler      │  │
│  │   - Validates alerts         │  │
│  │   - Orchestrates workflow    │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │   Code Analyzer              │  │
│  │   - Pattern detection        │  │
│  │   - Static analysis          │  │
│  │   - Issue identification     │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │   Fix Generator              │  │
│  │   - Generate fixes           │  │
│  │   - Create explanations      │  │
│  │   - Validate changes         │  │
│  └──────────┬───────────────────┘  │
│             │                       │
│  ┌──────────▼───────────────────┐  │
│  │   GitHub Integration         │  │
│  │   - Fetch source code        │  │
│  │   - Create branches          │  │
│  │   - Commit changes           │  │
│  │   - Create pull requests     │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │   MCP Client                 │  │
│  │   - Instana MCP Server       │  │
│  │   - OCP MCP Server           │  │
│  │   - GitHub MCP Server        │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Workflow:**
1. Receive alert webhook from Instana
2. Validate alert is memory-related
3. Fetch additional context from Instana via MCP
4. Identify affected source files
5. Fetch source code from GitHub
6. Analyze code for memory leak patterns
7. Generate fix by removing `static` modifier
8. Create new branch in GitHub
9. Commit fixed code
10. Create pull request with detailed explanation

**Code Analysis Patterns:**
- Static collections without cleanup
- Large allocations without limits
- Collections that grow indefinitely
- Resource leaks (unclosed streams, connections)

### 5. GitHub Repository

**Purpose:** Version control and code review platform.

**Integration Points:**
- Source code storage
- Pull request workflow
- Webhook triggers for CI/CD
- Code review and approval

**Automated PR Contents:**
- Fixed source code
- Detailed explanation of the issue
- Description of the fix applied
- Link to original Instana alert
- Testing checklist

### 6. OpenShift Pipeline (Tekton)

**Purpose:** CI/CD pipeline for building and testing the application.

**Pipeline Stages:**
1. **Fetch Repository** - Clone source code
2. **Build Application** - Maven build
3. **Run Tests** - Execute unit and integration tests
4. **Build Image** - Create container image with Buildah
5. **Push Image** - Push to container registry
6. **Update GitOps** - Update image tag in GitOps repo

**Triggers:**
- GitHub webhook on PR merge to main branch
- Manual trigger via OpenShift console
- Scheduled builds (optional)

**Pipeline Definition:**
```yaml
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: quarkus-memory-leak-app-pipeline
spec:
  tasks:
    - name: fetch-repository
    - name: build-application
    - name: run-tests
    - name: build-image
    - name: push-image
    - name: update-gitops-repo
```

### 7. ArgoCD (GitOps)

**Purpose:** Continuous deployment using GitOps principles.

**Features:**
- Automatic synchronization
- Self-healing deployments
- Rollback capabilities
- Multi-environment support

**Sync Policy:**
```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  retry:
    limit: 5
    backoff:
      duration: 5s
```

**Workflow:**
1. Monitor GitOps repository for changes
2. Detect new image tag in Kustomize configuration
3. Apply changes to OpenShift cluster
4. Verify deployment health
5. Report sync status

## Data Flow

### Alert to Fix Flow

```
1. Memory Leak Occurs
   └─> Quarkus app allocates memory in static collection
   
2. Instana Detects Issue
   └─> Agent monitors JVM metrics
   └─> Detects memory usage > 80%
   └─> Sends alert to Instana SaaS
   
3. Alert Webhook Triggered
   └─> Instana SaaS sends webhook to Bob
   └─> Includes alert details and metrics
   
4. Bob Analyzes Alert
   └─> Validates it's a memory leak
   └─> Fetches additional context from Instana
   └─> Identifies affected application
   
5. Bob Fetches Source Code
   └─> Uses GitHub API to get file content
   └─> Retrieves MemoryLeakResource.java
   
6. Bob Analyzes Code
   └─> Scans for memory leak patterns
   └─> Identifies static collection
   └─> Determines root cause
   
7. Bob Generates Fix
   └─> Removes 'static' modifier
   └─> Creates explanation
   └─> Validates syntax
   
8. Bob Creates PR
   └─> Creates new branch
   └─> Commits fixed code
   └─> Opens pull request
   └─> Adds detailed description
```

### Build and Deploy Flow

```
1. PR Merged to Main
   └─> GitHub webhook triggered
   
2. Pipeline Starts
   └─> Fetches latest code
   └─> Builds with Maven
   └─> Runs tests
   
3. Tests Pass
   └─> Builds container image
   └─> Pushes to registry
   └─> Updates GitOps repo
   
4. ArgoCD Detects Change
   └─> Syncs new configuration
   └─> Deploys updated image
   
5. Application Updated
   └─> Rolling update performed
   └─> Health checks pass
   └─> Memory leak resolved
```

## Security Considerations

### Secrets Management
- All credentials stored in OpenShift Secrets
- GitHub tokens with minimal required permissions
- Instana API tokens scoped appropriately
- Webhook secrets for authentication

### Network Security
- TLS encryption for all external communication
- Network policies restrict pod-to-pod communication
- Service mesh for internal traffic (optional)

### RBAC
- Bob agent has limited permissions
- Pipeline service account scoped to namespace
- ArgoCD uses dedicated service account

### Code Review
- All automated fixes require PR approval
- Tests must pass before merge
- Manual review recommended for critical changes

## Scalability

### Horizontal Scaling
- Quarkus app can scale to multiple replicas
- Bob agent can handle concurrent alerts
- Pipeline supports parallel execution

### Performance
- Bob processes alerts in < 30 seconds
- Pipeline completes in 5-10 minutes
- GitOps sync occurs within 1 minute

## Monitoring and Observability

### Metrics
- Application metrics via Prometheus
- Pipeline metrics via Tekton dashboard
- GitOps metrics via ArgoCD UI
- Bob agent exposes /status endpoint

### Logging
- Structured JSON logging
- Centralized log aggregation
- Alert correlation IDs
- Audit trail for all changes

### Tracing
- Distributed tracing with OpenTelemetry
- End-to-end request tracking
- Performance profiling

## Disaster Recovery

### Backup Strategy
- Git repositories are source of truth
- Container images stored in registry
- Configuration in GitOps repo
- Secrets backed up securely

### Recovery Procedures
1. Restore from Git repository
2. Redeploy using GitOps
3. Verify application health
4. Restore secrets if needed

## Future Enhancements

1. **Multi-Language Support**
   - Extend to Python, Node.js, Go
   - Language-specific analyzers
   
2. **Advanced AI Analysis**
   - Machine learning for pattern detection
   - Predictive issue identification
   
3. **Automated Testing**
   - Generate test cases for fixes
   - Performance regression testing
   
4. **Multi-Cluster Support**
   - Deploy across multiple clusters
   - Cross-cluster monitoring
   
5. **Enhanced Reporting**
   - Dashboards for remediation metrics
   - Trend analysis
   - Cost savings calculations

## Conclusion

This architecture demonstrates a complete autonomous remediation workflow that:
- Detects issues automatically
- Analyzes root causes
- Generates and applies fixes
- Deploys corrections safely
- Maintains full audit trail

The system is production-ready and can be extended to handle various types of issues beyond memory leaks.