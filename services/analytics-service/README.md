# Analytics Service (Go)

Consumes entry/org events from Redis Streams, keeps per-org metrics in MongoDB,
and serves them to the dashboard — including a live Server-Sent Events feed.

## Endpoints (behind the gateway at `/api/analytics/...`)
| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/org/{orgId}?projectId=` | Org metrics |
| GET | `/analytics/user/{userId}?orgId=&projectId=` | One user's activity |
| GET | `/analytics/overview?orgId=&projectId=` | Org + caller's activity |
| GET | `/analytics/stream?orgId=&projectId=` | SSE: pushes `metrics` on every change |
| GET | `/health`, `/api/health` | Health checks |

All analytics routes require `x-user-id` (set by the gateway) and check org
membership with org-service (cached 5 min).

## How it works
- One goroutine per Redis stream (`entry:created|updated|deleted`, `org:member.joined`),
  using the same consumer groups as the old Node service. Unacked messages are
  re-processed on startup.
- Every write is an atomic MongoDB `$inc`/upsert, so concurrent events can't lose counts.
- After each event, an in-process hub signals every open SSE stream for that org.

## Run
```bash
go test ./...
go run .            # reads env vars from .env.example
docker compose up -d --build analytics-service   # from repo root
```
