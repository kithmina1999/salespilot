package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
)

type UsageEntitlements = platform.UsageEntitlements

func GetUsageEntitlements(biz models.Business, now time.Time) (UsageEntitlements, error) {
	return platform.GetBusinessEntitlements(database.DB, biz, now)
}

func GetUsageStats(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business profile not found"})
		return
	}

	var productCount int64
	database.DB.Model(&models.Product{}).Where("business_id = ?", businessID).Count(&productCount)

	var ruleCount int64
	database.DB.Model(&models.Rule{}).Where("business_id = ?", businessID).Count(&ruleCount)

	ent, err := GetUsageEntitlements(biz, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load plan entitlements"})
		return
	}
	plans, err := platform.GetPlans(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load plan catalog"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"plan":                  biz.Plan,
		"active_trial":          ent.ActiveTrial,
		"trial_expires_at":      biz.TrialExpiresAt,
		"plan_expires_at":       biz.PlanExpiresAt,
		"products_used":         productCount,
		"products_limit":        ent.MaxProducts,
		"rules_used":            ruleCount,
		"rules_limit":           ent.MaxRules,
		"faq_replies_used":      biz.FaqReplyCount,
		"ai_messages_used":      biz.AIMessageCount,
		"ai_messages_limit":     ent.MaxAIMessages,
		"rule_generation_count": biz.RuleGenerationCount,
		"rule_generation_limit": ent.MaxRuleGens,
		"system_messages_used":  biz.SystemMessageCount,
		"system_messages_limit": ent.MaxSystemMessages,
		"storage_used_bytes":    biz.TotalStorageUsed,
		"storage_limit_bytes":   ent.MaxStorageBytes,
		"max_file_size_bytes":   ent.MaxFileSizeBytes,
		"features": gin.H{
			"cloudinary":      ent.CanUploadCloudinary,
			"whatsapp_images": ent.CanSendWhatsAppImages,
			"gemini_vision":   ent.CanUseGeminiVision,
		},
		"plan_limits": platform.PlanLimitsResponse(plans),
	})
}
