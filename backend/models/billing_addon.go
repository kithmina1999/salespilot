package models

import "time"

const (
	BillingTypeOneTime = "one_time"
	BillingTypeMonthly = "monthly"

	PurchasePolicyOncePerBusiness   = "once_per_business"
	PurchasePolicyOncePerConnection = "once_per_connection"
	PurchasePolicyRepeatable        = "repeatable"
)

type BillingAddon struct {
	Key            string    `json:"key" gorm:"primaryKey"`
	Name           string    `json:"name" gorm:"not null"`
	Description    string    `json:"description" gorm:"type:text"`
	Amount         float64   `json:"amount" gorm:"not null"`
	BillingType    string    `json:"billing_type" gorm:"not null"`     // one_time | monthly
	PurchasePolicy string    `json:"purchase_policy" gorm:"not null"`  // once_per_business | once_per_connection | repeatable
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	SortOrder      int       `json:"sort_order" gorm:"default:0"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
