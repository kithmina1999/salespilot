package services

// late_delivery.go — Cron job: detect shipped orders that haven't been delivered
// after the expected window, and alert the tenant via EMAIL.
//
// WHY EMAIL (not WhatsApp):
//   Late deliveries fire 5+ days after shipping. The business owner almost certainly
//   has NOT sent a message to the WA bot in the last 24h, so any free-form WA message
//   would be rejected by Meta as an outbound-without-template violation.
//   Email (via Resend) has no such restriction and works for all tenants regardless
//   of Meta business verification status.
//
// The FRONTEND Kanban shows a visual orange/red warning badge on shipped cards
// that are >5 days old, so even without email the operator sees the issue at a
// glance when they open the dashboard.
//
// Template-based WA outbound alerts are planned for Phase 5.

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

const lateDeliveryThreshold = 5 * 24 * time.Hour // 5 days

// RunLateDeliveryAlerts finds overdue shipped orders and emails the tenant's admin.
func RunLateDeliveryAlerts() {
	cutoff := time.Now().Add(-lateDeliveryThreshold)

	var orders []models.Order
	database.DB.
		Where("status = ? AND updated_at < ? AND late_alert_sent = ?",
			models.OrderStatusShipped, cutoff, false).
		Find(&orders)

	if len(orders) == 0 {
		return
	}
	log.Printf("⚠️ [LateDelivery] Found %d overdue shipped order(s) — sending email alerts", len(orders))

	for _, order := range orders {
		var business models.Business
		if err := database.DB.First(&business, order.BusinessID).Error; err != nil {
			continue
		}

		// Look up the admin user's email for this business
		var adminUser models.User
		if err := database.DB.
			Where("business_id = ? AND role = ?", order.BusinessID, models.RoleAdmin).
			Order("created_at ASC").
			First(&adminUser).Error; err != nil {
			log.Printf("⚠️ [LateDelivery] No admin user found for business %d — skipping", order.BusinessID)
			continue
		}

		daysLate := int(time.Since(order.UpdatedAt).Hours() / 24)
		customerDisplay := order.CustomerName
		if customerDisplay == "" {
			customerDisplay = order.CustomerPhone
		}

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		err := utils.SendLateDeliveryEmailContext(
			ctx,
			adminUser.Email,
			business.Name,
			int64(order.BusinessOrderNum),
			customerDisplay,
			order.CustomerPhone,
			daysLate,
			order.TotalPrice,
		)
		cancel()
		if err != nil {
			log.Printf("❌ [LateDelivery] Email failed for order #%d: %v", order.BusinessOrderNum, err)
		}

		// Mark so we don't re-alert
		database.DB.Model(&order).Update("late_alert_sent", true)
		log.Printf("✅ [LateDelivery] Alerted %s about order #%d (%d days late)",
			adminUser.Email, order.BusinessOrderNum, daysLate)
	}
}

// IsShippedOrderOverdue returns true if a shipped order has been in that state
// longer than the late delivery threshold. Used by the frontend Kanban to show
// visual warnings — no API call needed, computed from the order timestamp.
// Exported so it can be reused in handlers if needed.
func IsShippedOrderOverdue(updatedAt time.Time) bool {
	return time.Since(updatedAt) > lateDeliveryThreshold
}

// OverdueDaysStr returns a human-readable string like "7 days" for display.
func OverdueDaysStr(updatedAt time.Time) string {
	days := int(time.Since(updatedAt).Hours() / 24)
	return fmt.Sprintf("%d day%s", days, map[bool]string{true: "s", false: ""}[days != 1])
}
