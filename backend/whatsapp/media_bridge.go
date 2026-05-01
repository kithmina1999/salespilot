package whatsapp

// media_bridge.go — S5: Smart Media-Order Bridging
//
// Two behaviors added:
//
//  1. handleReviewImage (review intent):
//     • If customer has a Shipped order → create an IsUnmatched merchant alert
//       and thank the customer, but do NOT auto-mark as Delivered.
//     • No shipped order → plain thank-you only.
//
//  2. resolvePaymentOrder + handlePaymentProofImage upgrade:
//     • Single pending order   → resolve immediately (existing flow unchanged)
//     • Multiple pending orders → return Ambiguous flag + all orders for disambiguation
//     • No orders              → return nil
//
// Design decision: "Never auto-deliver on a review image."
// A photo could be negative feedback, damaged goods, or a query about their
// shipped item. Only the merchant can decide the right action from the dashboard.

import (
	"fmt"
	"log"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── PaymentOrderResult ───────────────────────────────────────────────────────

// PaymentOrderResult is the result of resolvePaymentOrder.
// Ambiguous = true means multiple unpaid orders exist and the customer
// must be asked which one the proof belongs to.
type PaymentOrderResult struct {
	Order     *models.Order   // the single resolved order (nil when Ambiguous or no match)
	Orders    []models.Order  // all candidates when Ambiguous = true
	Ambiguous bool
}

// ─── resolvePaymentOrder ─────────────────────────────────────────────────────

// resolvePaymentOrder finds pending bank-transfer orders for a phone number.
//
//   - 0 orders → returns nil
//   - 1 order  → returns PaymentOrderResult{Order: &order, Ambiguous: false}
//   - 2+ orders → returns PaymentOrderResult{Orders: [...], Ambiguous: true}
func resolvePaymentOrder(business *models.Business, phone string) *PaymentOrderResult {
	var orders []models.Order
	database.DB.Where(
		"business_id = ? AND customer_phone = ? AND payment_method = ? AND payment_status = ? AND status IN ?",
		business.ID, phone, "bank_transfer", "pending",
		[]string{models.OrderStatusNew, models.OrderStatusConfirmed},
	).Order("created_at desc").Find(&orders)

	switch len(orders) {
	case 0:
		return nil
	case 1:
		return &PaymentOrderResult{Order: &orders[0], Ambiguous: false}
	default:
		return &PaymentOrderResult{Orders: orders, Ambiguous: true}
	}
}

// ─── handleReviewImage ────────────────────────────────────────────────────────

// handleReviewImage handles the "review" image intent from HandleImageWebhook.
//
// If the customer has a shipped order, it creates an IsUnmatched message so
// the merchant sees a dashboard badge alerting them to review it. The order
// is NOT automatically advanced to Delivered — that remains a manual merchant
// action in the dashboard.
//
// orderID is passed when the caller already knows which order to link the review
// to (e.g. from an active cart state). Pass 0 to let the function auto-look up
// the most recent shipped order for this phone.
func handleReviewImage(business *models.Business, fromNormalized, fromRaw string, orderID uint, description string) {
	// Always thank the customer first — immediate, warm, unconditional
	botSendText(business, fromRaw, "Thanks for sharing! We love seeing our customers enjoy their orders 🙏😊")

	// Look up the shipped order to link the review to
	var shippedOrder models.Order
	var found bool

	if orderID > 0 {
		// Caller provided a specific order ID
		err := database.DB.Where("id = ? AND business_id = ? AND customer_phone = ? AND status = ?",
			orderID, business.ID, fromNormalized, models.OrderStatusShipped,
		).First(&shippedOrder).Error
		found = (err == nil)
	} else {
		// Auto-lookup: most recent shipped order for this phone
		err := database.DB.Where(
			"business_id = ? AND customer_phone = ? AND status = ?",
			business.ID, fromNormalized, models.OrderStatusShipped,
		).Order("created_at desc").First(&shippedOrder).Error
		found = (err == nil)
	}

	if !found {
		// No shipped order — just the thank-you is enough, no merchant alert needed
		log.Printf("📸 [MediaBridge] Review image from %s — no shipped order found, thank-you only", fromNormalized)
		return
	}

	// Create the IsUnmatched message as the merchant dashboard badge trigger
	// The content includes order number and description so the merchant has context
	content := fmt.Sprintf(
		"[Review image for Order #%d: %s]",
		shippedOrder.BusinessOrderNum, description,
	)
	if err := database.DB.Create(&models.Message{
		BusinessID:  business.ID,
		Phone:       fromNormalized,
		Role:        "user",
		Content:     content,
		IsUnmatched: true, // This is what drives the dashboard badge
	}).Error; err != nil {
		log.Printf("❌ [MediaBridge] Failed to create review IsUnmatched message: %v", err)
		return
	}

	// Alert the merchant (non-blocking)
	go func() {
		reportPhone := business.ReportPhone
		if reportPhone == "" {
			reportPhone = business.Phone
		}
		if reportPhone == "" {
			return
		}
		alert := fmt.Sprintf(
			"📸 *Review Image Received!*\n\n"+
				"Customer: %s\n"+
				"Order: #%d\n"+
				"Image: %s\n\n"+
				"Open your dashboard to mark as Delivered if appropriate.",
			fromNormalized, shippedOrder.BusinessOrderNum, description,
		)
		SendText(business.WAPhoneNumberID, business.WAAccessToken, reportPhone, alert)
	}()

	log.Printf("✅ [MediaBridge] Review bridge: IsUnmatched message created for Order #%d", shippedOrder.BusinessOrderNum)
}

// ─── Upgraded handlePaymentProofImage ────────────────────────────────────────

// handlePaymentProofImage replaces the old single-order-lookup version.
// It uses resolvePaymentOrder to detect multi-order ambiguity and respond
// with a disambiguation list when needed.
func handlePaymentProofImage(business *models.Business, fromNormalized, fromRaw, description string) {
	log.Printf("💳 [MediaBridge] Payment proof from %s — %s", fromNormalized, description)

	result := resolvePaymentOrder(business, fromNormalized)

	// Case: no pending orders
	if result == nil {
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

	// Case: multiple pending orders — ask which one
	if result.Ambiguous {
		log.Printf("⚠️ [MediaBridge] %s has %d pending orders — sending disambiguation", fromNormalized, len(result.Orders))

		// Build the disambiguation buttons (max 3 due to WhatsApp API limit)
		var buttons []Button
		for i, o := range result.Orders {
			if i >= 3 {
				break
			}
			buttons = append(buttons, Button{
				ID:    fmt.Sprintf("proof_order:%d", o.ID),
				Title: fmt.Sprintf("Order #%d — Rs.%.0f", o.BusinessOrderNum, o.TotalPrice),
			})
		}
		botSendButtons(business, fromRaw,
			"✅ *Payment proof received!*\n\nWe found multiple pending orders. Which order is this payment for?",
			buttons,
		)

		// Still log the proof image as unmatched pending disambiguation
		database.DB.Create(&models.Message{
			BusinessID:  business.ID,
			Phone:       fromNormalized,
			Role:        "user",
			Content:     fmt.Sprintf("[Payment proof (pending disambiguation for %d orders): %s]", len(result.Orders), description),
			IsUnmatched: true,
		})
		return
	}

	// Case: single pending order — existing confirmed flow
	pendingOrder := result.Order
	proof := models.OrderPaymentProof{
		BusinessID:    business.ID,
		OrderID:       pendingOrder.ID,
		CustomerPhone: fromNormalized,
		Amount:        pendingOrder.TotalPrice,
		Description:   description,
		Status:        "pending",
	}
	if err := database.DB.Create(&proof).Error; err != nil {
		log.Printf("❌ [MediaBridge] Failed to create OrderPaymentProof: %v", err)
	}

	// Update order payment status
	if err := database.DB.Model(pendingOrder).
		UpdateColumn("payment_status", "awaiting_verification").Error; err != nil {
		log.Printf("❌ [MediaBridge] Failed to update order payment status: %v", err)
	}

	// Log to chat history
	database.DB.Create(&models.Message{
		BusinessID:  business.ID,
		Phone:       fromNormalized,
		Role:        "user",
		Content:     fmt.Sprintf("[Payment proof for Order #%d: %s]", pendingOrder.BusinessOrderNum, description),
		IsUnmatched: true,
	})

	// ACK customer
	botSendText(business, fromRaw, fmt.Sprintf(
		"✅ *Payment proof received for Order #%d!*\n"+
			"Our team will review and confirm your payment. We'll update you shortly. 🙏",
		pendingOrder.BusinessOrderNum))

	// Alert merchant
	go func() {
		reportPhone := business.ReportPhone
		if reportPhone == "" {
			reportPhone = business.Phone
		}
		if reportPhone == "" {
			return
		}
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
	}()

	log.Printf("✅ [MediaBridge] Payment proof #%d for Order #%d — awaiting_verification",
		proof.ID, pendingOrder.BusinessOrderNum)
}
