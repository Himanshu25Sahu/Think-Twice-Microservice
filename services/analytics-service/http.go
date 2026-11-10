package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type App struct {
	store   *Store
	hub     *Hub
	members *Membership
}

func (a *App) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "analytics-service"})
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "status": "ok", "service": "analytics-service"})
	})
	mux.HandleFunc("GET /analytics/org/{orgId}", a.handleOrg)
	mux.HandleFunc("GET /analytics/user/{userId}", a.handleUser)
	mux.HandleFunc("GET /analytics/overview", a.handleOverview)
	mux.HandleFunc("GET /analytics/stream", a.handleStream)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeErr(w, http.StatusNotFound, fmt.Sprintf("Route not found: %s %s", r.Method, r.URL.Path))
	})
	return mux
}

func (a *App) handleOrg(w http.ResponseWriter, r *http.Request) {
	orgID, projectID, ok := a.authorize(w, r, r.PathValue("orgId"))
	if !ok {
		return
	}
	m, err := a.store.OrgMetrics(r.Context(), orgID, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": m})
}

func (a *App) handleUser(w http.ResponseWriter, r *http.Request) {
	orgID, projectID, ok := a.authorize(w, r, r.URL.Query().Get("orgId"))
	if !ok {
		return
	}
	u, err := a.store.UserActivity(r.Context(), r.PathValue("userId"), orgID, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": u})
}

func (a *App) handleOverview(w http.ResponseWriter, r *http.Request) {
	orgID, projectID, ok := a.authorize(w, r, r.URL.Query().Get("orgId"))
	if !ok {
		return
	}
	m, err := a.store.OrgMetrics(r.Context(), orgID, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	u, err := a.store.UserActivity(r.Context(), r.Header.Get("x-user-id"), orgID, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": map[string]any{"organization": m, "user": u}})
}

// authorize resolves the org/project for a request and checks that the
// caller (x-user-id, set by the gateway after verifying the JWT) belongs to
// the org. It writes the error response itself and returns ok=false on failure.
func (a *App) authorize(w http.ResponseWriter, r *http.Request, orgID string) (_, projectID string, ok bool) {
	projectID = r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = r.Header.Get("x-project-id")
	}
	userID := r.Header.Get("x-user-id")

	if orgID == "" {
		writeErr(w, http.StatusBadRequest, "Organization ID (orgId) is required")
		return "", "", false
	}
	if userID == "" {
		writeErr(w, http.StatusUnauthorized, "Not authenticated")
		return "", "", false
	}

	allowed, err := a.members.IsMember(r.Context(), orgID, userID, r.Header.Get("x-trace-id"))
	if err != nil {
		log.Printf("❌ membership check %s/%s: %v", orgID, userID, err)
		writeErr(w, http.StatusServiceUnavailable, "Could not verify organization access")
		return "", "", false
	}
	if !allowed {
		writeErr(w, http.StatusForbidden, "Access denied")
		return "", "", false
	}
	return orgID, projectID, true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"success": false, "message": msg})
}

// Membership asks org-service whether a user belongs to an org and caches the
// answer for 5 minutes, so dashboard polling doesn't hit org-service each time.
type Membership struct {
	baseURL string
	client  *http.Client
	mu      sync.Mutex
	cache   map[string]memberEntry
}

type memberEntry struct {
	allowed bool
	expires time.Time
}

func NewMembership(orgServiceURL string) *Membership {
	return &Membership{
		baseURL: orgServiceURL,
		// Generous timeout: on Render's free tier org-service may be cold-starting.
		client: &http.Client{Timeout: 20 * time.Second},
		cache:  map[string]memberEntry{},
	}
}

func (m *Membership) IsMember(ctx context.Context, orgID, userID, traceID string) (bool, error) {
	key := orgID + ":" + userID
	m.mu.Lock()
	e, hit := m.cache[key]
	m.mu.Unlock()
	if hit && time.Now().Before(e.expires) {
		return e.allowed, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.baseURL+"/org/"+url.PathEscape(orgID), nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("x-user-id", userID)
	if traceID != "" {
		req.Header.Set("x-trace-id", traceID)
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return false, err
	}
	resp.Body.Close()

	var allowed bool
	switch {
	case resp.StatusCode == http.StatusOK:
		allowed = true
	case resp.StatusCode == http.StatusForbidden, resp.StatusCode == http.StatusNotFound, resp.StatusCode == http.StatusBadRequest:
		allowed = false
	default:
		return false, errors.New("org-service returned " + resp.Status)
	}

	m.mu.Lock()
	m.cache[key] = memberEntry{allowed: allowed, expires: time.Now().Add(5 * time.Minute)}
	m.mu.Unlock()
	return allowed, nil
}

// Forget drops a cached answer, e.g. after the user joins the org.
func (m *Membership) Forget(orgID, userID string) {
	m.mu.Lock()
	delete(m.cache, orgID+":"+userID)
	m.mu.Unlock()
}
