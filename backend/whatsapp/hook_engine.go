package whatsapp

// hook_engine.go — Smart Sales Hook Engine
//
// Runs AFTER every FAQ or Gemini reply and appends a contextual
// sales nudge + WhatsApp buttons based on message intent and real-time signals.
//
// Hook priority (first match wins):
//  1. Scarcity       — stock ≤ 10 units OR ≤ 15% of MaxStock     (Pro)
//  2. Social proof   — product is top-3 ordered in last 30 days   (Pro)
//  3. Reorder        — returning customer previously bought this   (Pro)
//  4. Purchase prompt— generic product hook (all tiers)
//  5. Generic menu   — non-product replies get menu buttons        (all tiers)
//
// Free tier: hooks 4 and 5 only (static buttons, no dynamic data)
// Pro tier:  all hooks with live stock + bestseller detection

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// hookResult carries the enriched text and optional buttons.
type hookResult struct {
	Text    string   // original reply + appended hook text
	Buttons []Button // nil = no buttons (send as plain text)
}

// enrichAndSend runs the hook engine on a generated reply, then dispatches via
// botSendButtons or SendText as appropriate.
//
// Message persistence:
//   - When buttons are attached, botSendButtons already persists the message to DB.
//     We must NOT log again here to avoid duplicate Gemini context.
//   - For plain-text sends (SendText path), we log once here.
func enrichAndSend(
	business *models.Business,
	phone, fromRaw, replyText, originalMsg string,
) {
	result := enrichReply(business, phone, originalMsg, replyText)

	// Inject promotional watermark for Free plan users after their trial expires
	if business.Plan == models.PlanFree && !business.IsInActiveTrial() {
		result.Text += "\n\n⚡ _Powered by SalesPilot.lk - Get your own AI bot free_"
	}

	if isSandboxPhone(phone) {
		content := result.Text
		if len(result.Buttons) > 0 {
			content = "[Buttons] " + content
		}
		if err := persistSandboxBotMessage(business, phone, content); err != nil {
			log.Printf("[HookEngine] Sandbox persist failed for %s: %v", phone, err)
		}
		return
	}

	var sendErr error
	if len(result.Buttons) > 0 {
		// botSendButtons logs to DB internally — no extra Create needed
		sendErr = botSendButtons(
			business,
			fromRaw, result.Text, result.Buttons,
		)
	} else {
		accessToken, tokenErr := whatsappAccessTokenForBusiness(business)
		if tokenErr != nil {
			sendErr = tokenErr
		} else {
			sendErr = SendText(
				business.WAPhoneNumberID, accessToken,
				fromRaw, result.Text,
			)
		}
		if sendErr == nil {
			// Plain-text path: log once here (buttons path already logged)
			database.DB.Create(&models.Message{
				BusinessID: business.ID,
				Phone:      phone,
				Role:       "model",
				Content:    result.Text,
			})
		}
	}
	if sendErr != nil {
		log.Printf("❌ [HookEngine] Send failed to %s: %v", fromRaw, sendErr)
	}
}

// enrichReply builds the HookResult for a given reply. Safe to call on any reply.
func enrichReply(business *models.Business, phone, originalMsg, replyText string) hookResult {
	// Skip hooks entirely if the customer is mid-order — don't interrupt the flow
	if hasActiveCart(phone, business.ID) {
		return hookResult{Text: replyText}
	}

	// Try to identify which product the conversation is about
	product := detectProductMention(business.ID, originalMsg, replyText)

	if product != nil {
		return buildProductHook(business, phone, replyText, product)
	}

	// No product detected — add a generic navigation menu
	return buildGenericHook(business, replyText, originalMsg)
}

// ─── Product Hook ───────────────────────────────────────────────────────────────

func buildProductHook(business *models.Business, phone, replyText string, product *models.Product) hookResult {
	isPro := business.Plan == models.PlanPro

	// ── Pro-only dynamic hooks ──────────────────────────────────────────────────
	if isPro {
		// 1. Scarcity hook
		if isLowStock(product) {
			hook := fmt.Sprintf("\n\n⚠️ *Only %d left in stock* — grab yours before it's gone!", product.Stock)
			return hookResult{
				Text: replyText + hook,
				Buttons: []Button{
					{ID: "order_intent", Title: "🛒 Order Now"},
					{ID: "browse_more", Title: "📦 Browse Products"},
				},
			}
		}

		// 2. Social proof — is it a top seller?
		if isBestseller(business.ID, product.ID) {
			hook := "\n\n🔥 *One of our most popular items!* Customers love this one."
			return hookResult{
				Text: replyText + hook,
				Buttons: []Button{
					{ID: "order_intent", Title: "🛒 Order Now"},
					{ID: "browse_more", Title: "📦 Browse All"},
				},
			}
		}

		// 3. Returning customer who previously bought this product
		if hasOrderedBefore(phone, business.ID, product.ID) {
			hook := "\n\n😊 *You've ordered this before!* Want to get another one?"
			return hookResult{
				Text: replyText + hook,
				Buttons: []Button{
					{ID: "order_intent", Title: "🔄 Reorder"},
					{ID: "browse_more", Title: "📦 Browse Products"},
				},
			}
		}
	}

	// 4. Generic product hook (all tiers)
	hook := "\n\n🚚 *We deliver island-wide!* Interested in ordering?"
	buttons := []Button{
		{ID: "order_intent", Title: "🛒 Order Now"},
		{ID: "browse_more", Title: "📦 Browse Products"},
	}
	return hookResult{Text: replyText + hook, Buttons: buttons}
}

// ─── Generic Menu Hook ──────────────────────────────────────────────────────────

func buildGenericHook(business *models.Business, replyText, originalMsg string) hookResult {
	lower := strings.ToLower(originalMsg)

	// Order tracking intent — add track button
	trackKeywords := []string{"order status", "my order", "track", "where is", "dispatch", "delivered"}
	for _, kw := range trackKeywords {
		if strings.Contains(lower, kw) {
			return hookResult{
				Text: replyText,
				Buttons: []Button{
					{ID: "order_status_check", Title: "📦 My Orders"},
					{ID: "browse_more", Title: "🛍️ Browse Products"},
				},
			}
		}
	}

	// General greeting or help — show full menu
	greetKeywords := []string{"hello", "hi", "hey", "help", "menu", "what can", "start"}
	for _, kw := range greetKeywords {
		if strings.Contains(lower, kw) {
			return hookResult{
				Text: replyText,
				Buttons: []Button{
					{ID: "browse_more", Title: "🛍️ Browse Products"},
					{ID: "order_intent", Title: "🛒 Place an Order"},
					{ID: "order_status_check", Title: "📦 My Orders"},
				},
			}
		}
	}

	// Default: no hook — return plain reply
	return hookResult{Text: replyText}
}

// ─── Signal Detectors ───────────────────────────────────────────────────────────

// detectProductMention scans ONLY the customer's original message (not the bot reply)
// to find a matching product in this business's catalog.
//
// Scanning replyText was causing FAQ answers to get "Order Now" buttons any time
// the bot happened to mention a product name in its response — even for unrelated
// questions like return policies or delivery times.
func detectProductMention(businessID uint, originalMsg, replyText string) *models.Product {
	var products []models.Product
	database.DB.Where("business_id = ? AND active = ?", businessID, true).Find(&products)

	// Only check the customer's message — ignore what the bot said
	combined := strings.ToLower(NormalizeMessage(originalMsg))
	for i := range products {
		if strings.Contains(combined, strings.ToLower(products[i].Name)) {
			return &products[i]
		}
	}
	return nil
}

// isLowStock returns true when stock is critically low.
func isLowStock(product *models.Product) bool {
	if product.Stock <= 0 {
		return false // out of stock entirely — don't hook
	}
	if product.Stock <= 10 {
		return true
	}
	if product.MaxStock > 0 {
		ratio := float64(product.Stock) / float64(product.MaxStock)
		return ratio <= 0.15
	}
	return false
}

// isBestseller returns true if this product appears in the top-3 most-ordered
// products (by order count) in the last 30 days.
//
// The orders.items column is a JSON array of CartItem objects. We count how many
// distinct orders contain this product (one LIKE match = one order), then check
// if it's in the top-3 by volume. This is not perfect (doesn't sum quantities)
// but is accurate enough for the social-proof hook without a separate items table.
func isBestseller(businessID, productID uint) bool {
	type row struct {
		ProductID uint
		Count     int
	}

	// Count orders containing this product over the last 30 days
	var thisProductCount int64
	cutoff := time.Now().AddDate(0, 0, -30)
	database.DB.Model(&models.Order{}).
		Where(`business_id = ? AND created_at > ? AND status != ? AND items LIKE ?`,
			businessID, cutoff, models.OrderStatusCancelled,
			fmt.Sprintf(`%%"product_id":%d%%`, productID)).
		Count(&thisProductCount)

	if thisProductCount == 0 {
		return false
	}

	// Count all products' order frequencies to determine top-3
	var topRows []struct {
		Items string
	}
	database.DB.Model(&models.Order{}).
		Select("items").
		Where(`business_id = ? AND created_at > ? AND status != ?`,
			businessID, cutoff, models.OrderStatusCancelled).
		Find(&topRows)

	// Count per product_id across all orders using LIKE on each product
	var allProducts []models.Product
	database.DB.Where("business_id = ? AND active = ?", businessID, true).Find(&allProducts)

	type productCount struct {
		id    uint
		count int64
	}
	counts := make([]productCount, 0, len(allProducts))
	for _, p := range allProducts {
		var c int64
		database.DB.Model(&models.Order{}).
			Where(`business_id = ? AND created_at > ? AND status != ? AND items LIKE ?`,
				businessID, cutoff, models.OrderStatusCancelled,
				fmt.Sprintf(`%%"product_id":%d%%`, p.ID)).
			Count(&c)
		counts = append(counts, productCount{id: p.ID, count: c})
	}

	// Sort descending by count and check if our product is in top 3
	for i := 0; i < len(counts)-1; i++ {
		for j := i + 1; j < len(counts); j++ {
			if counts[j].count > counts[i].count {
				counts[i], counts[j] = counts[j], counts[i]
			}
		}
	}
	top := 3
	if len(counts) < top {
		top = len(counts)
	}
	for _, c := range counts[:top] {
		if c.id == productID && c.count > 0 {
			return true
		}
	}
	return false
}

// hasOrderedBefore returns true if this customer previously completed an order
// containing this product at this business.
func hasOrderedBefore(phone string, businessID, productID uint) bool {
	var count int64
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND customer_phone = ? AND status = ? AND items LIKE ?",
			businessID, phone, models.OrderStatusDelivered,
			fmt.Sprintf(`%%"product_id":%d%%`, productID)).
		Count(&count)
	return count > 0
}

// hasActiveCart checks if a customer currently has an active order session.
// Used by enrichReply to avoid interrupting the order flow.
func hasActiveCart(phone string, businessID uint) bool {
	var cart models.Cart
	err := database.DB.
		Where("phone = ? AND business_id = ? AND state NOT IN ? AND expires_at > ?",
			phone, businessID,
			[]string{models.CartStatePlaced, models.CartStateAbandoned},
			time.Now()).
		First(&cart).Error
	return err == nil
}
