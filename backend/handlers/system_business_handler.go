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
	HasAPIKey             bool       `json:"has_api_key"`
	HasWAAccessToken      bool       `json:"has_wa_access_token"`
	DebugActive           bool       `json:"debug_active"`
	DebugExpiresAt        *time.Time `json:"debug_expires_at"`
	DebugRemainingSeconds int64      `json:"debug_remaining_seconds"`
}

type businessCounts struct {
	ProductsActive int64   `json:"products_active"`
	ProductsTotal  int64   `json:"products_total"`
	RulesActive    int64   `json:"rules_active"`
	RulesTotal     int64   `json:"rules_total"`
	Customers      int64   `json:"customers"`
	Orders         int64   `json:"orders"`
	TotalRevenue   float64 `json:"total_revenue"`
	DashboardUsers int64   `json:"dashboard_users"`
}

type enrichedBusinessResponse struct {
	Business                systemBusinessResponse  `json:"business"`
	Counts                  businessCounts          `json:"counts"`
	RecentAuditLogs         []models.AuditLog       `json:"recent_audit_logs"`
	RecentPipelineLogs      []models.PipelineLog    `json:"recent_pipeline_logs"`
	PaymentHistory          []models.PaymentProof   `json:"payment_history"`
	RedeemedActivationCodes []models.ActivationCode `json:"redeemed_activation_codes"`
}

func buildSystemBusinessResponse(b models.Business) systemBusinessResponse {
	now := time.Now()
	active := b.DebugMode && b.DebugModeUntil != nil && b.DebugModeUntil.After(now)
	remaining := int64(0)
	if active {
		remaining = int64(b.DebugModeUntil.Sub(now).Seconds())
	}
	hasAPIKey := b.APIKey != ""
	hasWAAccessToken := b.WAAccessToken != ""

	// Do not serialize tenant secrets into system-admin list/detail payloads.
	// If a reveal workflow is ever needed, gate it behind PermSensitiveReveal.
	b.APIKey = ""
	b.WAAccessToken = ""
	b.WAStatus = effectiveWAStatus(b)
	return systemBusinessResponse{
		Business:              b,
		HasAPIKey:             hasAPIKey,
		HasWAAccessToken:      hasWAAccessToken,
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

	var counts businessCounts
	database.DB.Model(&models.Product{}).Where("business_id = ? AND active = ?", id, true).Count(&counts.ProductsActive)
	database.DB.Model(&models.Product{}).Where("business_id = ?", id).Count(&counts.ProductsTotal)
	database.DB.Model(&models.Rule{}).Where("business_id = ? AND is_active = ?", id, true).Count(&counts.RulesActive)
	database.DB.Model(&models.Rule{}).Where("business_id = ?", id).Count(&counts.RulesTotal)
	database.DB.Model(&models.Customer{}).Where("business_id = ?", id).Count(&counts.Customers)
	database.DB.Model(&models.Order{}).Where("business_id = ?", id).Count(&counts.Orders)

	type Result struct {
		Total float64
	}
	var result Result
	database.DB.Model(&models.Order{}).Select("coalesce(sum(total_price), 0) as total").Where("business_id = ?", id).Scan(&result)
	counts.TotalRevenue = result.Total

	database.DB.Model(&models.User{}).Where("business_id = ?", id).Count(&counts.DashboardUsers)

	var auditLogs []models.AuditLog
	database.DB.Where("business_id = ?", id).Order("created_at desc").Limit(10).Find(&auditLogs)

	var pipelineLogs []models.PipelineLog
	database.DB.Where("business_id = ?", id).Order("created_at desc").Limit(10).Find(&pipelineLogs)

	var paymentHistory []models.PaymentProof
	database.DB.Where("business_id = ?", id).Order("created_at desc").Limit(5).Find(&paymentHistory)

	var activationCodes []models.ActivationCode
	database.DB.Where("used_by_id = ?", id).Order("used_at desc").Limit(5).Find(&activationCodes)

	c.JSON(http.StatusOK, enrichedBusinessResponse{
		Business:                buildSystemBusinessResponse(business),
		Counts:                  counts,
		RecentAuditLogs:         auditLogs,
		RecentPipelineLogs:      pipelineLogs,
		PaymentHistory:          paymentHistory,
		RedeemedActivationCodes: activationCodes,
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
		Enable        bool   `json:"enable"`
		DurationHours int    `json:"duration_hours"` // How long to keep it on
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

// OverrideBusinessQuotas allows super admin to force a quota limit change on a tenant
func OverrideBusinessQuotas(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		AIMessageLimit      *int   `json:"ai_message_limit"`
		SystemMessageLimit  *int   `json:"system_message_limit"`
		RuleGenerationLimit *int   `json:"rule_generation_limit"`
		SimulationLimit     *int   `json:"simulation_limit"`
		Reason              string `json:"reason" binding:"required"`
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

	updates := map[string]interface{}{}
	auditMeta := map[string]interface{}{"reason": req.Reason}

	if req.AIMessageLimit != nil {
		updates["ai_message_limit"] = *req.AIMessageLimit
		auditMeta["new_ai_limit"] = *req.AIMessageLimit
	}
	if req.SystemMessageLimit != nil {
		updates["system_message_limit"] = *req.SystemMessageLimit
		auditMeta["new_system_limit"] = *req.SystemMessageLimit
	}
	if req.RuleGenerationLimit != nil {
		updates["rule_generation_limit"] = *req.RuleGenerationLimit
		auditMeta["new_rule_gen_limit"] = *req.RuleGenerationLimit
	}
	if req.SimulationLimit != nil {
		updates["simulation_limit"] = *req.SimulationLimit
		auditMeta["new_sim_limit"] = *req.SimulationLimit
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No limits provided to update"})
		return
	}

	if err := database.DB.Model(&business).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update business quotas"})
		return
	}

	LogActivity(business.ID, "super_admin", 0, "quotas_overridden", "billing", "", auditMeta, c.ClientIP(), "medium", business.Name, business.Plan)

	database.DB.First(&business, id)
	c.JSON(http.StatusOK, gin.H{"message": "Quotas overridden successfully", "business": buildSystemBusinessResponse(business)})
}

// ResetBusinessUsage allows super admin to surgically reset usage counters with an audit log
func ResetBusinessUsage(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Counters []string `json:"counters" binding:"required"`
		Reason   string   `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if len(req.Counters) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No counters selected for reset"})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	updates := map[string]interface{}{}
	auditMeta := map[string]interface{}{
		"reason":         req.Reason,
		"reset_counters": req.Counters,
	}

	for _, counter := range req.Counters {
		switch counter {
		case "ai":
			updates["ai_message_count"] = 0
		case "inbound":
			updates["system_message_count"] = 0
		case "simulation":
			updates["simulation_count"] = 0
		case "rule_gen":
			updates["rule_generation_count"] = 0
		}
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid counters provided"})
		return
	}

	if err := database.DB.Model(&business).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset business usage"})
		return
	}

	LogActivity(business.ID, "super_admin", 0, "usage_reset", "billing", "", auditMeta, c.ClientIP(), "medium", business.Name, business.Plan)

	database.DB.First(&business, id)
	c.JSON(http.StatusOK, gin.H{"message": "Usage counters reset successfully", "business": buildSystemBusinessResponse(business)})
}
