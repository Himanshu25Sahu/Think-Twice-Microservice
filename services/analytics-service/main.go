// Analytics service: consumes entry/org events from Redis Streams, keeps
// per-org metrics in MongoDB, and serves them over HTTP (plus a live SSE feed).
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/x/mongo/driver/connstring"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("[ANALYTICS] ")

	port := env("PORT", "5004")
	mongoURI := env("MONGODB_URI", "mongodb://localhost:27017/tt-analytics")
	redisURL := env("REDIS_URL", "redis://localhost:6379")
	orgServiceURL := env("ORG_SERVICE_URL", "http://localhost:5003")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Mongo
	cs, err := connstring.ParseAndValidate(mongoURI)
	if err != nil {
		log.Fatalf("invalid MONGODB_URI: %v", err)
	}
	dbName := cs.Database
	if dbName == "" {
		dbName = "test" // what mongoose used when the URI named no database
	}
	mc, err := mongo.Connect(options.Client().ApplyURI(mongoURI).SetServerSelectionTimeout(5 * time.Second))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer mc.Disconnect(context.Background())
	if err := mc.Ping(ctx, nil); err != nil {
		log.Fatalf("mongo ping: %v", err)
	}
	store := NewStore(mc.Database(dbName))
	if err := store.EnsureIndexes(ctx); err != nil {
		// Usually means the unique index already exists under another name
		// (created by the old Node service) - the data is still protected.
		log.Printf("⚠️ mongo indexes: %v", err)
	}
	log.Printf("connected to MongoDB (db=%s)", dbName)

	// Redis
	ropts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(ropts)
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}
	log.Print("connected to Redis")

	hub := NewHub()
	app := &App{store: store, hub: hub, members: NewMembership(orgServiceURL)}

	// One goroutine per stream. Each blocking XREADGROUP takes its own pooled
	// connection, so a slow stream never starves the others.
	for _, c := range []Consumer{
		{Stream: "entry:created", Group: "analytics-entry-created-group", Name: "analytics-entry-created-consumer", Handle: app.onEntryCreated},
		{Stream: "entry:updated", Group: "analytics-entry-updated-group", Name: "analytics-entry-updated-consumer", Handle: app.onEntryUpdated},
		{Stream: "entry:deleted", Group: "analytics-entry-deleted-group", Name: "analytics-entry-deleted-consumer", Handle: app.onEntryDeleted},
		{Stream: "org:member.joined", Group: "analytics-group", Name: "org-consumer", Handle: app.onMemberJoined},
	} {
		go c.Run(ctx, rdb)
	}

	srv := &http.Server{Addr: ":" + port, Handler: app.Routes()}
	go func() {
		log.Printf("HTTP server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Print("shutting down")
	hub.CloseAll() // end open SSE streams so Shutdown doesn't wait on them
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
