package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
	"gorm.io/gorm"
)

type CreateOrderRequest struct {
	CustomerPhone string  `json:"customer_phone" binding:"required"`
	CustomerName  string  `json:"customer_name"`
	Items         string  `json:"items" binding:"required"` // JSON array string
	TotalPrice    float64 `json:"total_price" binding:"required"`
	Address       string  `json:"address"`
	Notes         string  `json:"notes"`
}

type orderPagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

type orderSummary struct {
	NeedsAttention int64 `json:"needs_attention"`
	Active         int64 `json:"active"`
	Completed      int64 `json:"completed"`
	Cancelled      int64 `json:"cancelled"`
	All            int64 `json:"all"`
}

// CreateOrder creates a new order
func CreateOrder(c *gin.Context) {
	businessID := c.GetUint("business_id")
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	order := models.Order{
		BusinessID:    businessID,
		CustomerPhone: req.CustomerPhone,
		CustomerName:  req.CustomerName,
		Items:         req.Items,
		TotalPrice:    req.TotalPrice,
		Status:        models.OrderStatusNew,
		Address:       req.Address,
		Notes:         req.Notes,
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order"})
		return
	}

	// [Trigger] Notify Customer: Order Received
	// In reality, this is usually handled by the Bot in real-time right after generation,
	// but we could send a manual receipt here if we wanted.

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Order created successfully ✅",
		"order_id": order.ID,
		"order":    order,
	})
}

// ListOrders returns paginated orders filtered by queue, status, payment, search,
// and date range. Backward-compatible response fields: orders and count.
// Supports: ?queue=X ?status=X ?payment_status=X ?payment_method=X ?q=X
// ?date=YYYY-MM-DD ?from=YYYY-MM-DD&to=YYYY-MM-DD ?page=1 ?limit=25 ?sort=newest
func ListOrders(c *gin.Context) {
	var orders []models.Order
	page := parsePositiveInt(c.Query("page"), 1)
	limit := parsePositiveInt(c.Query("limit"), 25)
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	base := applyOrderFilters(orderBaseQuery(c), c, true, true)
	var total int64
	if err := base.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count orders"})
		return
	}

	query := applyOrderFilters(orderBaseQuery(c), c, true, true).
		Order(orderSortClause(c.Query("sort"))).
		Offset(offset).
		Limit(limit)

	if err := query.Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(limit)))
	}

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
		"pagination": orderPagination{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
		"summary": buildOrderSummary(c),
	})
}

func orderBaseQuery(c *gin.Context) *gorm.DB {
	db := c.MustGet("db").(*gorm.DB)
	query := db.Session(&gorm.Session{NewDB: true}).Model(&models.Order{})
	if businessID := c.GetUint("business_id"); businessID != 0 {
		query = query.Where("business_id = ?", businessID)
	}
	return query
}

func parsePositiveInt(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func applyOrderFilters(query *gorm.DB, c *gin.Context, includeQueue bool, includeStatus bool) *gorm.DB {
	if status := c.Query("status"); includeStatus && status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if paymentStatus := c.Query("payment_status"); paymentStatus != "" && paymentStatus != "all" {
		query = query.Where("payment_status = ?", paymentStatus)
	}
	if paymentMethod := c.Query("payment_method"); paymentMethod != "" && paymentMethod != "all" {
		query = query.Where("payment_method = ?", paymentMethod)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where(
			"customer_name ILIKE ? OR customer_phone ILIKE ? OR CAST(business_order_num AS TEXT) ILIKE ? OR CAST(id AS TEXT) ILIKE ?",
			like, like, like, like,
		)
	}
	if date := c.Query("date"); date != "" {
		if parsedDate, err := time.Parse("2006-01-02", date); err == nil {
			query = query.Where("created_at >= ? AND created_at < ?", parsedDate, parsedDate.AddDate(0, 0, 1))
		}
	}
	if from := c.Query("from"); from != "" {
		if parsedFrom, err := time.Parse("2006-01-02", from); err == nil {
			query = query.Where("created_at >= ?", parsedFrom)
		}
	}
	if to := c.Query("to"); to != "" {
		if parsedTo, err := time.Parse("2006-01-02", to); err == nil {
			query = query.Where("created_at < ?", parsedTo.AddDate(0, 0, 1))
		}
	}
	if queue := c.Query("queue"); includeQueue && queue != "" && queue != "all" {
		query = applyOrderQueueFilter(query, queue)
	}
	return query
}

func applyOrderQueueFilter(query *gorm.DB, queue string) *gorm.DB {
	switch queue {
	case "needs_attention":
		return query.Where(
			"(payment_method = ? AND payment_status = ?) OR payment_status = ? OR (status = ? AND updated_at <= ?)",
			"bank_transfer",
			"awaiting_verification",
			"rejected",
			models.OrderStatusShipped,
			time.Now().AddDate(0, 0, -5),
		)
	case "active":
		return query.Where("status IN ?", []string{
			models.OrderStatusNew,
			models.OrderStatusConfirmed,
			models.OrderStatusShipped,
		})
	case "completed":
		return query.Where("status = ?", models.OrderStatusDelivered)
	case "cancelled":
		return query.Where("status = ?", models.OrderStatusCancelled)
	default:
		return query
	}
}

func orderSortClause(sort string) string {
	switch sort {
	case "oldest":
		return "created_at ASC"
	case "updated_desc":
		return "updated_at DESC"
	case "updated_asc":
		return "updated_at ASC"
	case "total_desc":
		return "total_price DESC"
	case "total_asc":
		return "total_price ASC"
	default:
		return "created_at DESC"
	}
}

func buildOrderSummary(c *gin.Context) orderSummary {
	summaryBase := func() *gorm.DB { return applyOrderFilters(orderBaseQuery(c), c, false, false) }
	summary := orderSummary{}
	summaryBase().Count(&summary.All)
	applyOrderQueueFilter(summaryBase(), "needs_attention").Count(&summary.NeedsAttention)
	applyOrderQueueFilter(summaryBase(), "active").Count(&summary.Active)
	applyOrderQueueFilter(summaryBase(), "completed").Count(&summary.Completed)
	applyOrderQueueFilter(summaryBase(), "cancelled").Count(&summary.Cancelled)
	return summary
}

// GetOrdersByCustomer returns all orders for a specific customer phone
func GetOrdersByCustomer(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	var orders []models.Order
	if err := database.DB.Where("business_id = ? AND customer_phone = ?", businessID, phone).Order("created_at DESC").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders, "count": len(orders), "customer_phone": phone})
}

// ToggleLateAlert enables or disables the automatic late-delivery cron alert for an order.
// PATCH /api/v1/orders/:id/late-alert  {"enabled": true/false}
//
//	enabled=true  → reset late_alert_sent to false  (cron will send alert if overdue)
//	enabled=false → set  late_alert_sent to true   (suppress future alerts for this order)
func ToggleLateAlert(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	var order models.Order
	if err := db.Where("id = ?", id).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	db.Model(&order).Update("late_alert_sent", !req.Enabled)
	db.Where("id = ?", id).First(&order)
	c.JSON(http.StatusOK, gin.H{
		"message":         "Late delivery alert updated",
		"late_alert_sent": order.LateAlertSent,
		"alert_enabled":   !order.LateAlertSent,
	})
}

// UpdateOrderStatus updates the status of an order and optional logistics fields
func UpdateOrderStatus(c *gin.Context) {
	businessID := c.GetUint("business_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var req struct {
		Status         string `json:"status" binding:"required"`
		TrackingNumber string `json:"tracking_number"`
		CancelReason   string `json:"cancel_reason"`
		PaymentStatus  string `json:"payment_status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status is required"})
		return
	}

	// Validate status
	validStatuses := map[string]bool{
		models.OrderStatusNew: true, models.OrderStatusConfirmed: true,
		models.OrderStatusShipped: true, models.OrderStatusDelivered: true,
		models.OrderStatusCancelled: true,
	}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}

	var order models.Order
	db := c.MustGet("db").(*gorm.DB)
	if err := db.Where("id = ?", id).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	oldStatus := order.Status

	// Build update map with all provided fields
	updates := map[string]interface{}{"status": req.Status}
	if req.TrackingNumber != "" {
		updates["tracking_number"] = req.TrackingNumber
	}
	if req.CancelReason != "" {
		updates["cancel_reason"] = req.CancelReason
	}
	if req.PaymentStatus != "" {
		updates["payment_status"] = req.PaymentStatus
	}
	db.Model(&order).Updates(updates)

	// Fetch business for WhatsApp notifications
	var business models.Business
	if err := database.DB.First(&business, businessID).Error; err == nil {
		if business.WAPhoneNumberID != "" && business.WAAccessToken != "" {
			msgText := ""
			switch req.Status {
			case models.OrderStatusConfirmed:
				msgText = fmt.Sprintf("✅ *Order Confirmed!*\nHi %s, your order #%d has been confirmed! We'll process it shortly.", order.CustomerName, order.BusinessOrderNum)
			case models.OrderStatusShipped:
				track := ""
				if req.TrackingNumber != "" {
					track = fmt.Sprintf("\n📦 Tracking: %s", req.TrackingNumber)
				}
				msgText = fmt.Sprintf("🚚 *Order Shipped!*\nGreat news %s, your order #%d is on its way! Expected in 2–4 days.%s", order.CustomerName, order.BusinessOrderNum, track)
			case models.OrderStatusDelivered:
				msgText = fmt.Sprintf("🎁 *Order Delivered!*\nHope you love it, %s! Let us know if everything arrived safely. 😊", order.CustomerName)
			case models.OrderStatusCancelled:
				reason := ""
				if req.CancelReason != "" {
					reason = fmt.Sprintf("\nReason: %s", req.CancelReason)
				}
				msgText = fmt.Sprintf("❌ *Order Cancelled*\nHi %s, your order #%d has been cancelled.%s", order.CustomerName, order.BusinessOrderNum, reason)
			}
			if msgText != "" {
				cleanPhone := order.CustomerPhone
				if len(cleanPhone) > 0 && cleanPhone[0] == '+' {
					cleanPhone = cleanPhone[1:]
				}
				go whatsapp.SendText(business.WAPhoneNumberID, business.WAAccessToken, cleanPhone, msgText)
			}
		}
	}

	LogActivity(businessID, "user", c.GetUint("user_id"), "order_status_updated", "order", strconv.FormatUint(id, 10), map[string]interface{}{
		"old_status": oldStatus, "new_status": req.Status,
	}, c.ClientIP(), "low", business.Name, business.Plan)

	db.Where("id = ?", id).First(&order)
	c.JSON(http.StatusOK, gin.H{"message": "Order updated ✅", "order": order})
}
