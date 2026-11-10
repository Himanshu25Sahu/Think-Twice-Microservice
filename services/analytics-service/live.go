package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Hub fans out "this org's metrics changed" signals to every open dashboard
// stream for that org. Each subscriber has a 1-slot buffered channel: if a
// signal is already waiting, another one adds nothing, so a burst of events
// costs one refresh and a slow client never blocks the consumers.
type Hub struct {
	mu   sync.Mutex
	subs map[string]map[chan struct{}]struct{}
	done chan struct{}
	once sync.Once
}

func NewHub() *Hub {
	return &Hub{subs: map[string]map[chan struct{}]struct{}{}, done: make(chan struct{})}
}

func (h *Hub) Subscribe(orgID string) (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	h.mu.Lock()
	if h.subs[orgID] == nil {
		h.subs[orgID] = map[chan struct{}]struct{}{}
	}
	h.subs[orgID][ch] = struct{}{}
	h.mu.Unlock()

	return ch, func() {
		h.mu.Lock()
		delete(h.subs[orgID], ch)
		if len(h.subs[orgID]) == 0 {
			delete(h.subs, orgID)
		}
		h.mu.Unlock()
	}
}

func (h *Hub) Publish(orgID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs[orgID] {
		select {
		case ch <- struct{}{}:
		default: // already has a pending signal
		}
	}
}

func (h *Hub) CloseAll() { h.once.Do(func() { close(h.done) }) }

// handleStream serves GET /analytics/stream?orgId=&projectId= as
// Server-Sent Events: the current metrics immediately, then again every time
// an event changes them.
func (a *App) handleStream(w http.ResponseWriter, r *http.Request) {
	orgID, projectID, ok := a.authorize(w, r, r.URL.Query().Get("orgId"))
	if !ok {
		return
	}
	flusher, canFlush := w.(http.Flusher)
	if !canFlush {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no") // tell proxies not to buffer
	w.WriteHeader(http.StatusOK)

	updates, unsubscribe := a.hub.Subscribe(orgID)
	defer unsubscribe()

	send := func() bool {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		m, err := a.store.OrgMetrics(ctx, orgID, projectID)
		if err != nil {
			return true // transient; keep the stream open
		}
		b, _ := json.Marshal(m)
		if _, err := fmt.Fprintf(w, "event: metrics\ndata: %s\n\n", b); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	// retry: tells EventSource how long to wait before reconnecting.
	fmt.Fprint(w, "retry: 5000\n\n")
	if !send() {
		return
	}

	// Comments keep idle connections from being cut by proxies.
	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-a.hub.done:
			return
		case <-updates:
			if !send() {
				return
			}
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
