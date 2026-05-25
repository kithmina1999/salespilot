package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

type DailyStat struct {
	Date         string `json:"date"`
	AIMessages   int    `json:"ai_messages"`
	UserMessages int    `json:"user_messages"`
}

type TopKnowledgeGap struct {
	ID                     uint      `json:"id"`
	Message                string    `json:"message"` // mapped from raw_message for backward compatibility
	NormalizedMessage      string    `json:"normalized_message"`
	Count                  int       `json:"count"` // mapped from hit_count for backward compatibility
	RouterIntent           string    `json:"router_intent"`
	SuggestedKnowledgeType string    `json:"suggested_knowledge_type"`
	SuggestedAction        string    `json:"suggested_action"`
	SelectedProductID      *uint     `json:"selected_product_id"`
	AIReplyText            string    `json:"ai_reply_text"`
	LastSeenAt             time.Time `json:"last_seen_at"`
}

type DailyRevenue struct {
	Date    string  `json:"date"`
	Revenue float64 `json:"revenue"`
	Orders  int     `json:"orders"`
}

type OrderStatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

// GetDashboardStats aggregates all AI, revenue, order, and customer metrics for the Command Center UI
func GetDashboardStats(c *gin.Context) {
	businessID := c.GetUint("business_id")

	now := time.Now()

	// ── Time windows ─────────────────────────────────────────────────────────
	// Current month
	thisMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	// Previous month
	lastMonthEnd := thisMonthStart.Add(-time.Second)
	lastMonthStart := time.Date(lastMonthEnd.Year(), lastMonthEnd.Month(), 1, 0, 0, 0, 0, now.Location())
	// Today & Yesterday
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.Add(-24 * time.Hour)
	// This week / last week
	thisWeekStart := now.Add(-7 * 24 * time.Hour)
	lastWeekStart := now.Add(-14 * 24 * time.Hour)
	// 30-day window
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	sevenDaysAgo := now.Add(-7 * 24 * time.Hour)

	// ── 1. Total Unique Customers (all time) ─────────────────────────────────
	var totalCustomers int64
	database.DB.Model(&models.Message{}).
		Where("business_id = ?", businessID).
		Distinct("phone").Count(&totalCustomers)

	// ── 2. Business configuration ─────────────────────────────────────────────
	var biz models.Business
	database.DB.First(&biz, businessID)

	// ── 3. Top Unmatched Messages (Knowledge Gaps) ────────────────────────────
	var unmatched []TopKnowledgeGap
	database.DB.Model(&models.KnowledgeGap{}).
		Select("id, raw_message as message, normalized_message, hit_count as count, router_intent, suggested_knowledge_type, suggested_action, selected_product_id, ai_reply_text, last_seen_at").
		Where("business_id = ? AND resolved = ?", businessID, false).
		Order("count DESC").
		Limit(8).
		Scan(&unmatched)

	// ── 4. 7-Day Traffic (existing chart) ─────────────────────────────────────
	var dailyStats []DailyStat
	database.DB.Model(&models.Message{}).
		Select("DATE(created_at) as date, SUM(CASE WHEN role='model' THEN 1 ELSE 0 END) as ai_messages, SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) as user_messages").
		Where("business_id = ? AND created_at >= ?", businessID, sevenDaysAgo).
		Group("DATE(created_at)").
		Order("DATE(created_at) ASC").
		Scan(&dailyStats)

	// ── 5. Products & Rules ───────────────────────────────────────────────────
	var totalProducts, totalRules, noSinhalaCount int64
	database.DB.Model(&models.Product{}).Where("business_id = ?", businessID).Count(&totalProducts)
	database.DB.Model(&models.Rule{}).Where("business_id = ?", businessID).Count(&totalRules)
	database.DB.Model(&models.Rule{}).
		Where("business_id = ? AND is_active = ? AND system_managed = ? AND (sinhala_response IS NULL OR sinhala_response = ?)", businessID, true, false, "").
		Count(&noSinhalaCount)

	// ── 6. Revenue: this month vs last month ──────────────────────────────────
	var revenueThisMonth, revenueLastMonth float64
	database.DB.Model(&models.Order{}).
		Select("COALESCE(SUM(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND status != ?", businessID, thisMonthStart, models.OrderStatusCancelled).
		Scan(&revenueThisMonth)
	database.DB.Model(&models.Order{}).
		Select("COALESCE(SUM(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND created_at < ? AND status != ?", businessID, lastMonthStart, thisMonthStart, models.OrderStatusCancelled).
		Scan(&revenueLastMonth)

	// ── 7. Orders: today vs yesterday ────────────────────────────────────────
	var ordersToday, ordersYesterday, ordersThisMonth, ordersLastMonth int64
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND created_at >= ?", businessID, todayStart).
		Count(&ordersToday)
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", businessID, yesterdayStart, todayStart).
		Count(&ordersYesterday)
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND created_at >= ?", businessID, thisMonthStart).
		Count(&ordersThisMonth)
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Count(&ordersLastMonth)

	// ── 8. Pending orders ─────────────────────────────────────────────────────
	var pendingOrders int64
	database.DB.Model(&models.Order{}).
		Where("business_id = ? AND status = ?", businessID, models.OrderStatusNew).
		Count(&pendingOrders)

	// ── 9. Average order value (this month) ──────────────────────────────────
	var avgOrderValue float64
	database.DB.Model(&models.Order{}).
		Select("COALESCE(AVG(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND status != ?", businessID, thisMonthStart, models.OrderStatusCancelled).
		Scan(&avgOrderValue)

	// ── 10. Orders by status (for donut chart) ───────────────────────────────
	var ordersByStatus []OrderStatusCount
	database.DB.Model(&models.Order{}).
		Select("status, COUNT(*) as count").
		Where("business_id = ? AND created_at >= ?", businessID, thisMonthStart).
		Group("status").
		Scan(&ordersByStatus)

	// ── 11. 30-Day daily revenue + orders (for trend chart) ──────────────────
	var revenueTrend []DailyRevenue
	database.DB.Model(&models.Order{}).
		Select("DATE(created_at) as date, COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as orders").
		Where("business_id = ? AND created_at >= ? AND status != ?", businessID, thirtyDaysAgo, models.OrderStatusCancelled).
		Group("DATE(created_at)").
		Order("DATE(created_at) ASC").
		Scan(&revenueTrend)

	// ── 12. New customers: this week vs last week ─────────────────────────────
	// "New customer" = first ever message from that phone number in the period
	var newCustomersThisWeek, newCustomersLastWeek int64
	database.DB.Model(&models.Message{}).
		Select("COUNT(DISTINCT phone)").
		Where("business_id = ? AND role = 'user' AND created_at >= ?", businessID, thisWeekStart).
		Where("phone NOT IN (SELECT DISTINCT phone FROM messages WHERE business_id = ? AND role = 'user' AND created_at < ?)", businessID, thisWeekStart).
		Scan(&newCustomersThisWeek)

	database.DB.Model(&models.Message{}).
		Select("COUNT(DISTINCT phone)").
		Where("business_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?", businessID, lastWeekStart, thisWeekStart).
		Where("phone NOT IN (SELECT DISTINCT phone FROM messages WHERE business_id = ? AND role = 'user' AND created_at < ?)", businessID, lastWeekStart).
		Scan(&newCustomersLastWeek)

	// New customers this month vs last month (for KPI card % change)
	var newCustThisMonth, newCustLastMonth int64
	database.DB.Model(&models.Message{}).
		Select("COUNT(DISTINCT phone)").
		Where("business_id = ? AND role = 'user' AND created_at >= ?", businessID, thisMonthStart).
		Where("phone NOT IN (SELECT DISTINCT phone FROM messages WHERE business_id = ? AND role = 'user' AND created_at < ?)", businessID, thisMonthStart).
		Scan(&newCustThisMonth)
	database.DB.Model(&models.Message{}).
		Select("COUNT(DISTINCT phone)").
		Where("business_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Where("phone NOT IN (SELECT DISTINCT phone FROM messages WHERE business_id = ? AND role = 'user' AND created_at < ?)", businessID, lastMonthStart).
		Scan(&newCustLastMonth)

	// ── 13. Bot performance metrics ───────────────────────────────────────────
	// Count total user messages and unmatched messages for resolution rate
	var totalUserMsgsNow, totalUserMsgsPrev int64
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'user' AND created_at >= ?", businessID, thisMonthStart).
		Count(&totalUserMsgsNow)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Count(&totalUserMsgsPrev)

	var unmatchedNow, unmatchedPrev int64
	database.DB.Model(&models.KnowledgeGap{}).
		Where("business_id = ? AND created_at >= ?", businessID, thisMonthStart).
		Count(&unmatchedNow)
	database.DB.Model(&models.KnowledgeGap{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Count(&unmatchedPrev)

	// AI resolution rate = (total - unmatched) / total * 100
	aiResolutionRate := 0.0
	aiResolutionRatePrev := 0.0
	if totalUserMsgsNow > 0 {
		aiResolutionRate = float64(totalUserMsgsNow-unmatchedNow) / float64(totalUserMsgsNow) * 100
	}
	if totalUserMsgsPrev > 0 {
		aiResolutionRatePrev = float64(totalUserMsgsPrev-unmatchedPrev) / float64(totalUserMsgsPrev) * 100
	}

	// Bot automation % = AI-sent messages / total messages
	var aiMsgCountNow, aiMsgCountPrev, totalMsgNow, totalMsgPrev int64
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'model' AND created_at >= ?", businessID, thisMonthStart).
		Count(&aiMsgCountNow)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'model' AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Count(&aiMsgCountPrev)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND created_at >= ?", businessID, thisMonthStart).
		Count(&totalMsgNow)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", businessID, lastMonthStart, thisMonthStart).
		Count(&totalMsgPrev)

	botAutomationPct := 0.0
	botAutomationPctPrev := 0.0
	if totalMsgNow > 0 {
		botAutomationPct = float64(aiMsgCountNow) / float64(totalMsgNow) * 100
	}
	if totalMsgPrev > 0 {
		botAutomationPctPrev = float64(aiMsgCountPrev) / float64(totalMsgPrev) * 100
	}

	// ── Customers last month (for % change on total_customers card) ───────
	var totalCustomersLastMonth int64
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND created_at < ?", businessID, thisMonthStart).
		Distinct("phone").Count(&totalCustomersLastMonth)

	activeTrial := biz.IsInActiveTrial()
	ent, err := GetUsageEntitlements(biz, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load plan entitlements"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		// ── Original fields (kept for backward compat) ──
		"total_customers":       totalCustomers,
		"total_products":        totalProducts,
		"total_rules":           totalRules,
		"no_sinhala_coverage":   noSinhalaCount,
		"system_quota_used":     biz.SystemMessageCount,
		"ai_quota_used":         biz.AIMessageCount,
		"plan":                  biz.Plan,
		"active_trial":          activeTrial,
		"rule_generation_count": biz.RuleGenerationCount,
		"rule_generation_limit": ent.MaxRuleGens,
		"top_unmatched":         unmatched,
		"daily_stats":           dailyStats,

		// ── Revenue ──
		"revenue_this_month": revenueThisMonth,
		"revenue_last_month": revenueLastMonth,
		"avg_order_value":    avgOrderValue,

		// ── Orders ──
		"orders_today":      ordersToday,
		"orders_yesterday":  ordersYesterday,
		"orders_this_month": ordersThisMonth,
		"orders_last_month": ordersLastMonth,
		"pending_orders":    pendingOrders,
		"orders_by_status":  ordersByStatus,
		"revenue_daily_30d": revenueTrend,

		// ── Customers ──
		"new_customers_this_week":  newCustomersThisWeek,
		"new_customers_last_week":  newCustomersLastWeek,
		"new_customers_this_month": newCustThisMonth,
		"new_customers_last_month": newCustLastMonth,
		"total_customers_prev":     totalCustomersLastMonth,

		// ── Bot Performance ──
		"ai_resolution_rate":      aiResolutionRate,
		"ai_resolution_rate_prev": aiResolutionRatePrev,
		"bot_automation_pct":      botAutomationPct,
		"bot_automation_pct_prev": botAutomationPctPrev,
	})
}
