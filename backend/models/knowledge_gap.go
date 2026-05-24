package models

import (
	"crypto/sha1"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Constants for Knowledge Base types, sources, and suggested actions.
const (
	// Suggested actions
	ActionCreateStaticFAQ        = "create_static_faq"
	ActionUpdatePaymentSettings  = "update_payment_settings"
	ActionUpdateDeliverySettings = "update_delivery_settings"
	ActionUpdateProductCatalog   = "update_product_catalog"
	ActionReviewOrderFlow        = "review_order_flow"
	ActionNotNeeded              = "not_needed"
)

// KnowledgeGap represents an unmatched message cluster that highlights a missing piece of knowledge.
type KnowledgeGap struct {
	gorm.Model
	BusinessID             uint       `json:"business_id" gorm:"not null;uniqueIndex:idx_open_gap_cluster,where:resolved = false"`
	RawMessage             string     `json:"raw_message" gorm:"type:text"`
	NormalizedMessage      string     `json:"normalized_message" gorm:"type:text"`
	DetectedLanguage       string     `json:"detected_language"`
	RouterIntent           string     `json:"router_intent" gorm:"index"`
	RouterRoute            string     `json:"router_route" gorm:"index"`
	CartState              string     `json:"cart_state"`
	SelectedProductID      *uint      `json:"selected_product_id" gorm:"index"`
	AIReplyText            string     `json:"ai_reply_text" gorm:"type:text"`
	SuggestedKnowledgeType string     `json:"suggested_knowledge_type" gorm:"index"`
	SuggestedAction        string     `json:"suggested_action" gorm:"index"`
	ClusterKey             string     `json:"cluster_key" gorm:"size:160;uniqueIndex:idx_open_gap_cluster,where:resolved = false"`
	HitCount               int        `json:"hit_count" gorm:"default:1"`
	LastSeenAt             time.Time  `json:"last_seen_at"`
	Resolved               bool       `json:"resolved" gorm:"default:false;index"`
	ResolvedAction         string     `json:"resolved_action"`
	ResolvedRuleID         *uint      `json:"resolved_rule_id"`
	ResolvedAt             *time.Time `json:"resolved_at"`
	ResolvedMeta           string     `json:"resolved_meta" gorm:"type:text;default:'{}'"`
}

// BuildClusterKey generates a hashed cluster key to uniquely represent a knowledge gap.
func BuildClusterKey(routerIntent string, normalizedMsg string, productID *uint) string {
	intent := strings.TrimSpace(strings.ToLower(routerIntent))
	if intent == "" {
		intent = "unknown"
	}

	if productID != nil && *productID > 0 {
		return fmt.Sprintf("product:%d:intent:%s", *productID, intent)
	}

	normalized := strings.TrimSpace(strings.ToLower(normalizedMsg))
	h := sha1.New()
	h.Write([]byte(normalized))
	hashStr := fmt.Sprintf("%x", h.Sum(nil))
	if len(hashStr) > 12 {
		hashStr = hashStr[:12]
	}

	return fmt.Sprintf("intent:%s:hash:%s", intent, hashStr)
}

// MapIntentToSuggestion maps an intent to its suggested knowledge type and action.
func MapIntentToSuggestion(routerIntent string) (string, string) {
	intent := strings.TrimSpace(strings.ToLower(routerIntent))
	switch intent {
	case "payment_question":
		return KnowledgeTypeDynamicSetting, ActionUpdatePaymentSettings
	case "delivery_question", "order_timing_or_availability":
		return KnowledgeTypeDynamicSetting, ActionUpdateDeliverySettings
	case "product_detail", "product_search", "browse_catalog":
		return KnowledgeTypeProductCatalog, ActionUpdateProductCatalog
	case "add_to_cart", "cart_continue", "cart_escape", "order_status":
		return KnowledgeTypeOrderFlow, ActionReviewOrderFlow
	case "support_or_complaint", "general_faq", "unknown":
		return KnowledgeTypeStaticFAQ, ActionCreateStaticFAQ
	default:
		return KnowledgeTypeStaticFAQ, ActionCreateStaticFAQ
	}
}

// UpsertKnowledgeGap inserts or updates an existing unresolved knowledge gap cluster.
func UpsertKnowledgeGap(db *gorm.DB, gap *KnowledgeGap) error {
	var existing KnowledgeGap
	err := db.Where("business_id = ? AND cluster_key = ? AND resolved = ?", gap.BusinessID, gap.ClusterKey, false).First(&existing).Error
	if err == nil {
		// Existing open gap found, update hits and latest data
		existing.HitCount++
		existing.LastSeenAt = time.Now()
		existing.RawMessage = gap.RawMessage
		existing.NormalizedMessage = gap.NormalizedMessage
		existing.DetectedLanguage = gap.DetectedLanguage
		existing.RouterIntent = gap.RouterIntent
		existing.RouterRoute = gap.RouterRoute
		existing.CartState = gap.CartState
		existing.SelectedProductID = gap.SelectedProductID
		if gap.AIReplyText != "" {
			existing.AIReplyText = gap.AIReplyText
		}
		if err := db.Save(&existing).Error; err != nil {
			return err
		}
		*gap = existing
		return nil
	}

	// Create new open gap
	gap.HitCount = 1
	gap.LastSeenAt = time.Now()
	gap.Resolved = false
	return db.Create(gap).Error
}
