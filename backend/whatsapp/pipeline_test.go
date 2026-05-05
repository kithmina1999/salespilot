package whatsapp

// // pipeline_test.go — FAQ matching tests.
// //
// // Uses real PostgreSQL (loaded from ../.env) — same as production.
// // Run: go test -v ./whatsapp -run TestMatchFAQ

import (
	"log"
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// pipelineTestBiz is the seeded business for all whatsapp package tests.
var pipelineTestBiz models.Business

func TestMain(m *testing.M) {
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("⚠️  No .env found, relying on environment variables")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set — cannot run whatsapp package tests")
	}

	var err error
	database.DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("failed to connect to test DB: %v", err)
	}

	// Migrate all models used by whatsapp package tests
	if err := database.DB.AutoMigrate(
		&models.Business{},
		&models.Rule{},
		&models.UnmatchedMessage{},
		&models.Cart{},
		&models.Order{},
		&models.Customer{},
		&models.Message{},
		&models.Product{},
		&models.SavedAddress{},
		&models.PipelineLog{},
		&models.PipelineSignalLog{},
	); err != nil {
		log.Fatalf("AutoMigrate failed: %v", err)
	}
	// Seed isolated test business (upsert by APIKey to survive reruns)
	pipelineTestBiz = models.Business{
		Name:   "__test_whatsapp_pipeline__",
		Phone:  "00000099001",
		APIKey: "test-whatsapp-pipeline-key",
		Plan:   models.PlanFree,
	}
	database.DB.Where("api_key = ?", pipelineTestBiz.APIKey).FirstOrCreate(&pipelineTestBiz)

	// Seed FAQ rules for matchFAQ tests
	database.DB.Where("business_id = ? AND keywords LIKE ?", pipelineTestBiz.ID, "%price%").FirstOrCreate(&models.Rule{
		BusinessID: &pipelineTestBiz.ID, Keywords: "price,cost,how much",
		Response: "Shirts start at Rs. 2500", IsActive: true,
	})
	database.DB.Where("business_id = ? AND keywords LIKE ?", pipelineTestBiz.ID, "%delivery%").FirstOrCreate(&models.Rule{
		BusinessID: &pipelineTestBiz.ID, Keywords: "delivery,ship,courier",
		Response: "Delivery is Rs. 350 island-wide", IsActive: true,
	})

	Cache.LoadRules()

	code := m.Run()

	// Cleanup test data
	database.DB.Unscoped().Where("business_id = ?", pipelineTestBiz.ID).Delete(&models.Rule{})
	database.DB.Unscoped().Where("business_id = ?", pipelineTestBiz.ID).Delete(&models.Cart{})
	database.DB.Unscoped().Where("business_id = ?", pipelineTestBiz.ID).Delete(&models.Order{})
	database.DB.Unscoped().Delete(&models.Business{}, pipelineTestBiz.ID)

	os.Exit(code)
}

// func respPrefix(r *models.Rule, n int) string {
// 	if r == nil {
// 		return ""
// 	}
// 	s := r.Response
// 	if len(s) < n {
// 		return s
// 	}
// 	return s[:n]
// }

// func TestMatchFAQ(t *testing.T) {
// 	// NOTE: We assert that the right TOPIC is matched (contains key substring),
// 	// not the exact response text. The production DB has global FAQ rules that
// 	// outrank test-business rules for generic keywords like "price", "delivery".
// 	tests := []struct {
// 		name        string
// 		input       string
// 		wantContain string // substring the matched response must contain
// 		wantNil     bool   // true if we expect no match
// 	}{
// 		{"Singlish price", "shirt eke gana kiyada", "price", false},
// 		{"Singlish mila", "mila kiyanna", "price", false},
// 		{"Standard cost", "what is the cost?", "price", false},
// 		{"Sinhala script price", "shirt eke \u0db8\u0dd2\u0dbd", "price", false},
// 		{"Typo delivery", "can you do deliery?", "delivery", false},
// 		{"Typo courier", "do you do that couirir thing?", "delivery", false},
// 	}

// 	for _, tt := range tests {
// 		t.Run(tt.name, func(t *testing.T) {
// 			rule, _ := matchFAQ(pipelineTestBiz.ID, tt.input)
// 			if tt.wantNil {
// 				if rule != nil {
// 					t.Errorf("Expected no match, got: %s", rule.Response)
// 				}
// 				return
// 			}
// 			if rule == nil {
// 				t.Errorf("Expected match containing %q for input %q, got nil", tt.wantContain, tt.input)
// 				return
// 			}
// 			lower := strings.ToLower(rule.Response)
// 			if !strings.Contains(lower, strings.ToLower(tt.wantContain)) {
// 				t.Errorf("input=%q\ngot: %q\nwant response to contain: %q", tt.input, rule.Response, tt.wantContain)
// 			}
// 		})
// 	}
// }

// func TestMatchFAQ_CombinationKeywords(t *testing.T) {
// 	comboRule := models.Rule{
// 		BusinessID: &pipelineTestBiz.ID,
// 		Keywords:   "delivery+price",
// 		Response:   "Free delivery over Rs.5000",
// 		IsActive:   true,
// 	}
// 	database.DB.Create(&comboRule)
// 	defer database.DB.Unscoped().Delete(&comboRule)
// 	Cache.LoadRules()

// 	tests := []struct {
// 		name        string
// 		input       string
// 		wantContain string
// 	}{
// 		{"Both keywords: combo fires", "delivery price kiyada", "Free delivery"},
// 		{"Only delivery: single rule fires", "delivery details kiyanna", "delivery"},
// 		{"Only price: single rule fires", "price kiyada", "price"},
// 		{"Combo specificity wins 4 words", "delivery price eka kiyada", "Free delivery"},
// 	}

// 	for _, tt := range tests {
// 		t.Run(tt.name, func(t *testing.T) {
// 			rule, _ := matchFAQ(pipelineTestBiz.ID, tt.input)
// 			if rule == nil {
// 				t.Errorf("Expected a match for '%s', got nil", tt.input)
// 				return
// 			}
// 			if !strings.Contains(rule.Response, tt.wantContain) {
// 				t.Errorf("input=%q\n  got:  %q\n  want to contain: %q", tt.input, rule.Response, tt.wantContain)
// 			}
// 		})
// 	}
// }
