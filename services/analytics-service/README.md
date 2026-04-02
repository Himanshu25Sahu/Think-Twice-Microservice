# Analytics Service 📊

Event-driven analytics microservice for the Think Twice platform. Consumes events from Redis Streams and provides aggregated metrics for organizations and users.

## Architecture

```
Redis Streams (event-driven)
    ↓
Entry Consumer (entry-events stream)
    ↓
OrgMetrics & UserActivity Models (MongoDB)
    ↓
HTTP Endpoints (query aggregated data)
```

## Features

### Event Consumers

- **Entry Events**: Processes `entry:created`, `entry:updated`, `entry:deleted` events
  - Maintains organization metrics (total entries, type breakdown, weekly activity, top contributors)
  - Tracks per-user activity (entries created, type breakdown, last active)

- **Organization Events**: Processes `org:member.joined` events
  - Updates organization member count
  - Initializes user activity records

### Consumer Pattern

The service implements a battle-tested Redis Streams consumer group pattern:
- **Infinite loop polling** with `XREADGROUP` (COUNT 10, BLOCK 5000ms)
- **Automatic acknowledgment** (XACK) after successful processing
- **Retry logic** with 5-second exponential backoff on errors
- **JSON field parsing** with error recovery

### HTTP Endpoints

- `GET /health` — Service health check
- `GET /analytics/org/:orgId` — Get organization metrics
- `GET /analytics/user/:userId?orgId=xxx` — Get user activity in org
- `GET /analytics/overview?orgId=xxx` — Combined org + user dashboard

## Data Models

### OrgMetrics

```javascript
{
  orgId: String (unique),
  totalEntries: Number,
  totalMembers: Number,
  entriesByType: {
    architecture: Number,
    debugging: Number,
    feature: Number,
    'best-practice': Number,
    incident: Number,
    other: Number
  },
  weeklyActivity: [
    {
      week: "2024-W01",  // ISO week format
      count: Number,
      topType: String
    }
  ],
  topContributors: [
    {
      userId: String,
      count: Number
    }
  ],  // Top 10 only
  lastUpdated: Date
}
```

### UserActivity

```javascript
{
  userId: String,
  orgId: String,  // Compound unique index
  entriesCreated: Number,
  entriesByType: {
    architecture: Number,
    debugging: Number,
    feature: Number,
    'best-practice': Number,
    incident: Number,
    other: Number
  },
  lastActive: Date
}
```

## Event Stream Format

### Entry Events

```json
{
  "data": {
    "eventType": "entry:created",
    "orgId": "org-123",
    "authorId": "user-456",
    "entryId": "entry-789",
    "type": "architecture",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Organization Events

```json
{
  "data": {
    "eventType": "org:member.joined",
    "orgId": "org-123",
    "userId": "user-456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Development

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB and Redis URLs
```

### Environment Variables

```env
PORT=5004
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/think-twice-analytics
REDIS_URL=redis://localhost:6379
```

### Running Locally

```bash
# With nodemon (auto-reload)
npm run dev

# Production
npm start
```

### Testing

```bash
# Run test suite (publishes test events, checks metrics)
npm test

# Test specific endpoints
curl http://localhost:5004/health
curl http://localhost:5004/analytics/org/org-123
curl http://localhost:5004/analytics/user/user-456?orgId=org-123
```

## Docker Deployment

```bash
# Build image
docker build -t think-twice-analytics:1.0 .

# Run container
docker run -p 5004:5004 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/think-twice-analytics \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  think-twice-analytics:1.0
```

## Event Flow

1. **Entry Service** publishes `entry:created` event to Redis Stream
2. **Analytics Service** consumer receives event via XREADGROUP
3. **Event handler** increments org metrics and user activity
4. **Consumer** acknowledges (XACK) event after successful processing
5. **HTTP clients** query `/analytics/org/:orgId` to get updated metrics

## Performance Considerations

- **Consumer Batching**: Reads up to 10 events per poll (configurable)
- **Block Timeout**: 5 seconds between polls (low latency, low CPU)
- **Compound Indexes**: UserActivity has compound unique index on (userId, orgId)
- **Top Contributors**: Maintained as sorted list, limited to top 10 per org
- **Weekly Activity**: Aggregated by ISO week for monthly dashboarding

## Error Handling

- Failed event processing: Logged, acknowledged (no re-delivery by default)
- Malformed JSON: Logged with event details, processing continues
- Database connection loss: Service logs error, retries next poll
- Redis disconnection: Service attempts reconnection with backoff

## Monitoring

- All operations log with `[ANALYTICS]` prefix
- Trace IDs passed via `x-trace-id` header for request correlation
- Health check endpoint for K8s/Docker container probes
- Consumer status visible via simple health responses

## Future Enhancements

- [ ] Dead-letter queue for failed events
- [ ] Detailed metrics dashboard (charts, trends)
- [ ] Real-time metrics via WebSocket subscriptions
- [ ] Time-series data aggregation (daily/weekly/monthly)
- [ ] Performance alerts on anomalous patterns
- [ ] Admin endpoints for metrics recalculation

## Resume Highlights

This service demonstrates:
- **Event-Driven Architecture**: Production-grade Redis Streams consumer implementation
- **Microservice Patterns**: Separation of concerns with independent data storage
- **Error Resilience**: Graceful error handling, automatic retry logic
- **Scalability**: Stateless consumers can be horizontally scaled
- **Clean Code**: Well-organized structure with reusable consumer pattern
- **Testing**: Comprehensive test suite for event processing

---

**Port**: 5004 | **Database**: MongoDB (think-twice-analytics) | **Message Queue**: Redis Streams
