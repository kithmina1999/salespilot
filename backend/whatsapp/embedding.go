package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strings"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── Embedding API ─────────────────────────────────────────────────────────────

// embeddingModel is the Gemini embedding model used for semantic rule matching.
// text-embedding-004 was deprecated in early 2026; gemini-embedding-001 is the replacement.
const embeddingModel = "gemini-embedding-001"

// EmbedText calls the Gemini Embedding API and returns a []float64 vector.
// Uses text-embedding-004 which is multilingual and handles Sinhala natively.
func EmbedText(text string) ([]float64, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s",
		embeddingModel, apiKey,
	)

	body := map[string]interface{}{
		"model": "models/" + embeddingModel,
		"content": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": text},
			},
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("embedding: marshal failed: %w", err)
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("embedding: http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBody bytes.Buffer
		errBody.ReadFrom(resp.Body)
		return nil, fmt.Errorf("embedding: API returned status %d — %s", resp.StatusCode, errBody.String())
	}

	var result struct {
		Embedding struct {
			Values []float64 `json:"values"`
		} `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("embedding: decode failed: %w", err)
	}
	if len(result.Embedding.Values) == 0 {
		return nil, fmt.Errorf("embedding: API returned empty vector")
	}

	return result.Embedding.Values, nil
}

// ─── Math ──────────────────────────────────────────────────────────────────────

// CosineSimilarity returns a score from 0.0 (unrelated) to 1.0 (identical meaning).
// Both vectors must be the same length (768 for text-embedding-004).
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	denom := math.Sqrt(normA) * math.Sqrt(normB)
	if denom == 0 {
		return 0
	}
	return dot / denom
}

// ─── Rule Embed Text Builder ───────────────────────────────────────────────────

// buildEmbedText combines all human-readable fields of a rule into a single
// rich text string for embedding. Including the Sinhala response ensures that
// Sinhala customer messages will naturally match rules with Sinhala coverage.
func buildEmbedText(r models.Rule) string {
	parts := []string{}
	if r.Keywords != "" {
		parts = append(parts, r.Keywords)
	}
	if r.Response != "" {
		parts = append(parts, r.Response)
	}
	if r.SinhalaResponse != "" {
		parts = append(parts, r.SinhalaResponse)
	}
	return strings.Join(parts, ". ")
}

// ─── Rule Embed & Persist ──────────────────────────────────────────────────────

// EmbedAndStoreRule generates an embedding for the given rule and saves it to the DB.
// This should be called in a goroutine after CreateRule or UpdateRule succeeds
// so that it doesn't block the API response.
func EmbedAndStoreRule(r *models.Rule) {
	text := buildEmbedText(*r)
	if strings.TrimSpace(text) == "" {
		log.Printf("⚠️ EmbedAndStoreRule: rule %d has no text to embed — skipping", r.ID)
		return
	}

	vec, err := EmbedText(text)
	if err != nil {
		log.Printf("❌ EmbedAndStoreRule: rule %d embed failed: %v", r.ID, err)
		return
	}

	encoded, err := json.Marshal(vec)
	if err != nil {
		log.Printf("❌ EmbedAndStoreRule: rule %d marshal failed: %v", r.ID, err)
		return
	}

	if err := database.DB.Model(r).UpdateColumn("embedding", encoded).Error; err != nil {
		log.Printf("❌ EmbedAndStoreRule: rule %d DB update failed: %v", r.ID, err)
		return
	}

	log.Printf("✅ EmbedAndStoreRule: rule %d embedded (%d dims)", r.ID, len(vec))

	// Reload cache so new embedding is available immediately
	Cache.LoadRules()
}

// ─── Batch Migration ───────────────────────────────────────────────────────────

// EmbedAllMissingRules scans all active rules with no embedding and embeds them.
// Called once on server startup to migrate existing rules created before this feature.
func EmbedAllMissingRules() {
	var rules []models.Rule
	if err := database.DB.Where("is_active = ? AND (embedding IS NULL OR embedding = ?)", true, "").Find(&rules).Error; err != nil {
		log.Printf("❌ EmbedAllMissingRules: DB query failed: %v", err)
		return
	}

	if len(rules) == 0 {
		log.Printf("✅ EmbedAllMissingRules: all rules already embedded")
		return
	}

	log.Printf("🔄 EmbedAllMissingRules: embedding %d rules in background...", len(rules))
	go func() {
		for i := range rules {
			EmbedAndStoreRule(&rules[i])
		}
		log.Printf("✅ EmbedAllMissingRules: batch embedding complete")
	}()
}
