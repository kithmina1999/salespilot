package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ListKnowledgeGaps returns paginated unresolved gaps for the business, ordered by hit_count DESC.
func ListKnowledgeGaps(c *gin.Context) {
	businessID := c.GetUint("business_id")

	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	var gaps []models.KnowledgeGap
	var total int64

	// Count unresolved gaps for this business
	if err := database.DB.Model(&models.KnowledgeGap{}).
		Where("business_id = ? AND resolved = ?", businessID, false).
		Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count knowledge gaps"})
		return
	}

	// Fetch paginated unresolved gaps
	if err := database.DB.Where("business_id = ? AND resolved = ?", businessID, false).
		Order("hit_count DESC, last_seen_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&gaps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch knowledge gaps"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"gaps":  gaps,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// ResolveKnowledgeGap resolves a specific knowledge gap by ID.
func ResolveKnowledgeGap(c *gin.Context) {
	businessID := c.GetUint("business_id")
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid gap ID"})
		return
	}

	var req struct {
		ResolvedAction string  `json:"resolved_action" binding:"required"`
		ResolvedRuleID *uint   `json:"resolved_rule_id"`
		ResolvedMeta   *string `json:"resolved_meta"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resolved action is required"})
		return
	}

	var gap models.KnowledgeGap
	if err := database.DB.Where("id = ? AND business_id = ?", id, businessID).First(&gap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Knowledge gap not found"})
		return
	}

	now := time.Now()
	gap.Resolved = true
	gap.ResolvedAction = req.ResolvedAction
	gap.ResolvedAt = &now
	if req.ResolvedRuleID != nil {
		gap.ResolvedRuleID = req.ResolvedRuleID
	}
	if req.ResolvedMeta != nil {
		gap.ResolvedMeta = *req.ResolvedMeta
	}

	if err := database.DB.Save(&gap).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve knowledge gap"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Knowledge gap resolved successfully", "gap": gap})
}

// MarkGapNotNeeded resolves a specific knowledge gap with "not_needed" action shortcut.
func MarkGapNotNeeded(c *gin.Context) {
	businessID := c.GetUint("business_id")
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid gap ID"})
		return
	}

	var gap models.KnowledgeGap
	if err := database.DB.Where("id = ? AND business_id = ?", id, businessID).First(&gap).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Knowledge gap not found"})
		return
	}

	now := time.Now()
	gap.Resolved = true
	gap.ResolvedAction = models.ActionNotNeeded
	gap.ResolvedAt = &now

	if err := database.DB.Save(&gap).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve knowledge gap"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Knowledge gap marked as not needed", "gap": gap})
}
