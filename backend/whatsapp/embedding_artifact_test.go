package whatsapp

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

func TestLoadOrComputeCentroidCachesByModelAndContent(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:embedding_artifact_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.EmbeddingArtifact{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	calls := 0
	embed := func(text string) ([]float64, error) {
		calls++
		return []float64{float64(len(text)), 2}, nil
	}

	phrases := []string{"aa", "bbbb"}
	first, err := loadOrComputeCentroid(db, "intent:test", "model-v1", phrases, embed)
	if err != nil {
		t.Fatalf("first load: %v", err)
	}
	if calls != 2 || first[0] != 3 {
		t.Fatalf("first centroid=%v calls=%d, want [3 2] and 2 calls", first, calls)
	}

	second, err := loadOrComputeCentroid(db, "intent:test", "model-v1", phrases, embed)
	if err != nil {
		t.Fatalf("cached load: %v", err)
	}
	if calls != 2 || second[0] != 3 {
		t.Fatalf("cached centroid=%v calls=%d, want no new embedding calls", second, calls)
	}

	changed, err := loadOrComputeCentroid(db, "intent:test", "model-v1", []string{"aa", "cccccc"}, embed)
	if err != nil {
		t.Fatalf("content invalidation: %v", err)
	}
	if calls != 4 || changed[0] != 4 {
		t.Fatalf("changed centroid=%v calls=%d, want recompute after phrase change", changed, calls)
	}

	if _, err := loadOrComputeCentroid(db, "intent:test", "model-v2", []string{"aa", "cccccc"}, embed); err != nil {
		t.Fatalf("model invalidation: %v", err)
	}
	if calls != 6 {
		t.Fatalf("calls=%d, want recompute after model change", calls)
	}

	var count int64
	if err := db.Model(&models.EmbeddingArtifact{}).Count(&count).Error; err != nil {
		t.Fatalf("count artifacts: %v", err)
	}
	if count != 1 {
		t.Fatalf("artifact rows=%d, want one upserted row", count)
	}
}

func TestLoadOrComputeCentroidDoesNotPersistPartialResults(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:embedding_partial_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.EmbeddingArtifact{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	calls := 0
	embed := func(text string) ([]float64, error) {
		calls++
		if text == "unavailable" {
			return nil, errors.New("temporary failure")
		}
		return []float64{1, 2}, nil
	}
	phrases := []string{"available", "unavailable"}

	if _, err := loadOrComputeCentroid(db, "intent:partial", "model-v1", phrases, embed); err != nil {
		t.Fatalf("first partial result: %v", err)
	}
	if _, err := loadOrComputeCentroid(db, "intent:partial", "model-v1", phrases, embed); err != nil {
		t.Fatalf("second partial result: %v", err)
	}
	if calls != 4 {
		t.Fatalf("calls=%d, want partial centroid retried instead of cached", calls)
	}

	var count int64
	if err := db.Model(&models.EmbeddingArtifact{}).Count(&count).Error; err != nil {
		t.Fatalf("count artifacts: %v", err)
	}
	if count != 0 {
		t.Fatalf("artifact rows=%d, want no persisted partial centroid", count)
	}
}

func TestFindRulesNeedingEmbeddingsExcludesDynamicSettings(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:embedding_rules_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Rule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	rules := []models.Rule{
		{Keywords: "manual missing", SourceType: models.SourceTypeManual, IsActive: true},
		{Keywords: "payment", SourceType: models.SourceTypePaymentSettings, IsActive: true},
		{Keywords: "delivery", SourceType: models.SourceTypeDeliverySettings, IsActive: true},
		{Keywords: "already embedded", SourceType: models.SourceTypeManual, IsActive: true, Embedding: []byte(`[1,2]`)},
		{Keywords: "inactive", SourceType: models.SourceTypeManual, IsActive: false},
	}
	if err := db.Create(&rules).Error; err != nil {
		t.Fatalf("create rules: %v", err)
	}
	if err := db.Model(&rules[4]).Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate rule: %v", err)
	}

	missing, err := findRulesNeedingEmbeddings(db)
	if err != nil {
		t.Fatalf("find missing embeddings: %v", err)
	}
	if len(missing) != 1 || missing[0].ID != rules[0].ID {
		t.Fatalf("missing rule IDs=%v, want only %d", ruleIDs(missing), rules[0].ID)
	}
}

func ruleIDs(rules []models.Rule) []uint {
	ids := make([]uint, len(rules))
	for i := range rules {
		ids[i] = rules[i].ID
	}
	return ids
}
