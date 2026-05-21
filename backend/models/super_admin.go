package models

import (
	"time"
)

// Roles
const (
	SuperRoleOwner   = "owner"
	SuperRoleSupport = "support"
)

// Session constants
const (
	AdminSessionExpiresIn = 4 * time.Hour
	AdminIdleTimeout      = 45 * time.Minute
	AdminTokenPrefix      = "sat_"
)

// SuperAdminUser represents a top-level administrator for the platform.
type SuperAdminUser struct {
	ID           uint       `json:"id" gorm:"primaryKey"`
	Name         string     `json:"name" gorm:"not null"`
	Email        string     `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash string     `json:"-" gorm:"not null"`
	Role         string     `json:"role" gorm:"default:'owner'"` // owner | support
	IsActive     bool       `json:"is_active" gorm:"default:true"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// SuperAdminSession represents an active session token for a super admin.
type SuperAdminSession struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	AdminID    uint           `json:"admin_id" gorm:"index;not null"`
	Admin      SuperAdminUser `json:"-" gorm:"foreignKey:AdminID"`
	TokenHash  string         `json:"-" gorm:"uniqueIndex;not null"` // SHA-256 of raw token
	IPAddress  string         `json:"ip_address"`
	UserAgent  string         `json:"user_agent"`
	ExpiresAt  time.Time      `json:"expires_at"`
	LastUsedAt time.Time      `json:"last_used_at"`
	RevokedAt  *time.Time     `json:"revoked_at"`
	CreatedAt  time.Time      `json:"created_at"`
}
