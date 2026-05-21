package models

import (
	"time"
)

// PasswordResetToken stores a one-time WhatsApp OTP and the short-lived reset token
// that is issued after the OTP is verified. Two-phase flow:
//
//	Phase 1: OTPCode is set, ResetToken is empty  — user receives OTP via WhatsApp
//	Phase 2: ResetToken is set, OTPCode cleared   — user submits OTP, gets reset token
//	Phase 3: ResetToken is consumed                — user sets new password, record is deleted
type PasswordResetToken struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	Phone      string     `gorm:"index;not null" json:"phone"`
	OTPCode    string     `gorm:"not null" json:"-"` // 6-digit code sent via WhatsApp
	ResetToken string     `gorm:"index" json:"-"`    // UUID issued after OTP verified
	ExpiresAt  time.Time  `gorm:"not null" json:"expires_at"`
	UsedAt     *time.Time `json:"used_at"`
	Attempts   int        `gorm:"default:0" json:"-"` // brute-force guard
	CreatedAt  time.Time  `json:"created_at"`
}
