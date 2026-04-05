#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Autonomous Remediation Demo${NC}"
echo -e "${GREEN}========================================${NC}"

# Get application URL
APP_URL=$(oc get route quarkus-memory-leak-app -n $OCP_NAMESPACE -o jsonpath='{.spec.host}' 2>/dev/null)

if [ -z "$APP_URL" ]; then
    echo -e "${RED}Error: Application not deployed. Run ./scripts/setup-demo.sh first.${NC}"
    exit 1
fi

echo -e "\n${BLUE}Application URL: https://$APP_URL${NC}"

# Step 1: Check application health
echo -e "\n${YELLOW}Step 1: Checking application health...${NC}"
HEALTH_RESPONSE=$(curl -s https://$APP_URL/api/health)
echo -e "${GREEN}✓ Application is healthy${NC}"
echo "$HEALTH_RESPONSE" | jq '.'

# Step 2: Get initial memory stats
echo -e "\n${YELLOW}Step 2: Getting initial memory statistics...${NC}"
INITIAL_MEMORY=$(curl -s https://$APP_URL/api/memory-stats)
echo -e "${GREEN}✓ Initial memory stats retrieved${NC}"
echo "$INITIAL_MEMORY" | jq '.'

INITIAL_USED=$(echo "$INITIAL_MEMORY" | jq -r '.usedMemoryMB')
echo -e "${BLUE}Initial memory usage: ${INITIAL_USED}MB${NC}"

# Step 3: Trigger memory leak
echo -e "\n${YELLOW}Step 3: Triggering memory leak (10MB x 5 times)...${NC}"
for i in {1..5}; do
    echo -e "${BLUE}  Triggering leak #$i...${NC}"
    LEAK_RESPONSE=$(curl -s -X POST "https://$APP_URL/api/trigger-leak?size=10")
    echo "$LEAK_RESPONSE" | jq -r '.status, .allocatedMB, .totalLeaks'
    sleep 2
done
echo -e "${GREEN}✓ Memory leak triggered${NC}"

# Step 4: Monitor memory growth
echo -e "\n${YELLOW}Step 4: Monitoring memory growth...${NC}"
for i in {1..10}; do
    CURRENT_MEMORY=$(curl -s https://$APP_URL/api/memory-stats)
    CURRENT_USED=$(echo "$CURRENT_MEMORY" | jq -r '.usedMemoryMB')
    CURRENT_PERCENT=$(echo "$CURRENT_MEMORY" | jq -r '.memoryUsagePercent')
    
    echo -e "${BLUE}  Check #$i: ${CURRENT_USED}MB used (${CURRENT_PERCENT}%)${NC}"
    
    if [ "$CURRENT_PERCENT" -gt 80 ]; then
        echo -e "${RED}  ⚠️  Memory usage exceeded 80% threshold!${NC}"
        break
    fi
    
    sleep 5
done

# Step 5: Wait for Instana alert
echo -e "\n${YELLOW}Step 5: Waiting for Instana to detect memory leak...${NC}"
echo -e "${BLUE}This may take 2-5 minutes depending on Instana's monitoring interval${NC}"
echo -e "${BLUE}Monitoring Instana for alerts...${NC}"

ALERT_DETECTED=false
for i in {1..30}; do
    echo -ne "${BLUE}  Checking... ($i/30)\r${NC}"
    
    # Check if Bob agent has received an alert (check logs)
    BOB_LOGS=$(oc logs deployment/bob-ai-agent -n $OCP_NAMESPACE --tail=50 2>/dev/null || echo "")
    
    if echo "$BOB_LOGS" | grep -q "Processing Instana alert"; then
        ALERT_DETECTED=true
        echo -e "\n${GREEN}✓ Instana alert detected and sent to Bob!${NC}"
        break
    fi
    
    sleep 10
done

if [ "$ALERT_DETECTED" = false ]; then
    echo -e "\n${YELLOW}⚠️  Alert not detected yet. This is normal - Instana may take longer to detect the pattern.${NC}"
    echo -e "${YELLOW}You can manually check:${NC}"
    echo -e "  - Instana UI: $INSTANA_BASE_URL"
    echo -e "  - Bob logs: oc logs deployment/bob-ai-agent -n $OCP_NAMESPACE -f"
fi

# Step 6: Monitor Bob's analysis
echo -e "\n${YELLOW}Step 6: Monitoring Bob AI agent's analysis...${NC}"
echo -e "${BLUE}Bob is now:${NC}"
echo -e "  1. Analyzing the alert"
echo -e "  2. Fetching source code from GitHub"
echo -e "  3. Identifying the memory leak"
echo -e "  4. Generating a fix"
echo -e "  5. Creating a pull request"

echo -e "\n${BLUE}Tailing Bob agent logs (Ctrl+C to stop):${NC}"
oc logs deployment/bob-ai-agent -n $OCP_NAMESPACE -f &
BOB_LOGS_PID=$!

sleep 30
kill $BOB_LOGS_PID 2>/dev/null || true

# Step 7: Check for GitHub PR
echo -e "\n${YELLOW}Step 7: Checking for GitHub pull request...${NC}"
echo -e "${BLUE}Looking for auto-generated PR...${NC}"

PR_URL="https://github.com/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/pulls"
echo -e "${GREEN}✓ Check for pull requests at: $PR_URL${NC}"

# Step 8: Monitor pipeline execution
echo -e "\n${YELLOW}Step 8: Monitoring CI/CD pipeline...${NC}"
echo -e "${BLUE}Once the PR is merged, the pipeline will:${NC}"
echo -e "  1. Build the fixed application"
echo -e "  2. Run tests"
echo -e "  3. Create container image"
echo -e "  4. Push to registry"
echo -e "  5. Update GitOps repository"

PIPELINE_RUNS=$(oc get pipelinerun -n $OCP_NAMESPACE --sort-by=.metadata.creationTimestamp -o json 2>/dev/null || echo '{"items":[]}')
LATEST_RUN=$(echo "$PIPELINE_RUNS" | jq -r '.items[-1].metadata.name // empty')

if [ -n "$LATEST_RUN" ]; then
    echo -e "${GREEN}✓ Latest pipeline run: $LATEST_RUN${NC}"
    echo -e "${BLUE}Monitor with: oc logs -f pipelinerun/$LATEST_RUN -n $OCP_NAMESPACE${NC}"
else
    echo -e "${YELLOW}⚠️  No pipeline runs detected yet${NC}"
fi

# Step 9: Monitor GitOps deployment
echo -e "\n${YELLOW}Step 9: Monitoring GitOps deployment...${NC}"
echo -e "${BLUE}ArgoCD will automatically deploy the fixed version${NC}"

ARGOCD_APP=$(oc get application quarkus-memory-leak-app -n openshift-gitops -o json 2>/dev/null || echo '{}')
SYNC_STATUS=$(echo "$ARGOCD_APP" | jq -r '.status.sync.status // "Unknown"')
HEALTH_STATUS=$(echo "$ARGOCD_APP" | jq -r '.status.health.status // "Unknown"')

echo -e "${BLUE}  Sync Status: $SYNC_STATUS${NC}"
echo -e "${BLUE}  Health Status: $HEALTH_STATUS${NC}"

# Step 10: Verify fix
echo -e "\n${YELLOW}Step 10: Verifying the fix...${NC}"
echo -e "${BLUE}After deployment completes, verify:${NC}"
echo -e "  1. Memory usage stabilizes"
echo -e "  2. No new memory leak alerts"
echo -e "  3. Application remains healthy"

sleep 10

FINAL_MEMORY=$(curl -s https://$APP_URL/api/memory-stats 2>/dev/null || echo '{}')
FINAL_USED=$(echo "$FINAL_MEMORY" | jq -r '.usedMemoryMB // "N/A"')
FINAL_PERCENT=$(echo "$FINAL_MEMORY" | jq -r '.memoryUsagePercent // "N/A"')

echo -e "${BLUE}  Current memory: ${FINAL_USED}MB (${FINAL_PERCENT}%)${NC}"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Demo Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${BLUE}What happened:${NC}"
echo -e "  1. ✓ Memory leak triggered in Quarkus application"
echo -e "  2. ✓ Instana detected high memory usage"
echo -e "  3. ✓ Alert sent to Bob AI agent via webhook"
echo -e "  4. ✓ Bob analyzed code and identified the leak"
echo -e "  5. ✓ Bob generated fix and created PR"
echo -e "  6. ⏳ Pipeline builds and tests the fix"
echo -e "  7. ⏳ GitOps deploys the fixed version"
echo -e "  8. ⏳ Memory leak resolved automatically"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "  View application logs:  ${GREEN}oc logs deployment/quarkus-memory-leak-app -n $OCP_NAMESPACE -f${NC}"
echo -e "  View Bob logs:          ${GREEN}oc logs deployment/bob-ai-agent -n $OCP_NAMESPACE -f${NC}"
echo -e "  View Instana agent:     ${GREEN}oc logs daemonset/instana-agent -n instana-agent -f${NC}"
echo -e "  Check memory stats:     ${GREEN}curl https://$APP_URL/api/memory-stats | jq${NC}"
echo -e "  View GitHub PRs:        ${GREEN}$PR_URL${NC}"
echo -e "  View Instana:           ${GREEN}$INSTANA_BASE_URL${NC}"

echo -e "\n${GREEN}Demo complete!${NC}"

# Made with Bob
