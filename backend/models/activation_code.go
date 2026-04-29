package models

import (
	"time"
)

type ActivationCode struct {
	ID           uint       `json:"id" gorm:"primaryKey"`
	Code         string     `json:"code" gorm:"uniqueIndex;not null"` // e.g., "BSS-PRO-X7K2"
	Plan         string     `json:"plan" gorm:"not null"`             // starter | pro | free
	BillingCycle string     `json:"billing_cycle" gorm:"not null"`    // monthly | quarterly | annual
	DurationDays int        `json:"duration_days" gorm:"not null"`    // 30 | 90 | 365
	Note         string     `json:"note"`                             // Admin note (e.g., "Paid via bank — +94771234567")
	TargetPhone  string     `json:"target_phone"`                     // Lock to specific tenant phone (empty = any tenant)
	IsUsed       bool       `json:"is_used" gorm:"default:false"`
	UsedByID     *uint      `json:"used_by_id"`                       // Business ID that redeemed it
	UsedByName   *string    `json:"used_by_name"`                     // Business name (denormalized for easy listing)
	UsedAt       *time.Time `json:"used_at"`
	ExpiresAt    *time.Time `json:"expires_at"`                       // Optional code expiry (nil = no expiry)
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
