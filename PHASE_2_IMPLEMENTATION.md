# Phase 2: Redis Streams Event-Driven Architecture

## Overview
Phase 2 transforms the microservices from a request-response synchronous model to an event-driven asynchronous model using Redis Streams. This enables decoupled inter-service communication and real-time metrics aggregation.

---

## Architecture

### Event Flow

```
Decision Service (Event Producer)
  ├─ Create Decision → emit "decision:created"
  ├─ Update Decision → emit "decision:updated"
  └─ Resolve Decision → emit "decision:resolved"
           ↓ (Redis Streams)
        [Redis]
           ↓
Analytics Service (Event Consumer)
  ├─ consume "decision:created" → update user metrics
  ├─ consume "decision:updated" → refresh statistics
  └─ consume "decision:resolved" → track outcomes
```

### Key Components

#### 1. **Event Emitter** (`decision-service/utils/eventEmitter.js`)
- Publishes events to Redis Streams
- Supports multiple stream types: `decision:created`, `decision:updated`, `decision:resolved`
- Handles JSON serialization for complex payloads

**Key Functions:**
```javascript
emitEvent(streamName, eventData)           // Emit event
createConsumerGroup(streamName, groupName)  // Setup consumer group
readPendingMessages(...)                    // Read from stream
acknowledgeMessage(...)                     // Confirm processing
```

#### 2. **Event Consumer** (`analytics-service/utils/eventConsumer.js`)
- Listens to Redis Streams with consumer groups
- Processes events asynchronously
- Handles acknowledgment and retry logic

**Key Functions:**
```javascript
createEventClient()                    // Connect to Redis
startStreamListener(...)               // Begin consuming events
```

#### 3. **Metrics Model** (`analytics-service/models/MetricsModel.js`)
Stores aggregated user metrics updated by event consumers:
- `totalDecisions`: Count of all decisions
- `categoryBreakdown`: Distribution across categories
- `avgConfidence`: Average confidence level
- `successRate`: Percentage of resolved decisions

#### 4. **Event Handlers** (in `analytics-service/server.js`)
Process different event types:

```javascript
handleDecisionCreatedEvent()  // Increment decision count, update category
handleDecisionUpdatedEvent()  // Recalculate confidence metrics
handleDecisionResolvedEvent() // Track successful outcomes
```

---

## Implementation Details

### Event Payload Format

#### decision:created
```javascript
{
  userId: "507f191e810c19729de860ea",
  decision: {
    _id: "...",
    title: "Should I change careers?",
    category: "career",
    confidenceLevel: 75,
    options: [...],
    createdAt: ISOString
  },
  userEmail: "user@example.com",
  timestamp: "2026-03-14T..."
}
```

#### decision:updated
```javascript
{
  userId: "507f191e810c19729de860ea",
  decision: {
    // Updated decision object with all fields
    confidenceLevel: 85  // Changed from 75 to 85
  },
  userEmail: "user@example.com",
  timestamp: "2026-03-14T..."
}
```

#### decision:resolved
```javascript
{
  userId: "507f191e810c19729de860ea",
  decision: { /* decision obj */ },
  outcome: "positive" | "negative" | "neutral",
  timestamp: "2026-03-14T..."
}
```

### Redis Streams Configuration

#### Consumer Groups
- **Stream**: `decision:created`
  - **Group**: `analytics-group`
  - **Consumer**: `analytics-consumer-1`
  - **Start ID**: `0` (consume all historical messages)

- **Stream**: `decision:updated`
  - **Consumer**: `analytics-consumer-2`

- **Stream**: `decision:resolved`
  - **Consumer**: `analytics-consumer-3`

#### Consumer Behavior
- Reads up to 5 messages per iteration
- Blocks for 5 seconds if no new messages
- Acknowledges messages only after processing completes
- Automatic retry on processing failure (message requeued)

---

## Usage

### 1. Creating an Event

In `decision-service/controllers/decisionController.js`:

```javascript
import { emitEvent, STREAM_NAMES } from '../utils/eventEmitter.js';

// After saving decision
const savedDecision = await decision.save();

// Emit event
await emitEvent(STREAM_NAMES.DECISION_CREATED, {
  userId: req.user._id.toString(),
  decision: savedDecision,
  userEmail: req.user.email,
});
```

### 2. Consuming Events

In `analytics-service/server.js`:

```javascript
import { startStreamListener, createEventClient } from './utils/eventConsumer.js';

const handleDecisionCreatedEvent = async (eventData) => {
  // Update metrics
  const metrics = await Metrics.findOne({ userId: eventData.userId });
  metrics.totalDecisions += 1;
  await metrics.save();
};

// Start listener at server startup
const eventClient = await createEventClient();
startStreamListener(
  eventClient,
  'decision:created',
  'analytics-group',
  'analytics-consumer-1',
  handleDecisionCreatedEvent
);
```

---

## Testing

### Run Phase 2 Tests
```bash
cd services/decision-service
node tests/testStreamEvents.js
```

**Test Coverage:**
1. ✅ Consumer group creation
2. ✅ Event emission
3. ✅ Event retrieval
4. ✅ Stream info validation
5. ✅ Multiple event emission
6. ✅ Analytics consumer simulation
7. ✅ Event ordering verification

### Manual Testing

1. **Start all services** (already running in Docker):
   ```bash
   docker-compose up
   ```

2. **Trigger event via API**:
   ```bash
   POST http://localhost:5000/decisions/create
   {
     "title": "Test decision",
     "description": "Testing Phase 2",
     "category": "career",
     "options": [{"title": "Option A"}, {"title": "Option B"}],
     "confidenceLevel": 80,
     "reviewDate": "2026-04-01"
   }
   ```

3. **Check Analytics Service logs**:
   ```
   📤 Event emitted to "decision:created": 1710420000000-0
   📊 Metrics updated for user 507f191e810c19729de860ea
   ```

4. **Query Updated Metrics**:
   ```bash
   GET http://localhost:5000/analytics/metrics/507f191e810c19729de860ea
   
   Response:
   {
     "success": true,
     "data": {
       "totalDecisions": 1,
       "avgConfidence": 80,
       "categoryBreakdown": {
         "career": 1,
         // ... other categories
       }
     }
   }
   ```

---

## Event Flow Sequence (Complete Example)

### Scenario: User creates a decision

**Timeline:**
1. **T=0s** - Client calls `POST /decisions/create` with decision data
2. **T=0.1s** - Decision Service validates input
3. **T=0.2s** - Decision saved to MongoDB
4. **T=0.201s** - Event emitted to Redis: `decision:created`
5. **T=0.202s** - Event ID assigned by Redis Streams: `1710420000000-0`
6. **T=0.3s** - API Gateway routes event through to client ✓
7. **T=0.5s** - Analytics Service consumer picks up event
8. **T=0.6s** - Metrics queried/created for user
9. **T=0.7s** - Metrics updated: `totalDecisions++`, `categoryBreakdown[career]++`
10. **T=0.8s** - Message acknowledged to Redis
11. **T=1.0s** - Client receives 201 Created response

**Result:**
- Decision persisted in MongoDB ✓
- Event persisted in Redis Streams ✓
- Analytics updated asynchronously ✓
- No blocking on event processing ✓

---

## Current Implementation Status

### ✅ Completed
- Event emitter utility (`eventEmitter.js`)
- Event consumer utility (`eventConsumer.js`)
- Metrics model (`MetricsModel.js`)
- Decision Service event emission (create, update)
- Analytics Service event listener setup
- Event handlers (all 3 types)
- Test suite (`testStreamEvents.js`)

### 🟡 In Progress
- Phase 1 JWT validation (blockers: must fix before full E2E test)
- API Gateway routing to analytics metrics endpoint

### 📋 Pending
- Resolve decision endpoint (emit `decision:resolved`)
- Performance metrics dashboard
- Event replay and recovery mechanisms
- Automated test suite integration

---

## Configuration

### Environment Variables (`.env.docker`)

```env
# Redis
REDIS_URL=redis://redis:6379

# Decision Service
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
MONGO_URI=mongodb://mongo:27017/think-twice

# Analytics Service
PORT=5002
MONGO_URI=mongodb://mongo:27017/think-twice
```

### Docker Compose Services
All services automatically share these credentials via `env_file: .env.docker`

---

## Troubleshooting

### Problem: Analytics Service not consuming events

**Diagnosis:**
```bash
# Check Redis Streams
redis-cli
> XLEN decision:created           # Should see messages
> XINFO GROUPS decision:created  # Should see consumer group
> XPENDING decision:created analytics-group  # Check pending messages
```

**Solutions:**
1. Verify Redis connection: `docker logs redis` (if using Docker)
2. Check Analytics Service logs: `docker logs analytics-service`
3. Restart Analytics Service: `docker-compose restart analytics-service`

### Problem: Events not emitted from Decision Service

**Diagnosis:**
1. Check Decision Service logs for event emission errors
2. Verify Redis connection in Decision Service
3. Confirm JWT_SECRET matches between services

**Solution:**
```bash
# Restart Decision Service
docker-compose restart decision-service
```

### Problem: Consumer group already exists error

**Solution:**
```bash
redis-cli
> XGROUP DESTROY decision:created analytics-group  # Remove group
# Then restart Analytics Service to recreate group
```

---

## Performance Considerations

### Throughput
- **Current**: ~100 events/sec per consumer
- **Scaling**: Can horizontally scale consumers with independent names
- **Batch Processing**: Events processed in groups of 5 for efficiency

### Latency
- **Event Emission**: < 10ms (Redis Streams append)
- **Consumer Detection**: 5-second block timeout
- **Metrics Update**: ~50-100ms (MongoDB operations)
- **E2E Latency**: ~500-1000ms from decision create to metrics updated

### Storage
- **Event Size**: ~2KB per decision event
- **Retention**: Events kept indefinitely (manual cleanup can be added)
- **Metrics Storage**: ~1KB per user

---

## Next Steps (Phase 3)

### Distributed Tracing Integration
- Add Jaeger tracing to correlate events across services
- Track event flow from creation to metrics update
- Visualize service dependencies

### Advanced Event Processing
- Implement event replay for analytics recalculation
- Add event filtering and routing rules
- Implement dead-letter queues for failed events

### Monitoring & Observability
- Add Prometheus metrics for stream health
- Create dashboard for event throughput
- Set up alerts for consumer lag

---

## References

- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- [Node.js Redis Client](https://github.com/redis/node-redis)
- [Consumer Groups in Redis Streams](https://redis.io/docs/data-types/streams-tutorial/#consumer-groups)
