package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ListPipelineLogs returns paginated pipeline logs for a specific business
func ListPipelineLogs(c *gin.Context) {
	businessID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	var logs []models.PipelineLog
	var total int64

	query := database.DB.Model(&models.PipelineLog{}).Where("business_id = ?", businessID)

	// Optional filtering
	route := c.Query("route")
	if route != "" {
		query = query.Where("route_taken = ?", route)
	}

	query.Count(&total)
	if err := query.Order("created_at desc").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pipeline logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": logs,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GetPipelineLogDetails returns a specific pipeline log with its nested SignalLogs
func GetPipelineLogDetails(c *gin.Context) {
	logID := c.Param("log_id")

	var pLog models.PipelineLog
	if err := database.DB.Preload("SignalLogs").First(&pLog, logID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pipeline log not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"log": pLog,
	})
}
