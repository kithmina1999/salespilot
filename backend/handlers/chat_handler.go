package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// ListChats returns a unique list of phone numbers that have conversed with the bot, including the latest message and status.
func ListChats(c *gin.Context) {
	businessID := c.GetUint("business_id")

	// We need to get the latest message for every distinct phone number for this business.
	// We can use a raw SQL query with row_number() or simply fetch distinct phones and then their latest message.

	type ChatSummary struct {
		Phone          string `json:"phone"`
		LatestMessage  string `json:"latest_message"`
		MessageTime    string `json:"message_time"`
		Status         string `json:"status"`
		CustomerName   string `json:"customer_name"`
		UnmatchedCount int    `json:"unmatched_count"`
		UnreadCount    int    `json:"unread_count"`
	}

	var summaries []ChatSummary

	query := `
		SELECT 
			m.phone, 
			(SELECT content FROM messages WHERE phone = m.phone AND business_id = m.business_id ORDER BY created_at DESC LIMIT 1) as latest_message,
			(SELECT created_at FROM messages WHERE phone = m.phone AND business_id = m.business_id ORDER BY created_at DESC LIMIT 1) as message_time,
			(SELECT status FROM messages WHERE phone = m.phone AND business_id = m.business_id ORDER BY created_at DESC LIMIT 1) as status,
			(SELECT COUNT(*) FROM messages WHERE phone = m.phone AND business_id = m.business_id AND is_unmatched = true) as unmatched_count,
			(
				SELECT COUNT(*) FROM messages msg
				LEFT JOIN customers cust ON msg.phone = cust.phone AND msg.business_id = cust.business_id
				WHERE msg.phone = m.phone AND msg.business_id = m.business_id
				  AND msg.role = 'user' AND msg.is_read = false
				  AND cust.bot_paused = true
			) as unread_count,
			c.name as customer_name
		FROM messages m
		LEFT JOIN customers c ON m.phone = c.phone AND m.business_id = c.business_id
		WHERE m.business_id = ? AND m.deleted_at IS NULL
		GROUP BY m.phone, m.business_id, c.name
		ORDER BY message_time DESC
	`

	if err := database.DB.Raw(query, businessID).Scan(&summaries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat list"})
		return
	}

	c.JSON(http.StatusOK, summaries)
}

// GetChatProfile returns the full chat log, the customer profile, and the order history for a single phone number.
func GetChatProfile(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	// 1. Get all messages
	var messages []models.Message
	if err := database.DB.Where("business_id = ? AND phone = ?", businessID, phone).Order("created_at ASC").Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	// 2. Auto-mark all unread user messages as read (merchant opened the chat)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND phone = ? AND role = 'user' AND is_read = false", businessID, phone).
		Update("is_read", true)

	// 3. Get customer profile (might be empty if they never placed an order or we never upserted them)
	var customer models.Customer
	database.DB.Where("business_id = ? AND phone = ?", businessID, phone).First(&customer)

	// 4. Get order history
	var orders []models.Order
	database.DB.Where("business_id = ? AND customer_phone = ?", businessID, phone).Order("created_at DESC").Find(&orders)

	// Build the response payload
	c.JSON(http.StatusOK, gin.H{
		"messages": messages,
		"customer": customer, // If ID is 0, it means no profile exists yet
		"orders":   orders,
	})
}

// GetNotifications returns a lightweight unread message summary for global polling.
// Only counts messages from customers where the bot is currently PAUSED —
// because those are the only conversations that need manual merchant attention.
// Single-query implementation: COUNT, COUNT DISTINCT, and latest preview in one DB round-trip.
func GetNotifications(c *gin.Context) {
	businessID := c.GetUint("business_id")

	type NotifResult struct {
		TotalUnread   int64  `json:"total_unread"`
		UnreadThreads int64  `json:"unread_threads"`
		MessageID     uint   `json:"message_id"`
		Phone         string `json:"phone"`
		Preview       string `json:"preview"`
		CustomerName  string `json:"customer_name"`
	}

	var result NotifResult

	// One DB round-trip: aggregate counts + latest preview subqueries
	database.DB.Raw(`
		SELECT
			COUNT(m.id)             AS total_unread,
			COUNT(DISTINCT m.phone) AS unread_threads,
			(
				SELECT m2.id FROM messages m2
				INNER JOIN customers c2 ON m2.phone = c2.phone AND m2.business_id = c2.business_id
				WHERE m2.business_id = ? AND m2.role = 'user' AND m2.is_read = false AND m2.deleted_at IS NULL
				  AND c2.bot_paused = true AND (c2.bot_paused_until IS NULL OR c2.bot_paused_until > NOW())
				ORDER BY m2.created_at DESC LIMIT 1
			) AS message_id,
			(
				SELECT m2.phone FROM messages m2
				INNER JOIN customers c2 ON m2.phone = c2.phone AND m2.business_id = c2.business_id
				WHERE m2.business_id = ? AND m2.role = 'user' AND m2.is_read = false AND m2.deleted_at IS NULL
				  AND c2.bot_paused = true AND (c2.bot_paused_until IS NULL OR c2.bot_paused_until > NOW())
				ORDER BY m2.created_at DESC LIMIT 1
			) AS phone,
			(
				SELECT m2.content FROM messages m2
				INNER JOIN customers c2 ON m2.phone = c2.phone AND m2.business_id = c2.business_id
				WHERE m2.business_id = ? AND m2.role = 'user' AND m2.is_read = false AND m2.deleted_at IS NULL
				  AND c2.bot_paused = true AND (c2.bot_paused_until IS NULL OR c2.bot_paused_until > NOW())
				ORDER BY m2.created_at DESC LIMIT 1
			) AS preview,
			(
				SELECT c2.name FROM messages m2
				INNER JOIN customers c2 ON m2.phone = c2.phone AND m2.business_id = c2.business_id
				WHERE m2.business_id = ? AND m2.role = 'user' AND m2.is_read = false AND m2.deleted_at IS NULL
				  AND c2.bot_paused = true AND (c2.bot_paused_until IS NULL OR c2.bot_paused_until > NOW())
				ORDER BY m2.created_at DESC LIMIT 1
			) AS customer_name
		FROM messages m
		INNER JOIN customers c ON m.phone = c.phone AND m.business_id = c.business_id
		WHERE m.business_id = ? AND m.role = 'user' AND m.is_read = false AND m.deleted_at IS NULL
		  AND c.bot_paused = true AND (c.bot_paused_until IS NULL OR c.bot_paused_until > NOW())
	`, businessID, businessID, businessID, businessID, businessID).Scan(&result)

	// Build the latest object only when there are actual unread messages
	type NotifLatest struct {
		MessageID    uint   `json:"message_id"`
		Phone        string `json:"phone"`
		Preview      string `json:"preview"`
		CustomerName string `json:"customer_name"`
	}

	var latest *NotifLatest
	if result.MessageID > 0 {
		latest = &NotifLatest{
			MessageID:    result.MessageID,
			Phone:        result.Phone,
			Preview:      result.Preview,
			CustomerName: result.CustomerName,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total_unread":   result.TotalUnread,
		"unread_threads": result.UnreadThreads,
		"latest":         latest,
	})
}

// SendManualReply allows merchants to override the bot and send a manual message from the dashboard
func SendManualReply(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message content is required"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authenticate business"})
		return
	}

	// 1. Check if Meta API credentials exist
	if biz.WAPhoneNumberID == "" || biz.WAAccessToken == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "WhatsApp bot is offline. Reconnect from the dashboard."})
		return
	}

	// 2. Format Phone Number
	var customer models.Customer
	database.DB.Where("business_id = ? AND phone = ?", businessID, phone).First(&customer)

	cleanPhone := strings.TrimPrefix(phone, "+")

	// 3. Send Message
	err := whatsapp.SendText(biz.WAPhoneNumberID, biz.WAAccessToken, cleanPhone, req.Message)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send WhatsApp message: " + err.Error()})
		return
	}

	// 4. Save to DB with Role: "merchant"
	dbMsg := models.Message{
		BusinessID:  businessID,
		Phone:       phone,
		Role:        "merchant",
		Content:     req.Message,
		Status:      "resolved",
		IsUnmatched: false,
	}
	database.DB.Create(&dbMsg)

	// 5. Clear Unmatched Badges & update previous messages
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND phone = ? AND is_unmatched = true", businessID, phone).
		Update("is_unmatched", false)

	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND phone = ? AND status = 'needs_attention'", businessID, phone).
		Update("status", "resolved")

	// Resolve any pending unmatched messages in the fallback queue
	database.DB.Model(&models.UnmatchedMessage{}).
		Where("business_id = ? AND phone = ? AND status = ?", businessID, phone, "pending").
		Update("status", "resolved")

	c.JSON(http.StatusOK, gin.H{
		"message": "Manual reply sent",
		"data":    dbMsg,
	})
}
