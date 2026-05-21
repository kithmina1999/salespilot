package models

import "time"

const (
	ServiceStatusPaid      = "paid"
	ServiceStatusFulfilled = "fulfilled"
	ServiceStatusCancelled = "cancelled"
)

type BillingServicePurchase struct {
	ID                 uint       `json:"id" gorm:"primaryKey"`
	BusinessID         uint       `json:"business_id" gorm:"not null;index"`
	AddonKey           string     `json:"addon_key" gorm:"not null;index"`
	PaymentProofID     uint       `json:"payment_proof_id" gorm:"not null;index"`
	Status             string     `json:"status" gorm:"not null;default:'paid'"` // paid | fulfilled | cancelled
	ServiceInstanceKey string     `json:"service_instance_key"` // optional identifier if multiple instances
	PurchasedAt        time.Time  `json:"purchased_at"`
	FulfilledAt        *time.Time `json:"fulfilled_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}
