package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
)

// GetSystemMetrics returns platform-wide Tier 1 usage and business statistics
func GetSystemMetrics(c *gin.Context) {
	var totalBusinesses, freePlanCount, starterPlanCount, proPlanCount, activeTrials, expiredPlans int64
	var waConnected, waDisconnected, waNotConnected int64
	var nearAiLimit, nearSimLimit, expiredPaid int64
	var pendingPayments, suspendedTenants int64

	// Business Plan & Status
	database.DB.Model(&models.Business{}).Count(&totalBusinesses)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanFree).Count(&freePlanCount)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanStarter).Count(&starterPlanCount)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanPro).Count(&proPlanCount)
	database.DB.Model(&models.Business{}).Where("trial_expires_at > ?", time.Now()).Count(&activeTrials)
	database.DB.Model(&models.Business{}).Where("plan != ? AND plan_expires_at < ?", models.PlanFree, time.Now()).Count(&expiredPlans)

	// WhatsApp status must use the same effective rules as tenant-facing UI.
	var waBusinesses []models.Business
	if err := database.DB.Select("wa_status", "wa_phone_number_id", "wa_access_token").Find(&waBusinesses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load WhatsApp status metrics"})
		return
	}
	for _, business := range waBusinesses {
		switch effectiveWAStatus(business) {
		case waStatusConnected:
			waConnected++
		case waStatusDisconnected:
			waDisconnected++
		default:
			waNotConnected++
		}
	}

	// Global Usage
	type UsageSum struct {
		TotalSystem     int `gorm:"column:total_system"`
		TotalAI         int `gorm:"column:total_ai"`
		TotalFaq        int `gorm:"column:total_faq"`
		TotalRuleGen    int `gorm:"column:total_rule_gen"`
		TotalSimulation int `gorm:"column:total_sim"`
	}
	var usage UsageSum
	database.DB.Model(&models.Business{}).Select("COALESCE(SUM(system_message_count), 0) as total_system, COALESCE(SUM(ai_message_count), 0) as total_ai, COALESCE(SUM(faq_reply_count), 0) as total_faq, COALESCE(SUM(rule_generation_count), 0) as total_rule_gen, COALESCE(SUM(simulation_count), 0) as total_sim").Scan(&usage)

	// Risk Alerts & Action Queue
	database.DB.Model(&models.Business{}).Where("ai_message_limit > 0 AND CAST(ai_message_count AS FLOAT) / CAST(ai_message_limit AS FLOAT) >= 0.8").Count(&nearAiLimit)
	database.DB.Model(&models.Business{}).Where("simulation_limit > 0 AND CAST(simulation_count AS FLOAT) / CAST(simulation_limit AS FLOAT) >= 0.8").Count(&nearSimLimit)
	database.DB.Model(&models.Business{}).Where("plan != ? AND plan_expires_at < ?", models.PlanFree, time.Now()).Count(&expiredPaid)
	database.DB.Model(&models.PaymentProof{}).Where("status = ?", models.PaymentStatusPending).Count(&pendingPayments)
	database.DB.Model(&models.Business{}).Where("suspended_at IS NOT NULL").Count(&suspendedTenants)

	pricing, err := platform.PublicPricing(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load pricing"})
		return
	}
	mrr := int64(0)
	if planPricing, ok := pricing[models.PlanStarter]; ok {
		mrr += int64(planPricing[models.BillingMonthly]) * starterPlanCount
	}
	if planPricing, ok := pricing[models.PlanPro]; ok {
		mrr += int64(planPricing[models.BillingMonthly]) * proPlanCount
	}
	arr := mrr * 12

	c.JSON(http.StatusOK, gin.H{
		"businesses": gin.H{
			"total":         totalBusinesses,
			"free":          freePlanCount,
			"starter":       starterPlanCount,
			"pro":           proPlanCount,
			"active_trials": activeTrials,
			"expired_plans": expiredPlans,
		},
		"whatsapp": gin.H{
			"connected":     waConnected,
			"disconnected":  waDisconnected,
			"not_connected": waNotConnected,
		},
		"usage": gin.H{
			"ai_messages":         usage.TotalAI,
			"faq_replies":         usage.TotalFaq,
			"system_messages":     usage.TotalSystem,
			"rule_generations":    usage.TotalRuleGen,
			"simulation_messages": usage.TotalSimulation,
		},
		"revenue": gin.H{
			"estimated_mrr": mrr,
			"estimated_arr": arr,
			"currency":      "LKR",
			"is_estimate":   true,
		},
		"risk": gin.H{
			"near_ai_limit_count":         nearAiLimit,
			"near_simulation_limit_count": nearSimLimit,
			"expired_paid_count":          expiredPaid,
		},
		"action_queue": gin.H{
			"pending_payments":      pendingPayments,
			"expired_paid_plans":    expiredPaid,
			"near_quota_tenants":    nearAiLimit + nearSimLimit,
			"disconnected_whatsapp": waDisconnected,
			"suspended_tenants":     suspendedTenants,
		},
	})
}
