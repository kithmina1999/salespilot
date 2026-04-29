package whatsapp

import (
	"log"
	"os"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	var err error
	database.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	database.DB.AutoMigrate(&models.Business{}, &models.Rule{}, &models.UnmatchedMessage{})

	biz := models.Business{Name: "TestBiz"}
	database.DB.Create(&biz)

	database.DB.Create(&models.Rule{
		BusinessID: &biz.ID, Keywords: "price,cost,how much",
		Response: "Shirts start at Rs. 2500", IsActive: true,
	})
	database.DB.Create(&models.Rule{
		BusinessID: &biz.ID, Keywords: "delivery,ship,courier",
		Response: "Delivery is Rs. 350 island-wide", IsActive: true,
	})

	Cache.LoadRules()
	os.Exit(m.Run())
}

func respPrefix(r *models.Rule, n int) string {
	if r == nil {
		return ""
	}
	s := r.Response
	if len(s) < n {
		return s
	}
	return s[:n]
}

func TestMatchFAQ(t *testing.T) {
	var biz models.Business
	database.DB.First(&biz)

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Singlish price", "shirt eke gana kiyada", "Shirts start at Rs. 2500"},
		{"Singlish mila", "mila kiyanna", "Shirts start at Rs. 2500"},
		{"Standard cost", "what is the cost?", "Shirts start at Rs. 2500"},
		// Sinhala script: mila (price) in Sinhala
		{"Sinhala script price", "shirt eke \u0db8\u0dd2\u0dbd", "Shirts start at Rs. 2500"},
		{"Typo delivery", "can you do deliery?", "Delivery is Rs. 350 island-wide"},
		{"Typo courier", "do you do that couirir thing?", "Delivery is Rs. 350 island-wide"},
		{"Unmatched", "do you have red pants?", ""},
		{"No false positive magazine", "do you sell this magazine?", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, _ := matchFAQ(biz.ID, tt.input)
			if tt.expected == "" {
				if rule != nil {
					t.Errorf("Expected no match, got: %s", rule.Response)
				}
			} else {
				if rule == nil {
					t.Errorf("Expected match for '%s', got nil", tt.input)
				} else if rule.Response != tt.expected {
					t.Errorf("Expected '%s', got '%s'", tt.expected, rule.Response)
				}
			}
		})
	}
}

func TestMatchFAQ_CombinationKeywords(t *testing.T) {
	var biz models.Business
	database.DB.First(&biz)

	comboRule := models.Rule{
		BusinessID: &biz.ID,
		Keywords:   "delivery+price",
		Response:   "Free delivery over Rs.5000",
		IsActive:   true,
	}
	database.DB.Create(&comboRule)
	defer database.DB.Unscoped().Delete(&comboRule)
	Cache.LoadRules()

	tests := []struct {
		name        string
		input       string
		wantContain string // substring expected in response
	}{
		{"Both keywords: combo fires", "delivery price kiyada", "Free delivery"},
		{"Only delivery: single rule fires", "delivery details kiyanna", "Delivery is Rs."},
		{"Only price: single rule fires", "price kiyada", "Shirts start"},
		{"Combo specificity wins 4 words", "delivery price eka kiyada", "Free delivery"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rule, _ := matchFAQ(biz.ID, tt.input)
			if rule == nil {
				t.Errorf("Expected a match for '%s', got nil", tt.input)
				return
			}
			if !strings.Contains(rule.Response, tt.wantContain) {
				t.Errorf("input=%q\n  got:  %q\n  want to contain: %q", tt.input, rule.Response, tt.wantContain)
			}
		})
	}
}
