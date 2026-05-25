package knowledge

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

// SyncProductKnowledge upserts a system-managed Rule for a product.
func SyncProductKnowledge(db *gorm.DB, product models.Product) error {
	keywords := GenerateProductKeywords(product)
	responses, err := json.Marshal(map[string]string{
		"en": "*{{product_name}}*\nPrice: {{product_price}}\n{{product_stock_status}}\n{{product_options_summary}}",
	})
	if err != nil {
		return err
	}
	responsesJSON := string(responses)

	var rule models.Rule
	err = db.Where("business_id = ? AND source_type = ? AND source_id = ?", product.BusinessID, models.SourceTypeProduct, product.ID).First(&rule).Error

	if err == nil {
		// Update existing rule
		rule.Keywords = keywords
		rule.Responses = responsesJSON
		rule.IsActive = product.Active
		rule.Category = "Product Catalog"
		rule.SystemManaged = true
		rule.KnowledgeType = models.KnowledgeTypeProductCatalog
		return db.Save(&rule).Error
	} else if err == gorm.ErrRecordNotFound {
		// Create new rule
		bizID := product.BusinessID
		prodID := product.ID
		rule = models.Rule{
			BusinessID:    &bizID,
			Category:      "Product Catalog",
			Keywords:      keywords,
			Responses:     responsesJSON,
			IsActive:      product.Active,
			KnowledgeType: models.KnowledgeTypeProductCatalog,
			SourceType:    models.SourceTypeProduct,
			SourceID:      &prodID,
			SystemManaged: true,
		}
		return db.Create(&rule).Error
	}
	return err
}

// SyncAllSystemKnowledge backfills system-managed knowledge for existing dev data.
// It is idempotent and safe to run at startup before the FAQ cache is loaded.
func SyncAllSystemKnowledge(db *gorm.DB) error {
	if err := db.Model(&models.Rule{}).
		Where("knowledge_type IS NULL OR knowledge_type = ?", "").
		Update("knowledge_type", models.KnowledgeTypeStaticFAQ).Error; err != nil {
		return err
	}
	if err := db.Model(&models.Rule{}).
		Where("source_type IS NULL OR source_type = ?", "").
		Update("source_type", models.SourceTypeManual).Error; err != nil {
		return err
	}

	var businesses []models.Business
	if err := db.Find(&businesses).Error; err != nil {
		return err
	}
	for _, business := range businesses {
		if err := EnsureDynamicSettingKnowledge(db, business); err != nil {
			log.Printf("knowledge sync: failed to sync dynamic settings for business %d: %v", business.ID, err)
		}
	}

	var products []models.Product
	if err := db.Find(&products).Error; err != nil {
		return err
	}
	for _, product := range products {
		if err := SyncProductKnowledge(db, product); err != nil {
			log.Printf("knowledge sync: failed to sync product %d: %v", product.ID, err)
		}
	}

	return nil
}

// DeactivateProductKnowledge sets the system-managed rule for a product to inactive.
func DeactivateProductKnowledge(db *gorm.DB, businessID uint, productID uint) error {
	return db.Model(&models.Rule{}).
		Where("business_id = ? AND source_type = ? AND source_id = ?", businessID, models.SourceTypeProduct, productID).
		Update("is_active", false).Error
}

// EnsureDynamicSettingKnowledge upserts the payment and delivery visibility rules for a business.
func EnsureDynamicSettingKnowledge(db *gorm.DB, business models.Business) error {
	bizID := business.ID

	// 1. Payment visibility rule
	paymentKeywords := "payment,pay,cod,cash on delivery,bank transfer,deposit,account number"
	paymentResponses := `{"en":"{{payment_methods_summary}}"}`
	var paymentRule models.Rule
	err := db.Where("business_id = ? AND source_type = ?", bizID, models.SourceTypePaymentSettings).First(&paymentRule).Error
	if err == nil {
		paymentRule.Keywords = paymentKeywords
		paymentRule.Responses = paymentResponses
		paymentRule.IsActive = true // Always true per instructions
		paymentRule.SystemManaged = true
		paymentRule.KnowledgeType = models.KnowledgeTypeDynamicSetting
		paymentRule.Category = "Payment"
		if err := db.Save(&paymentRule).Error; err != nil {
			return err
		}
	} else if err == gorm.ErrRecordNotFound {
		paymentRule = models.Rule{
			BusinessID:    &bizID,
			Category:      "Payment",
			Keywords:      paymentKeywords,
			Responses:     paymentResponses,
			IsActive:      true, // Always true per instructions
			KnowledgeType: models.KnowledgeTypeDynamicSetting,
			SourceType:    models.SourceTypePaymentSettings,
			SystemManaged: true,
		}
		if err := db.Create(&paymentRule).Error; err != nil {
			return err
		}
	} else {
		return err
	}

	// 2. Delivery visibility rule
	deliveryKeywords := "delivery,shipping,courier,delivery fee,delivery charge,how long delivery"
	deliveryResponses := `{"en":"{{delivery_policy_summary}}\n\n{{operating_hours}}"}`
	var deliveryRule models.Rule
	err = db.Where("business_id = ? AND source_type = ?", bizID, models.SourceTypeDeliverySettings).First(&deliveryRule).Error
	if err == nil {
		deliveryRule.Keywords = deliveryKeywords
		deliveryRule.Responses = deliveryResponses
		deliveryRule.IsActive = true
		deliveryRule.SystemManaged = true
		deliveryRule.KnowledgeType = models.KnowledgeTypeDynamicSetting
		deliveryRule.Category = "Delivery"
		if err := db.Save(&deliveryRule).Error; err != nil {
			return err
		}
	} else if err == gorm.ErrRecordNotFound {
		deliveryRule = models.Rule{
			BusinessID:    &bizID,
			Category:      "Delivery",
			Keywords:      deliveryKeywords,
			Responses:     deliveryResponses,
			IsActive:      true,
			KnowledgeType: models.KnowledgeTypeDynamicSetting,
			SourceType:    models.SourceTypeDeliverySettings,
			SystemManaged: true,
		}
		if err := db.Create(&deliveryRule).Error; err != nil {
			return err
		}
	} else {
		return err
	}

	return nil
}

// GenerateProductKeywords generates a list of keyword phrases for product matching.
func GenerateProductKeywords(product models.Product) string {
	var keywords []string

	// 1. Add full name normalized
	name := strings.TrimSpace(product.Name)
	if name != "" {
		keywords = append(keywords, strings.ToLower(name))
	}

	// 2. Parse and add aliases
	var aliases []string
	if product.Aliases != "" && product.Aliases != "[]" {
		if err := json.Unmarshal([]byte(product.Aliases), &aliases); err == nil {
			for _, alias := range aliases {
				alias = strings.TrimSpace(alias)
				if alias != "" {
					keywords = append(keywords, strings.ToLower(alias))
				}
			}
		}
	}

	// Helper to clean words
	cleanWord := func(w string) string {
		w = strings.ToLower(w)
		w = strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
				return r
			}
			return -1
		}, w)
		return w
	}

	// 3. Extract words from product name
	words := strings.Fields(name)
	var cleanWords []string
	stopWords := map[string]bool{
		"a": true, "an": true, "the": true, "and": true, "or": true, "in": true, "of": true,
		"for": true, "with": true, "at": true, "to": true, "on": true, "by": true, "is": true,
		"are": true, "it": true, "this": true, "that": true,
	}
	for _, w := range words {
		cleaned := cleanWord(w)
		if cleaned != "" && !stopWords[cleaned] {
			cleanWords = append(cleanWords, cleaned)
		}
	}

	// 4. Generate multi-word phrases (2+ consecutive meaningful words)
	for i := 0; i < len(cleanWords)-1; i++ {
		phrase2 := cleanWords[i] + " " + cleanWords[i+1]
		keywords = append(keywords, phrase2)
		if i < len(cleanWords)-2 {
			phrase3 := cleanWords[i] + " " + cleanWords[i+1] + " " + cleanWords[i+2]
			keywords = append(keywords, phrase3)
		}
	}

	// 5. Add combo keywords of category + name words (e.g. clothing+dress)
	category := strings.TrimSpace(strings.ToLower(product.Category))
	if category != "" {
		catCleaned := cleanWord(category)
		if catCleaned != "" {
			for _, cw := range cleanWords {
				keywords = append(keywords, fmt.Sprintf("%s+%s", catCleaned, cw))
			}
		}
	}

	// Deduplicate and normalize
	seen := make(map[string]bool)
	var uniqueKeywords []string
	for _, kw := range keywords {
		kw = strings.TrimSpace(kw)
		if kw != "" && !seen[kw] {
			seen[kw] = true
			uniqueKeywords = append(uniqueKeywords, kw)
		}
	}

	return strings.Join(uniqueKeywords, ",")
}

// AutoResolveGaps resolves all unresolved gaps matching businessID and action.
func AutoResolveGaps(db *gorm.DB, businessID uint, action string) error {
	now := time.Now()
	return db.Model(&models.KnowledgeGap{}).
		Where("business_id = ? AND suggested_action = ? AND resolved = ?", businessID, action, false).
		Updates(map[string]interface{}{
			"resolved":        true,
			"resolved_action": action,
			"resolved_at":     &now,
		}).Error
}

// AutoResolveGapByID resolves a specific knowledge gap by ID.
func AutoResolveGapByID(db *gorm.DB, gapID uint, action string, ruleID *uint) error {
	now := time.Now()
	updates := map[string]interface{}{
		"resolved":        true,
		"resolved_action": action,
		"resolved_at":     &now,
	}
	if ruleID != nil {
		updates["resolved_rule_id"] = *ruleID
	}
	return db.Model(&models.KnowledgeGap{}).
		Where("id = ?", gapID).
		Updates(updates).Error
}
