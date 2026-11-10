package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// Event is one Redis Stream message. Producers JSON-encode each field value,
// so a field may arrive as `"abc"` or as plain `abc`.
type Event map[string]string

func parseEvent(values map[string]any) Event {
	e := Event{}
	for k, raw := range values {
		s := fmt.Sprint(raw)
		var decoded any
		if json.Unmarshal([]byte(s), &decoded) == nil {
			switch v := decoded.(type) {
			case string:
				s = v
			case nil:
				s = ""
			}
		}
		e[k] = s
	}
	return e
}

type Consumer struct {
	Stream, Group, Name string
	Handle              func(context.Context, Event) error
}

// Run reads the stream until ctx is cancelled. It first re-delivers messages
// this consumer read but never acknowledged (e.g. the service was killed
// mid-batch), then switches to new messages.
func (c Consumer) Run(ctx context.Context, rdb *redis.Client) {
	err := rdb.XGroupCreateMkStream(ctx, c.Stream, c.Group, "0").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		log.Printf("❌ create group %s on %s: %v", c.Group, c.Stream, err)
	}
	log.Printf("🔄 listening to %s (group %s)", c.Stream, c.Group)

	cursor := "0" // pending first
	for ctx.Err() == nil {
		res, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group: c.Group, Consumer: c.Name, Streams: []string{c.Stream, cursor},
			Count: 10, Block: 30 * time.Second,
		}).Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("❌ read %s: %v (retrying in 5s)", c.Stream, err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
			}
			continue
		}

		n := 0
		for _, stream := range res {
			for _, msg := range stream.Messages {
				n++
				if err := c.Handle(ctx, parseEvent(msg.Values)); err != nil {
					log.Printf("❌ handler %s %s: %v", c.Stream, msg.ID, err)
				}
				// Ack even on failure so a bad message can't block the stream.
				if err := rdb.XAck(ctx, c.Stream, c.Group, msg.ID).Err(); err != nil {
					log.Printf("❌ ack %s %s: %v", c.Stream, msg.ID, err)
				}
			}
		}
		if cursor == "0" && n == 0 {
			cursor = ">" // backlog drained; now wait for new messages
		}
	}
}

// Metrics are kept for the org as a whole ("" project) and for the event's
// project, so the dashboard can show either.
func scopes(projectID string) []string {
	if projectID == "" {
		return []string{""}
	}
	return []string{"", projectID}
}

func (a *App) onEntryCreated(ctx context.Context, e Event) error {
	if e["entryId"] == "" || e["orgId"] == "" || e["authorId"] == "" || e["type"] == "" {
		log.Printf("⚠️ skipping incomplete entry:created event: %v", e)
		return nil
	}
	now := time.Now()
	for _, p := range scopes(e["projectId"]) {
		if err := a.store.RecordEntryCreated(ctx, e["orgId"], p, e["authorId"], e["type"], now); err != nil {
			return err
		}
	}
	log.Printf("📝 entry created %s (%s) in org %s", e["entryId"], e["type"], e["orgId"])
	a.hub.Publish(e["orgId"])
	return nil
}

func (a *App) onEntryDeleted(ctx context.Context, e Event) error {
	if e["orgId"] == "" {
		return nil
	}
	now := time.Now()
	for _, p := range scopes(e["projectId"]) {
		if err := a.store.RecordEntryDeleted(ctx, e["orgId"], p, now); err != nil {
			return err
		}
	}
	log.Printf("🗑️ entry deleted %s in org %s", e["entryId"], e["orgId"])
	a.hub.Publish(e["orgId"])
	return nil
}

func (a *App) onEntryUpdated(ctx context.Context, e Event) error {
	if e["orgId"] == "" {
		return nil
	}
	now := time.Now()
	for _, p := range scopes(e["projectId"]) {
		if err := a.store.RecordEntryUpdated(ctx, e["orgId"], p, e["authorId"], now); err != nil {
			return err
		}
	}
	a.hub.Publish(e["orgId"])
	return nil
}

func (a *App) onMemberJoined(ctx context.Context, e Event) error {
	if e["orgId"] == "" || e["userId"] == "" {
		return nil
	}
	now := time.Now()
	for _, p := range scopes(e["projectId"]) {
		if err := a.store.RecordMemberJoined(ctx, e["orgId"], p, e["userId"], now); err != nil {
			return err
		}
	}
	a.members.Forget(e["orgId"], e["userId"]) // a cached "denied" is now stale
	log.Printf("👤 member %s joined org %s", e["userId"], e["orgId"])
	a.hub.Publish(e["orgId"])
	return nil
}

// isoWeek returns e.g. "2026-W45", matching the format already stored.
func isoWeek(t time.Time) string {
	y, w := t.UTC().ISOWeek()
	return fmt.Sprintf("%d-W%02d", y, w)
}
