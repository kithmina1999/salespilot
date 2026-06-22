package whatsapp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	embeddingArtifactIntentPrefix   = "intent:"
	embeddingArtifactAddressValid   = "address:valid"
	embeddingArtifactAddressInvalid = "address:invalid"
)

type embedTextFunc func(string) ([]float64, error)

func loadOrComputeCentroid(db *gorm.DB, key, model string, phrases []string, embed embedTextFunc) ([]float64, error) {
	contentHash, err := embeddingContentHash(phrases)
	if err != nil {
		return nil, fmt.Errorf("hash centroid content: %w", err)
	}

	if db != nil {
		var artifact models.EmbeddingArtifact
		result := db.Where("key = ?", key).Limit(1).Find(&artifact)
		if result.Error == nil && result.RowsAffected > 0 && artifact.Model == model && artifact.ContentHash == contentHash {
			var vector []float64
			if decodeErr := json.Unmarshal(artifact.Embedding, &vector); decodeErr == nil && len(vector) > 0 {
				log.Printf("✅ [EmbeddingArtifact] Loaded %s from database", key)
				return vector, nil
			}
		}
		if result.Error != nil {
			log.Printf("⚠️ [EmbeddingArtifact] Failed to load %s: %v — recomputing", key, result.Error)
		}
	}

	vector, embeddedCount, err := computeCentroidWithCount(phrases, embed)
	if err != nil {
		return nil, err
	}
	if embeddedCount != len(phrases) {
		log.Printf("⚠️ [EmbeddingArtifact] %s is partial (%d/%d phrases) — not persisting", key, embeddedCount, len(phrases))
		return vector, nil
	}
	if db == nil {
		return vector, nil
	}

	encoded, err := json.Marshal(vector)
	if err != nil {
		return nil, fmt.Errorf("encode centroid %s: %w", key, err)
	}
	artifact := models.EmbeddingArtifact{
		Key:         key,
		Model:       model,
		ContentHash: contentHash,
		Embedding:   encoded,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"model", "content_hash", "embedding", "updated_at"}),
	}).Create(&artifact).Error; err != nil {
		log.Printf("⚠️ [EmbeddingArtifact] Failed to persist %s: %v", key, err)
		return vector, nil
	}

	log.Printf("✅ [EmbeddingArtifact] Computed and stored %s", key)
	return vector, nil
}

func embeddingContentHash(phrases []string) (string, error) {
	encoded, err := json.Marshal(phrases)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:]), nil
}

func computeCentroid(phrases []string, embed embedTextFunc) ([]float64, error) {
	vector, _, err := computeCentroidWithCount(phrases, embed)
	return vector, err
}

func computeCentroidWithCount(phrases []string, embed embedTextFunc) ([]float64, int, error) {
	var sum []float64
	count := 0

	for _, phrase := range phrases {
		vector, err := embed(phrase)
		if err != nil {
			log.Printf("⚠️ [EmbeddingArtifact] Skipping phrase %q: %v", phrase, err)
			continue
		}
		if len(vector) == 0 {
			continue
		}
		if len(sum) == 0 {
			sum = make([]float64, len(vector))
		}
		if len(vector) != len(sum) {
			log.Printf("⚠️ [EmbeddingArtifact] Skipping phrase %q: dimension mismatch", phrase)
			continue
		}
		for i, value := range vector {
			sum[i] += value
		}
		count++
	}

	if count == 0 {
		return nil, 0, fmt.Errorf("all phrase embeddings failed")
	}
	for i := range sum {
		sum[i] /= float64(count)
	}
	return sum, count, nil
}
