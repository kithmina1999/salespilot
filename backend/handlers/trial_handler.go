package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
)

// POST /api/v1/billing/trial/start
// Starts a 14-day AI trial for a free plan business.
// Idempotent: does nothing if a trial has already been started.
func StartTrial(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	// Idempotency: don't restart an existing trial
	if biz.TrialExpiresAt != nil {
		c.JSON(http.StatusOK, gin.H{
			"trial_started": false,
			"message":       "Trial already active or previously used",
			"expires_at":    biz.TrialExpiresAt,
		})
		return
	}

	// Only free plan businesses can start a trial
	if biz.Plan != models.PlanFree {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Trial is only available on the Free plan",
		})
		return
	}

	settings, err := platform.GetBillingSettings(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trial settings"})
		return
	}
	ent, err := platform.GetPlanEntitlements(database.DB, settings.TrialPlanKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load trial entitlements"})
		return
	}
	now := time.Now()
	expiresAt := now.AddDate(0, 0, settings.TrialDays)

	database.DB.Model(&biz).Updates(map[string]interface{}{
		"trial_expires_at": expiresAt,
		"ai_message_limit": ent.MaxAIMessages,
		"simulation_limit": ent.MaxSimulations,
	})

	LogActivity(biz.ID, "system", 0, "trial_started", "billing", "14_day_ai_trial",
		map[string]interface{}{
			"expires_at": expiresAt,
			"ai_limit":   ent.MaxAIMessages,
		}, c.ClientIP(), "low", biz.Name, models.PlanFree)

	log.Printf("✨ 14-Day AI Trial started for Business %d — Expires %s (AI limit: %d)",
		biz.ID, expiresAt.Format("2006-01-02"), ent.MaxAIMessages)

	c.JSON(http.StatusOK, gin.H{
		"trial_started": true,
		"message":       "Your AI trial has started.",
		"expires_at":    expiresAt,
		"ai_limit":      ent.MaxAIMessages,
		"trial_days":    settings.TrialDays,
	})
}
