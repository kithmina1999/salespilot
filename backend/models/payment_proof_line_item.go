package models

import "time"

const (
	ItemTypeSubscription = "subscription"
	ItemTypeAddon        = "addon"
)

type PaymentProofLineItem struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	PaymentProofID uint      `json:"payment_proof_id" gorm:"not null;index"`
	ItemType       string    `json:"item_type" gorm:"not null"` // subscription | addon
	Key            string    `json:"key" gorm:"not null"`       // plan key or addon key
	Name           string    `json:"name" gorm:"not null"`
	Description    string    `json:"description" gorm:"type:text"`
	BillingType    string    `json:"billing_type"` // one_time | monthly | annual (copied for history)
	Quantity       int       `json:"quantity" gorm:"not null;default:1"`
	UnitPrice      float64   `json:"unit_price" gorm:"not null"`
	Total          float64   `json:"total" gorm:"not null"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
