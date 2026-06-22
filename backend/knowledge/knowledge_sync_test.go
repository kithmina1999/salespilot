package knowledge

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

func TestGenerateProductKeywords(t *testing.T) {
	prod := models.Product{
		Name:     "Premium Red Dress XL",
		Category: "Clothing",
		Aliases:  `["red frock", "party dress"]`,
	}

	keywords := GenerateProductKeywords(prod)
	kwList := strings.Split(keywords, ",")

	// Check that we got full name
	hasFullName := false
	for _, k := range kwList {
		if k == "premium red dress xl" {
			hasFullName = true
		}
	}
	if !hasFullName {
		t.Errorf("Expected full name keyword 'premium red dress xl' to be present, got: %v", kwList)
	}

	// Check aliases
	hasAlias1 := false
	hasAlias2 := false
	for _, k := range kwList {
		if k == "red frock" {
			hasAlias1 = true
		}
		if k == "party dress" {
			hasAlias2 = true
		}
	}
	if !hasAlias1 || !hasAlias2 {
		t.Errorf("Expected aliases 'red frock' and 'party dress' to be present, got: %v", kwList)
	}

	// Check that clothing is NOT a standalone keyword (no clothing alone)
	for _, k := range kwList {
		if k == "clothing" {
			t.Errorf("Did not expect category 'clothing' to be a standalone keyword to avoid false positives")
		}
	}

	// Check combo keyword
	hasCombo := false
	for _, k := range kwList {
		if k == "clothing+dress" {
			hasCombo = true
		}
	}
	if !hasCombo {
		t.Errorf("Expected combo category+word keyword 'clothing+dress' to be present, got: %v", kwList)
	}
}

func TestSyncProductKnowledgeUsesLiveTemplateJSON(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:product_knowledge_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Rule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	product := models.Product{
		BusinessID: 7,
		ID:         12,
		Name:       `Bob's "Best" Mug`,
		Price:      1250,
		Active:     true,
	}
	if err := SyncProductKnowledge(db, product); err != nil {
		t.Fatalf("sync product knowledge: %v", err)
	}

	var rule models.Rule
	if err := db.Where("business_id = ? AND source_type = ? AND source_id = ?", product.BusinessID, models.SourceTypeProduct, product.ID).First(&rule).Error; err != nil {
		t.Fatalf("find rule: %v", err)
	}

	var responses map[string]string
	if err := json.Unmarshal([]byte(rule.Responses), &responses); err != nil {
		t.Fatalf("responses are not valid JSON: %v", err)
	}
	if got := responses["en"]; !strings.Contains(got, "{{product_name}}") || !strings.Contains(got, "{{product_price}}") {
		t.Fatalf("product response should use live placeholders, got %q", got)
	}
}

func TestSyncProductKnowledgeInvalidatesOnlyChangedEmbeddingText(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:product_embedding_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Rule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	product := models.Product{BusinessID: 7, ID: 12, Name: "Blue Mug", Active: true}
	rule, needsEmbedding, err := SyncProductKnowledgeWithEmbeddingState(db, product)
	if err != nil {
		t.Fatalf("initial sync: %v", err)
	}
	if !needsEmbedding {
		t.Fatal("new product rule should need an embedding")
	}

	rule.Embedding = []byte(`[1,2]`)
	if err := db.Save(rule).Error; err != nil {
		t.Fatalf("store embedding: %v", err)
	}

	unchanged, needsEmbedding, err := SyncProductKnowledgeWithEmbeddingState(db, product)
	if err != nil {
		t.Fatalf("unchanged sync: %v", err)
	}
	if needsEmbedding || len(unchanged.Embedding) == 0 {
		t.Fatal("unchanged semantic text should retain its embedding")
	}

	product.Name = "Red Mug"
	changed, needsEmbedding, err := SyncProductKnowledgeWithEmbeddingState(db, product)
	if err != nil {
		t.Fatalf("changed sync: %v", err)
	}
	if !needsEmbedding || len(changed.Embedding) != 0 {
		t.Fatal("changed semantic text should clear and regenerate its embedding")
	}
}

func TestSyncAllSystemKnowledgeBackfillsExistingData(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:system_knowledge_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Business{}, &models.Product{}, &models.Rule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	biz := models.Business{Name: "Backfill Shop", AllowCOD: true}
	if err := db.Create(&biz).Error; err != nil {
		t.Fatalf("create business: %v", err)
	}
	manualRule := models.Rule{BusinessID: &biz.ID, Keywords: "hello", IsActive: true}
	if err := db.Create(&manualRule).Error; err != nil {
		t.Fatalf("create rule: %v", err)
	}
	product := models.Product{BusinessID: biz.ID, Name: "Starter Pack", Price: 1490, Active: true}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	if err := SyncAllSystemKnowledge(db); err != nil {
		t.Fatalf("sync all system knowledge: %v", err)
	}

	var updatedManual models.Rule
	if err := db.First(&updatedManual, manualRule.ID).Error; err != nil {
		t.Fatalf("find manual rule: %v", err)
	}
	if updatedManual.KnowledgeType != models.KnowledgeTypeStaticFAQ || updatedManual.SourceType != models.SourceTypeManual {
		t.Fatalf("manual rule fields = (%q, %q), want static/manual", updatedManual.KnowledgeType, updatedManual.SourceType)
	}

	var count int64
	db.Model(&models.Rule{}).Where("business_id = ? AND source_type IN ?", biz.ID, []string{
		models.SourceTypePaymentSettings,
		models.SourceTypeDeliverySettings,
		models.SourceTypeProduct,
	}).Count(&count)
	if count != 3 {
		t.Fatalf("system-managed rule count = %d, want 3", count)
	}
}
