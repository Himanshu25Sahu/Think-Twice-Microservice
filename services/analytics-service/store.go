package main

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Entry types the dashboard knows about. Unknown types still count toward
// totalEntries but get no per-type bucket (same as the Node version).
var entryTypes = []string{"architecture", "debugging", "feature", "best-practice", "incident", "other"}

func isKnownType(t string) bool {
	for _, k := range entryTypes {
		if k == t {
			return true
		}
	}
	return false
}

func zeroTypes() map[string]int64 {
	m := make(map[string]int64, len(entryTypes))
	for _, t := range entryTypes {
		m[t] = 0
	}
	return m
}

type WeekCount struct {
	Week  string `bson:"week" json:"week"`
	Count int64  `bson:"count" json:"count"`
}

type Contributor struct {
	UserID string `bson:"userId" json:"userId"`
	Count  int64  `bson:"count" json:"count"`
}

type OrgMetrics struct {
	OrgID           string           `bson:"orgId" json:"orgId"`
	ProjectID       string           `bson:"projectId" json:"projectId"`
	TotalEntries    int64            `bson:"totalEntries" json:"totalEntries"`
	TotalMembers    int64            `bson:"totalMembers" json:"totalMembers"`
	EntriesByType   map[string]int64 `bson:"entriesByType" json:"entriesByType"`
	WeeklyActivity  []WeekCount      `bson:"weeklyActivity" json:"weeklyActivity"`
	TopContributors []Contributor    `bson:"topContributors" json:"topContributors"`
	LastUpdated     time.Time        `bson:"lastUpdated" json:"lastUpdated"`
}

type UserActivity struct {
	UserID         string           `bson:"userId" json:"userId"`
	OrgID          string           `bson:"orgId" json:"orgId"`
	ProjectID      string           `bson:"projectId" json:"projectId"`
	EntriesCreated int64            `bson:"entriesCreated" json:"entriesCreated"`
	EntriesByType  map[string]int64 `bson:"entriesByType" json:"entriesByType"`
	LastActive     time.Time        `bson:"lastActive" json:"lastActive"`
}

// Store wraps the two collections the Node service created via mongoose,
// so existing production data is read and written unchanged.
type Store struct {
	orgs  *mongo.Collection
	users *mongo.Collection
}

func NewStore(db *mongo.Database) *Store {
	return &Store{orgs: db.Collection("orgmetrics"), users: db.Collection("useractivities")}
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	unique := options.Index().SetUnique(true)
	if _, err := s.orgs.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "orgId", Value: 1}, {Key: "projectId", Value: 1}}, Options: unique,
	}); err != nil {
		return err
	}
	_, err := s.users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "userId", Value: 1}, {Key: "orgId", Value: 1}, {Key: "projectId", Value: 1}}, Options: unique,
	})
	return err
}

// ---- reads ----

func (s *Store) OrgMetrics(ctx context.Context, orgID, projectID string) (OrgMetrics, error) {
	m := OrgMetrics{OrgID: orgID, ProjectID: projectID, LastUpdated: time.Now()}
	err := s.orgs.FindOne(ctx, bson.M{"orgId": orgID, "projectId": projectID}).Decode(&m)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return m, err
	}
	m.EntriesByType = fillTypes(m.EntriesByType)
	if m.WeeklyActivity == nil {
		m.WeeklyActivity = []WeekCount{}
	}
	if m.TopContributors == nil {
		m.TopContributors = []Contributor{}
	}
	return m, nil
}

func (s *Store) UserActivity(ctx context.Context, userID, orgID, projectID string) (UserActivity, error) {
	u := UserActivity{UserID: userID, OrgID: orgID, ProjectID: projectID, LastActive: time.Now()}
	err := s.users.FindOne(ctx, bson.M{"userId": userID, "orgId": orgID, "projectId": projectID}).Decode(&u)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return u, err
	}
	u.EntriesByType = fillTypes(u.EntriesByType)
	return u, nil
}

func fillTypes(m map[string]int64) map[string]int64 {
	out := zeroTypes()
	for k, v := range m {
		out[k] = v
	}
	return out
}

// ---- writes ----
// Each write is a single atomic MongoDB operation (upsert / $inc), so two
// events for the same org can never overwrite each other's counts.

var upsert = options.UpdateOne().SetUpsert(true)

func (s *Store) ensureOrg(ctx context.Context, orgID, projectID string) error {
	_, err := s.orgs.UpdateOne(ctx, bson.M{"orgId": orgID, "projectId": projectID}, bson.M{
		"$setOnInsert": bson.M{
			"totalEntries": 0, "totalMembers": 0, "entriesByType": zeroTypes(),
			"weeklyActivity": bson.A{}, "topContributors": bson.A{}, "lastUpdated": time.Now(),
		},
	}, upsert)
	return err
}

func (s *Store) ensureUser(ctx context.Context, userID, orgID, projectID string) error {
	_, err := s.users.UpdateOne(ctx, bson.M{"userId": userID, "orgId": orgID, "projectId": projectID}, bson.M{
		"$setOnInsert": bson.M{"entriesCreated": 0, "entriesByType": zeroTypes(), "lastActive": time.Now()},
	}, upsert)
	return err
}

func (s *Store) RecordEntryCreated(ctx context.Context, orgID, projectID, authorID, entryType string, now time.Time) error {
	if err := s.ensureOrg(ctx, orgID, projectID); err != nil {
		return err
	}
	scope := bson.M{"orgId": orgID, "projectId": projectID}

	inc := bson.M{"totalEntries": 1}
	if isKnownType(entryType) {
		inc["entriesByType."+entryType] = 1
	}
	if _, err := s.orgs.UpdateOne(ctx, scope, bson.M{"$inc": inc, "$set": bson.M{"lastUpdated": now}}); err != nil {
		return err
	}

	// Weekly bucket: bump if present, otherwise append.
	week := isoWeek(now)
	if err := s.bumpOrPush(ctx, scope, "weeklyActivity", "week", week, bson.M{"week": week, "count": 1}); err != nil {
		return err
	}

	// Contributor: bump if present, otherwise append; then keep the top 10.
	if err := s.bumpOrPush(ctx, scope, "topContributors", "userId", authorID, bson.M{"userId": authorID, "count": 1}); err != nil {
		return err
	}
	if _, err := s.orgs.UpdateOne(ctx, scope, bson.M{"$push": bson.M{"topContributors": bson.M{
		"$each": bson.A{}, "$sort": bson.M{"count": -1}, "$slice": 10,
	}}}); err != nil {
		return err
	}

	// Author's own activity.
	if err := s.ensureUser(ctx, authorID, orgID, projectID); err != nil {
		return err
	}
	uinc := bson.M{"entriesCreated": 1}
	if isKnownType(entryType) {
		uinc["entriesByType."+entryType] = 1
	}
	_, err := s.users.UpdateOne(ctx, bson.M{"userId": authorID, "orgId": orgID, "projectId": projectID},
		bson.M{"$inc": uinc, "$set": bson.M{"lastActive": now}})
	return err
}

func (s *Store) bumpOrPush(ctx context.Context, scope bson.M, array, key, value string, item bson.M) error {
	filter := bson.M{"orgId": scope["orgId"], "projectId": scope["projectId"], array + "." + key: value}
	res, err := s.orgs.UpdateOne(ctx, filter, bson.M{"$inc": bson.M{array + ".$.count": 1}})
	if err != nil || res.MatchedCount > 0 {
		return err
	}
	_, err = s.orgs.UpdateOne(ctx, scope, bson.M{"$push": bson.M{array: item}})
	return err
}

func (s *Store) RecordEntryDeleted(ctx context.Context, orgID, projectID string, now time.Time) error {
	scope := bson.M{"orgId": orgID, "projectId": projectID}
	if _, err := s.orgs.UpdateOne(ctx, bson.M{"orgId": orgID, "projectId": projectID, "totalEntries": bson.M{"$gt": 0}},
		bson.M{"$inc": bson.M{"totalEntries": -1}}); err != nil {
		return err
	}
	_, err := s.orgs.UpdateOne(ctx, scope, bson.M{"$set": bson.M{"lastUpdated": now}})
	return err
}

func (s *Store) RecordEntryUpdated(ctx context.Context, orgID, projectID, authorID string, now time.Time) error {
	if _, err := s.orgs.UpdateOne(ctx, bson.M{"orgId": orgID, "projectId": projectID},
		bson.M{"$set": bson.M{"lastUpdated": now}}); err != nil {
		return err
	}
	if authorID == "" {
		return nil
	}
	_, err := s.users.UpdateOne(ctx, bson.M{"userId": authorID, "orgId": orgID, "projectId": projectID},
		bson.M{"$set": bson.M{"lastActive": now}})
	return err
}

func (s *Store) RecordMemberJoined(ctx context.Context, orgID, projectID, userID string, now time.Time) error {
	if err := s.ensureOrg(ctx, orgID, projectID); err != nil {
		return err
	}
	if _, err := s.orgs.UpdateOne(ctx, bson.M{"orgId": orgID, "projectId": projectID},
		bson.M{"$inc": bson.M{"totalMembers": 1}, "$set": bson.M{"lastUpdated": now}}); err != nil {
		return err
	}
	return s.ensureUser(ctx, userID, orgID, projectID)
}
