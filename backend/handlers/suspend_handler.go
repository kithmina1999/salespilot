package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// SuspendBusiness allows a super admin to softly suspend a business.
func SuspendBusiness(c *gin.Context) {
	adminID := c.GetUint("super_admin_id")
	businessID := c.Param("id")

	var req struct {
		Reason  string `json:"reason" binding:"required"`
		Type    string `json:"type" binding:"required"` // billing | abuse | policy | manual
		Confirm string `json:"confirm"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason and type are required"})
		return
	}

	if err := ValidateHighRiskAction(req.Reason, req.Confirm, "SUSPEND BUSINESS"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
		return
	}

	if biz.SuspendedAt != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business is already suspended"})
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"suspended_at":     &now,
		"suspended_reason": req.Reason,
		"suspended_by":     adminID,
		"suspension_type":  req.Type,
	}

	if err := database.DB.Model(&biz).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to suspend business"})
		return
	}

	LogActivity(biz.ID, "super_admin", adminID, "business_suspended", "business", fmt.Sprintf("%d", biz.ID), map[string]interface{}{
		"type":   req.Type,
		"reason": req.Reason,
	}, c.ClientIP(), "high", biz.Name, biz.Plan)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Business suspended successfully",
		"business": biz,
	})
}

// UnsuspendBusiness allows a super admin to lift a soft suspension.
func UnsuspendBusiness(c *gin.Context) {
	businessID := c.Param("id")

	var req struct {
		Reason  string `json:"reason" binding:"required"`
		Confirm string `json:"confirm"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
		return
	}

	if err := ValidateHighRiskAction(req.Reason, req.Confirm, "UNSUSPEND BUSINESS"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "business not found"})
		return
	}

	if biz.SuspendedAt == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business is not suspended"})
		return
	}

	if err := database.DB.Model(&biz).Updates(map[string]interface{}{
		"suspended_at":     nil,
		"suspended_reason": "",
		"suspended_by":     nil,
		"suspension_type":  "",
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unsuspend business"})
		return
	}

	LogActivity(biz.ID, "super_admin", 0, "business_unsuspended", "business", fmt.Sprintf("%d", biz.ID), map[string]interface{}{
		"reason": req.Reason,
	}, c.ClientIP(), "high", biz.Name, biz.Plan)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Business unsuspended successfully",
		"business": biz,
	})
}
