package models

import (
	"time"

	"gorm.io/gorm"
)

// Valid roles for tenant users
const (
	RoleAdmin  = "admin"
	RoleStaff  = "staff"
	RoleViewer = "viewer"
)

// User represents a Dashboard user for a specific Business Tenant.
// A business can have multiple users with different roles (admin/staff/viewer).
type User struct {
	gorm.Model
	BusinessID        uint       `json:"business_id" gorm:"index;not null"`
	Email             string     `json:"email" gorm:"uniqueIndex;not null"`
	Phone             string     `json:"phone" gorm:"uniqueIndex"`
	DisplayName       string     `json:"display_name"`                // Set by admin when inviting; shown in audit logs
	PasswordHash      string     `json:"-" gorm:"not null"`           // Never serialised to JSON
	Role              string     `json:"role" gorm:"default:'admin'"` // admin | staff | viewer
	IsEmailVerified   bool       `json:"is_email_verified" gorm:"default:false"`
	IsActive          bool       `json:"is_active" gorm:"default:true"` // Soft-disable without deleting the row
	PasswordChangedAt *time.Time `json:"password_changed_at"`           // Used to invalidate pre-existing sessions on password reset

	// Per-user dashboard UI language preference (ISO 639-1: "en", "si", "ta" …)
	// Independent from Business.BotReplyLanguage — a Tamil-speaking owner can
	// use a Tamil dashboard while their bot replies in Sinhala to customers.
	DashboardLanguage string `json:"dashboard_language" gorm:"default:'en'"`

	// Relational binding
	Business *Business `json:"business,omitempty" gorm:"foreignKey:BusinessID"`
}
