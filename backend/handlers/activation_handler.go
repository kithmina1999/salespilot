package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ── Launch Promotion ─────────────────────────────────────────────────────────
// Change promoEndDate to extend or end the promotion. Set it to a past date to disable.
// TODO: REPLACE BEFORE PRODUCTION — adjust the promotion end date
var promoEndDate = time.Date(2026, time.April, 30, 23, 59, 59, 0, time.UTC)

func promoIsActive() bool {
	return time.Now().Before(promoEndDate)
}

// generateActivationCode generates a formatted code like BSS-PRO-X7K2 or BSS-GRW-A3F9
func generateActivationCode(plan string) string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	planTag := "GRW"
	switch strings.ToLower(plan) {
	case "pro":
		planTag = "PRO"
	case "starter":
		planTag = "STR"
	case "free":
		planTag = "FRE"
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	part := func(n int) string {
		b := make([]byte, n)
		for i := range b {
			b[i] = charset[r.Intn(len(charset))]
		}
		return string(b)
	}

	return fmt.Sprintf("BSS-%s-%s", planTag, part(4))
}

// ─────────────────────────────────────────────────────────────────
// POST /system/activation-codes  (Master Admin only)
// Body: { plan, billing_cycle, duration_days, note, target_phone }
// ─────────────────────────────────────────────────────────────────
func CreateActivationCode(c *gin.Context) {
	var req struct {
		Plan         string `json:"plan"          binding:"required"`
		BillingCycle string `json:"billing_cycle" binding:"required"`
		DurationDays int    `json:"duration_days" binding:"required"`
		Note         string `json:"note"`
		TargetPhone  string `json:"target_phone"` // optional: lock code to a specific tenant phone
		Reason       string `json:"reason" binding:"required"`
		Confirm      string `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "plan, billing_cycle, duration_days, and reason are required: " + err.Error()})
		return
	}

	if err := ValidateHighRiskAction(req.Reason, req.Confirm, "GENERATE CODE"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate plan
	planNorm := strings.ToLower(req.Plan)
	validPlans := map[string]bool{
		"starter": true,
		"pro":     true,
		"free":    true,
	}
	if !validPlans[planNorm] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan. Use: starter, pro, or free"})
		return
	}

	// Generate a unique code (retry on collision)
	var code models.ActivationCode
	var codeStr string
	for attempts := 0; attempts < 10; attempts++ {
		codeStr = generateActivationCode(req.Plan)
		if err := database.DB.Where("code = ?", codeStr).First(&code).Error; err != nil {
			break // not found = unique
		}
	}

	code = models.ActivationCode{
		Code:         codeStr,
		Plan:         planNorm,
		BillingCycle: req.BillingCycle,
		DurationDays: req.DurationDays,
		Note:         req.Note,
		TargetPhone:  req.TargetPhone,
	}

	if err := database.DB.Create(&code).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create activation code: " + err.Error()})
		return
	}

	// Log that super admin created a code — this was previously missing!
	LogActivity(0, "super_admin", 0, "activation_code_created", "activation_code", codeStr, map[string]interface{}{
		"plan":          planNorm,
		"billing_cycle": req.BillingCycle,
		"duration_days": req.DurationDays,
		"target_phone":  req.TargetPhone,
		"note":          req.Note,
	}, c.ClientIP(), "medium", "platform", "")

	c.JSON(http.StatusCreated, gin.H{
		"message": "Activation code created ✅",
		"code":    code,
	})
}

// ─────────────────────────────────────────────────────────────────
// GET /system/activation-codes  (Master Admin only)
// ─────────────────────────────────────────────────────────────────
func ListActivationCodes(c *gin.Context) {
	var codes []models.ActivationCode
	query := database.DB.Order("created_at DESC")

	// Filter by used status
	if used := c.Query("used"); used == "true" {
		query = query.Where("is_used = ?", true)
	} else if used == "false" {
		query = query.Where("is_used = ?", false)
	}

	if err := query.Find(&codes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activation codes"})
		return
	}

	var total, usedCount, available int64
	database.DB.Model(&models.ActivationCode{}).Count(&total)
	database.DB.Model(&models.ActivationCode{}).Where("is_used = ?", true).Count(&usedCount)
	available = total - usedCount

	c.JSON(http.StatusOK, gin.H{
		"codes":     codes,
		"total":     total,
		"used":      usedCount,
		"available": available,
	})
}

// ─────────────────────────────────────────────────────────────────
// DELETE /system/activation-codes/:code  (Master Admin only)
// ─────────────────────────────────────────────────────────────────
func RevokeActivationCode(c *gin.Context) {
	codeStr := c.Param("code")

	var req struct {
		Reason  string `json:"reason" binding:"required"`
		Confirm string `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required: " + err.Error()})
		return
	}

	if err := ValidateHighRiskAction(req.Reason, req.Confirm, "REVOKE CODE"); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var code models.ActivationCode
	if err := database.DB.Where("code = ?", codeStr).First(&code).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activation code not found"})
		return
	}

	if code.IsUsed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot revoke an already-used code"})
		return
	}

	if err := database.DB.Delete(&code).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke code"})
		return
	}

	// Log that super admin revoked a code — this was previously missing!
	LogActivity(0, "super_admin", 0, "activation_code_revoked", "activation_code", codeStr, map[string]interface{}{
		"plan":          code.Plan,
		"billing_cycle": code.BillingCycle,
		"duration_days": code.DurationDays,
	}, c.ClientIP(), "medium", "platform", "")

	c.JSON(http.StatusOK, gin.H{"message": "Code revoked ✅", "code": codeStr})
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/billing/activate  (Tenant JWT protected)
// Body: { "code": "BSS-PRO-X7K2" }
// ─────────────────────────────────────────────────────────────────
func RedeemActivationCode(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code is required"})
		return
	}

	codeStr := strings.TrimSpace(strings.ToUpper(req.Code))

	// Fetch the code
	var code models.ActivationCode
	if err := database.DB.Where("code = ?", codeStr).First(&code).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid activation code. Please check and try again."})
		return
	}

	// Already used?
	if code.IsUsed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This activation code has already been used."})
		return
	}

	// Expired?
	if code.ExpiresAt != nil && code.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This activation code has expired."})
		return
	}

	// Phone lock check: if the code was assigned to a specific phone, verify
	if code.TargetPhone != "" {
		var biz models.Business
		if err := database.DB.First(&biz, businessID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Business not found"})
			return
		}
		// Normalize and compare
		bizPhone := strings.ReplaceAll(biz.Phone, " ", "")
		targetPhone := strings.ReplaceAll(code.TargetPhone, " ", "")
		if bizPhone != targetPhone {
			c.JSON(http.StatusForbidden, gin.H{"error": "This activation code is assigned to a different account."})
			return
		}
	}

	// Fetch business for stacking logic
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Business not found"})
		return
	}

	// Calculate new expiry — stack on top of existing plan if still active
	now := time.Now()
	newExpiry := now.AddDate(0, 0, code.DurationDays)
	if biz.PlanExpiresAt != nil && biz.PlanExpiresAt.After(now) {
		newExpiry = biz.PlanExpiresAt.AddDate(0, 0, code.DurationDays)
	}

	// Stack remaining trial days onto Starter plan — reward early subscribers
	// (a user on a Starter trial activating a Starter plan shouldn't lose their remaining trial days)
	trialBonusDays := 0
	if code.Plan == models.PlanStarter && biz.IsInActiveTrial() {
		trialDaysLeft := int(time.Until(*biz.TrialExpiresAt).Hours() / 24)
		if trialDaysLeft > 0 {
			newExpiry = newExpiry.AddDate(0, 0, trialDaysLeft)
			trialBonusDays = trialDaysLeft
		}
	}

	// First activation bonus — only applies during launch promotion period
	isFirstActivation := biz.BillingCycle == "" && biz.PlanExpiresAt == nil
	bonusApplied := isFirstActivation && promoIsActive()
	newAILimit := 3000     // Standard: 3,000 AI replies/month
	newRuleGenLimit := 100 // Standard: 100 AI rule generations/month
	if bonusApplied {
		newAILimit = 4000     // First-activation bonus: +1,000 extra AI replies
		newRuleGenLimit = 150 // First-activation bonus: +50 extra rule generations
	}

	newSimulationLimit := models.StarterSimulationLimit
	if code.Plan == models.PlanPro {
		newSimulationLimit = models.ProSimulationLimit
	} else if code.Plan == models.PlanFree {
		newSimulationLimit = models.FreeSimulationLimit
	}

	// Upgrade the business plan and clear the trial (trial ends when paid plan begins)
	updates := map[string]interface{}{
		"plan":                  code.Plan,
		"billing_cycle":         code.BillingCycle,
		"plan_expires_at":       newExpiry,
		"ai_message_limit":      newAILimit,
		"rule_generation_limit": newRuleGenLimit,
		"simulation_limit":      newSimulationLimit,
		"trial_expires_at":      nil, // Clear trial — paid plan is now active
	}
	// Use Session(&gorm.Session{}) with Select("*") to allow writing nil (zero) values
	database.DB.Model(&biz).Select("plan", "billing_cycle", "plan_expires_at", "ai_message_limit", "rule_generation_limit", "simulation_limit", "trial_expires_at").Updates(updates)

	// Mark code as used
	usedAt := time.Now()
	bizName := biz.Name
	database.DB.Model(&code).Updates(map[string]interface{}{
		"is_used":      true,
		"used_at":      &usedAt,
		"used_by_id":   businessID,
		"used_by_name": bizName,
	})

	// Audit log
	LogActivity(businessID, "user", c.GetUint("user_id"), "plan_activated", "billing", codeStr, map[string]interface{}{
		"plan":             code.Plan,
		"billing_cycle":    code.BillingCycle,
		"duration_days":    code.DurationDays,
		"trial_bonus_days": trialBonusDays,
		"total_days":       code.DurationDays + trialBonusDays,
		"expires_at":       newExpiry,
		"first_activation": isFirstActivation,
		"bonus_applied":    bonusApplied,
	}, c.ClientIP(), "medium", biz.Name, code.Plan)

	msg := "Plan activated successfully! 🎉"
	if bonusApplied && trialBonusDays > 0 {
		msg = fmt.Sprintf("Welcome aboard! 🎁 Launch bonus applied (+1,000 extra AI replies & +50 rule gens) + %d trial days carried over. Total: %d days!", trialBonusDays, code.DurationDays+trialBonusDays)
	} else if bonusApplied {
		msg = "Welcome aboard! 🎁 Launch bonus applied: 4,000 AI replies + 150 rule generations this month!"
	} else if trialBonusDays > 0 {
		msg = fmt.Sprintf("Plan activated! 🎉 Your %d remaining trial days have been added — your plan is active for %d days total.", trialBonusDays, code.DurationDays+trialBonusDays)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          msg,
		"plan":             code.Plan,
		"billing_cycle":    code.BillingCycle,
		"expires_at":       newExpiry.Format("2006-01-02"),
		"days_remaining":   code.DurationDays + trialBonusDays,
		"trial_bonus_days": trialBonusDays,
		"bonus_applied":    bonusApplied,
		"ai_message_limit": newAILimit,
		"rule_gen_limit":   newRuleGenLimit,
	})
}
