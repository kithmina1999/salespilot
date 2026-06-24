package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/httpclient"
)

type ReceiptAnalysis struct {
	IsValid         bool       `json:"is_valid"`
	Reason          string     `json:"reason"`
	ExtractedAmount float64    `json:"extracted_amount"`
	ExtractedDate   *time.Time `json:"extracted_date"`
	ExtractedRef    string     `json:"extracted_ref"`
	ExtractedBank   string     `json:"extracted_bank"`
	ExtractedPayer  string     `json:"extracted_payer"`
	Confidence      float64    `json:"confidence"`
	RawSummary      string     `json:"raw_summary"`
}

// AnalyzePaymentReceipt uses Gemini 2.5 Flash to pre-check a payment receipt image.
func AnalyzePaymentReceipt(imageBytes []byte, mimeType string) ReceiptAnalysis {
	return AnalyzePaymentReceiptContext(context.Background(), imageBytes, mimeType)
}

func AnalyzePaymentReceiptContext(ctx context.Context, imageBytes []byte, mimeType string) ReceiptAnalysis {
	fallback := ReceiptAnalysis{
		IsValid: true, // Fail open if API fails
		Reason:  "AI scan unavailable",
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("⚠️ [ReceiptScanner] GEMINI_API_KEY not set")
		return fallback
	}

	b64Image := base64.StdEncoding.EncodeToString(imageBytes)

	prompt := `You are an AI assistant that verifies bank transfer and payment receipt screenshots.

Analyse this image and respond with ONLY a JSON object (no markdown, no extra text):

{
  "is_valid": true|false,
  "reason": "Explain why it is invalid or blurry. Keep it empty if valid.",
  "amount": 15000.00,
  "date": "2024-05-20T10:30:00Z",
  "reference": "Ref number if visible",
  "bank": "Bank name",
  "payer": "Payer name if visible",
  "confidence": 0.95,
  "summary": "Short text summary of the receipt"
}

Rules:
1. is_valid MUST be false ONLY if the image is blurry, cropped, unreadable, or completely unrelated to a payment receipt.
2. DO NOT set is_valid to false just because an amount doesn't match an expectation (you don't know the expectation).
3. Extract amount as a float (digits only, no currency symbols). Date in ISO format if possible, otherwise null.
4. Try your best to extract the transaction reference, bank name, and payer name.`

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": prompt},
					{"inline_data": map[string]string{
						"mime_type": mimeType,
						"data":      b64Image,
					}},
				},
			},
		},
	}

	jsonBody, _ := json.Marshal(body)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	resp, err := httpclient.PostJSONContext(ctx, httpclient.DependencyGemini, "analyze_payment_receipt", url, jsonBody, httpclient.RetryTransient)
	if err != nil {
		log.Printf("❌ [ReceiptScanner] Vision API call failed: %v", err)
		return fallback
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [ReceiptScanner] Failed to parse Vision response: %v", err)
		return fallback
	}

	raw := extractGeminiText(result)
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var parsed struct {
		IsValid    bool    `json:"is_valid"`
		Reason     string  `json:"reason"`
		Amount     float64 `json:"amount"`
		Date       *string `json:"date"`
		Reference  string  `json:"reference"`
		Bank       string  `json:"bank"`
		Payer      string  `json:"payer"`
		Confidence float64 `json:"confidence"`
		Summary    string  `json:"summary"`
	}

	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		log.Printf("[ReceiptScanner] Could not parse Vision response JSON")
		return fallback
	}

	var extractedDate *time.Time
	if parsed.Date != nil && *parsed.Date != "" {
		if t, err := time.Parse(time.RFC3339, *parsed.Date); err == nil {
			extractedDate = &t
		} else {
			log.Printf("[ReceiptScanner] Could not parse extracted date: %v", err)
		}
	}

	return ReceiptAnalysis{
		IsValid:         parsed.IsValid,
		Reason:          parsed.Reason,
		ExtractedAmount: parsed.Amount,
		ExtractedDate:   extractedDate,
		ExtractedRef:    parsed.Reference,
		ExtractedBank:   parsed.Bank,
		ExtractedPayer:  parsed.Payer,
		Confidence:      parsed.Confidence,
		RawSummary:      parsed.Summary,
	}
}

// extractGeminiText is a helper to pull the text out of the Gemini API response
func extractGeminiText(resp map[string]interface{}) string {
	candidates, ok := resp["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return ""
	}
	firstCandidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return ""
	}
	content, ok := firstCandidate["content"].(map[string]interface{})
	if !ok {
		return ""
	}
	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return ""
	}
	firstPart, ok := parts[0].(map[string]interface{})
	if !ok {
		return ""
	}
	text, _ := firstPart["text"].(string)
	return text
}
