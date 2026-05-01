package services

// payment_cleanup.go — Slice 5: "The Automated Cleanup"
//
// CancelStaleTransferOrders finds bank-transfer orders that have been sitting
// unpaid beyond the 72-hour window and auto-cancels them.
//
// Cancellation criteria (ALL must be true):
//   - payment_method = 'bank_transfer'
//   - payment_status IN ('pending', 'rejected')   — NOT awaiting_verification or approved
//   - status NOT IN ('cancelled', 'delivered')     — not already resolved
//   - created_at < NOW() - 72h                     — past the grace window
//
// On cancel:
//   - Order.Status        → "cancelled"
//   - Order.PaymentStatus → "cancelled"
//   - Order.CancelReason  → "Auto-cancelled: payment not received within 72 hours"
//   - Customer notified via WhatsApp (best-effort)

import (
	"fmt"
	"log"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

const (
	stalePaymentWindow = 72 * time.Hour
	autoCancelReason   = "Auto-cancelled: payment not received within 72 hours"
)

// CancelStaleTransferOrders is idempotent and safe to call on any schedule.
func CancelStaleTransferOrders() {
	cutoff := time.Now().Add(-stalePaymentWindow)
	log.Printf("🧹 [PaymentCleanup] Scanning for stale bank-transfer orders older than %v (cutoff: %v)",
		stalePaymentWindow, cutoff.Format("2006-01-02 15:04"))

	var orders []models.Order
	if err := database.DB.
		Where(`payment_method = 'bank_transfer'
			AND payment_status IN ('pending', 'rejected')
			AND status NOT IN ('cancelled', 'delivered')
			AND created_at < ?`, cutoff).
		Find(&orders).Error; err != nil {
		log.Printf("❌ [PaymentCleanup] DB query failed: %v", err)
		return
	}

	if len(orders) == 0 {
		log.Println("✅ [PaymentCleanup] No stale bank-transfer orders found")
		return
	}

	log.Printf("⚠️  [PaymentCleanup] Found %d stale orders — cancelling...", len(orders))

	for i := range orders {
		order := &orders[i]

		if err := database.DB.Model(order).Updates(map[string]interface{}{
			"status":         models.OrderStatusCancelled,
			"payment_status": "cancelled",
			"cancel_reason":  autoCancelReason,
		}).Error; err != nil {
			log.Printf("❌ [PaymentCleanup] Failed to cancel order #%d: %v", order.BusinessOrderNum, err)
			continue
		}

		log.Printf("✅ [PaymentCleanup] Auto-cancelled order #%d (biz=%d, customer=%s)",
			order.BusinessOrderNum, order.BusinessID, order.CustomerPhone)

		// Notify customer via WhatsApp — best-effort, non-blocking
		go notifyStaleOrderCancelled(order)
	}
}

// notifyStaleOrderCancelled sends a cancellation WhatsApp message to the customer.
// Failures are logged but never propagated — the cancellation itself already succeeded.
func notifyStaleOrderCancelled(order *models.Order) {
	var business models.Business
	if err := database.DB.First(&business, order.BusinessID).Error; err != nil {
		log.Printf("⚠️ [PaymentCleanup] Business %d not found for notification: %v", order.BusinessID, err)
		return
	}
	if business.WAPhoneNumberID == "" || business.WAAccessToken == "" {
		return // business not connected to WhatsApp
	}

	name := order.CustomerName
	if name == "" {
		name = "there"
	}

	msg := fmt.Sprintf(
		"⏰ *Order #%d Cancelled*\n\n"+
			"Hi %s, your order (Rs. %.0f) has been automatically cancelled because "+
			"we didn't receive payment confirmation within 72 hours.\n\n"+
			"If you'd like to reorder, just send us a message anytime! 😊",
		order.BusinessOrderNum, name, order.TotalPrice,
	)

	customerPhone := order.CustomerPhone
	if len(customerPhone) > 0 && customerPhone[0] == '+' {
		customerPhone = customerPhone[1:]
	}

	if err := whatsapp.SendText(business.WAPhoneNumberID, business.WAAccessToken, customerPhone, msg); err != nil {
		log.Printf("⚠️ [PaymentCleanup] Failed to notify customer %s: %v", order.CustomerPhone, err)
	}
}
