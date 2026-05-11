package models

import (
	"time"
)

// PlatformNotice represents a platform-wide announcement or alert (e.g. maintenance, outage)
type PlatformNotice struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	Title     string     `json:"title" gorm:"not null"`
	Message   string     `json:"message" gorm:"not null"`
	Type      string     `json:"type" gorm:"default:'info'"` // info | warning | critical
	IsActive  bool       `json:"is_active" gorm:"default:true"`
	CreatedBy uint       `json:"created_by"`
	ExpiresAt *time.Time `json:"expires_at"` // optional auto-deactivation time
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
