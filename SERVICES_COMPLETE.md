# Think Twice — Complete Microservices Architecture

## Services Overview

```
Think Twice Platform
├── gateway/                    — API Gateway (port 5000) — PUBLIC
├── services/
│   ├── auth-service/           — Authentication (port 5001) — INTERNAL
│   ├── org-service/            — Organizations (port 5003) — INTERNAL
│   ├── entry-service/          — Entries/Knowledge (port 5002) — INTERNAL
│   └── analytics-service/      — Analytics (port 5004) — INTERNAL
└── client/                     — Frontend (Next.js, port 3000)
```

## Service Responsibilities

### 1. API Gateway (port 5000) — PUBLIC ENTRY POINT

**Role:** Only service exposed to clients. Routes requests to internal services.

**Responsibilities:**
- JWT verification from cookies
- Request header enrichment (x-user-id, x-user-email, x-trace-id)
- Rate limiting (100 req/15min per IP)
- Distributed tracing
- Service error handling

**Routes:**
- `POST /api/auth/*` → Auth Service (no auth required)
- `POST /api/org/*` → Org Service (auth required)
- `POST /api/entries/*` → Entry Service (auth required)
- `POST /api/analytics/*` → Analytics Service (auth required)

---

### 2. Auth Service (port 5001) — INTERNAL

**Role:** User authentication and profile management.

**Stores:**
- User documents (name, email, password hash)
- Organization references (not ownership — just references)
- Active organization preference

**Endpoints:**
```
POST   /auth/register           — { name, email, password }
POST   /auth/login              — { email, password }
POST   /auth/logout             — Clear token
GET    /auth/me                 — Get current user
PUT    /auth/update-active-org  — { orgId }
PUT    /auth/add-org            — { userId, orgId } [called by org-service]
GET    /health                  — Service status
```

**Communication:**
- Receives headers: `x-trace-id`, `x-user-id` (only on protected endpoints)
- Called by org-service: add/switch organizations
- Sets JWT in httpOnly cookies

---

### 3. Organization Service (port 5003) — INTERNAL

**Role:** Multi-tenant organization management.

**Stores:**
- Organizations with slug (unique)
- Members list with roles (owner, admin, member, viewer)
- Invite codes for org joins

**Key Design:** userId stored as STRING, not ObjectId (proper microservice boundary)

**Endpoints:**
```
POST   /org/create              — { name }
POST   /org/join                — { inviteCode }
GET    /org/my-orgs             — List user's orgs
GET    /org/:orgId              — Get org details
PUT    /org/switch/:orgId       — Switch active org
GET    /health                  — Service status
```

**Events (Redis Streams):**
- `org:created` — New org created
- `org:member.joined` — User joined org

**Internal Calls:**
- Auth Service: `PUT /auth/add-org`, `PUT /auth/update-active-org`
- Cache: Org membership checks (5min TTL)

---

### 4. Entry Service (port 5002) — INTERNAL

**Role:** Knowledge base / entry management with search and caching.

**Stores:**
- Entries (What, Why, Do's, Don'ts format)
- Entry types: architecture, debugging, feature, best-practice, incident, other
- Entry status: draft, published, archived
- Upvotes

**Key Design:** orgId and authorId stored as STRINGs, denormalized author name

**Endpoints:**
```
GET    /entries                 — List (with ?q, ?type, ?tag, ?page, ?limit, ?sort)
POST   /entries                 — Create new entry
GET    /entries/:id             — Get single entry
PUT    /entries/:id             — Update (author or org admin)
DELETE /entries/:id             — Soft delete (set status=archived)
POST   /entries/:id/upvote      — Toggle upvote
GET    /health                  — Service status
```

**Query Parameters (GET /entries):**
- `?orgId=xxx` — REQUIRED (or sent in header)
- `?q=search` — Full-text search
- `?type=architecture` — Filter by type
- `?tag=redis` — Filter by tag
- `?page=1` — Pagination (default 1)
- `?limit=20` — Items per page (max 100, default 20)
- `?sort=newest|oldest|popular` — Sort order

**Caching:**
- Key: `entries:{orgId}:{md5(query)}`
- TTL: 5 minutes
- Invalidated on: create, update, delete, upvote

**Events (Redis Streams):**
- `entry:created`
- `entry:updated`
- `entry:deleted`

**Internal Calls:**
- Org Service: Verify user membership (cached 5min)
- Cache: Entry list results, org membership checks

---

### 5. Analytics Service (port 5004) — INTERNAL

**Role:** Event consumption and analytics.

**Subscribes to Events (Redis Streams):**
- `entry:created` → Track entry creation
- `entry:updated` → Track modifications
- `entry:deleted` → Track deletions
- `org:created` → Track org creation
- `org:member.joined` → Track member joins

**Provides:**
- Usage metrics
- Entry trends
- Org/user analytics

*(Implementation: Consumes Redis Streams, stores metrics in MongoDB or time-series DB)*

---

## Request Flow Example

### 1. User Registration & Login

```
Client: POST /api/auth/register
  ↓
Gateway: [rate limit] → [proxy to auth] → no headers needed
  ↓
Auth Service: Create user, hash password, sign JWT
  ↓
Response: Set httpOnly cookie, return user
  ↓
Client has jwt in cookie
```

### 2. Create Organization

```
Client: POST /api/org/create (cookie: jwt)
  ↓
Gateway: [rate limit]
  ↓
Gateway: [verify JWT] → extract userId, email
  ↓
Gateway: [set headers] x-user-id, x-user-email, x-trace-id
  ↓
Gateway: [proxy to org-service]
  ↓
Org Service: [read x-user-id header] Create org
  ↓
Org Service: [internal call] PUT auth-service/auth/add-org { userId, orgId }
  ↓
Auth Service: Add org to user.organizations, set as activeOrg
  ↓
Org Service: [emit event] org:created
  ↓
Response: Org created
  ↓
Client updated
```

### 3. List Entries

```
Client: GET /api/entries?orgId=xxx&q=redis (cookie: jwt)
  ↓
Gateway: [verify JWT] → x-user-id, x-user-email, x-trace-id
  ↓
Entry Service: [orgAccess middleware]
  ↓
  orgAccess: [check cache] org:member:{orgId}:{userId}
    If miss: [call org-service] GET /org/{orgId}
    Verify user is member → [cache result 5min]
  ↓
Entry Service: [build query] { orgId, status: { $ne: 'archived' }, $text: { $search: 'redis' } }
  ↓
Entry Service: [check cache] entries:{orgId}:{hash}
    If hit: return cached
    If miss: execute query → [cache 5min]
  ↓
Response: Entries with pagination
  ↓
Client displays results
```

---

## Authentication & Headers

### JWT Cookie Flow

**On Login:**
```javascript
// Auth Service sets cookie
res.cookie('token', jwt, {
  httpOnly: true,
  secure: true (production),
  sameSite: 'none' (production),
  maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
})
```

**On Subsequent Requests:**
```javascript
// Client automatically includes cookie
// Browser sends: Cookie: token=jwt

// Gateway verifies
const token = req.cookies.token
const decoded = jwt.verify(token, JWT_SECRET)
// decoded: { id: userId, email: userEmail }

// Gateway forwards
req.headers['x-user-id'] = decoded.id
req.headers['x-user-email'] = decoded.email
```

**Downstream Services:**
```javascript
// Read from headers, no re-verification
const userId = req.headers['x-user-id']
const email = req.headers['x-user-email']
```

---

## Distributed Tracing

Every request gets a unique `x-trace-id` UUID:

```
Client: POST /api/org/create
  ↓
Gateway: Generate/propagate x-trace-id: `550e8400-e29b-41d4-a716-446655440000`
  [GATEWAY] POST /api/org/create trace=550e8400...
  ↓
Gateway: Forward x-trace-id header
  ↓
Org Service: Receive x-trace-id
  [ORG] Create org: name=Acme trace=550e8400...
  ↓
Org Service: Call Auth Service with x-trace-id
  [ORG] 📤 Event org:created trace=550e8400...
  ↓
Analytics Service: Consume event
  [ANALYTICS] Event entry:created trace=550e8400...
```

**All logs include:** `[SERVICE_NAME] message trace=UUID`

---

## Caching Strategy

### Entry List Caching

**Key:** `entries:{orgId}:{md5(queryHash)}`
**TTL:** 5 minutes
**Invalidation:** ANY mutation (create, update, delete, upvote)

```javascript
// Generate hash
const hash = md5(JSON.stringify({ q, type, tag, page, limit, sort }))
const cacheKey = `entries:${orgId}:${hash}`

// Check cache
const cached = await redis.get(cacheKey)

// Invalidate pattern
await redis.del(`entries:${orgId}:*`)
```

### Org Membership Cache

**Key:** `org:member:{orgId}:{userId}`
**TTL:** 5 minutes
**Value:** `'allowed'` or `'denied'`

Used to avoid hammering org-service on every entry request.

---

## Inter-Service Communication

### Synchronous (HTTP via Axios)

**Org Service → Auth Service:**
```javascript
// Add org to user
await axios.put('http://auth-service:5001/auth/add-org', {
  userId: userId,
  orgId: orgId.toString()
}, { headers: { 'x-trace-id': traceId } })
```

**Entry Service → Org Service:**
```javascript
// Verify membership
const response = await axios.get('http://org-service:5003/org/' + orgId, {
  headers: { 'x-trace-id': traceId, 'x-user-id': userId }
})
```

### Asynchronous (Redis Streams)

**Org Service publishes:**
```javascript
await redis.xAdd('org:created', '*', {
  orgId: org._id.toString(),
  userId: userId,
  name: org.name,
  timestamp: new Date().toISOString()
})
```

**Analytics Service consumes:**
```javascript
const messages = await redis.xReadGroup({
  key: 'org:created',
  group: 'analytics-group',
  consumer: 'consumer-1'
})
```

---

## Error Handling

### HTTP Status Codes

- `200` — OK
- `201` — Created
- `400` — Bad Request (validation)
- `401` — Unauthorized (no/invalid auth)
- `403` — Forbidden (membership check failed)
- `404` — Not Found
- `429` — Rate Limited
- `500` — Server Error
- `503` — Service Unavailable (downstream service down)

### Response Format

```json
{
  "success": true/false,
  "message": "Human readable message",
  "data": { /* ... */ }
}
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- MongoDB
- Redis

### Install & Start Each Service

```bash
# Auth Service
cd services/auth-service
npm install
npm run dev  # runs on 5001

# Org Service
cd services/org-service
npm install
npm run dev  # runs on 5003

# Entry Service
cd services/entry-service
npm install
npm run dev  # runs on 5002

# Gateway (last, routes to others)
cd gateway
npm install
npm run dev  # runs on 5000
```

### Environment Variables

Each service has `.env.example` — copy to `.env` and update URLs.

Key common vars:
- `NODE_ENV` — development/production
- `MONGODB_URI` — MongoDB connection
- `REDIS_URL` — Redis connection
- `JWT_SECRET` — Must be SAME across auth-service and gateway
- `FRONTEND_URL` — CORS origin
- `*_SERVICE_URL` — Internal service URLs for inter-service calls

---

## Database Indexes

### Organization Collection
```
slug: unique, index
owner: index
members.userId: index
```

### Entry Collection
```
orgId: index
status: index
createdAt: index
compound: { orgId: 1, status: 1, createdAt: -1 }
text: { title, what, why, tags }
```

### User Collection (Auth Service)
```
email: unique
```

---

## Docker Deployment

### Build Images
```bash
docker build -t think-twice-gateway ./gateway
docker build -t think-twice-auth ./services/auth-service
docker build -t think-twice-org ./services/org-service
docker build -t think-twice-entry ./services/entry-service
```

### Docker Compose Example
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:5
    ports: ['27017:27017']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']

  auth:
    image: think-twice-auth
    ports: ['5001:5001']
    environment:
      MONGODB_URI: mongodb://mongodb:27017/think-twice
      JWT_SECRET: ${JWT_SECRET}
      REDIS_URL: redis://redis:6379
    depends_on: [mongodb, redis]

  org:
    image: think-twice-org
    ports: ['5003:5003']
    environment:
      MONGODB_URI: mongodb://mongodb:27017/think-twice
      AUTH_SERVICE_URL: http://auth:5001
      REDIS_URL: redis://redis:6379
    depends_on: [mongodb, redis, auth]

  entry:
    image: think-twice-entry
    ports: ['5002:5002']
    environment:
      MONGODB_URI: mongodb://mongodb:27017/think-twice
      ORG_SERVICE_URL: http://org:5003
      REDIS_URL: redis://redis:6379
    depends_on: [mongodb, redis, org]

  gateway:
    image: think-twice-gateway
    ports: ['5000:5000']
    environment:
      JWT_SECRET: ${JWT_SECRET}
      AUTH_SERVICE_URL: http://auth:5001
      ORG_SERVICE_URL: http://org:5003
      ENTRY_SERVICE_URL: http://entry:5002
      ANALYTICS_SERVICE_URL: http://analytics:5004
    depends_on: [auth, org, entry]
```

---

## Monitoring & Logs

All services log with consistent format:
```
[SERVICE] action message trace=UUID
[AUTH] Login attempt: user@example.com trace=550e8400...
[ORG] Create org: Acme trace=550e8400...
[ENTRY] List entries: org=123 trace=550e8400...
```

Trace IDs allow correlation across services for debugging.

---

## Future Enhancements

- [ ] Centralized logging (ELK stack)
- [ ] Distributed tracing (Jaeger)
- [ ] Service mesh (Istio)
- [ ] API Gateway rate limiting via Redis (instead of in-memory)
- [ ] Circuit breakers for service calls
- [ ] Swagger/OpenAPI documentation
- [ ] GraphQL gateway option
- [ ] Webhook subscriptions for events
- [ ] Full-text search optimization (Elasticsearch)
- [ ] Read replicas for analytics service

---

## Troubleshooting

**"Service unavailable"**: Check if service is running and URL in .env is correct
**"Invalid token"**: Verify JWT_SECRET is same across auth-service and gateway
**"CORS error"**: Check FRONTEND_URL matches client URL
**"Database connection failed"**: Verify MongoDB is running and MONGODB_URI is correct
**"Redis connection warning"**: Redis is optional for MVP; service will continue

---

## API Testing

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"jane@example.com","password":"password123"}'

# Create org
curl -X POST http://localhost:5000/api/org/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Acme Inc"}'

# List entries
curl -X GET 'http://localhost:5000/api/entries?orgId=<orgId>&q=redis&page=1' \
  -b cookies.txt

# Create entry
curl -X POST http://localhost:5000/api/entries \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "orgId":"<orgId>",
    "title":"Redis Caching Strategy",
    "type":"best-practice",
    "what":"Use Redis for session storage",
    "why":"Improves performance",
    "dos":["Cache entire sessions"],
    "donts":["Cache passwords"]
  }'
```

---

## License

ISC
