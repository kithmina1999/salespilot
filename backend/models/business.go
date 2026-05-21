package models

import (
	"time"

	"gorm.io/gorm"
)

// IsInActiveTrial returns true if the business has an active (not yet expired) trial.
func (b *Business) IsInActiveTrial() bool {
	return b.TrialExpiresAt != nil && b.TrialExpiresAt.After(time.Now())
}

// Billing Plans
const (
	PlanFree    = "free"
	PlanStarter = "starter" // Rs. 1,490/month
	PlanPro     = "pro"     // Rs. 3,490/month
	PlanTrial   = "trial"   // internal entitlement profile for active trials
)

// Plan Limits
const (
	FreeMsgLimit        = 500  // inbound messages/month
	FreeRuleLimit       = 10   // active FAQ rules
	FreeAILimit         = 0    // AI replies (trial handled separately)
	FreeRuleGenLimit    = 3    // AI rule generations
	FreeProductLimit    = 10   // products in catalog
	StarterRuleLimit    = 50   // active FAQ rules
	StarterAILimit      = 1500 // AI replies/month
	StarterRuleGenLimit = 30   // AI rule generations/month
	// inbound: unlimited (-1), products: unlimited (-1)
	ProRuleLimit    = -1   // unlimited
	ProAILimit      = 5000 // AI replies/month
	ProRuleGenLimit = 100  // AI rule generations/month
	// inbound: unlimited (-1), products: unlimited (-1)
)

// Trial
const (
	TrialDurationDays    = 14  // 14-day full-feature trial
	TrialAILimit         = 150 // AI replies allowed during trial period
	TrialMsgLimit        = 500 // Inbound messages allowed during trial
	TrialRuleLimit       = 50  // FAQ rules allowed during trial
	TrialSimulationLimit = 100
)

// Simulation Limits
const (
	FreeSimulationLimit    = 50
	StarterSimulationLimit = 250
	ProSimulationLimit     = -1 // unlimited fair use
)

// Sandbox Hourly Rate Limits
const (
	SandboxHourlyLimitFree    = 20
	SandboxHourlyLimitTrial   = 30
	SandboxHourlyLimitStarter = 60
	SandboxHourlyLimitPro     = 100
)

// Billing Cycles
const (
	BillingMonthly   = "monthly"   // 30 days
	BillingQuarterly = "quarterly" // 90 days
	BillingAnnual    = "annual"    // 365 days
)

// Suspension Types
const (
	SuspensionBilling = "billing"
	SuspensionAbuse   = "abuse"
	SuspensionPolicy  = "policy"
	SuspensionManual  = "manual"
)

type Business struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	Name            string     `json:"name" gorm:"not null"`
	Phone           string     `json:"phone" gorm:"uniqueIndex"`
	APIKey          string     `json:"api_key" gorm:"uniqueIndex;not null"`
	WAPhoneNumberID string     `json:"wa_phone_number_id" gorm:"uniqueIndex:idx_wa_phone_unique,where:wa_phone_number_id != ''"` // set when tenant connects Meta account
	WABAID          string     `json:"waba_id"`                                                                                  // set when tenant connects Meta account
	WAAccessToken   string     `json:"wa_access_token"`                                                                          // set when tenant connects Meta account
	BotName         string     `json:"bot_name" gorm:"default:'AI Assistant'"`
	BotPersonality  string     `json:"bot_personality"`
	OperatingHours  string     `json:"operating_hours"`
	DeliveryPolicy  string     `json:"delivery_policy"`
	ConnectedAt     *time.Time `json:"connected_at"`
	WAStatus        string     `json:"wa_status" gorm:"default:'not_connected'"` // "connected" | "disconnected" | "not_connected"
	MetaCatalogID   string     `json:"meta_catalog_id" gorm:"default:''"`        // Meta Commerce Manager Catalog ID for native WA shopping

	// Suspension
	SuspendedAt     *time.Time `json:"suspended_at"`
	SuspendedReason string     `json:"suspended_reason" gorm:"type:text"`
	SuspendedBy     *uint      `json:"suspended_by"`
	SuspensionType  string     `json:"suspension_type"` // billing | abuse | policy | manual

	// Debug mode for pipeline logging
	DebugMode      bool       `json:"debug_mode" gorm:"default:false"`
	DebugModeUntil *time.Time `json:"debug_mode_until"`

	// Billing
	Plan           string     `json:"plan" gorm:"default:'free'"`
	BillingCycle   string     `json:"billing_cycle"`    // monthly | quarterly | annual
	PlanExpiresAt  *time.Time `json:"plan_expires_at"`  // nil = free (no expiry)
	PayHereOrderID string     `json:"payhere_order_id"` // last successful PayHere order_id
	TrialExpiresAt *time.Time `json:"trial_expires_at"`

	// Usage Counters (reset monthly)
	CurrentUsageMonth   string `json:"current_usage_month"`
	AIMessageCount      int    `json:"ai_message_count" gorm:"default:0"`
	AIMessageLimit      int    `json:"ai_message_limit" gorm:"default:0"`
	SystemMessageCount  int    `json:"system_message_count" gorm:"default:0"`
	SystemMessageLimit  int    `json:"system_message_limit" gorm:"default:500"`
	FaqReplyCount       int    `json:"faq_reply_count" gorm:"default:0"`
	TotalStorageUsed    int64  `json:"total_storage_used" gorm:"default:0"`
	RuleGenerationCount int    `json:"rule_generation_count" gorm:"default:0"`
	RuleGenerationLimit int    `json:"rule_generation_limit" gorm:"default:100"` // 100 standard, 150 for first-activation bonus users
	SimulationCount     int    `json:"simulation_count" gorm:"default:0"`
	SimulationLimit     int    `json:"simulation_limit" gorm:"default:50"`

	// Onboarding status
	OnboardingComplete bool `json:"onboarding_complete" gorm:"default:false"`

	// Language Settings (independent per concern)
	// BotReplyLanguage: fallback lang when customer language can't be detected (ISO 639-1)
	BotReplyLanguage string `json:"bot_reply_language" gorm:"default:'en'"`
	// BotSupportedLangs: comma-separated ISO codes the bot has responses for
	// e.g. "en,si" means the bot replies in English and Sinhala
	BotSupportedLangs string `json:"bot_supported_langs" gorm:"default:'en,si'"`

	// Deprecated: kept for migration window, migrated to BotReplyLanguage on first save
	ResponseLanguage string `json:"response_language,omitempty" gorm:"default:'sinhala_first'"`

	// ── Payment Configuration ─────────────────────────────────────────────────
	// AllowCOD: enables Cash on Delivery as a checkout option (default: true)
	AllowCOD bool `json:"allow_cod" gorm:"default:true"`
	// AllowTransfer: enables Bank Transfer as a checkout option (default: false, merchant opt-in)
	AllowTransfer bool `json:"allow_transfer" gorm:"default:false"`
	// BankDetails: free-form text the merchant provides so the bot can show it to customers
	// e.g. "Bank: Sampath Bank\nAccount No: 123456\nName: Acme Shop Pvt Ltd"
	BankDetails string `json:"bank_details" gorm:"type:text"`

	// Monthly Intelligence Report
	MonthlyReportEnabled bool   `json:"monthly_report_enabled" gorm:"default:true"`
	ReportPhone          string `json:"report_phone"` // WhatsApp number to deliver reports; falls back to Phone if empty

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AfterFind intercepts whenever a business is retrieved from the database and ensures its usage quotas are accurate.
// It performs a "lazy reset": comparing the business's current_usage_month against the real-world calendar month.
// If it has rolled over, it automatically zeroes out the counters and saves the new state.
func (b *Business) AfterFind(tx *gorm.DB) (err error) {
	currentMonth := time.Now().Format("2006-01") // Extracted as "YYYY-MM" (e.g., "2026-03")

	if b.CurrentUsageMonth == "" {
		// First time migration: set current month without resetting counters.
		b.CurrentUsageMonth = currentMonth
		// Fire async — don't block the login/auth response
		businessID := b.ID
		go tx.Model(&Business{}).Where("id = ?", businessID).UpdateColumn("current_usage_month", currentMonth)
		return
	}

	if b.CurrentUsageMonth != currentMonth {
		// New month! Zero out the counters.
		b.CurrentUsageMonth = currentMonth
		b.AIMessageCount = 0
		b.SystemMessageCount = 0
		b.FaqReplyCount = 0
		b.RuleGenerationCount = 0
		b.SimulationCount = 0

		// Fire async — don't block the caller
		businessID := b.ID
		go tx.Model(&Business{}).Where("id = ?", businessID).Select(
			"current_usage_month",
			"ai_message_count",
			"system_message_count",
			"faq_reply_count",
			"rule_generation_count",
			"simulation_count",
		).Updates(*b)
	}

	return
}
