package models

import "time"

const (
	PaymentStatusPending           = "pending"
	PaymentStatusApproved          = "approved"
	PaymentStatusRejected          = "rejected"
	PaymentStatusNeedsResubmission = "needs_resubmission"
)

// PaymentProof tracks bank-transfer payment submissions from tenants.
// Lifecycle: pending → approved | rejected
type PaymentProof struct {
	ID             uint       `json:"id"             gorm:"primaryKey"`
	BusinessID     uint       `json:"business_id"    gorm:"not null;index"`
	BusinessName   string     `json:"business_name"`                           // denormalized for admin list
	BusinessPhone  string     `json:"business_phone"`                          // for WhatsApp fallback
	BusinessEmail  string     `json:"business_email"`                          // for Resend code delivery
	CheckoutType   string     `json:"checkout_type"  gorm:"default:'subscription'"`    // subscription | addon_only | mixed
	BillingCycle   string     `json:"billing_cycle"`                           // monthly | quarterly | annual (empty if addon_only)
	Plan           string     `json:"plan"`                                    // starter | pro (empty if addon_only)
	Amount         float64    `json:"amount"         gorm:"not null"`          // expected LKR amount shown to user (TotalAmount)
	PlanAmount     float64    `json:"plan_amount"`
	MonthlyAddonTotal float64 `json:"monthly_addon_total"`
	OneTimeTotal   float64    `json:"one_time_total"`
	TotalAmount    float64    `json:"total_amount"`
	ScreenshotURL  string     `json:"screenshot_url" gorm:"not null"`          // Cloudinary URL or local path
	Status         string     `json:"status"         gorm:"default:'pending'"` // pending | approved | rejected | needs_resubmission

	// Tenant declarations
	DeclaredAmount   float64    `json:"declared_amount"`
	PaidAt           *time.Time `json:"paid_at"`
	PaymentReference string     `json:"payment_reference"`

	// AI Pre-Check Data
	ScanStatus          string     `json:"scan_status"` // success | needs_resubmission | failed
	ScanExtractedAmount float64    `json:"scan_extracted_amount"`
	ScanExtractedDate   *time.Time `json:"scan_extracted_date"`
	ScanExtractedRef    string     `json:"scan_extracted_ref"`
	ScanExtractedBank   string     `json:"scan_extracted_bank"`
	ScanExtractedPayer  string     `json:"scan_extracted_payer"`
	ScanConfidence      float64    `json:"scan_confidence"`
	ScanReason          string     `json:"scan_reason"`
	MismatchFlags       string     `json:"mismatch_flags"`
	RawScanSummary      string     `json:"raw_scan_summary"`
	ActivationCode string     `json:"activation_code"`                         // filled on approval
	AdminNote      string     `json:"admin_note"`                              // rejection reason or admin comment
	LineItems      []PaymentProofLineItem `json:"line_items"`
	ReviewedAt     *time.Time `json:"reviewed_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
