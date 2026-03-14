#!/bin/bash
# Phase 2 Testing Script - Redis Streams Event-Driven Architecture

echo "🧪 Phase 2: Event-Driven Architecture Test"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to wait for service health
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=0
    
    echo "Waiting for $service on port $port..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$port/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $service is ready${NC}"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Start test
echo "📋 PHASE 2 TEST CHECKLIST"
echo ""

# Test 1: Service Health
echo "TEST 1: Service Health Checks"
echo "-----------------------------"
wait_for_service "Decision Service" 5001
wait_for_service "Analytics Service" 5002
echo ""

# Test 2: Redis Stream Test (Node.js test runner)
echo "TEST 2: Redis Streams Unit Tests"
echo "--------------------------------"
cd services/decision-service
if node tests/testStreamEvents.js; then
    echo -e "${GREEN}✅ Stream tests passed${NC}"
else
    echo -e "${RED}❌ Stream tests failed${NC}"
    exit 1
fi
echo ""

# Test 3: Create a decision and verify event emission
echo "TEST 3: End-to-End Event Flow"
echo "-----------------------------"

# Create a test decision
DECISION_RESPONSE=$(curl -s -X POST http://localhost:5000/decisions/create \
  -H "Content-Type: application/json" \
  -b "accessToken=$(curl -s -c /tmp/cookies.txt http://localhost:5000/auth/verify | jq -r '.data.token' 2>/dev/null)" \
  -d '{
    "title": "Phase 2 Test Decision",
    "description": "Testing event-driven architecture",
    "category": "personal",
    "confidenceLevel": 75,
    "options": [
      {"title": "Option A"},
      {"title": "Option B"}
    ],
    "reviewDate": "2026-04-15"
  }')

echo "Decision created:"
echo $DECISION_RESPONSE | jq '.' 2>/dev/null || echo "Response: $DECISION_RESPONSE"

# Give event time to propagate
echo "Waiting for event processing..."
sleep 2

# Check analytics metrics
echo ""
echo "TEST 4: Verify Metrics Updated"
echo "------------------------------"

METRICS_RESPONSE=$(curl -s http://localhost:5002/analytics/metrics/$(jq -r '.data.decision.user' <<< "$DECISION_RESPONSE" 2>/dev/null || echo "test"))

echo "User metrics:"
echo $METRICS_RESPONSE | jq '.' 2>/dev/null || echo "Response: $METRICS_RESPONSE"

echo ""
echo "================================"
echo -e "${GREEN}✅ PHASE 2 TEST COMPLETE${NC}"
echo "================================"
echo ""
echo "Next Steps:"
echo "- Review the complete Phase 2 implementation in PHASE_2_IMPLEMENTATION.md"
echo "- Check Analytics Service logs: docker logs analytics-service"
echo "- Query metrics via: curl http://localhost:5002/analytics/metrics/{userId}"
echo ""
