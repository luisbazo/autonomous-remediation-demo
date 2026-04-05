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
echo -e "${GREEN}Autonomous Remediation Demo Cleanup${NC}"
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

# Delete demo resources in the project namespace
echo -e "\n${YELLOW}Deleting demo resources from namespace: $OCP_NAMESPACE${NC}"

oc delete -k k8s/base -n $OCP_NAMESPACE --ignore-not-found=true || true
oc delete -f pipeline/pipeline.yaml -n $OCP_NAMESPACE --ignore-not-found=true || true

oc delete service bob-agent -n $OCP_NAMESPACE --ignore-not-found=true || true
oc delete deployment bob-agent -n $OCP_NAMESPACE --ignore-not-found=true || true
oc delete secret bob-webhook -n $OCP_NAMESPACE --ignore-not-found=true || true
oc delete secret github-token -n $OCP_NAMESPACE --ignore-not-found=true || true
oc delete configmap bob-agent-code -n $OCP_NAMESPACE --ignore-not-found=true || true

echo -e "${GREEN}✓ Demo resources removed from $OCP_NAMESPACE${NC}"

# Delete shared/cluster-related resources created by setup
echo -e "\n${YELLOW}Deleting shared resources...${NC}"

oc delete -f gitops/application.yaml --ignore-not-found=true || true
oc delete secret instana-agent -n instana-agent --ignore-not-found=true || true

echo -e "${GREEN}✓ Shared resources removed${NC}"

# Optionally delete namespaces created by setup
if oc get namespace instana-agent >/dev/null 2>&1; then
    echo -e "\n${YELLOW}Deleting namespace: instana-agent${NC}"
    oc delete project instana-agent --ignore-not-found=true || true
fi

if oc get namespace "$OCP_NAMESPACE" >/dev/null 2>&1; then
    echo -e "\n${YELLOW}Deleting namespace: $OCP_NAMESPACE${NC}"
    oc delete project "$OCP_NAMESPACE" --ignore-not-found=true || true
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nRemoved resources created by [scripts/setup-demo.sh](scripts/setup-demo.sh)."
echo -e "Cleanup script: ${YELLOW}./scripts/delete-demo.sh${NC}"

# Made with Bob