#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found. Please copy .env.example to .env and configure it.${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Autonomous Remediation Demo Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
MISSING_DEPS=()

if ! command_exists oc; then
    MISSING_DEPS+=("oc (OpenShift CLI)")
fi

# kubectl is optional - oc can be used instead for OpenShift
# if ! command_exists kubectl; then
#     MISSING_DEPS+=("kubectl")
# fi

if ! command_exists node; then
    MISSING_DEPS+=("node (Node.js)")
fi

if ! command_exists mvn; then
    MISSING_DEPS+=("mvn (Maven)")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}Missing required dependencies:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo -e "  - $dep"
    done
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"

# Login to OpenShift
echo -e "\n${YELLOW}Logging into OpenShift...${NC}"
oc login --token=$OCP_TOKEN --server=$OCP_API_URL --insecure-skip-tls-verify=true
echo -e "${GREEN}✓ Logged into OpenShift${NC}"

# Create namespace
echo -e "\n${YELLOW}Creating namespace: $OCP_NAMESPACE${NC}"
oc new-project $OCP_NAMESPACE 2>/dev/null || oc project $OCP_NAMESPACE
echo -e "${GREEN}✓ Namespace ready${NC}"

# Create Instana agent namespace
echo -e "\n${YELLOW}Creating Instana agent namespace...${NC}"
oc new-project instana-agent 2>/dev/null || oc project instana-agent
echo -e "${GREEN}✓ Instana namespace ready${NC}"

# Create secrets
echo -e "\n${YELLOW}Creating secrets...${NC}"

# Instana agent secret
oc create secret generic instana-agent \
    --from-literal=key=$INSTANA_API_TOKEN \
    -n instana-agent \
    --dry-run=client -o yaml | oc apply -f -

# Bob webhook secret
oc create secret generic bob-webhook \
    --from-literal=secret=$BOB_WEBHOOK_SECRET \
    -n $OCP_NAMESPACE \
    --dry-run=client -o yaml | oc apply -f -

# GitHub token secret
oc create secret generic github-token \
    --from-literal=token=$GITHUB_TOKEN \
    -n $OCP_NAMESPACE \
    --dry-run=client -o yaml | oc apply -f -

echo -e "${GREEN}✓ Secrets created${NC}"

# Deploy Instana agent
echo -e "\n${YELLOW}Deploying Instana agent...${NC}"
oc apply -f instana-config/agent-config.yaml -n instana-agent
oc apply -f instana-config/agent-daemonset.yaml -n instana-agent
echo -e "${GREEN}✓ Instana agent deployed${NC}"

# Build and deploy Bob AI agent
echo -e "\n${YELLOW}Building Bob AI agent...${NC}"
cd bob-agent
npm install
npm run build
cd ..
echo -e "${GREEN}✓ Bob agent built${NC}"

# Create Bob agent deployment
echo -e "\n${YELLOW}Deploying Bob AI agent...${NC}"
cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bob-agent
  namespace: $OCP_NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bob-agent
  template:
    metadata:
      labels:
        app: bob-agent
    spec:
      containers:
      - name: bob-agent
        image: node:18-alpine
        command: ["node", "/app/dist/index.js"]
        ports:
        - containerPort: 3000
        env:
        - name: BOB_WEBHOOK_PORT
          value: "3000"
        - name: BOB_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: bob-webhook
              key: secret
        - name: INSTANA_BASE_URL
          value: "$INSTANA_BASE_URL"
        - name: INSTANA_API_TOKEN
          value: "$INSTANA_API_TOKEN"
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: github-token
              key: token
        - name: GITHUB_REPO_OWNER
          value: "$GITHUB_REPO_OWNER"
        - name: GITHUB_REPO_NAME
          value: "$GITHUB_REPO_NAME"
        - name: OCP_API_URL
          value: "$OCP_API_URL"
        - name: OCP_TOKEN
          value: "$OCP_TOKEN"
        volumeMounts:
        - name: app-code
          mountPath: /app
      volumes:
      - name: app-code
        configMap:
          name: bob-agent-code
---
apiVersion: v1
kind: Service
metadata:
  name: bob-agent
  namespace: $OCP_NAMESPACE
spec:
  selector:
    app: bob-agent
  ports:
  - port: 3000
    targetPort: 3000
EOF
echo -e "${GREEN}✓ Bob agent deployed${NC}"

# Build Quarkus application
echo -e "\n${YELLOW}Building Quarkus application...${NC}"
cd quarkus-app
./mvnw clean package -DskipTests
cd ..
echo -e "${GREEN}✓ Quarkus application built${NC}"

# Deploy Quarkus application
echo -e "\n${YELLOW}Deploying Quarkus application...${NC}"
oc apply -k k8s/base -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Quarkus application deployed${NC}"

# Install Tekton Pipelines (if not already installed)
echo -e "\n${YELLOW}Setting up Tekton Pipelines...${NC}"
oc apply -f pipeline/pipeline.yaml -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Pipeline configured${NC}"

# Install OpenShift GitOps (ArgoCD)
echo -e "\n${YELLOW}Setting up GitOps...${NC}"
oc apply -f gitops/application.yaml
echo -e "${GREEN}✓ GitOps configured${NC}"

# Wait for deployments
echo -e "\n${YELLOW}Waiting for deployments to be ready...${NC}"
oc wait --for=condition=available --timeout=300s deployment/quarkus-memory-leak-app -n $OCP_NAMESPACE
oc wait --for=condition=available --timeout=300s deployment/bob-agent -n $OCP_NAMESPACE
echo -e "${GREEN}✓ All deployments ready${NC}"

# Get application URL
APP_URL=$(oc get route quarkus-memory-leak-app -n $OCP_NAMESPACE -o jsonpath='{.spec.host}')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nApplication URL: ${YELLOW}https://$APP_URL${NC}"
echo -e "Bob Agent: ${YELLOW}http://bob-agent.$OCP_NAMESPACE.svc.cluster.local:3000${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Run the demo: ${GREEN}./scripts/run-demo.sh${NC}"
echo -e "2. Monitor Instana: ${GREEN}$INSTANA_BASE_URL${NC}"
echo -e "3. Check GitHub PRs: ${GREEN}https://github.com/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/pulls${NC}"
echo -e "\n${YELLOW}To trigger the memory leak manually:${NC}"
echo -e "${GREEN}curl -X POST https://$APP_URL/api/trigger-leak?size=10${NC}"

# Made with Bob
