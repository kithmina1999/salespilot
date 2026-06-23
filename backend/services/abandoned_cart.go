package services

// abandoned_cart.go — Cron job: send WhatsApp reminder to customers with stale carts.
//
// Runs every hour. Finds carts that:
//  - Are NOT placed/abandoned
//  - Were last updated > 2 hours ago (customer went silent)
//  - Haven't had a reminder sent yet
//
// Sends one WA nudge, marks remind_sent, then marks the cart as abandoned
// so the slot is freed and the customer can start fresh.

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// RunAbandonedCartReminders finds stale carts and sends a single WA nudge.
func RunAbandonedCartReminders() {
	cutoff := time.Now().Add(-2 * time.Hour) // carts idle for > 2h

	var carts []models.Cart
	database.DB.
		Where("state NOT IN ? AND updated_at < ? AND abandon_reminder_sent = ? AND expires_at > ?",
			[]string{models.CartStatePlaced, models.CartStateAbandoned},
			cutoff,
			false,
			time.Now(),
		).
		Preload(""). // no associations, just the struct
		Find(&carts)

	if len(carts) == 0 {
		return
	}
	log.Printf("🛒 [AbandonedCart] Found %d stale cart(s) — sending reminders", len(carts))

	for _, cart := range carts {
		var business models.Business
		if err := database.DB.First(&business, cart.BusinessID).Error; err != nil {
			continue
		}
		if business.WAPhoneNumberID == "" || business.WAAccessToken == "" {
			continue
		}
		accessToken, err := whatsappAccessTokenForBusiness(business)
		if err != nil {
			log.Printf("failed to decrypt abandoned-cart WhatsApp token for business %d: %v", business.ID, err)
			continue
		}

		// Build a context-aware nudge based on cart state
		msg := buildCartReminderMsg(&business, &cart)
		if msg == "" {
			continue
		}

		// Send the reminder
		whatsapp.SendText(business.WAPhoneNumberID, accessToken, cart.Phone, msg)
		log.Printf("📩 [AbandonedCart] Sent reminder to %s (cart %d, state=%s)", cart.Phone, cart.ID, cart.State)

		// Mark reminder sent + abandon the cart
		database.DB.Model(&cart).Updates(map[string]interface{}{
			"abandon_reminder_sent": true,
			"state":                 models.CartStateAbandoned,
			"expires_at":            time.Now(),
		})
	}
}

// buildCartReminderMsg returns a personalised WA message based on how far
// the customer got in the checkout flow.
func buildCartReminderMsg(business *models.Business, cart *models.Cart) string {
	switch cart.State {
	case models.CartStateBrowsing, models.CartStateItemSelected:
		return fmt.Sprintf(
			"👋 Hey! You were browsing *%s* a while back. Tap below to continue:\n\n🛍️ Browse products: reply *order*\n\nWe'd love to help you find what you need! 😊",
			business.Name,
		)
	case models.CartStatePendingSize, models.CartStatePendingQty:
		name := cart.PendingProductName
		if name == "" {
			name = "your item"
		}
		return fmt.Sprintf(
			"🛒 You left *%s* in your cart (%s). Want to finish your order?\n\nReply *order* to pick up where you left off! 🙌",
			name, business.Name,
		)
	case models.CartStateAddMore, models.CartStatePendingAddress,
		models.CartStatePendingNotes, models.CartStatePendingConfirm:
		// Customer got further — show their cart total
		var items []models.CartItem
		json.Unmarshal([]byte(cart.Items), &items) //nolint:errcheck
		total := cart.TotalPrice
		if total == 0 {
			for _, it := range items {
				total += it.Subtotal
			}
		}
		totalStr := fmt.Sprintf("Rs. %.0f", total)
		return fmt.Sprintf(
			"⏰ Your cart at *%s* is waiting!\n\n💰 Total: *%s*\n📍 Just needs your delivery address to confirm.\n\nReply *checkout* to complete your order 🚀",
			business.Name, totalStr,
		)
	}
	return ""
}
