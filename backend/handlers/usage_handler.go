package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

type usageEntitlements struct {
	ActiveTrial           bool
	MaxProducts           int
	MaxRules              int
	MaxAIMessages         int
	MaxSystemMessages     int
	MaxRuleGens           int
	MaxStorageBytes       int64
	CanUploadCloudinary   bool
	CanSendWhatsAppImages bool
	CanUseGeminiVision    bool
}

func getUsageEntitlements(biz models.Business, now time.Time) usageEntitlements {
	ent := usageEntitlements{
		MaxProducts:       models.FreeProductLimit,
		MaxRules:          models.FreeRuleLimit,
		MaxAIMessages:     models.FreeAILimit,
		MaxSystemMessages: models.FreeMsgLimit,
		MaxRuleGens:       models.FreeRuleGenLimit,
		MaxStorageBytes:   0,
	}

	switch biz.Plan {
	case models.PlanStarter:
		ent.MaxProducts = 100
		ent.MaxRules = -1
		ent.MaxAIMessages = models.StarterAILimit
		ent.MaxSystemMessages = -1
		ent.MaxRuleGens = models.StarterRuleGenLimit
		ent.MaxStorageBytes = 500 * 1024 * 1024
		ent.CanUploadCloudinary = true
		ent.CanSendWhatsAppImages = true
		return ent
	case models.PlanPro:
		ent.MaxProducts = -1
		ent.MaxRules = -1
		ent.MaxAIMessages = models.ProAILimit
		ent.MaxSystemMessages = -1
		ent.MaxRuleGens = models.ProRuleGenLimit
		ent.MaxStorageBytes = 1024 * 1024 * 1024
		ent.CanUploadCloudinary = true
		ent.CanSendWhatsAppImages = true
		ent.CanUseGeminiVision = true
		return ent
	}

	if biz.TrialExpiresAt != nil && biz.TrialExpiresAt.After(now) {
		ent.ActiveTrial = true
		ent.MaxProducts = 50
		ent.MaxRules = models.TrialRuleLimit
		ent.MaxAIMessages = models.TrialAILimit
		ent.MaxSystemMessages = models.TrialMsgLimit
		ent.MaxRuleGens = models.StarterRuleGenLimit
	}

	return ent
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

	ent := getUsageEntitlements(biz, time.Now())

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
		"features": gin.H{
			"cloudinary":      ent.CanUploadCloudinary,
			"whatsapp_images": ent.CanSendWhatsAppImages,
			"gemini_vision":   ent.CanUseGeminiVision,
		},
		"plan_limits": gin.H{
			"free": gin.H{
				"products":        models.FreeProductLimit,
				"rules":           models.FreeRuleLimit,
				"ai_messages":     models.FreeAILimit,
				"system_messages": models.FreeMsgLimit,
				"rule_gens":       models.FreeRuleGenLimit,
				"storage_bytes":   0,
			},
			"starter": gin.H{
				"products":        100,
				"rules":           -1,
				"ai_messages":     models.StarterAILimit,
				"system_messages": -1,
				"rule_gens":       models.StarterRuleGenLimit,
				"storage_bytes":   500 * 1024 * 1024,
			},
			"pro": gin.H{
				"products":        -1,
				"rules":           -1,
				"ai_messages":     models.ProAILimit,
				"system_messages": -1,
				"rule_gens":       models.ProRuleGenLimit,
				"storage_bytes":   1024 * 1024 * 1024,
			},
		},
	})
}
