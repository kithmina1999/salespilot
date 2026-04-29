package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

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

	activeTrial := biz.IsInActiveTrial()

	// ── Base defaults (Free Plan) ──
	maxProducts      := models.FreeProductLimit
	maxRules         := models.FreeRuleLimit
	maxAIMessages    := models.FreeAILimit
	maxSystemMessages := models.FreeMsgLimit
	maxRuleGens      := models.FreeRuleGenLimit
	maxStorageBytes  := int64(0)

	canUploadCloudinary  := false
	canSendWhatsAppImages := false
	canUseGeminiVision   := false

	// ── Apply Paid / Trial limits ──
	if activeTrial {
		// Trial gives a meaningful preview — specific numbers so the usage meter
		// shows actual bars instead of "∞ Unlimited" (which confused users on free trial).
		// Storage is locked during trial since Cloudinary upload requires a paid plan.
		maxProducts       = 50
		maxRules          = models.TrialRuleLimit        // 50 (not -1 / unlimited)
		maxAIMessages     = biz.AIMessageLimit           // 150 set at trial start
		maxSystemMessages = models.TrialMsgLimit         // 500 (not -1 / unlimited)
		maxRuleGens       = models.StarterRuleGenLimit   // 30
		maxStorageBytes   = 0                            // locked during trial
		canUploadCloudinary  = false
		canSendWhatsAppImages = false
	} else if biz.Plan == models.PlanStarter {
		maxProducts       = 100
		maxRules          = -1                           // unlimited for paid Starter
		maxAIMessages     = models.StarterAILimit        // 1500, not the stale DB column
		maxSystemMessages = -1                           // unlimited for paid Starter
		maxRuleGens       = models.StarterRuleGenLimit   // 30
		maxStorageBytes   = 500 * 1024 * 1024            // 500 MB
		canUploadCloudinary  = true
		canSendWhatsAppImages = true
	} else if biz.Plan == models.PlanPro {
		maxProducts       = -1                           // unlimited
		maxRules          = -1                           // unlimited
		maxAIMessages     = models.ProAILimit            // 5000, not the stale DB column
		maxSystemMessages = -1                           // unlimited
		maxRuleGens       = models.ProRuleGenLimit       // 100
		maxStorageBytes   = 1024 * 1024 * 1024           // 1 GB
		canUploadCloudinary  = true
		canSendWhatsAppImages = true
		canUseGeminiVision   = true
	}

	c.JSON(http.StatusOK, gin.H{
		"plan":                  biz.Plan,
		"active_trial":          activeTrial,
		"trial_expires_at":      biz.TrialExpiresAt,
		"plan_expires_at":       biz.PlanExpiresAt,
		"products_used":         productCount,
		"products_limit":        maxProducts,
		"rules_used":            ruleCount,
		"rules_limit":           maxRules,
		"faq_replies_used":      biz.FaqReplyCount,
		"ai_messages_used":      biz.AIMessageCount,
		"ai_messages_limit":     maxAIMessages,
		"rule_generation_count": biz.RuleGenerationCount,
		"rule_generation_limit": maxRuleGens,
		"system_messages_used":  biz.SystemMessageCount,
		"system_messages_limit": maxSystemMessages,
		"storage_used_bytes":    biz.TotalStorageUsed,
		"storage_limit_bytes":   maxStorageBytes,
		"features": gin.H{
			"cloudinary":      canUploadCloudinary,
			"whatsapp_images": canSendWhatsAppImages,
			"gemini_vision":   canUseGeminiVision,
		},

		// ── Plan limits reference — used by the frontend compare table.
		// Single source of truth: always matches models/business.go constants.
		// Frontend should NEVER hardcode these values.
		"plan_limits": gin.H{
			"free": gin.H{
				"products":        models.FreeProductLimit,  // 10
				"rules":           models.FreeRuleLimit,     // 10
				"ai_messages":     models.FreeAILimit,       // 0 (locked)
				"system_messages": models.FreeMsgLimit,      // 300
				"rule_gens":       models.FreeRuleGenLimit,  // 3
				"storage_bytes":   0,
			},
			"starter": gin.H{
				"products":        100,
				"rules":           -1,                            // unlimited
				"ai_messages":     models.StarterAILimit,        // 1500
				"system_messages": -1,                            // unlimited
				"rule_gens":       models.StarterRuleGenLimit,   // 30
				"storage_bytes":   500 * 1024 * 1024,
			},
			"pro": gin.H{
				"products":        -1,                          // unlimited
				"rules":           -1,                          // unlimited
				"ai_messages":     models.ProAILimit,          // 5000
				"system_messages": -1,                          // unlimited
				"rule_gens":       models.ProRuleGenLimit,     // 100
				"storage_bytes":   1024 * 1024 * 1024,
			},
		},
	})
}
