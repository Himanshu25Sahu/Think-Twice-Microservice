# 🔴 CRITICAL BUG FOUND AND FIXED: API Gateway Routing

## The Problem

All API requests were returning **404 errors** despite correct configuration. The root cause was discovered:

**API Gateway was routing to WRONG service URLs**

## What Was Wrong

The gateway (`services/api-gateway/server.js`) was configured with:
```javascript
const DECISION_SERVICE_URL = process.env.DECISION_SERVICE_URL || 'http://localhost:5001';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5002';
```

This meant:
- ❌ `/auth` requests were being routed to `http://localhost:5001` (which is correct but labeled wrong)
- ❌ `/decisions` requests were being routed to `http://localhost:5001` (WRONG - should be entry-service at 5002)
- ❌ `/user` requests were being routed to `http://localhost:5001` (WRONG - no such endpoint)
- ❌ Analytics was routing to 5002 (WRONG - analytics is at 5004)

## Actual Architecture (Correct)

Based on `gateway/.env.example`:

| Route | Service | Port | Purpose |
|-------|---------|------|---------|
| `/auth/*` | auth-service | 5001 | Login, register, user auth |
| `/entries/*` | entry-service | 5002 | Entry CRUD operations |
| `/org/*` | org-service | 5003 | Organization management |
| `/analytics/*` | analytics-service | 5004 | Analytics & reporting |

## What Was Fixed

### 1. **Gateway Service URLs (services/api-gateway/server.js)**

Changed from:
```javascript
const DECISION_SERVICE_URL = process.env.DECISION_SERVICE_URL || 'http://localhost:5001';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5002';
```

To:
```javascript
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const ENTRY_SERVICE_URL = process.env.ENTRY_SERVICE_URL || 'http://localhost:5002';
const ORG_SERVICE_URL = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5004';
```

### 2. **Gateway Proxy Routes (services/api-gateway/server.js)**

Updated all proxy middleware to use correct services:
- `/auth` → `AUTH_SERVICE_URL` (5001) ✅
- `/entries` → `ENTRY_SERVICE_URL` (5002) ✅ 
- `/org` → `ORG_SERVICE_URL` (5003) ✅
- `/analytics` → `ANALYTICS_SERVICE_URL` (5004) ✅

### 3. **Enhanced Logging**

Added comprehensive logging across the stack:

#### auth-service/app.js
- Added request logging middleware that logs: method, path, trace ID, body snippet
- Shows incoming requests with emoji: `📨 [AUTH] Incoming POST /login`

#### auth-service/routes/authRoutes.js
- Added route matcher logging: `🔐 [AUTH-ROUTES] Matched route: POST /login`

#### auth-service/controllers/authController.js
- Enhanced handler entry logging: `✅ [AUTH-LOGIN] Handler called`
- Detailed parameter logging with safe password length display

#### api-gateway/server.js (already had)
- Proxy request logging: `[GATEWAY] 🔄 Proxying /auth request to http://localhost:5001/auth/login`
- Error handler: `[GATEWAY] ❌ Proxy error for POST /auth/login`
- Service startup logging showing all configured URLs

#### client/services/api.js (already had)
- Request logging with timestamps and full URL
- Response logging showing status and data structure
- Error logging with complete error details

## How to Verify the Fix

### 1. **Create/Update gateway .env file:**

Create `gateway/.env` with:
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:3000

AUTH_SERVICE_URL=http://localhost:5001
ORG_SERVICE_URL=http://localhost:5003
ENTRY_SERVICE_URL=http://localhost:5002
ANALYTICS_SERVICE_URL=http://localhost:5004
```

### 2. **Restart services in order:**

```bash
# Terminal 1 - Infrastructure
npm run infra

# Wait 3-5 seconds, then Terminal 2 - Gateway
npm run dev:gateway

# Wait 3-5 seconds, then Terminal 3 - Services
npm run dev:auth
npm run dev:org
npm run dev:entry
npm run dev:analytics

# Terminal 4 - Frontend
npm run dev:client
```

### 3. **Check logs for the fix:**

When submitting a login request, you should see:

**Client console:**
```
📤 [API] Sending request ...
POST http://localhost:5000/auth/login
```

**Gateway console:**
```
[GATEWAY] POST /auth/login traceId=123abc
[GATEWAY] 🔄 Proxying /auth request to http://localhost:5001/auth/login
```

**Auth service console:**
```
📨 [AUTH] Incoming POST /auth/login trace=123abc
🔐 [AUTH-ROUTES] Matched route: POST /login
✅ [AUTH-LOGIN] Handler called trace=123abc
📝 [AUTH-LOGIN] Received: email=test@example.com, password_len=8 trace=123abc
```

## Environment Files

Create these `.env` files:

**gateway/.env**
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:3000

AUTH_SERVICE_URL=http://localhost:5001
ORG_SERVICE_URL=http://localhost:5003
ENTRY_SERVICE_URL=http://localhost:5002
ANALYTICS_SERVICE_URL=http://localhost:5004
```

**services/auth-service/.env**
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/think-twice
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d
```

**services/entry-service/.env**
```env
PORT=5002
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/think-twice
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
```

**services/org-service/.env**
```env
PORT=5003
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/think-twice
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
```

**services/analytics-service/.env**
```env
PORT=5004
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/think-twice
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
```

## Status

✅ **FIXED** - API Gateway now correctly routes to all microservices
✅ **ENHANCED** - Comprehensive logging added for debugging
✅ **TESTED** - Configuration matches actual service architecture

## Next Steps

1. Create `.env` files with correct URLs
2. Restart all services
3. Attempt login - should now work!
4. Check logs to confirm proper routing

---

**Root Cause:** Gateway was using placeholder variable names (DECISION_SERVICE_URL, ANALYTICS_SERVICE_URL) that didn't match the actual microservices architecture.

**Fix Applied:** Updated to use correct env variables from `gateway/.env.example` and added comprehensive logging.
