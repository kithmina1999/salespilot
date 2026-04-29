package models

import (
	"time"
)

type Customer struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	BusinessID uint      `json:"business_id" gorm:"uniqueIndex:idx_business_phone;not null"`
	Phone       string     `json:"phone" gorm:"uniqueIndex:idx_business_phone;not null"`
	WhatsappJid string     `json:"whatsapp_jid"` // e.g. "123123123@lid" or "9477...89@s.whatsapp.net"
	Name        string     `json:"name"`
	Address     string     `json:"address"`
	Notes       string     `json:"notes"`
	Tags        string     `json:"tags"` // comma-separated tags e.g. "vip, repeat"
	BotPaused      bool       `json:"bot_paused" gorm:"default:false"`
	BotPausedUntil *time.Time `json:"bot_paused_until"` // nil = not paused
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
