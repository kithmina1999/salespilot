package whatsapp

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/httpclient"
	"github.com/kithmina1999/salespilot/models"
)

const maxMetaImageBytes int64 = 10 << 20

// ImageAnalysis is the result of a single Gemini Vision call.
// Both intent and description are extracted together so we never
// upload the image bytes more than once.
type ImageAnalysis struct {
	Intent      string // "product_inquiry" | "payment_proof" | "review" | "other"
	Description string // plain-text description of what Gemini sees in the image
}

// ── Public entry point ─────────────────────────────────────────────────────────

// HandleImageWebhook downloads a Meta media item, analyses it once with Gemini
// Vision (intent + description), then routes to the correct handler using only
// the text description — no second image upload needed.
func HandleImageWebhook(business *models.Business, fromNormalized, fromRaw, mediaID, pushName string) {
	HandleImageWebhookContext(context.Background(), business, fromNormalized, fromRaw, mediaID, pushName)
}

func HandleImageWebhookContext(ctx context.Context, business *models.Business, fromNormalized, fromRaw, mediaID, pushName string) {
	log.Printf("[MediaRouter] Processing image (business_id=%d)", business.ID)

	mediaURL, err := fetchMetaMediaURL(ctx, mediaID, business.WAAccessToken)
	if err != nil {
		log.Printf("❌ [MediaRouter] Failed to get media URL: %v", err)
		botSendText(business, fromRaw, "Sorry, I couldn't process your image. Please try again!")
		return
	}

	// NOTE: Meta media URLs are short-lived — download immediately.
	imageBytes, mimeType, err := downloadMetaMedia(ctx, mediaURL, business.WAAccessToken)
	if err != nil {
		log.Printf("❌ [MediaRouter] Failed to download media: %v", err)
		botSendText(business, fromRaw, "Sorry, I couldn't process your image. Please try again!")
		return
	}

	// Single Vision call: get intent AND description together.
	// All downstream handlers receive the text description — image bytes are
	// no longer needed after this point.
	analysis := analyzeImageWithVision(ctx, imageBytes, mimeType)
	log.Printf("[MediaRouter] Image classified (business_id=%d intent=%s)", business.ID, analysis.Intent)

	switch analysis.Intent {
	case "product_inquiry":
		handleProductImageInquiry(ctx, business, fromNormalized, fromRaw, analysis.Description)
	case "payment_proof":
		screenshotURL := uploadPaymentProofImageToCloudinary(ctx, business.ID, imageBytes, mimeType)
		handlePaymentProofImage(business, fromNormalized, fromRaw, analysis.Description, screenshotURL)
	case "review":
		// Route to media_bridge.go: creates IsUnmatched merchant alert if shipped order
		// exists. Does NOT auto-mark as delivered — merchant confirms from dashboard.
		handleReviewImage(business, fromNormalized, fromRaw, 0, analysis.Description)
	default:
		botSendText(business, fromRaw, "Thanks for the image! How can I help you today? 😊")
	}
}

// ── Single Vision Call ─────────────────────────────────────────────────────────

// analyzeImageWithVision sends the image to Gemini once and returns both the
// routing intent and a human-readable description of the image content.
// The description is used by all downstream handlers so the image is never
// re-uploaded to Gemini.
func analyzeImageWithVision(ctx context.Context, imageBytes []byte, mimeType string) ImageAnalysis {
	fallback := ImageAnalysis{Intent: "other", Description: ""}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("⚠️ [MediaRouter] GEMINI_API_KEY not set")
		return fallback
	}

	b64Image := base64.StdEncoding.EncodeToString(imageBytes)

	prompt := `You are an image analyser for a WhatsApp e-commerce chatbot.

Analyse this image and respond with ONLY a JSON object (no markdown, no extra text):

{
  "intent": "<one of: product_inquiry | payment_proof | review | other>",
  "description": "<1-2 sentence plain English description of exactly what you see>"
}

Intent rules:
- product_inquiry  → customer is showing something they want to buy or asking about a product
- payment_proof    → bank transfer screenshot, payment receipt, QR code scan, or any proof of payment
- review           → photo of a product already received (unboxing, review, testimonial)
- other            → anything else (meme, selfie, document, unclear)

The description must capture enough detail for follow-up questions (colour, item type, visible text like amounts, bank names, etc).`

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

	resp, err := httpclient.PostJSONContext(ctx, httpclient.DependencyGemini, "analyze_whatsapp_image", url, jsonBody, httpclient.RetryTransient)
	if err != nil {
		log.Printf("❌ [MediaRouter] Vision call failed: %v", err)
		return fallback
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [MediaRouter] Failed to parse Vision response: %v", err)
		return fallback
	}

	raw := strings.TrimSpace(extractGeminiText(result))
	// Strip markdown fences if Gemini adds them despite instructions
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var parsed struct {
		Intent      string `json:"intent"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		log.Printf("[MediaRouter] Invalid Vision response JSON; using fallback")
		return fallback
	}

	// Validate intent value
	switch parsed.Intent {
	case "product_inquiry", "payment_proof", "review", "other":
	default:
		parsed.Intent = "other"
	}

	return ImageAnalysis{Intent: parsed.Intent, Description: parsed.Description}
}

// ── Route Handlers (text-only, no image bytes) ────────────────────────────────

// handleProductImageInquiry does a DB keyword search against the description first.
// If matching products are found, it formats them as a list and sends directly.
// Only calls Gemini for a natural-language response when no DB match exists.
func handleProductImageInquiry(ctx context.Context, business *models.Business, fromNormalized, fromRaw, description string) {
	// Step 1: search the catalog using words from the description
	var matchedProducts []models.Product
	words := strings.Fields(strings.ToLower(description))
	// Build OR query for the most meaningful words (skip short ones)
	var conditions []string
	var args []interface{}
	for _, w := range words {
		if len(w) > 3 {
			conditions = append(conditions, "(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)")
			pat := "%" + w + "%"
			args = append(args, pat, pat, pat)
		}
	}

	if len(conditions) > 0 {
		whereClause := "business_id = ? AND active = ? AND (" + strings.Join(conditions, " OR ") + ")"
		allArgs := append([]interface{}{business.ID, true}, args...)
		database.DB.Where(whereClause, allArgs...).Limit(5).Find(&matchedProducts)
	}

	// Step 2a: found DB matches — build a formatted product list reply
	if len(matchedProducts) > 0 {
		var sb strings.Builder
		sb.WriteString("*Here's what we have that might match:* 🛍️\n\n")
		for _, p := range matchedProducts {
			stockLabel := "In Stock ✅"
			if p.Stock == 0 {
				stockLabel = "Out of Stock ❌"
			}
			sb.WriteString(fmt.Sprintf("*%s* — Rs.%.0f (%s)\n", p.Name, p.Price, stockLabel))
			if p.Description != "" {
				sb.WriteString(fmt.Sprintf("_%s_\n", p.Description))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("Reply with a product name to order or ask more! 😊")
		reply := sb.String()
		botSendText(business, fromRaw, reply)
		database.DB.Create(&models.Message{BusinessID: business.ID, Phone: fromNormalized, Role: "user", Content: fmt.Sprintf("[Image: %s]", description)})
		database.DB.Create(&models.Message{BusinessID: business.ID, Phone: fromNormalized, Role: "model", Content: reply})
		return
	}

	// Step 2b: no DB match — fall back to Gemini text call with full catalog
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		botSendText(business, fromRaw, "Sorry, I couldn't find a matching product. Could you describe what you're looking for?")
		return
	}

	var allProducts []models.Product
	database.DB.Where("business_id = ? AND active = ?", business.ID, true).Find(&allProducts)
	var catalogStr string
	for _, p := range allProducts {
		catalogStr += fmt.Sprintf("- %s (Rs.%.0f): %s\n", p.Name, p.Price, p.Description)
	}
	if catalogStr == "" {
		catalogStr = "No products listed yet."
	}

	systemPrompt := fmt.Sprintf(
		"You are %s's WhatsApp assistant for %s. "+
			"Warm, conversational, max 3 sentences. If no matching product exists, say clearly it's not available and suggest the closest alternative or ask for more details.\n\nCATALOG:\n%s",
		business.BotName, business.Name, catalogStr)
	userMsg := fmt.Sprintf("Customer sent an image. What they see: %s\nDo we have something like this?", description)

	body := map[string]interface{}{
		"system_instruction": map[string]interface{}{"parts": map[string]interface{}{"text": systemPrompt}},
		"contents": []map[string]interface{}{
			{"role": "user", "parts": []map[string]interface{}{{"text": userMsg}}},
		},
	}
	jsonBody, _ := json.Marshal(body)
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	resp, err := httpclient.PostJSONContext(ctx, httpclient.DependencyGemini, "match_product_image", url, jsonBody, httpclient.RetryTransient)
	if err != nil {
		botSendText(business, fromRaw, "We couldn't find a match right now. Could you describe what you're looking for?")
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	reply := extractGeminiText(result)
	if reply == "" {
		reply = "We don't seem to have that item right now. Could you describe what you're looking for? 😊"
	}

	botSendText(business, fromRaw, reply)
	database.DB.Create(&models.Message{BusinessID: business.ID, Phone: fromNormalized, Role: "user", Content: fmt.Sprintf("[Image: %s]", description)})
	database.DB.Create(&models.Message{BusinessID: business.ID, Phone: fromNormalized, Role: "model", Content: reply})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func uploadPaymentProofImageToCloudinary(parent context.Context, businessID uint, imageBytes []byte, mimeType string) string {
	cloudinaryURL := os.Getenv("CLOUDINARY_URL")
	if cloudinaryURL == "" {
		log.Println("⚠️ [MediaRouter] CLOUDINARY_URL not set; storing payment proof without screenshot URL")
		return ""
	}

	cld, err := cloudinary.NewFromURL(cloudinaryURL)
	if err != nil {
		log.Printf("⚠️ [MediaRouter] Failed to initialize Cloudinary for payment proof: %v", err)
		return ""
	}

	ctx, cancel := context.WithTimeout(parent, httpclient.ExternalAPITimeout)
	defer cancel()

	resp, err := cld.Upload.Upload(ctx, bytes.NewReader(imageBytes), uploader.UploadParams{
		Folder:   "salespilot/order-proofs",
		PublicID: fmt.Sprintf("proof-%d-%d", businessID, time.Now().UnixNano()),
	})
	if err != nil {
		log.Printf("⚠️ [MediaRouter] Failed to upload payment proof image (%s): %v", mimeType, err)
		return ""
	}
	return resp.SecureURL
}

// localizedWaitMessage returns a short "please wait" in the business's bot language.
func localizedWaitMessage(business *models.Business) string {
	switch business.BotReplyLanguage {
	case "si":
		return "Wait a second... 🔍"
	case "ta":
		return "ஒரு நிமிடம்... 🔍"
	default:
		return "Wait a second... 🔍"
	}
}

// fetchMetaMediaURL resolves a Meta media ID to a short-lived download URL.
func fetchMetaMediaURL(ctx context.Context, mediaID, accessToken string) (string, error) {
	url := fmt.Sprintf("https://graph.facebook.com/v19.0/%s", mediaID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "resolve_media_url", req, httpclient.RetryTransient)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode media URL: %w", err)
	}
	if result.URL == "" {
		return "", fmt.Errorf("empty URL for media_id=%s", mediaID)
	}
	return result.URL, nil
}

// downloadMetaMedia downloads image bytes from a Meta media URL using Bearer auth.
func downloadMetaMedia(ctx context.Context, mediaURL, accessToken string) ([]byte, string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "download_media", req, httpclient.RetryTransient)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download failed: status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxMetaImageBytes {
		return nil, "", fmt.Errorf("media too large: %d bytes", resp.ContentLength)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxMetaImageBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("reading bytes: %w", err)
	}
	if int64(len(data)) > maxMetaImageBytes {
		return nil, "", fmt.Errorf("media too large: exceeds %d bytes", maxMetaImageBytes)
	}

	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/jpeg"
	}
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	return data, mimeType, nil
}
