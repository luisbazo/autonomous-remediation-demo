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

if ! command_exists podman; then
    MISSING_DEPS+=("podman")
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

# Configure external image registry endpoint
REGISTRY_HOST=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}' 2>/dev/null || true)
if [ -z "$REGISTRY_HOST" ]; then
    echo -e "${RED}Error: OpenShift image registry route is not exposed. Expose the default route in openshift-image-registry before running setup.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Logging into OpenShift image registry...${NC}"
oc whoami -t | podman login --username kubeadmin --password-stdin --tls-verify=false "$REGISTRY_HOST"
echo -e "${GREEN}✓ Logged into image registry: $REGISTRY_HOST${NC}"

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

# GitHub webhook secret for Tekton trigger
oc create secret generic github-webhook-secret \
    --from-literal=secret=$BOB_WEBHOOK_SECRET \
    -n $OCP_NAMESPACE \
    --dry-run=client -o yaml | oc apply -f -

echo -e "${GREEN}✓ Secrets created${NC}"

# Grant image-builder permissions to service account (required for Instana native modules)
echo -e "\n${YELLOW}Granting image-builder permissions...${NC}"
oc policy add-role-to-user system:image-builder system:serviceaccount:$OCP_NAMESPACE:default -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Permissions granted${NC}"

# Build and push Bob AI agent image
echo -e "\n${YELLOW}Building Bob AI agent...${NC}"
cd bob-agent
npm install
npm run build
podman build --platform linux/amd64 -t bob-ai-agent:latest .
podman tag bob-ai-agent:latest $REGISTRY_HOST/$OCP_NAMESPACE/bob-ai-agent:latest
podman push --tls-verify=false $REGISTRY_HOST/$OCP_NAMESPACE/bob-ai-agent:latest
cd ..
echo -e "${GREEN}✓ Bob agent image built and pushed${NC}"

# Create Bob agent deployment
echo -e "\n${YELLOW}Deploying Bob AI agent...${NC}"
oc apply -f bob-agent/k8s/service.yaml -n $OCP_NAMESPACE
oc apply -f bob-agent/k8s/deployment.yaml -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Bob agent deployed${NC}"

# Build and push Quarkus application image
echo -e "\n${YELLOW}Building Quarkus application...${NC}"
cd quarkus-app
mvn clean package -DskipTests
podman build --platform linux/amd64 -t quarkus-memory-leak-app:latest .
podman tag quarkus-memory-leak-app:latest $REGISTRY_HOST/$OCP_NAMESPACE/quarkus-memory-leak-app:latest
podman push --tls-verify=false $REGISTRY_HOST/$OCP_NAMESPACE/quarkus-memory-leak-app:latest
cd ..
echo -e "${GREEN}✓ Quarkus application image built and pushed${NC}"

# Deploy Quarkus application
echo -e "\n${YELLOW}Deploying Quarkus application...${NC}"
oc apply -k k8s/base -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Quarkus application deployed${NC}"

# Install Tekton Pipelines and Triggers
echo -e "\n${YELLOW}Setting up Tekton Pipelines...${NC}"
oc apply -f pipeline/pipeline.yaml -n $OCP_NAMESPACE
oc apply -f pipeline/triggers.yaml -n $OCP_NAMESPACE
echo -e "${GREEN}✓ Pipeline and triggers configured${NC}"

# Install OpenShift GitOps (ArgoCD)
echo -e "\n${YELLOW}Setting up GitOps...${NC}"
oc apply -f gitops/application.yaml
echo -e "${GREEN}✓ GitOps configured${NC}"

# Wait for deployments
echo -e "\n${YELLOW}Waiting for deployments to be ready...${NC}"
oc wait --for=condition=available --timeout=300s deployment/quarkus-memory-leak-app -n $OCP_NAMESPACE
oc wait --for=condition=available --timeout=300s deployment/bob-ai-agent -n $OCP_NAMESPACE
echo -e "${GREEN}✓ All deployments ready${NC}"

# Get application and webhook URLs
APP_URL=$(oc get route quarkus-memory-leak-app -n $OCP_NAMESPACE -o jsonpath='{.spec.host}')
TEKTON_WEBHOOK_HOST=$(oc get route quarkus-memory-leak-app-listener -n $OCP_NAMESPACE -o jsonpath='{.spec.host}')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nApplication URL: ${YELLOW}https://$APP_URL${NC}"
echo -e "Bob Agent: ${YELLOW}http://bob-agent.$OCP_NAMESPACE.svc.cluster.local:3000${NC}"
echo -e "Tekton GitHub Webhook: ${YELLOW}https://$TEKTON_WEBHOOK_HOST${NC}"
echo -e "GitHub Webhook Endpoint: ${YELLOW}https://$TEKTON_WEBHOOK_HOST${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Run the demo: ${GREEN}./scripts/run-demo.sh${NC}"
echo -e "2. Configure a GitHub webhook to: ${GREEN}https://$TEKTON_WEBHOOK_HOST${NC}"
echo -e "3. Use content type: ${GREEN}application/json${NC}"
echo -e "4. Use secret: ${GREEN}$BOB_WEBHOOK_SECRET${NC}"
echo -e "5. Select the ${GREEN}Pushes${NC} event and target branch ${GREEN}main${NC}"
echo -e "6. Monitor Instana: ${GREEN}$INSTANA_BASE_URL${NC}"
echo -e "7. Check GitHub PRs: ${GREEN}https://github.com/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/pulls${NC}"
echo -e "\n${YELLOW}To trigger the memory leak manually:${NC}"
echo -e "${GREEN}curl -X POST https://$APP_URL/api/trigger-leak?size=10${NC}"

# Made with Bob
