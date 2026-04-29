package models

import (
	"time"
)

// EmailVerificationToken is used during the signup flow to verify a user's email address
type EmailVerificationToken struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	Email     string     `json:"email" gorm:"index;not null"`
	OTP       string     `json:"otp" gorm:"not null"` // 6-digit code sent via Resend API
	ExpiresAt time.Time  `json:"expires_at"`          // Typically valid for 15 minutes
	UsedAt    *time.Time `json:"used_at"`             // Set when successfully verified
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
