package models

import "time"

// PasswordChangeToken is used for the authenticated in-dashboard password change flow.
// A 6-digit OTP is sent to the user's registered email. On verification, a short-lived
// change_token is issued. The change_token is then exchanged for the actual password update.
//
// This is intentionally separate from PasswordResetToken (the public forgot-password flow)
// so the two flows never interfere. PasswordResetToken can later be migrated to use email
// as well once businesses are verified.
type PasswordChangeToken struct {
	ID          uint       `gorm:"primaryKey"`
	UserID      uint       `gorm:"index;not null"` // links to users.id (the authenticated user)
	Email       string     `gorm:"index;not null"` // email the OTP was sent to
	OTPCode     string     `gorm:"not null"`       // 6-digit code; cleared after verification
	ChangeToken string     `gorm:"index"`          // short-lived UUID issued after OTP is verified
	Attempts    int        `gorm:"default:0"`      // brute-force guard
	ExpiresAt   time.Time  `gorm:"not null"`
	UsedAt      *time.Time // nil = not yet used; set when OTP is verified
	CreatedAt   time.Time
}
