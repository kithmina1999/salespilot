package whatsapp

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

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
	log.Printf("🔍 [MediaRouter] Processing image from %s (biz=%d)", fromNormalized, business.ID)

	mediaURL, err := fetchMetaMediaURL(mediaID, business.WAAccessToken)
	if err != nil {
		log.Printf("❌ [MediaRouter] Failed to get media URL: %v", err)
		botSendText(business, fromRaw, "Sorry, I couldn't process your image. Please try again!")
		return
	}

	// NOTE: Meta media URLs are short-lived — download immediately.
	imageBytes, mimeType, err := downloadMetaMedia(mediaURL, business.WAAccessToken)
	if err != nil {
		log.Printf("❌ [MediaRouter] Failed to download media: %v", err)
		botSendText(business, fromRaw, "Sorry, I couldn't process your image. Please try again!")
		return
	}

	// Single Vision call: get intent AND description together.
	// All downstream handlers receive the text description — image bytes are
	// no longer needed after this point.
	analysis := analyzeImageWithVision(imageBytes, mimeType)
	log.Printf("🏷️  [MediaRouter] intent=%s desc=%q for %s", analysis.Intent, analysis.Description, fromNormalized)

	switch analysis.Intent {
	case "product_inquiry":
		handleProductImageInquiry(business, fromNormalized, fromRaw, analysis.Description)
	case "payment_proof":
		handlePaymentProofImage(business, fromNormalized, fromRaw, analysis.Description)
	case "review":
		// Store the review description for the merchant, thank the customer
		database.DB.Create(&models.Message{
			BusinessID: business.ID,
			Phone:      fromNormalized,
			Role:       "user",
			Content:    fmt.Sprintf("[Image review: %s]", analysis.Description),
		})
		botSendText(business, fromRaw, "Thanks for sharing! We love to hear from our customers 🙏")
	default:
		botSendText(business, fromRaw, "Thanks for the image! How can I help you today? 😊")
	}
}

// ── Single Vision Call ─────────────────────────────────────────────────────────

// analyzeImageWithVision sends the image to Gemini once and returns both the
// routing intent and a human-readable description of the image content.
// The description is used by all downstream handlers so the image is never
// re-uploaded to Gemini.
func analyzeImageWithVision(imageBytes []byte, mimeType string) ImageAnalysis {
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

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
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
		log.Printf("⚠️ [MediaRouter] Could not parse JSON from Vision: %q — fallback to 'other'", raw)
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
func handleProductImageInquiry(business *models.Business, fromNormalized, fromRaw, description string) {
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

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonBody))
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

// handlePaymentProofImage:
// 1. Finds the customer's most recent pending bank-transfer order
// 2. Creates an OrderPaymentProof record (status: pending) linked to that order
// 3. Updates Order.PaymentStatus to "awaiting_verification"
// 4. ACKs the customer and alerts the merchant
func handlePaymentProofImage(business *models.Business, fromNormalized, fromRaw, description string) {
	log.Printf("💳 [MediaRouter] Payment proof from %s — %s", fromNormalized, description)

	// Find the most recent pending bank-transfer order for this customer
	var pendingOrder models.Order
	hasUnpaidOrder := database.DB.Where(
		"business_id = ? AND customer_phone = ? AND payment_method = ? AND payment_status = ? AND status IN ?",
		business.ID, fromNormalized, "bank_transfer", "pending",
		[]string{models.OrderStatusNew, models.OrderStatusConfirmed},
	).Order("created_at desc").First(&pendingOrder).Error == nil

	if !hasUnpaidOrder {
		botSendText(business, fromRaw,
			"Thanks for sharing! We couldn't find an active order pending payment for your number. "+
				"If you've already placed an order and made a transfer, please contact us directly. 🙏")
		database.DB.Create(&models.Message{
			BusinessID:  business.ID,
			Phone:       fromNormalized,
			Role:        "user",
			Content:     fmt.Sprintf("[Payment proof (no matching order found): %s]", description),
			IsUnmatched: true,
		})
		return
	}

	// Create the OrderPaymentProof record
	proof := models.OrderPaymentProof{
		BusinessID:    business.ID,
		OrderID:       pendingOrder.ID,
		CustomerPhone: fromNormalized,
		Amount:        pendingOrder.TotalPrice,
		Description:   description,
		Status:        "pending",
	}
	if err := database.DB.Create(&proof).Error; err != nil {
		log.Printf("❌ [MediaRouter] Failed to create OrderPaymentProof: %v", err)
	}

	// Update order payment status to awaiting_verification
	if err := database.DB.Model(&pendingOrder).
		UpdateColumn("payment_status", "awaiting_verification").Error; err != nil {
		log.Printf("❌ [MediaRouter] Failed to update order payment status: %v", err)
	}

	// Log proof to chat history
	proofNote := fmt.Sprintf("[Payment proof for Order #%d: %s]", pendingOrder.BusinessOrderNum, description)
	database.DB.Create(&models.Message{
		BusinessID:  business.ID,
		Phone:       fromNormalized,
		Role:        "user",
		Content:     proofNote,
		IsUnmatched: true,
	})

	// ACK the customer
	botSendText(business, fromRaw, fmt.Sprintf(
		"✅ *Payment proof received for Order #%d!*\n"+
			"Our team will review and confirm your payment. We'll update you shortly. 🙏",
		pendingOrder.BusinessOrderNum))

	// Notify the merchant
	reportPhone := business.ReportPhone
	if reportPhone == "" {
		reportPhone = business.Phone
	}
	if reportPhone != "" {
		alert := fmt.Sprintf(
			"💳 *Payment Proof Received!*\n\n"+
				"Order: #%d\nCustomer: %s\nAmount: Rs.%.0f\n\n"+
				"What was sent: %s\n\n"+
				"Open your dashboard to approve or reject this payment.",
			pendingOrder.BusinessOrderNum,
			pendingOrder.CustomerPhone,
			pendingOrder.TotalPrice,
			description,
		)
		SendText(business.WAPhoneNumberID, business.WAAccessToken, reportPhone, alert)
	}

	log.Printf("✅ [MediaRouter] Payment proof #%d for Order #%d — status set to awaiting_verification",
		proof.ID, pendingOrder.BusinessOrderNum)
}


// ── Helpers ───────────────────────────────────────────────────────────────────

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
func fetchMetaMediaURL(mediaID, accessToken string) (string, error) {
	url := fmt.Sprintf("https://graph.facebook.com/v19.0/%s", mediaID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
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
func downloadMetaMedia(mediaURL, accessToken string) ([]byte, string, error) {
	req, _ := http.NewRequest("GET", mediaURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download failed: status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("reading bytes: %w", err)
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
	