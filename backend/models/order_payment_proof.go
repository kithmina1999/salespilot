package models

import "time"

// OrderPaymentProof tracks bank-transfer payment submissions from customers for their orders.
// Lifecycle: pending → approved | rejected (by the tenant merchant)
type OrderPaymentProof struct {
	ID            uint       `json:"id"             gorm:"primaryKey"`
	BusinessID    uint       `json:"business_id"    gorm:"not null;index"`
	OrderID       uint       `json:"order_id"       gorm:"not null;index"` // Relates to the customer's Order
	CustomerPhone string     `json:"customer_phone" gorm:"not null"`       // For sending approval/rejection notifications
	Amount        float64    `json:"amount"         gorm:"not null"`       // The order total at time of upload
	ScreenshotURL string     `json:"screenshot_url"`                       // Cloudinary URL if uploaded, or empty if just Gemini text
	Description   string     `json:"description"    gorm:"type:text"`      // The text description from Gemini Vision
	Status        string     `json:"status"         gorm:"default:'pending'"` // pending | approved | rejected
	MerchantNote  string     `json:"merchant_note"`                           // Optional rejection reason
	ReviewedAt    *time.Time `json:"reviewed_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
