package models

import (
	"encoding/json"
	"strings"

	"gorm.io/gorm"
)

// Rule defines automated FAQ responses for a specific tenant.
// (Global rules are deprecated; use RuleTemplate instead).
type Rule struct {
	gorm.Model
	BusinessID *uint  `json:"business_id" gorm:"index"`
	Category   string `json:"category" gorm:"index"`     // e.g., "Shipping", "General"
	Keywords   string `json:"keywords" gorm:"type:text"` // comma-separated keywords

	// New: extensible per-language response map, e.g. {"en": "...", "si": "...", "ta": "..."}
	Responses string `json:"responses" gorm:"type:text;default:'{}'"`

	// Deprecated (kept for migration window — will be dropped in v2.1)
	Response        string `json:"response,omitempty"`
	SinhalaResponse string `json:"sinhala_response,omitempty" gorm:"type:text"`

	IsActive   bool `json:"is_active" gorm:"default:true"`
	UsageCount uint `json:"usage_count" gorm:"default:0"`

	// Action Tier (critical, intent, casual) defines allowed actions
	ActionTier string `json:"action_tier" gorm:"default:'intent'"`

	// Tier 1: Hard silent drop — no reply sent, no token consumed, no log created
	// Must be combined with ActionTier == "critical" to actually drop
	IsDropRule bool `json:"is_drop_rule" gorm:"default:false"`
	// Tier 2: Context bridge — check last bot message; re-prompt if it was a question, else silent drop
	IsContextBridge bool   `json:"is_context_bridge" gorm:"default:false"`
	Embedding       []byte `json:"-" gorm:"type:bytea"` // JSON-encoded float64 vector, not exposed in API

	// Knowledge Base typed fields
	KnowledgeType string `json:"knowledge_type" gorm:"default:'static_faq';index"`
	SourceType    string `json:"source_type" gorm:"index"`
	SourceID      *uint  `json:"source_id" gorm:"index"`
	SystemManaged bool   `json:"system_managed" gorm:"default:false;index"`
}

// Knowledge Types (system_managed is NOT a knowledge type — it's a boolean flag)
const (
	KnowledgeTypeStaticFAQ      = "static_faq"
	KnowledgeTypeDynamicSetting = "dynamic_setting"
	KnowledgeTypeProductCatalog = "product_catalog"
	KnowledgeTypeOrderFlow      = "order_flow"
)

// Source Types
const (
	SourceTypeManual           = "manual"
	SourceTypeProduct          = "product"
	SourceTypePaymentSettings  = "payment_settings"
	SourceTypeDeliverySettings = "delivery_settings"
)

const (
	TierCritical = "critical" // abuse, spam, blacklist
	TierIntent   = "intent"   // pricing, order, support
	TierCasual   = "casual"   // greetings, jokes, hehe
)

// GetResponse returns the best available response text for the given ISO 639-1 language code.
// Priority: exact lang match → "en" fallback → first non-empty value → legacy Response field.
func (r *Rule) GetResponse(langCode string) string {
	if r.Responses != "" && r.Responses != "{}" {
		var m map[string]string
		if err := json.Unmarshal([]byte(r.Responses), &m); err == nil {
			// 1. Exact match
			if v, ok := m[strings.TrimSpace(langCode)]; ok && v != "" {
				return v
			}
			// 2. English fallback
			if v, ok := m["en"]; ok && v != "" {
				return v
			}
			// 3. First non-empty
			for _, v := range m {
				if v != "" {
					return v
				}
			}
		}
	}
	// 4. Legacy fallback (migration window)
	if langCode == "si" && r.SinhalaResponse != "" {
		return r.SinhalaResponse
	}
	return r.Response
}

// GetExactResponse returns only the response explicitly configured for langCode.
// Unlike GetResponse, this deliberately does not fall back to English.
func (r *Rule) GetExactResponse(langCode string) string {
	langCode = strings.TrimSpace(langCode)
	if langCode == "" {
		return ""
	}
	if r.Responses != "" && r.Responses != "{}" {
		var m map[string]string
		if err := json.Unmarshal([]byte(r.Responses), &m); err == nil {
			if v, ok := m[langCode]; ok {
				return v
			}
		}
	}
	if langCode == "en" {
		return r.Response
	}
	if langCode == "si" {
		return r.SinhalaResponse
	}
	return ""
}

// SetResponse updates the Responses JSON map for a given language code.
func (r *Rule) SetResponse(langCode, text string) {
	var m map[string]string
	if r.Responses != "" {
		json.Unmarshal([]byte(r.Responses), &m) //nolint:errcheck
	}
	if m == nil {
		m = map[string]string{}
	}
	m[langCode] = text
	b, _ := json.Marshal(m)
	r.Responses = string(b)
}

// RuleTemplate defines seed FAQ rules that businesses can clone into their own accounts.
type RuleTemplate struct {
	gorm.Model
	Category        string `json:"category" gorm:"index"`
	Keywords        string `json:"keywords" gorm:"type:text"`
	Responses       string `json:"responses" gorm:"type:text;default:'{}'"`
	IsDropRule      bool   `json:"is_drop_rule" gorm:"default:false"`
	IsContextBridge bool   `json:"is_context_bridge" gorm:"default:false"`
	Embedding       []byte `json:"-" gorm:"type:bytea"`
}
