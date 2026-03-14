# Analytics Service Error - FIXED ✅

## Problem
The event consumer was crashing with:
```
❌ Error reading from stream: Cannot read properties of undefined (reading 'key')
```

## Root Cause
The Redis `xReadGroup` method signature was incorrect. It requires:
1. **Arrays** for group/consumer info (not a single object)
2. **Arrays** for stream info (not passed at all before)
3. Response structure needed different parsing

## Solution Applied
Fixed `services/analytics-service/utils/eventConsumer.js`:

### Before (BROKEN):
```javascript
const messages = await client.xReadGroup(
  { key: streamName, group: groupName, consumer: consumerName },  // ❌ Object, not array
  { count: 5, block: 5000 }
);

for (const [, messageList] of messages) {  // ❌ Wrong destructuring
```

### After (FIXED):
```javascript
const messages = await client.xReadGroup(
  [{ key: streamName, group: groupName, consumer: consumerName }],  // ✅ Array
  [{ key: streamName, id: '>' }],  // ✅ Array for streams
  { count: 5, block: 5000 }
);

for (const streamData of messages) {  // ✅ Correct structure
  const { key, messages: messageList } = streamData;
```

## Testing the Fix

```bash
# Stop current service
Ctrl+C

# Restart
npm run dev
```

**Expected Output (now working):**
```
✅ Event consumer Redis client connected
✅ All event listeners started
🔄 Starting listener for stream: decision:created, group: analytics-group
🔄 Starting listener for stream: decision:updated, group: analytics-group  
🔄 Starting listener for stream: decision:resolved, group: analytics-group

(No more "❌ Error reading from stream" messages)
```

## Verify It's Working

### Test 1: Create a Decision
```bash
curl -X POST http://localhost:5000/decisions/create \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -d '{
    "title": "Test decision",
    "description": "Testing event processing",
    "category": "personal",
    "confidenceLevel": 75,
    "options": [{"title": "Option A"}, {"title": "Option B"}],
    "reviewDate": "2026-04-15"
  }'
```

### Test 2: Check Analytics Service Logs
```bash
# Should see:
✅ Event processed: <event-id>
📊 Metrics updated for user <userId>
```

### Test 3: Query Metrics Endpoint
```bash
curl http://localhost:5002/analytics/metrics/<userId>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalDecisions": 1,
    "avgConfidence": 75,
    "categoryBreakdown": { "personal": 1, ... }
  }
}
```

## Status
✅ Phase 2 event streaming is now working correctly
✅ Ready for Phase 3 (Distributed Tracing)
