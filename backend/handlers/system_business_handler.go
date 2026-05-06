package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

type systemBusinessResponse struct {
	models.Business
	DebugActive           bool       `json:"debug_active"`
	DebugExpiresAt        *time.Time `json:"debug_expires_at"`
	DebugRemainingSeconds int64      `json:"debug_remaining_seconds"`
}

func buildSystemBusinessResponse(b models.Business) systemBusinessResponse {
	now := time.Now()
	active := b.DebugMode && b.DebugModeUntil != nil && b.DebugModeUntil.After(now)
	remaining := int64(0)
	if active {
		remaining = int64(b.DebugModeUntil.Sub(now).Seconds())
	}
	return systemBusinessResponse{
		Business:              b,
		DebugActive:           active,
		DebugExpiresAt:        b.DebugModeUntil,
		DebugRemainingSeconds: remaining,
	}
}

// ListSystemBusinesses returns all businesses with light details
func ListSystemBusinesses(c *gin.Context) {
	var businesses []models.Business
	if err := database.DB.Order("created_at desc").Find(&businesses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list businesses"})
		return
	}

	response := make([]systemBusinessResponse, 0, len(businesses))
	for _, business := range businesses {
		response = append(response, buildSystemBusinessResponse(business))
	}

	c.JSON(http.StatusOK, gin.H{
		"businesses": response,
	})
}

// GetSystemBusiness returns full details of a single business
func GetSystemBusiness(c *gin.Context) {
	id := c.Param("id")

	var business models.Business
	if err := database.DB.First(&business, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"business": buildSystemBusinessResponse(business),
	})
}

// OverrideBusinessPlan allows super admin to force a plan or expiry on a tenant
func OverrideBusinessPlan(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Plan          string     `json:"plan" binding:"required"`
		BillingCycle  string     `json:"billing_cycle"`
		PlanExpiresAt *time.Time `json:"plan_expires_at"`
		Reason        string     `json:"reason" binding:"required"`
		Confirm       string     `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if err := ValidateHighRiskAction(req.Reason, req.Confirm, "FORCE PLAN"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	updates := map[string]interface{}{
		"plan":            req.Plan,
		"billing_cycle":   req.BillingCycle,
		"plan_expires_at": req.PlanExpiresAt,
	}

	if err := database.DB.Model(&business).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update business plan"})
		return
	}

	log.Printf("🛡️ SUPER ADMIN changed plan for %s (ID: %d) to %s. Reason: %s",
		business.Name, business.ID, req.Plan, req.Reason)

	// Since super admin has no user ID in context, ActorType is 'super_admin'
	LogActivity(business.ID, "super_admin", 0, "plan_overridden", "billing", "", map[string]interface{}{
		"new_plan":   req.Plan,
		"expires_at": req.PlanExpiresAt,
		"reason":     req.Reason,
	}, c.ClientIP(), "high", business.Name, req.Plan)

	// Fetch updated record
	database.DB.First(&business, id)
	c.JSON(http.StatusOK, gin.H{"message": "Plan overridden successfully", "business": business})
}

// ToggleDebugMode enables or disables verbose pipeline tracking for a business
func ToggleDebugMode(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Enable        bool `json:"enable"`
		DurationHours int  `json:"duration_hours"` // How long to keep it on
		Reason        string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	updates := map[string]interface{}{
		"debug_mode": req.Enable,
	}

	if req.Enable {
		hours := req.DurationHours
		switch hours {
		case 1, 6, 24, 72:
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "duration_hours must be one of 1, 6, 24, or 72"})
			return
		}
		expiresAt := time.Now().Add(time.Duration(hours) * time.Hour)
		updates["debug_mode_until"] = &expiresAt
	} else {
		updates["debug_mode_until"] = nil
	}

	if err := database.DB.Model(&business).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle debug mode"})
		return
	}

	status := "disabled"
	if req.Enable {
		status = "enabled"
	}
	LogActivity(business.ID, "super_admin", 0, "debug_mode_toggled", "system", "", map[string]interface{}{
		"status":         status,
		"duration_hours": req.DurationHours,
		"reason":         req.Reason,
	}, c.ClientIP(), "medium", business.Name, business.Plan)

	database.DB.First(&business, id)
	c.JSON(http.StatusOK, gin.H{"message": "Debug mode " + status, "business": buildSystemBusinessResponse(business)})
}
