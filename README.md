# Think Twice 🧠

A multi-tenant knowledge logging platform for engineering teams. Document architecture decisions, debugging playbooks, and best practices. Built with Node.js microservices and Next.js 14.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 14)                 │
│                   localhost:3000                        │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                API Gateway (Express)                    │
│              localhost:5000 | Port 5000                 │
└────────┬────────────┬────────────┬────────────┬─────────┘
         │            │            │            │
    ┌────▼──┐  ┌─────▼──┐  ┌──────▼──┐  ┌─────▼──┐  ┌────────▼───┐
    │ Auth  │  │  Org   │  │ Entry  │  │Analytics│  │ (Internal) │
    │ 5001  │  │  5003  │  │ 5002   │  │ 5004   │  │ Services   │
    └───────┘  └────────┘  └────────┘  └────────┘  └────────────┘
         │            │            │            │
    ┌────┴────────────┴────────────┴────────────┴─────────┐
    │           MongoDB (Docker)                         │
    │          Port 27017                                │
    └───────────────────────────────────────────────────┘
         │
    ┌────▼───────────────────────────────────────────────┐
    │          Redis (Docker)                            │
    │          Port 6379                                 │
    └────────────────────────────────────────────────────┘
```

## 📋 Services

| Service   | Port | Database | Purpose |
|-----------|------|----------|---------|
| Gateway   | 5000 | -        | HTTP proxy, JWT verification, rate limiting |
| Auth      | 5001 | MongoDB (tt-auth) | User registration, login, JWT |
| Entry     | 5002 | MongoDB (tt-entries) | Knowledge entries CRUD, caching |
| Org       | 5003 | MongoDB (tt-orgs) | Organization management, multi-tenancy |
| Analytics | 5004 | MongoDB (tt-analytics) | Event-driven metrics aggregation |

## 🧩 Projects Inside Organizations

- Organizations now contain multiple projects.
- New organizations automatically get a `Default Project` so new entry flows are immediately usable.
- Entry, voting, and analytics requests are scoped by both `orgId` and `projectId`.
- The client sends active context headers on every request: `x-org-id` and `x-project-id`.
- Only org owners can create projects. All org members can list and switch projects inside the active org.
- Legacy entries without `projectId` are treated as part of the org's first project until backfilled.
- Recommended backfill for older data: set `projectId` on existing `tt-entries.entries` documents to the intended project ID.

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Docker & Docker Compose**
- **npm 9+**

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Start infrastructure (MongoDB + Redis)

```bash
npm run infra
```

This starts MongoDB and Redis in Docker. Verify they're running:

```bash
docker ps | grep tt-
```

### 3. Open 6 terminal tabs and start each service

**Terminal 1 - Auth Service:**
```bash
npm run dev:auth  # Port 5001
```

**Terminal 2 - Org Service:**
```bash
npm run dev:org  # Port 5003
```

**Terminal 3 - Entry Service:**
```bash
npm run dev:entry  # Port 5002
```

**Terminal 4 - Analytics Service:**
```bash
npm run dev:analytics  # Port 5004
```

**Terminal 5 - Gateway:**
```bash
npm run dev:gateway  # Port 5000
```

**Terminal 6 - Client:**
```bash
npm run dev:client  # Port 3000
```

Wait ~10 seconds for all services to start.

### 4. Verify everything works

```bash
bash verify.sh
```

This script will:
- Check all service health endpoints
- Create a test user
- Create an organization
- Create and switch to a project
- Create a knowledge entry
- Verify analytics aggregation
- Check frontend accessibility

### 5. Open in browser

Navigate to **http://localhost:3000**

**Test credentials:**
- Email: `test@example.com`
- Password: `password123`

## 📝 Local Development Environment Files

All `.env` files are created automatically during setup:

- `gateway/.env` - Gateway configuration
- `services/auth-service/.env` - Auth service configuration
- `services/org-service/.env` - Org service configuration
- `services/entry-service/.env` - Entry service configuration
- `services/analytics-service/.env` - Analytics service configuration
- `client/.env.local` - Frontend configuration

**IMPORTANT:** All services use the same `JWT_SECRET` for token verification.

## 🛠️ Tech Stack

### Backend
- **Server Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Caching:** Redis (Streams for async events)
- **Authentication:** JWT (httpOnly cookies)
- **Runtime:** Node.js 18+
- **Architecture:** Microservices with API Gateway

### Frontend
- **Framework:** Next.js 14 (App Router)
- **State Management:** Redux Toolkit
- **HTTP Client:** Axios
- **Styling:** TailwindCSS
- **UI:** Custom components (no libraries)
- **Icons:** Inline SVGs

## 🔄 Communication Patterns

### Synchronous (HTTP)
- Client → Gateway (rewrites to `/api/*`)
- Gateway → Auth/Entry/Org/Analytics services
- Service-to-service calls (e.g., Entry → Org for membership check)

### Asynchronous (Redis Streams)
- Entry Service publishes `entry:created`, `entry:updated`, `entry:deleted` with `orgId` + `projectId`
- Org Service publishes org events with `projectId` included for downstream compatibility
- Analytics Service consumes events and aggregates metrics

## 📚 API Endpoints Summary

### Auth Service
```
POST   /auth/register          Create user account
POST   /auth/login             Login and receive JWT
POST   /auth/logout            Invalidate JWT
GET    /auth/me                Get current user
PUT    /auth/profile           Update user profile
```

### Org Service
```
POST   /org/create             Create organization
POST   /org/join               Join by invite code
GET    /org/my-orgs            List user's organizations
GET    /org/:id                Get org details
PUT    /org/switch/:id         Set active organization
POST   /org/:orgId/projects    Create project (owner only)
GET    /org/:orgId/projects    List projects in org
PUT    /org/switch-project/:id Set active project in current org
```

### Entry Service
```
GET    /entries                List entries (requires x-org-id + x-project-id)
GET    /entries/:id            Get entry details
POST   /entries                Create entry
PUT    /entries/:id            Update entry
DELETE /entries/:id            Delete entry
POST   /entries/:id/upvote     Toggle upvote
POST   /entries/:id/relations  Add decision relation
DELETE /entries/:id/relations/:targetId  Remove decision relation
GET    /entries/graph          Get full decision graph (nodes + edges)
```

### Analytics Service
```
GET    /analytics/org/:orgId         Get org/project metrics
GET    /analytics/user/:userId       Get user activity
GET    /analytics/overview           Get combined dashboard
```

## 🔗 Decision Graph / Impact Map

Users can link decisions to each other to visualize how they affect the organization.

**Relations Types:**
- **impacts** (red): This decision impacts another
- **depends_on** (blue): This decision depends on another
- **replaces** (amber): This decision replaces another
- **related_to** (purple): This decision is related to another
- **blocks** (pink): This decision blocks another

**Features:**
- Interactive graph visualization (React Flow)
- Click to view full entry details
- Filter by relation type
- See ripple effects of decisions
- Beautiful dark-mode UI with Tailwind
- Responsive on all screen sizes

**Access:**
- Open graph at: **`/graph`** (inside project dashboard)
- Backend: POST/DELETE relations via `/entries/:id/relations`
- Frontend: Redux slice manages graph state + React Flow visualization

## 🎯 Resume Highlights

This project showcases:

- **Microservices Architecture:** Independent, scalable services with clear boundaries
- **Event-Driven Design:** Redis Streams consumer pattern for async processing
- **Multi-Tenancy:** Org-based data isolation with proper security checks
- **Production Code:** Error handling, logging, middleware patterns
- **Full-Stack:** Backend microservices + modern frontend framework
- **Database Patterns:** Mongoose schemas, indexing, query optimization
- **Caching Strategy:** Redis with TTL and cache invalidation
- **API Design:** RESTful endpoints with proper HTTP status codes
- **Security:** JWT authentication, httpOnly cookies, CORS, rate limiting
- **Testing:** Integration test suite (verify.sh)

## 📝 Development Workflow

### Adding a new feature

1. Create a new endpoint in relevant service
2. Add Redux thunk in frontend
3. Create component to call the thunk
4. Test via frontend UI
5. Run `bash verify.sh` to ensure no regressions

### Service-to-service communication

Example: Entry Service calling Org Service to verify membership

```javascript
// entry-service - controllers/entryController.js
async function createEntry(req, res) {
  const { orgId } = req.body;
  const userId = req.headers['x-user-id'];

  // Call org service to verify membership
  const org = await axios.get(`http://localhost:5003/org/${orgId}`, {
    headers: { 'x-user-id': userId, 'x-trace-id': traceId }
  });

  if (!org.data.members.includes(userId)) {
    return res.status(403).json({ success: false, message: 'Not a member' });
  }

  // Proceed with entry creation
}
```

### Publishing events

Example: Entry Service publishing entry creation event

```javascript
// entry-service - controllers/entryController.js
await redisClient.xAdd('entry-events', '*', 'data', JSON.stringify({
  eventType: 'entry:created',
  orgId,
  authorId: userId,
  entryId: entry._id,
  type: entry.type,
  timestamp: new Date().toISOString(),
}));
```

## 🐛 Troubleshooting

### Port already in use

Kill process on specific port (Linux/Mac):
```bash
lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

Or on Windows PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Services can't connect to MongoDB/Redis

Ensure Docker containers are running:
```bash
docker ps | grep tt-
```

### JWT authentication fails

Ensure `JWT_SECRET` is the same in:
- `gateway/.env`
- `services/auth-service/.env`

### Frontend shows 401 errors

1. Check if gateway is running: `curl http://localhost:5000/health`
2. Check if auth service is running: `curl http://localhost:5001/health`
3. Clear browser cookies and try logging in again

## 📦 Deployment

### Docker Compose Production

Build images and deploy all services:

```bash
docker compose up --build
```

### Environment Variables for Production

Update `.env` files with:
- Real `JWT_SECRET` (use `openssl rand -base64 32`)
- Production database URIs
- CORS origins
- Rate limit settings

## 📄 License

MIT

---

**Questions?** Check the service README files in each service directory for more details.

## 🧠 Key Learnings

* How containerization (Docker) simplifies deployment and scaling
* How load balancing (Nginx) improves concurrency and reliability
* Why Redis caching drastically reduces first-load latency
* How CI/CD turns manual redeploys into fast, reliable automation
* Importance of observability — monitoring with Prometheus and health checks

---

## 🧑‍💻 Local Setup

```bash
# 1. Clone repo
git clone https://github.com/Himanshu25Sahu/think-twice.git
cd think-twice

# 2. Start containers
docker-compose up --build

# 3. Visit frontend
http://localhost:3000
```

---

## 🏗️ Future Improvements

* Add advanced analytics & visualization for decisions
* Implement Kubernetes-based scaling
* Introduce authentication & role-based access
* Deploy Prometheus metrics dashboard to cloud

---

## ✨ Author

👨‍💻 **Himanshu Sahu**
📍 Bengaluru, India
🔗 [Portfolio](https://himanshu25sahu.github.io/HimanshuSahu/) · [LinkedIn](https://linkedin.com/in/himanshu-sahu-303b2b25a/) · [GitHub](https://github.com/Himanshu25Sahu)

---

### ⭐ If you found this project useful, consider giving it a star!

> “From a simple decision tracker to a production-grade, load-balanced platform — **Think Twice** taught me how real systems scale, automate, and perform under pressure.”
