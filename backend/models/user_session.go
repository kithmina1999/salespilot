package models

import "time"

// UserSession records every login attempt and tracks active sessions.
// Successful logins produce a SessionToken embedded in the JWT; the auth
// middleware validates the session is still active (not revoked) on every
// request. Failed logins are recorded with LoginStatus="failed" for the
// login history view.
type UserSession struct {
	ID         uint `gorm:"primaryKey" json:"id"`
	UserID     uint `gorm:"index;not null" json:"user_id"`
	BusinessID uint `gorm:"index;not null" json:"business_id"`

	// Token tracking
	SessionToken string     `gorm:"uniqueIndex;not null" json:"-"` // UUID — never exposed to frontend
	ExpiresAt    time.Time  `gorm:"not null" json:"expires_at"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"` // nil = active

	// Device metadata (captured at login)
	IPAddress  string `gorm:"not null" json:"ip_address"`
	UserAgent  string `json:"-"`           // raw UA — internal only
	DeviceType string `json:"device_type"` // desktop | mobile | tablet | unknown
	Browser    string `json:"browser"`     // Chrome | Safari | Firefox etc.
	OS         string `json:"os"`          // Windows | macOS | iOS | Android etc.

	// Login outcome
	LoginStatus string `gorm:"default:'success'" json:"login_status"` // success | failed
	FailReason  string `json:"fail_reason,omitempty"`                 // bad_password | unverified_email | disabled

	LastActiveAt time.Time `json:"last_active_at"`
	CreatedAt    time.Time `json:"created_at"` // = login timestamp
}
