package models

import "gorm.io/gorm"

// Message stores conversational history for Gemini context.
type Message struct {
	gorm.Model
	BusinessID  uint   `json:"business_id" gorm:"index"`
	Phone       string `json:"phone" gorm:"index"` // The WhatsApp Chat ID
	Role        string `json:"role"`               // "user", "model", or "system"
	Content     string `json:"content" gorm:"type:text"`
	Status      string `json:"status" gorm:"default:'bot_handling'"` // bot_handling, resolved, needs_attention
	IsUnmatched bool   `json:"is_unmatched" gorm:"default:false"`    // True if bot failed to answer
	IsRead      bool   `json:"is_read" gorm:"default:false"`         // False until merchant views the chat
}
