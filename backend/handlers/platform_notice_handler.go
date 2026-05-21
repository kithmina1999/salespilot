package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ListPlatformNotices returns all notices for the admin dashboard
func ListPlatformNotices(c *gin.Context) {
	var notices []models.PlatformNotice
	if err := database.DB.Order("created_at desc").Find(&notices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notices"})
		return
	}
	c.JSON(http.StatusOK, notices)
}

// CreatePlatformNotice creates a new notice and deactivates all others
func CreatePlatformNotice(c *gin.Context) {
	adminID := c.GetUint("admin_id")

	var req struct {
		Title     string     `json:"title" binding:"required"`
		Message   string     `json:"message" binding:"required"`
		Type      string     `json:"type"` // info, warning, critical
		ExpiresAt *time.Time `json:"expires_at"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type == "" {
		req.Type = "info"
	}

	// Deactivate any currently active notices first (only one active at a time)
	database.DB.Model(&models.PlatformNotice{}).Where("is_active = ?", true).Update("is_active", false)

	notice := models.PlatformNotice{
		Title:     req.Title,
		Message:   req.Message,
		Type:      req.Type,
		IsActive:  true,
		CreatedBy: adminID,
		ExpiresAt: req.ExpiresAt,
	}

	if err := database.DB.Create(&notice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create notice"})
		return
	}

	c.JSON(http.StatusCreated, notice)
}

// DeactivatePlatformNotice marks a notice as inactive
func DeactivatePlatformNotice(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Model(&models.PlatformNotice{}).Where("id = ?", id).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate notice"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notice deactivated"})
}
