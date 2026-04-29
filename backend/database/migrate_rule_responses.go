package database

import (
	"encoding/json"
	"log"

	"github.com/kithmina1999/salespilot/models"
)

// MigrateRuleResponses is a one-time migration that copies the legacy
// `response` and `sinhala_response` columns into the new `responses` JSON map.
//
// Run this once on deploy after the schema migration has added the `responses`
// column. It is idempotent — rules that already have a non-empty `responses`
// map are skipped.
//
// Mapping:
//
//	response        → responses["en"]
//	sinhala_response → responses["si"]
func MigrateRuleResponses() {
	log.Println("🌐 Starting rule responses migration...")

	var rules []models.Rule
	// Only migrate rules with empty/null responses map
	if err := DB.Where("responses = '{}' OR responses IS NULL OR responses = ''").Find(&rules).Error; err != nil {
		log.Printf("❌ MigrateRuleResponses: failed to fetch rules: %v", err)
		return
	}

	if len(rules) == 0 {
		log.Println("✅ MigrateRuleResponses: nothing to migrate (all rules already have responses map)")
		return
	}

	migrated := 0
	skipped := 0

	for i := range rules {
		r := &rules[i]

		// Build map from legacy fields
		m := map[string]string{}
		if r.Response != "" {
			m["en"] = r.Response
		}
		if r.SinhalaResponse != "" {
			m["si"] = r.SinhalaResponse
		}

		if len(m) == 0 {
			skipped++
			continue
		}

		b, err := json.Marshal(m)
		if err != nil {
			log.Printf("⚠️  MigrateRuleResponses: failed to marshal rule %d: %v", r.ID, err)
			skipped++
			continue
		}

		if err := DB.Model(r).UpdateColumn("responses", string(b)).Error; err != nil {
			log.Printf("⚠️  MigrateRuleResponses: failed to update rule %d: %v", r.ID, err)
			skipped++
			continue
		}
		migrated++
	}

	log.Printf("✅ MigrateRuleResponses: migrated=%d skipped=%d total=%d", migrated, skipped, len(rules))
}
