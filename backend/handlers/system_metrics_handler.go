package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// GetSystemMetrics returns platform-wide usage and business statistics
func GetSystemMetrics(c *gin.Context) {
	var totalBusinesses int64
	var freePlanCount int64
	var growthPlanCount int64
	var proPlanCount int64
	var activeTrials int64

	database.DB.Model(&models.Business{}).Count(&totalBusinesses)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanFree).Count(&freePlanCount)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanStarter).Count(&growthPlanCount)
	database.DB.Model(&models.Business{}).Where("plan = ?", models.PlanPro).Count(&proPlanCount)
	database.DB.Model(&models.Business{}).Where("trial_expires_at > DATETIME('now')").Count(&activeTrials)

	// Sum of message usage across all businesses
	type UsageSum struct {
		TotalSystem int `gorm:"column:total_system"`
		TotalAI     int `gorm:"column:total_ai"`
		TotalFaq    int `gorm:"column:total_faq"`
	}
	var usage UsageSum

	database.DB.Model(&models.Business{}).Select("IFNULL(SUM(system_message_count), 0) as total_system, IFNULL(SUM(ai_message_count), 0) as total_ai, IFNULL(SUM(faq_reply_count), 0) as total_faq").Scan(&usage)

	// New businesses in last 30 days
	var newBusinesses30d int64
	database.DB.Model(&models.Business{}).Where("created_at >= DATETIME('now', '-30 days')").Count(&newBusinesses30d)

	c.JSON(http.StatusOK, gin.H{
		"total_businesses":             totalBusinesses,
		"free_plan":                    freePlanCount,
		"active_paid":                  growthPlanCount + proPlanCount,
		"growth_plan":                  growthPlanCount,
		"pro_plan":                     proPlanCount,
		"active_trials":                activeTrials,
		"total_messages_this_month":    usage.TotalSystem,
		"total_ai_messages_this_month": usage.TotalAI,
		"total_faq_replies_this_month": usage.TotalFaq,
		"new_businesses_last_30d":      newBusinesses30d,
	})
}
