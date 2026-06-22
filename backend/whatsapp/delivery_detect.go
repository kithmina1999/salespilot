package whatsapp

// delivery_detect.go — Smart delivery confirmation detection for the WhatsApp pipeline.
//
// Two layers:
//
//  Layer A — Passive auto-confirm (runs before every other handler)
//    If the customer's message contains delivery confirmation language AND they
//    have an active shipped order → auto-mark as delivered, send a thank-you.
//    Works within the 24h session window (customer messaged us = session open).
//
//  Layer B — Proactive check (defer'd goroutine, fires after main reply)
//    If the customer has a shipped order older than 1 day and we haven't asked
//    yet → send a YES/NO button question. Customer is already chatting (session
//    open) so interactive buttons are fully allowed without using a template.
//    Guarded by Order.DeliveryCheckSent so we only ask once per order.
//
// WHY NOT WHATSAPP TEMPLATES?
//    These messages are sent IN-SESSION (customer messaged us first). As long as
//    we reply within 24 hours of that message, free-form text + buttons are
//    fully allowed by Meta — no template or business verification required.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/httpclient"
	"github.com/kithmina1999/salespilot/models"
)

// ─── Keywords ─────────────────────────────────────────────────────────────────

var deliveryKeywordsEN = []string{
	"received", "got it", "got my order", "arrived", "delivered",
	"picked up", "collected", "i got", "already got", "it came",
	"came already", "came in", "parcel arrived", "package arrived",
	"yes received", "yes delivered",
}

var deliveryKeywordsSinhala = []string{
	// Sinhala script
	"ලැබුණා", "ලැබුනා", "ලැබිලා", "ගත්තා", "ආවා", "ගෙනාව",
}

var deliveryKeywordsSinglish = []string{
	// Romanised Sinhala
	"labuna", "labunaa", "labila", "gaththa", "gatta",
	"aawa", "genawa", "genattha",
}

// isDeliveryConfirmation returns true if the text signals that the customer
// has received their parcel. Checks EN, Sinhala script, and Singlish.
func isDeliveryConfirmation(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	norm := strings.ToLower(NormalizeMessage(text))

	for _, kw := range deliveryKeywordsEN {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	for _, kw := range deliveryKeywordsSinhala {
		if strings.Contains(text, kw) {
			return true
		}
	}
	for _, kw := range deliveryKeywordsSinglish {
		if strings.Contains(norm, kw) {
			return true
		}
	}
	return false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// getLatestShippedOrder returns the most recent Order with status=shipped
// for this customer, or nil if none.
func getLatestShippedOrder(businessID uint, phone string) *models.Order {
	var order models.Order
	if err := database.DB.
		Where("business_id = ? AND customer_phone = ? AND status = ?",
			businessID, phone, models.OrderStatusShipped).
		Order("created_at DESC").
		First(&order).Error; err != nil {
		return nil
	}
	return &order
}

// markShippedOrderDelivered updates an order to delivered and suppresses
// any pending late-delivery alert.
func markShippedOrderDelivered(order *models.Order) {
	database.DB.Model(order).Updates(map[string]interface{}{
		"status":              models.OrderStatusDelivered,
		"late_alert_sent":     true, // suppress pending late alert
		"delivery_check_sent": true,
	})
}

// sendDeliveryInteractive posts a pre-built interactive payload to the Meta API.
func sendDeliveryInteractive(phoneNumberID, accessToken string, payload map[string]interface{}) {
	url := fmt.Sprintf("https://graph.facebook.com/v19.0/%s/messages", phoneNumberID)
	jsonBody, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Printf("❌ [DeliveryCheck] HTTP build error: %v", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpclient.Do(req)
	if err != nil {
		log.Printf("❌ [DeliveryCheck] HTTP send error: %v", err)
		return
	}
	defer resp.Body.Close()
}

// ─── Layer A: Passive Auto-Confirm ────────────────────────────────────────────

// HandleDeliveryDetection runs as an early intercept in the pipeline.
// Returns true (handled=stop pipeline) if the message is a delivery confirmation
// AND the customer has a shipped order.
func HandleDeliveryDetection(business *models.Business, from, fromRaw, text string) bool {
	if !isDeliveryConfirmation(text) {
		return false
	}
	order := getLatestShippedOrder(business.ID, from)
	if order == nil {
		return false
	}

	markShippedOrderDelivered(order)

	msg := fmt.Sprintf(
		"🎉 Wonderful! We've marked your order *#%d* as *Delivered*. Thank you for shopping with *%s*!\n\nHope you love it — reply *order* anytime to shop again 😊",
		order.BusinessOrderNum, business.Name,
	)
	botSendText(business, fromRaw, msg)

	database.DB.Create(&models.Message{
		BusinessID: business.ID,
		Phone:      from,
		Role:       "model",
		Content:    msg,
	})

	log.Printf("✅ [DeliveryDetect] Auto-confirmed order #%d as delivered for %s",
		order.BusinessOrderNum, from)
	return true
}

// ─── Layer B: Proactive Check ─────────────────────────────────────────────────

// ScheduleDeliveryCheck is called as a deferred goroutine at the END of the
// pipeline (after the main bot reply has been dispatched). It checks whether
// the customer has a shipped order that is >1 day old and hasn't been asked yet,
// and if so sends a YES / NO button question exploiting the now-open session window.
func ScheduleDeliveryCheck(business *models.Business, from, fromRaw string) {
	// Small delay so the main bot reply lands first
	time.Sleep(600 * time.Millisecond)

	order := getLatestShippedOrder(business.ID, from)
	if order == nil || order.DeliveryCheckSent {
		return
	}
	// Only ask after at least 1 day since shipping
	if time.Since(order.UpdatedAt) < 24*time.Hour {
		return
	}

	// Mark first to prevent duplicate sends on concurrent messages
	database.DB.Model(order).Update("delivery_check_sent", true)

	orderNum := fmt.Sprintf("%d", order.BusinessOrderNum)
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                fromRaw,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "button",
			"body": map[string]interface{}{
				"text": fmt.Sprintf(
					"📦 *Quick update!*\n\nYour order *#%s* from *%s* was shipped. Has it arrived?",
					orderNum, business.Name,
				),
			},
			"action": map[string]interface{}{
				"buttons": []map[string]interface{}{
					{
						"type": "reply",
						"reply": map[string]interface{}{
							"id":    "delivery_yes",
							"title": "✅ Yes, received!",
						},
					},
					{
						"type": "reply",
						"reply": map[string]interface{}{
							"id":    "delivery_no",
							"title": "❌ Not yet",
						},
					},
				},
			},
		},
	}

	sendDeliveryInteractive(business.WAPhoneNumberID, business.WAAccessToken, payload)
	log.Printf("📩 [DeliveryCheck] Sent delivery check to %s for order #%s", from, orderNum)
}

// ─── Button Response Handlers ─────────────────────────────────────────────────

// handleDeliveryYes is called when customer presses "✅ Yes, received!" button.
// Marks the latest shipped order as delivered and sends a thank-you.
func handleDeliveryYes(business *models.Business, from, fromRaw string) {
	order := getLatestShippedOrder(business.ID, from)
	if order == nil {
		// Shouldn't happen, but handle gracefully
		msg := fmt.Sprintf("🎉 Wonderful! Thank you for letting us know. We hope to see you again at *%s* soon! 😊", business.Name)
		botSendText(business, fromRaw, msg)
		return
	}

	markShippedOrderDelivered(order)

	msg := fmt.Sprintf(
		"🎉 Brilliant! Order *#%d* is now marked as *Delivered*.\n\nThank you for shopping with *%s* — we'd love to see you again!\n\nReply *order* anytime to browse or reorder 🛍️",
		order.BusinessOrderNum, business.Name,
	)
	botSendText(business, fromRaw, msg)

	database.DB.Create(&models.Message{
		BusinessID: business.ID,
		Phone:      from,
		Role:       "model",
		Content:    msg,
	})
	log.Printf("✅ [DeliveryYes] Order #%d marked delivered via button (customer %s)", order.BusinessOrderNum, from)
}

// handleDeliveryNo is called when customer presses "❌ Not yet" button.
// Reassures the customer, logs the concern, and leaves the order in shipped status
// so the tenant can follow up.
func handleDeliveryNo(business *models.Business, from, fromRaw string) {
	order := getLatestShippedOrder(business.ID, from)
	orderInfo := ""
	if order != nil {
		orderInfo = fmt.Sprintf(" (#%d)", order.BusinessOrderNum)
	}

	msg := fmt.Sprintf(
		"⏳ Got it! Your order%s is still on the way.\n\nWe'll look into it and follow up with you. If you need urgent help, reply *help* or contact us directly.\n\nSorry for the wait! 🙏",
		orderInfo,
	)
	botSendText(business, fromRaw, msg)

	database.DB.Create(&models.Message{
		BusinessID: business.ID,
		Phone:      from,
		Role:       "model",
		Content:    msg,
	})
	log.Printf("⚠️ [DeliveryNo] Customer %s reports order%s NOT yet received — tenant should follow up", from, orderInfo)
}
