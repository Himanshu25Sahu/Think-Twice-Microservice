#!/bin/bash

set -e

BASE_URL="${BASE_URL:-http://localhost:5000}"
JAEGER_URL="${JAEGER_URL:-http://localhost:16686}"
TRACE_ID="trace-$(date +%s)-$RANDOM"

echo "=============================="
echo "Think Twice - Tracing Verification"
echo "=============================="

echo "Using trace id: $TRACE_ID"

echo "1) Checking Jaeger API availability..."
if curl -sf "$JAEGER_URL/api/services" > /dev/null; then
  echo "   OK: Jaeger API reachable"
else
  echo "   ERROR: Jaeger API is not reachable at $JAEGER_URL"
  exit 1
fi

echo "2) Sending request through gateway with explicit trace headers..."
TRACEPARENT="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
RESPONSE_HEADERS=$(mktemp)

curl -s -o /dev/null -D "$RESPONSE_HEADERS" \
  -H "x-trace-id: $TRACE_ID" \
  -H "traceparent: $TRACEPARENT" \
  "$BASE_URL/api/health"

if grep -iq "^x-trace-id: $TRACE_ID" "$RESPONSE_HEADERS"; then
  echo "   OK: Gateway echoed x-trace-id"
else
  echo "   WARN: Gateway did not echo the same x-trace-id"
fi

rm -f "$RESPONSE_HEADERS"

echo "3) Checking Jaeger has onboarded service names..."
SERVICES_JSON=$(curl -sf "$JAEGER_URL/api/services")
if echo "$SERVICES_JSON" | grep -Eqi "gateway|api-gateway|entry-service|org-service|analytics-service|auth-service"; then
  echo "   OK: Jaeger reports Think Twice services"
else
  echo "   WARN: Service names not visible yet; generate traffic and retry in ~30s"
fi

echo ""
echo "Tracing smoke verification complete."
echo "Open: $JAEGER_URL"
echo "Tip: trigger /entries or /org routes to see multi-hop traces."
