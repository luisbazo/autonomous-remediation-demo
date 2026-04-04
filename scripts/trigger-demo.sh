#!/bin/bash

# Autonomous Memory Leak Remediation - Demo Script
# This script triggers the memory leak and monitors the remediation process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QUARKUS_URL="https://quarkus-memory-leak-app-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com"
BOB_URL="https://bob-ai-agent-demo-namespace.apps.itz-74esdv.infra01-lb.fra02.techzone.ibm.com"
NAMESPACE="demo-namespace"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Autonomous Memory Leak Remediation Demo${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check application health
echo -e "${YELLOW}Step 1: Checking application health...${NC}"
HEALTH=$(curl -k -s "${QUARKUS_URL}/api/health" | jq -r '.status')
if [ "$HEALTH" == "UP" ]; then
    echo -e "${GREEN}✓ Quarkus application is healthy${NC}"
else
    echo -e "${RED}✗ Quarkus application is not healthy${NC}"
    exit 1
fi

# Step 2: Check Bob AI agent health
echo -e "${YELLOW}Step 2: Checking Bob AI agent health...${NC}"
BOB_HEALTH=$(curl -k -s "${BOB_URL}/health" | jq -r '.status')
if [ "$BOB_HEALTH" == "UP" ]; then
    echo -e "${GREEN}✓ Bob AI agent is healthy${NC}"
else
    echo -e "${RED}✗ Bob AI agent is not healthy${NC}"
    exit 1
fi

# Step 3: Get initial memory status
echo -e "${YELLOW}Step 3: Getting initial memory status...${NC}"
INITIAL_STATUS=$(curl -k -s "${QUARKUS_URL}/api/memory/status")
echo -e "${BLUE}Initial Status:${NC}"
echo "$INITIAL_STATUS" | jq '.'

# Step 4: Trigger memory leak
echo ""
echo -e "${YELLOW}Step 4: Triggering memory leak...${NC}"
echo -e "${RED}WARNING: This will intentionally cause a memory leak!${NC}"
echo -e "Press Enter to continue or Ctrl+C to cancel..."
read

for i in {1..10}; do
    echo -e "${BLUE}Triggering leak iteration $i/10...${NC}"
    LEAK_RESPONSE=$(curl -k -s -X POST "${QUARKUS_URL}/api/memory/leak?size=10")
    echo "$LEAK_RESPONSE" | jq '.'
    sleep 2
done

# Step 5: Monitor memory status
echo ""
echo -e "${YELLOW}Step 5: Monitoring memory status...${NC}"
for i in {1..5}; do
    echo -e "${BLUE}Check $i/5...${NC}"
    STATUS=$(curl -k -s "${QUARKUS_URL}/api/memory/status")
    echo "$STATUS" | jq '.'
    
    LEAKED_MB=$(echo "$STATUS" | jq -r '.leakedMemoryMB')
    echo -e "${RED}Leaked Memory: ${LEAKED_MB} MB${NC}"
    sleep 5
done

# Step 6: Check Instana monitoring
echo ""
echo -e "${YELLOW}Step 6: Checking Instana monitoring...${NC}"
echo -e "${BLUE}Instana should now be detecting the memory leak${NC}"
echo -e "${BLUE}Check Instana UI for alerts at: https://integration-bobinstana.instana.io${NC}"

# Step 7: Monitor Bob AI agent
echo ""
echo -e "${YELLOW}Step 7: Monitoring Bob AI agent for alerts...${NC}"
echo -e "${BLUE}Bob should receive webhook from Instana when alert triggers${NC}"
echo -e "${BLUE}Check Bob logs with: oc logs -n ${NAMESPACE} -l app=bob-ai-agent --tail=50${NC}"

# Step 8: Check Bob statistics
echo ""
echo -e "${YELLOW}Step 8: Checking Bob AI agent statistics...${NC}"
BOB_STATS=$(curl -k -s "${BOB_URL}/stats")
echo "$BOB_STATS" | jq '.'

# Step 9: Instructions for manual verification
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Demo Triggered Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Monitor Instana UI for memory leak alerts"
echo -e "2. Check Bob AI agent logs: ${YELLOW}oc logs -n ${NAMESPACE} -l app=bob-ai-agent -f${NC}"
echo -e "3. Wait for Bob to create GitHub PR with fix"
echo -e "4. Review and merge the PR"
echo -e "5. Verify the fix is deployed"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View app logs:  ${YELLOW}oc logs -n ${NAMESPACE} -l app=quarkus-memory-leak-app --tail=50${NC}"
echo -e "  View Bob logs:  ${YELLOW}oc logs -n ${NAMESPACE} -l app=bob-ai-agent --tail=50${NC}"
echo -e "  Check memory:   ${YELLOW}curl -k ${QUARKUS_URL}/api/memory/status | jq${NC}"
echo -e "  Clear memory:   ${YELLOW}curl -k -X POST ${QUARKUS_URL}/api/memory/clear${NC}"
echo ""

# Made with Bob
