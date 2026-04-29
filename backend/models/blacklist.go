package models

import (
	"time"

	"gorm.io/gorm"
)

type BlacklistedNumber struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	BusinessID uint           `gorm:"index;not null" json:"business_id"`
	Phone      string         `gorm:"index;not null" json:"phone"`
	Reason     string         `json:"reason"`
	BlockedAt  time.Time      `json:"blocked_at"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
