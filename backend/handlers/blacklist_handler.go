package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

// GetBlacklist returns all blocked numbers for the tenant
func GetBlacklist(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var blocked []models.BlacklistedNumber
	if err := database.DB.Where("business_id = ?", businessID).Order("blocked_at desc").Find(&blocked).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch blacklist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"blacklist": blocked})
}

// AddToBlacklist manually blocks a number
func AddToBlacklist(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Phone  string `json:"phone" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Normalize phone uniformly
	req.Phone = utils.NormalizePhone(req.Phone)

	block := models.BlacklistedNumber{
		BusinessID: businessID.(uint),
		Phone:      req.Phone,
		Reason:     req.Reason,
		BlockedAt:  time.Now(),
	}

	if err := database.DB.Create(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to blacklist"})
		return
	}

	// Audit Log
	bizName, bizPlan := GetBusinessContext(businessID.(uint))
	LogActivity(businessID.(uint), "user", businessID.(uint), "phone_blacklisted", "blacklist", req.Phone, map[string]interface{}{"reason": req.Reason}, c.ClientIP(), "medium", bizName, bizPlan)

	c.JSON(http.StatusCreated, gin.H{"message": "Number blocked successfully", "block": block})
}

// RemoveFromBlacklist unblocks a number
func RemoveFromBlacklist(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id := c.Param("id")

	var block models.BlacklistedNumber
	if err := database.DB.Where("id = ? AND business_id = ?", id, businessID).First(&block).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Blacklist entry not found"})
		return
	}

	if err := database.DB.Delete(&block).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove block"})
		return
	}

	// Audit Log
	bizName, bizPlan := GetBusinessContext(businessID.(uint))
	LogActivity(businessID.(uint), "user", businessID.(uint), "phone_unblacklisted", "blacklist", block.Phone, nil, c.ClientIP(), "medium", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Number unblocked successfully"})
}
