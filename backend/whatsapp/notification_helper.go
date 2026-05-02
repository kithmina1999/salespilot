package whatsapp

// notification_helper.go — S4: Notification Enhancement
//
// Pure builder functions + thin DB write helper for merchant-facing in-app events.
// Two event types are produced by the pipeline:
//   - "new_order"     — order finalized in finalizeOrder()
//   - "payment_proof" — bank-transfer screenshot received in handlePaymentProofImage()
//
// Design decisions:
//   - Builders are pure (no DB, no side-effects) → trivial to test
//   - createNotification() is the only function with a DB side-effect
//   - Always called in a goroutine so it never blocks the customer-facing reply

import (
	"fmt"
	"log"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// buildOrderNotification returns an unread Notification for a newly placed order.
// Falls back to phone when customerName is empty (first-time buyers may have no profile yet).
func buildOrderNotification(businessID uint, orderNum int, customerName, phone string, total float64) models.Notification {
	label := customerName
	if label == "" {
		label = phone
	}
	return models.Notification{
		BusinessID: businessID,
		Type:       "new_order",
		Title:      fmt.Sprintf("🛒 New Order #%d", orderNum),
		Body:       fmt.Sprintf("From %s · Rs. %.0f", label, total),
		IsRead:     false,
	}
}

// buildProofNotification returns an unread Notification when a customer submits
// a payment screenshot for a bank-transfer order.
func buildProofNotification(businessID, proofID uint, orderNum int, phone string, amount float64) models.Notification {
	return models.Notification{
		BusinessID: businessID,
		Type:       "payment_proof",
		Title:      fmt.Sprintf("💳 Payment Proof — Order #%d", orderNum),
		Body:       fmt.Sprintf("From %s · Rs. %.0f · Awaiting review", phone, amount),
		RefID:      proofID,
		IsRead:     false,
	}
}

// createNotification persists a Notification record.
// Intended to be called with `go createNotification(...)` so it never blocks.
func createNotification(n models.Notification) {
	if err := database.DB.Create(&n).Error; err != nil {
		log.Printf("⚠️ [Notif] Failed to create notification type=%s biz=%d: %v", n.Type, n.BusinessID, err)
	}
}
