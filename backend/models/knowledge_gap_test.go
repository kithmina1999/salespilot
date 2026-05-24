package models

import (
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestUpsertKnowledgeGapReturnsExistingID(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:knowledge_gap_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&KnowledgeGap{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	first := KnowledgeGap{
		BusinessID:        1,
		RawMessage:        "first",
		NormalizedMessage: "first",
		RouterIntent:      "unknown",
		ClusterKey:        BuildClusterKey("unknown", "first", nil),
	}
	if err := UpsertKnowledgeGap(db, &first); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if first.ID == 0 {
		t.Fatalf("first upsert did not populate ID")
	}

	second := KnowledgeGap{
		BusinessID:        1,
		RawMessage:        "second",
		NormalizedMessage: "first",
		RouterIntent:      "unknown",
		ClusterKey:        first.ClusterKey,
	}
	if err := UpsertKnowledgeGap(db, &second); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("second upsert ID = %d, want existing ID %d", second.ID, first.ID)
	}
	if second.HitCount != 2 {
		t.Fatalf("HitCount = %d, want 2", second.HitCount)
	}
}
