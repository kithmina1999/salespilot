package models

import "time"

const (
	BillingTypeOneTime = "one_time"
	BillingTypeMonthly = "monthly"

	PurchasePolicyOncePerBusiness   = "once_per_business"
	PurchasePolicyOncePerConnection = "once_per_connection"
	PurchasePolicyRepeatable        = "repeatable"

	AddonSourceSystem = "system"
	AddonSourceCustom = "custom"

	AddonVisibilityPublic    = "public"
	AddonVisibilityAdminOnly = "admin_only"

	AddonWAStatusAny          = "any"
	AddonWAStatusConnected    = "connected"
	AddonWAStatusNotConnected = "not_connected"

	AddonCheckoutSubOrStandalone = "subscription_or_standalone"
	AddonCheckoutSubOnly         = "subscription_only"
	AddonCheckoutStandaloneOnly  = "standalone_only"
)

type BillingAddon struct {
	Key                  string    `json:"key" gorm:"primaryKey"`
	Name                 string    `json:"name" gorm:"not null"`
	Description          string    `json:"description" gorm:"type:text"`
	Amount               float64   `json:"amount" gorm:"not null"`
	BillingType          string    `json:"billing_type" gorm:"not null"`    // one_time | monthly
	PurchasePolicy       string    `json:"purchase_policy" gorm:"not null"` // once_per_business | once_per_connection | repeatable
	Source               string    `json:"source" gorm:"not null;default:'system'"`
	Badge                string    `json:"badge"`
	Visibility           string    `json:"visibility" gorm:"not null;default:'public'"`
	RequiresWAStatus     string    `json:"requires_wa_status" gorm:"not null;default:'any'"`
	CheckoutAvailability string    `json:"checkout_availability" gorm:"not null;default:'subscription_or_standalone'"`
	IncludesText         string    `json:"includes_text" gorm:"type:text"`
	NotIncludedText      string    `json:"not_included_text" gorm:"type:text"`
	IsActive             bool      `json:"is_active" gorm:"default:true"`
	SortOrder            int       `json:"sort_order" gorm:"default:0"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}
