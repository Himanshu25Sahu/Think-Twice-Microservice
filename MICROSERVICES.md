# Think Twice — Microservices Architecture

Multi-tenant knowledge logging platform with API Gateway and microservices.

## Overview

```
Think Twice Microservices
├── gateway/              — API Gateway (port 5000) — public-facing
├── services/
│   ├── auth-service/     — Auth + User management (port 5001) — internal
│   ├── org-service/      — Organization management (port 5003)
│   ├── entry-service/    — Entry/Knowledge base (port 5002)
│   └── analytics-service — Analytics (port 5004)
└── client/               — Frontend (Next.js, port 3000)
```

## Architecture

### API Gateway (port 5000)

**The only public-facing service.** All client requests go through the gateway.

**Responsibilities:**
- JWT verification
- Trace ID generation for distributed tracing
- Request routing to downstream services
- Rate limiting (100 req/15min per IP)
- Error handling and service health checks

**Request Flow:**
```
Client
  ↓
Gateway
  ├─→ [jwt verify] → attach x-user-id, x-user-email headers
  ├─→ [rate limit check]
  ├─→ [route to service]
  └─→ [proxy response]
  ↓
Client
```

### Auth Service (port 5001)

**Internal microservice.** Handles authentication and user management.

**Endpoints:**
- `POST /auth/register` — Register new user
- `POST /auth/login` — Login (returns JWT in httpOnly cookie)
- `POST /auth/logout` — Clear token
- `GET /auth/me` — Get current user profile
- `PUT /auth/update-active-org` — Switch active organization
- `PUT /auth/add-org` — Called by org-service to add org to user (internal)
- `GET /health` — Service health check

**JWT Payload:**
```javascript
{
  id: user._id,
  email: user.email,
  iat: timestamp,
  exp: timestamp + 3 days
}
```

### Downstream Services (org, entry, analytics)

**Trust gateway headers:**
- `x-user-id` — MongoDB user ID
- `x-user-email` — User's email
- `x-trace-id` — UUID for request tracing

No re-authentication needed. Read from `req.headers['x-user-id']`.

## Microservice Communication Rules

### 1. Gateway → Auth Service
- **No auth required** for `/auth/*` routes
- Gateway does NOT verify JWT for these routes
- Proxy passes through as-is

### 2. Gateway → Other Services (org, entry, analytics)
- **Auth required** for all routes
- Gateway verifies JWT cookie
- On success, gateway sets headers:
  ```
  x-user-id: decoded.id
  x-user-email: decoded.email
  x-trace-id: traced UUID
  ```
- Proxy forwards request with headers
- Downstream service TRUSTS these headers

### 3. Downstream Services → Auth Service
- Internal service-to-service calls to add org to user
- No authentication needed (internal network)
- Example: org-service calls `PUT /auth/add-org` after creating org

## Setup

### Prerequisites

- Node.js 18+
- MongoDB
- Docker (optional)

### Installation

1. **Gateway:**
   ```bash
   cd gateway
   npm install
   cp .env.example .env
   npm run dev
   ```

2. **Auth Service:**
   ```bash
   cd services/auth-service
   npm install
   cp .env.example .env
   npm run dev
   ```

3. **Other services:**
   ```bash
   cd services/{org,entry,analytics}-service
   npm install
   cp .env.example .env
   npm run dev
   ```

### Environment Variables

**Gateway (.env):**
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:3000

AUTH_SERVICE_URL=http://localhost:5001
ORG_SERVICE_URL=http://localhost:5003
ENTRY_SERVICE_URL=http://localhost:5002
ANALYTICS_SERVICE_URL=http://localhost:5004
```

**Auth Service (.env):**
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/think-twice
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=3d
FRONTEND_URL=http://localhost:3000
```

## API Endpoints

### Public Routes (via Gateway)

#### Auth — `/api/auth`
```
POST   /api/auth/register       — { name, email, password }
POST   /api/auth/login          — { email, password }
POST   /api/auth/logout         — 
GET    /api/auth/me             — [protected]
PUT    /api/auth/update-active-org — { orgId } [protected]
```

#### Organization — `/api/org` (all protected)
```
POST   /api/org/create          — { name }
POST   /api/org/join            — { inviteCode }
GET    /api/org/my-orgs         — 
GET    /api/org/:orgId          — 
PUT    /api/org/switch/:orgId   — 
```

#### Entries — `/api/entries` (all protected)
```
GET    /api/entries             — [?q=search&type=...&tag=...&page=1&limit=20]
POST   /api/entries             — { title, type, what, why, dos, donts, ... }
GET    /api/entries/:id         — 
PUT    /api/entries/:id         — { title, type, ... }
DELETE /api/entries/:id         — 
POST   /api/entries/:id/upvote  — 
```

#### Analytics — `/api/analytics` (all protected)
```
GET    /api/analytics           — 
POST   /api/analytics/events    — 
```

### Health Checks
```
GET /api/health                 — Gateway health
(downstream services have /health on their internal ports)
```

## Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

**HTTP Status Codes:**
- `200` — OK
- `201` — Created
- `400` — Bad Request (validation error)
- `401` — Unauthorized (missing/invalid JWT)
- `403` — Forbidden (access denied)
- `404` — Not Found
- `429` — Too Many Requests (rate limit)
- `500` — Server Error
- `503` — Service Unavailable

## Tracing

Every request is assigned a unique `x-trace-id` (UUID):

1. Client calls gateway
2. Gateway generates trace ID (or uses existing from header)
3. Gateway forwards trace ID to downstream service
4. All services log with trace ID: `[SERVICE] action trace=${traceId}`
5. Error responses include trace ID for correlation

Example log:
```
[GATEWAY] POST /api/auth/register trace=550e8400-e29b-41d4-a716-446655440000
[AUTH] Register attempt: user@example.com trace=550e8400-e29b-41d4-a716-446655440000
[AUTH] User registered successfully: user@example.com trace=550e8400-e29b-41d4-a716-446655440000
```

## Rate Limiting

Gateway applies rate limiting:
- **Limit:** 100 requests per IP
- **Window:** 15 minutes
- **Storage:** In-memory map (no Redis needed for MVP)

If exceeded: `429 Too Many Requests`

## Security

✓ JWT stored in httpOnly cookies (no XSS access)  
✓ Cookies marked `secure` in production  
✓ `sameSite=none` in production for cross-domain requests  
✓ CORS restricted to frontend URL  
✓ Passwords hashed with bcryptjs (10 rounds)  
✓ Downstream services trust gateway-provided headers (no re-auth)  
✓ All endpoints log with trace ID  

## Docker

### Build images:
```bash
docker build -t think-twice-gateway ./gateway
docker build -t think-twice-auth ./services/auth-service
```

### Run with docker-compose (example):
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:5
    ports:
      - "27017:27017"

  gateway:
    image: think-twice-gateway
    ports:
      - "5000:5000"
    environment:
      JWT_SECRET: ${JWT_SECRET}
      AUTH_SERVICE_URL: http://auth:5001
    depends_on:
      - auth

  auth:
    image: think-twice-auth
    ports:
      - "5001:5001"
    environment:
      MONGODB_URI: mongodb://mongodb:27017/think-twice
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - mongodb
```

## Development Workflow

1. Start MongoDB:
   ```bash
   mongod
   ```

2. Start services in separate terminals:
   ```bash
   # Terminal 1: Auth Service
   cd services/auth-service && npm run dev

   # Terminal 2: Gateway
   cd gateway && npm run dev

   # Terminal 3: Other services...
   cd services/org-service && npm run dev
   ```

3. Test:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Jane","email":"jane@example.com","password":"password123"}'
   ```

## Service Interoperability

### Org Service → Auth Service Example

When org-service creates an org and adds the creator as owner:

1. **Create org** in MongoDB
2. **Call auth service:**
   ```javascript
   fetch('http://auth-service:5001/auth/add-org', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ userId, orgId })
   })
   ```
3. Auth service adds org to user's `organizations` array

## Error Handling

All services implement consistent error handling:
- Catch errors with try/catch
- Log error with trace ID
- Return standardized error response
- Never expose internal error details in production

## Future Enhancements

- [ ] Distributed tracing (Jaeger, Zipkin)
- [ ] Service mesh (Istio)
- [ ] Centralized logging (ELK stack)
- [ ] Metrics and monitoring (Prometheus, Grafana)
- [ ] Event streaming (Redis Streams, Kafka)
- [ ] Circuit breaker pattern
- [ ] API documentation (Swagger/OpenAPI)
- [ ] GraphQL gateway option

## Troubleshooting

**"Service unavailable" error:**
- Check if downstream service is running
- Verify service URL in gateway env
- Check logs for service error

**"Invalid token" error:**
- Ensure JWT_SECRET is same across gateway and auth service
- Verify cookie is being sent from client
- Check token expiry

**"Database connection failed":**
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- Check MongoDB connection string format

**"CORS error":**
- Verify FRONTEND_URL in gateway and service .env
- Check if credentials: true is set
- Verify cookie domain/sameSite settings

## License

ISC
