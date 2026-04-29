package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// ListGlobalRules returns all rules where BusinessID IS NULL (platform-wide defaults).
func ListGlobalRules(c *gin.Context) {
	var rules []models.Rule
	if err := database.DB.Where("business_id IS NULL").Order("created_at DESC").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch global rules"})
		return
	}
	c.JSON(http.StatusOK, rules)
}

// CreateGlobalRule creates a new platform-wide rule (DROP, Context Bridge, or normal FAQ).
func CreateGlobalRule(c *gin.Context) {
	var req struct {
		Keywords        string `json:"keywords" binding:"required"`
		Response        string `json:"response"`
		SinhalaResponse string `json:"sinhala_response"`
		IsActive        bool   `json:"is_active"`
		IsDropRule      bool   `json:"is_drop_rule"`
		IsContextBridge bool   `json:"is_context_bridge"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keywords are required: " + err.Error()})
		return
	}

	rule := models.Rule{
		BusinessID:      nil, // NULL = global
		Keywords:        req.Keywords,
		Response:        req.Response,
		SinhalaResponse: req.SinhalaResponse,
		IsActive:        req.IsActive,
		IsDropRule:      req.IsDropRule,
		IsContextBridge: req.IsContextBridge,
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create global rule"})
		return
	}

	// Embed in background so semantic matching picks it up
	if !rule.IsDropRule && !rule.IsContextBridge && rule.Response != "" {
		go whatsapp.EmbedAndStoreRule(&rule)
	}

	// Reload the rule cache so it takes effect immediately
	whatsapp.Cache.LoadRules()

	// Log that super admin created a global rule — was previously missing!
	LogActivity(0, "super_admin", 0, "global_rule_created", "rule", fmt.Sprintf("%d", rule.ID), map[string]interface{}{
		"keywords":          rule.Keywords,
		"is_drop_rule":      rule.IsDropRule,
		"is_context_bridge": rule.IsContextBridge,
	}, c.ClientIP(), "medium", "platform", "")

	c.JSON(http.StatusCreated, rule)
}

// UpdateGlobalRule updates an existing platform-wide rule by ID.
func UpdateGlobalRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	var rule models.Rule
	if err := database.DB.Where("id = ? AND business_id IS NULL", id).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Global rule not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := database.DB.Model(&rule).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update global rule"})
		return
	}

	database.DB.First(&rule, id)
	whatsapp.Cache.LoadRules()

	// Log that super admin updated a global rule — was previously missing!
	LogActivity(0, "super_admin", 0, "global_rule_updated", "rule", fmt.Sprintf("%d", id), map[string]interface{}{
		"updates": updates,
	}, c.ClientIP(), "medium", "platform", "")

	c.JSON(http.StatusOK, rule)
}

// DeleteGlobalRule permanently removes a platform-wide rule.
func DeleteGlobalRule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	if err := database.DB.Where("id = ? AND business_id IS NULL", id).Delete(&models.Rule{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete global rule"})
		return
	}

	whatsapp.Cache.LoadRules()

	// Log that super admin deleted a global rule — was previously missing!
	LogActivity(0, "super_admin", 0, "global_rule_deleted", "rule", fmt.Sprintf("%d", id), map[string]interface{}{}, c.ClientIP(), "medium", "platform", "")

	c.JSON(http.StatusOK, gin.H{"message": "Global rule deleted"})
}
