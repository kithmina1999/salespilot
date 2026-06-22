package models

import "time"

// EmbeddingArtifact stores reusable, application-wide embedding vectors such
// as intent and address centroids. Model and content hash changes invalidate
// an artifact without requiring manual database cleanup.
type EmbeddingArtifact struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Key         string    `json:"key" gorm:"size:128;not null;uniqueIndex"`
	Model       string    `json:"model" gorm:"size:128;not null"`
	ContentHash string    `json:"content_hash" gorm:"size:64;not null;index"`
	Embedding   []byte    `json:"-" gorm:"type:bytea;not null"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
