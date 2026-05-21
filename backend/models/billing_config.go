package models

import "time"

// PlatformBillingSettings stores platform-wide billing instructions.
// Keep this typed: these fields are revenue-impacting and should not be
// updated through a generic settings blob.
type PlatformBillingSettings struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	BankName        string    `json:"bank_name" gorm:"size:120"`
	BankBranch      string    `json:"bank_branch" gorm:"size:120"`
	BankAccountNo   string    `json:"bank_account_no" gorm:"size:80"`
	BankAccountName string    `json:"bank_account_name" gorm:"size:160"`
	SupportPhone    string    `json:"support_phone" gorm:"size:40"`
	TrialDays       int       `json:"trial_days" gorm:"default:14"`
	TrialPlanKey    string    `json:"trial_plan_key" gorm:"size:20;default:'trial'"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (PlatformBillingSettings) TableName() string {
	return "platform_billing_settings"
}

// SubscriptionPlan is the platform plan catalog. It drives displayed pricing
// and default entitlements for plan-based enforcement.
type SubscriptionPlan struct {
	Key         string `json:"key" gorm:"primaryKey;size:20"`
	DisplayName string `json:"display_name" gorm:"size:80;not null"`
	Badge       string `json:"badge" gorm:"size:80"`
	Description string `json:"description" gorm:"type:text"`
	Currency    string `json:"currency" gorm:"size:8;default:'LKR'"`

	MonthlyPrice float64 `json:"monthly_price" gorm:"not null;default:0"`
	AnnualPrice  float64 `json:"annual_price" gorm:"not null;default:0"`
	IsActive     bool    `json:"is_active" gorm:"default:true"`
	IsPublic     bool    `json:"is_public" gorm:"default:true"`
	SortOrder    int     `json:"sort_order" gorm:"default:0"`

	MaxProducts       int   `json:"max_products" gorm:"default:0"`        // -1 = unlimited
	MaxRules          int   `json:"max_rules" gorm:"default:0"`           // -1 = unlimited
	MaxAIMessages     int   `json:"max_ai_messages" gorm:"default:0"`     // -1 = unlimited
	MaxSystemMessages int   `json:"max_system_messages" gorm:"default:0"` // -1 = unlimited
	MaxRuleGens       int   `json:"max_rule_gens" gorm:"default:0"`       // -1 = unlimited
	MaxSimulations    int   `json:"max_simulations" gorm:"default:0"`     // -1 = unlimited
	MaxStorageBytes   int64 `json:"max_storage_bytes" gorm:"default:0"`   // -1 = unlimited
	MaxFileSizeBytes  int64 `json:"max_file_size_bytes" gorm:"default:0"`

	CanUploadCloudinary   bool `json:"can_upload_cloudinary" gorm:"default:false"`
	CanSendWhatsAppImages bool `json:"can_send_whatsapp_images" gorm:"default:false"`
	CanUseGeminiVision    bool `json:"can_use_gemini_vision" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (SubscriptionPlan) TableName() string {
	return "subscription_plans"
}

// BillingPaymentAttempt freezes checkout details at initiation time so PayHere
// callbacks do not depend on whatever the current catalog price is later.
type BillingPaymentAttempt struct {
	OrderID      string    `json:"order_id" gorm:"primaryKey;size:80"`
	BusinessID   uint      `json:"business_id" gorm:"not null;index"`
	Plan         string    `json:"plan" gorm:"size:20;not null"`
	BillingCycle string    `json:"billing_cycle" gorm:"size:20;not null"`
	Amount       float64   `json:"amount" gorm:"not null"`
	Currency     string    `json:"currency" gorm:"size:8;default:'LKR'"`
	Status       string    `json:"status" gorm:"size:20;default:'pending'"`
	PaymentID    string    `json:"payment_id" gorm:"size:120"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (BillingPaymentAttempt) TableName() string {
	return "billing_payment_attempts"
}
