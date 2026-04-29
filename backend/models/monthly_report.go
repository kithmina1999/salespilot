package models

import "time"

// MonthlyReport stores each AI-generated business intelligence report
// sent to the owner at the start of each month.
type MonthlyReport struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	BusinessID uint      `json:"business_id" gorm:"index;not null"`
	Month      string    `json:"month"`       // e.g. "2026-03"
	ReportType string    `json:"report_type"` // "basic" | "advanced"
	ReportText string    `json:"report_text" gorm:"type:text"`
	SentTo     string    `json:"sent_to"`  // WhatsApp number it was delivered to
	SentAt     time.Time `json:"sent_at"`
	CreatedAt  time.Time `json:"created_at"`
}
