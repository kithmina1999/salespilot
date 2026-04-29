package models

import "gorm.io/gorm"

// UnmatchedMessage logs user messages that bypassed the FAQ matching layer
// and were sent to the AI fallback. This helps merchants discover missing FAQs.
type UnmatchedMessage struct {
	gorm.Model
	BusinessID    *uint  `json:"business_id" gorm:"index"`
	Message       string `json:"message" gorm:"type:text"`
	IntentCluster string `json:"intent_cluster" gorm:"type:varchar(255);index"`
	Resolved      bool   `json:"resolved" gorm:"default:false"` // marks if a merchant has addressed it
}
