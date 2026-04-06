#!/bin/bash

set -e

echo "=============================="
echo "Think Twice — System Verification"
echo "=============================="

BASE="http://localhost:5000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

# 1. Health checks
info "Checking service health..."
curl -sf "$BASE/health" > /dev/null && pass "Gateway healthy" || fail "Gateway down"
curl -sf http://localhost:5001/health > /dev/null && pass "Auth Service healthy" || fail "Auth Service down"
curl -sf http://localhost:5002/health > /dev/null && pass "Entry Service healthy" || fail "Entry Service down"
curl -sf http://localhost:5003/health > /dev/null && pass "Org Service healthy" || fail "Org Service down"
curl -sf http://localhost:5004/health > /dev/null && pass "Analytics Service healthy" || fail "Analytics Service down"

# 2. Register a user
info "Registering test user..."
REGISTER=$(curl -sf -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}')
echo "$REGISTER" | grep -q '"success":true' && pass "User registered" || fail "Registration failed"

# 3. Check auth
info "Verifying auth..."
ME=$(curl -sf "$BASE/auth/me" -b cookies.txt)
echo "$ME" | grep -q '"success":true' && pass "Auth verified" || fail "Auth check failed"

# 4. Create organization
info "Creating organization..."
ORG=$(curl -sf -X POST "$BASE/org/create" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Test Org"}')
echo "$ORG" | grep -q '"success":true' && pass "Organization created" || fail "Org creation failed"
ORG_ID=$(echo "$ORG" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

# 5. Create project and switch context
info "Creating project..."
PROJECT=$(curl -sf -X POST "$BASE/org/$ORG_ID/projects" \
  -H "Content-Type: application/json" \
  -H "x-org-id: $ORG_ID" \
  -b cookies.txt \
  -d '{"name":"Test Project","description":"Project scope verification"}')
echo "$PROJECT" | grep -q '"success":true' && pass "Project created" || fail "Project creation failed"
PROJECT_ID=$(echo "$PROJECT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

info "Switching active project..."
SWITCH_PROJECT=$(curl -sf -X PUT "$BASE/org/switch-project/$PROJECT_ID" \
  -H "x-org-id: $ORG_ID" \
  -b cookies.txt)
echo "$SWITCH_PROJECT" | grep -q '"success":true' && pass "Project switched" || fail "Project switch failed"

# 6. Create an entry
info "Creating knowledge entry..."
ENTRY=$(curl -sf -X POST "$BASE/entries" \
  -H "Content-Type: application/json" \
  -H "x-org-id: $ORG_ID" \
  -H "x-project-id: $PROJECT_ID" \
  -b cookies.txt \
  -d "{\"orgId\":\"$ORG_ID\",\"projectId\":\"$PROJECT_ID\",\"title\":\"Test Architecture Decision\",\"type\":\"architecture\",\"what\":\"We use Redis for caching\",\"why\":\"Performance improvement\",\"dos\":[\"Set TTL\"],\"donts\":[\"Never cache auth\"]}")
echo "$ENTRY" | grep -q '"success":true' && pass "Entry created" || fail "Entry creation failed"
ENTRY_ID=$(echo "$ENTRY" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

# 7. List entries
info "Listing entries..."
LIST=$(curl -sf "$BASE/entries?orgId=$ORG_ID&projectId=$PROJECT_ID" \
  -H "x-org-id: $ORG_ID" \
  -H "x-project-id: $PROJECT_ID" \
  -b cookies.txt)
echo "$LIST" | grep -q '"success":true' && pass "Entries listed" || fail "List failed"

# 8. Get analytics
info "Checking analytics..."
sleep 2
ANALYTICS=$(curl -sf "$BASE/analytics/overview?orgId=$ORG_ID&projectId=$PROJECT_ID" \
  -H "x-org-id: $ORG_ID" \
  -H "x-project-id: $PROJECT_ID" \
  -b cookies.txt)
echo "$ANALYTICS" | grep -q '"success":true' && pass "Analytics retrieved" || fail "Analytics failed"

# 9. Check frontend
info "Checking frontend..."
curl -sf http://localhost:3000 > /dev/null && pass "Frontend accessible" || fail "Frontend down"

# Cleanup
rm -f cookies.txt

echo ""
echo "=============================="
echo -e "${GREEN}All checks passed! System is working.${NC}"
echo "=============================="
echo ""
echo "Open http://localhost:3000 in your browser."
echo "Email: test@example.com | Password: password123"
