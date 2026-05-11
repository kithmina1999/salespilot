package handlers

import (
	"crypto/md5"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// billingDays maps a billing cycle to the number of days the plan is active.
var billingDays = map[string]int{
	models.BillingMonthly: 30,
	models.BillingAnnual:  365,
}

// billingAmounts maps cycle → amount in LKR (must match PayHere checkout amount exactly)
var billingAmounts = map[string]map[string]float64{
	models.PlanStarter: {
		models.BillingMonthly: 1490,
		models.BillingAnnual:  14900, // save Rs. 3,000 (2 months free)
	},
	models.PlanPro: {
		models.BillingMonthly: 3490,
		models.BillingAnnual:  34900, // save Rs. 7,000 (2 months free)
	},
}

type billingTimeRemaining struct {
	Status        string
	EffectivePlan string
	ActiveTrial   bool
	ExpiresAt     *time.Time
	TotalSeconds  int64
	Days          int
	Hours         int
	Minutes       int
}

func getBillingTimeRemaining(biz models.Business, now time.Time) billingTimeRemaining {
	status := "free"
	effectivePlan := models.PlanFree
	var expiresAt *time.Time

	switch {
	case biz.Plan == models.PlanStarter || biz.Plan == models.PlanPro:
		status = "paid_active"
		effectivePlan = biz.Plan
		expiresAt = biz.PlanExpiresAt
	case biz.Plan == models.PlanFree && biz.TrialExpiresAt != nil && biz.TrialExpiresAt.After(now):
		status = "trial_active"
		effectivePlan = models.PlanFree
		expiresAt = biz.TrialExpiresAt
	}

	if expiresAt == nil {
		return billingTimeRemaining{Status: status, EffectivePlan: effectivePlan, ActiveTrial: status == "trial_active"}
	}

	remaining := expiresAt.Sub(now)
	if remaining <= 0 {
		if status == "paid_active" {
			status = "expired_to_free"
		} else {
			status = "trial_expired_to_free"
		}
		return billingTimeRemaining{Status: status, EffectivePlan: models.PlanFree, ExpiresAt: expiresAt}
	}

	totalSeconds := int64(remaining.Seconds())
	return billingTimeRemaining{
		Status:        status,
		EffectivePlan: effectivePlan,
		ActiveTrial:   status == "trial_active",
		ExpiresAt:     expiresAt,
		TotalSeconds:  totalSeconds,
		Days:          int(totalSeconds / 86400),
		Hours:         int((totalSeconds % 86400) / 3600),
		Minutes:       int((totalSeconds % 3600) / 60),
	}
}

// generateOrderID creates a unique order ID per payment attempt.
func generateOrderID(businessID uint) string {
	return fmt.Sprintf("OC-%d-%d-%d", businessID, time.Now().Unix(), rand.Intn(9999))
}

// payhereHash computes the MD5 hash PayHere requires to validate payments.
// Formula: MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).upper())
func payhereHash(merchantID, orderID string, amount float64, currency, merchantSecret string) string {
	secretHash := fmt.Sprintf("%X", md5.Sum([]byte(merchantSecret)))
	raw := fmt.Sprintf("%s%s%.2f%s%s", merchantID, orderID, amount, currency, secretHash)
	return fmt.Sprintf("%X", md5.Sum([]byte(raw)))
}

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/billing/status
// Returns the current plan, expiry, billing cycle, and usage.
// ─────────────────────────────────────────────────────────────────
func BillingStatus(c *gin.Context) {
	businessID := c.GetUint("business_id")
	now := time.Now()
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}
	remaining := getBillingTimeRemaining(biz, now)

	// Determine days remaining if plan is active
	var daysRemaining *int
	if biz.PlanExpiresAt != nil && biz.PlanExpiresAt.After(now) {
		d := int(biz.PlanExpiresAt.Sub(now).Hours() / 24)
		daysRemaining = &d
	}

	// Trial days remaining
	var trialDaysRemaining *int
	if biz.TrialExpiresAt != nil && biz.TrialExpiresAt.After(now) {
		d := int(biz.TrialExpiresAt.Sub(now).Hours() / 24)
		trialDaysRemaining = &d
	}

	// Grace period: 3 days after plan expiry — bot still runs but merchant gets a warning banner
	const gp = 3 * 24 * time.Hour
	gracePeriodActive := false
	var graceEndsAt *time.Time
	if biz.Plan != models.PlanFree && biz.PlanExpiresAt != nil {
		sinceExpiry := time.Since(*biz.PlanExpiresAt)
		if sinceExpiry > 0 && sinceExpiry <= gp {
			gracePeriodActive = true
			t := biz.PlanExpiresAt.Add(gp)
			graceEndsAt = &t
		}
	}

	// Fetch active platform notice
	var notice *models.PlatformNotice
	var n models.PlatformNotice
	// Check for active notice that hasn't expired
	err := database.DB.Where("is_active = ? AND (expires_at IS NULL OR expires_at > ?)", true, now).Order("created_at desc").First(&n).Error
	if err == nil {
		notice = &n
	}

	c.JSON(http.StatusOK, gin.H{
		"plan":                  biz.Plan,
		"effective_plan":        remaining.EffectivePlan,
		"status":                remaining.Status,
		"active_trial":          remaining.ActiveTrial,
		"billing_cycle":         biz.BillingCycle,
		"plan_expires_at":       biz.PlanExpiresAt,
		"days_remaining":        daysRemaining,
		"trial_expires_at":      biz.TrialExpiresAt,
		"trial_days_remaining":  trialDaysRemaining,
		"expires_at":            remaining.ExpiresAt,
		"seconds_remaining":     remaining.TotalSeconds,
		"hours_remaining":       remaining.Hours,
		"minutes_remaining":     remaining.Minutes,
		"grace_period":          gracePeriodActive,
		"grace_ends_at":         graceEndsAt,
		"ai_message_count":      biz.AIMessageCount,
		"faq_reply_count":       biz.FaqReplyCount,
		"system_message_count":  biz.SystemMessageCount,
		"rule_generation_count": biz.RuleGenerationCount,
		"pricing": gin.H{
			"starter": gin.H{
				"monthly": billingAmounts[models.PlanStarter][models.BillingMonthly],
				"annual":  billingAmounts[models.PlanStarter][models.BillingAnnual],
			},
			"pro": gin.H{
				"monthly": billingAmounts[models.PlanPro][models.BillingMonthly],
				"annual":  billingAmounts[models.PlanPro][models.BillingAnnual],
			},
		},
		// Launch promotion fields
		"promo_active":        promoIsActive(),
		"promo_ends_at":       promoEndDate.Format(time.RFC3339),
		"is_first_activation": biz.BillingCycle == "" && biz.PlanExpiresAt == nil,
		"platform_notice":     notice,
	})
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/billing/initiate
// Generates a PayHere checkout payload for the frontend to redirect to.
// Body: { "cycle": "monthly" | "quarterly" | "annual" }
// ─────────────────────────────────────────────────────────────────
func BillingInitiate(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		Plan  string `json:"plan"  binding:"required"` // "starter" | "pro"
		Cycle string `json:"cycle" binding:"required"` // "monthly" | "annual"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cycle is required (monthly | quarterly | annual)"})
		return
	}

	planAmounts, planOk := billingAmounts[req.Plan]
	if !planOk {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan. Use: starter or pro"})
		return
	}
	amount, cycleOk := planAmounts[req.Cycle]
	if !cycleOk {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cycle. Use: monthly or annual"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Business not found"})
		return
	}

	merchantID := os.Getenv("PAYHERE_MERCHANT_ID")
	merchantSecret := os.Getenv("PAYHERE_MERCHANT_SECRET")
	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:8080"
	}
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Use PayHere sandbox in development
	isSandbox := os.Getenv("PAYHERE_SANDBOX") != "false"
	checkoutURL := "https://sandbox.payhere.lk/pay/checkout"
	if !isSandbox {
		checkoutURL = "https://www.payhere.lk/pay/checkout"
	}

	orderID := generateOrderID(businessID)
	hash := payhereHash(merchantID, orderID, amount, "LKR", merchantSecret)

	c.JSON(http.StatusOK, gin.H{
		"checkout_url": checkoutURL,
		"order_id":     orderID,
		"merchant_id":  merchantID,
		"amount":       fmt.Sprintf("%.2f", amount),
		"currency":     "LKR",
		"cycle":        req.Cycle,
		"hash":         hash,
		"items":        fmt.Sprintf("SalesPilot %s Plan (%s)", strings.Title(req.Plan), req.Cycle),
		"name":         biz.Name,
		"phone":        biz.Phone,
		"notify_url":   serverURL + "/api/v1/billing/notify",
		"return_url":   frontendURL + "/dashboard/usage?status=success",
		"cancel_url":   frontendURL + "/dashboard/usage?status=cancel",
	})
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/billing/notify   ← PUBLIC (no JWT) — PayHere POSTs here
// Validates PayHere's MD5 and upgrades the business plan.
// ─────────────────────────────────────────────────────────────────
func BillingNotify(c *gin.Context) {
	merchantID := os.Getenv("PAYHERE_MERCHANT_ID")
	merchantSecret := os.Getenv("PAYHERE_MERCHANT_SECRET")

	// PayHere sends form fields (application/x-www-form-urlencoded)
	orderID := c.PostForm("order_id")
	paymentID := c.PostForm("payment_id")
	statusCode := c.PostForm("status_code")
	amountStr := c.PostForm("payhere_amount")
	currency := c.PostForm("payhere_currency")
	receivedHash := strings.ToUpper(c.PostForm("md5sig"))

	// Only handle successful payments (status_code 2 = success)
	if statusCode != "2" {
		log.Printf("💳 PayHere notify: non-success status %s for order %s", statusCode, orderID)
		c.String(http.StatusOK, "OK") // Always 200 to PayHere
		return
	}

	// Validate MD5 hash
	var amount float64
	fmt.Sscanf(amountStr, "%f", &amount)
	expectedHash := payhereHash(merchantID, orderID, amount, currency, merchantSecret)
	if receivedHash != expectedHash {
		log.Printf("❌ PayHere notify: INVALID HASH for order %s — possible fraud attempt", orderID)
		c.String(http.StatusForbidden, "Invalid hash")
		return
	}

	// Parse business ID and cycle from order_id format: OC-{bizID}-{timestamp}-{rand}
	// Cycle is stored in a pending payment record (we encode it into order_id)
	// Extract from order prefix: OC-{businessID}-...
	var businessID uint
	fmt.Sscanf(orderID, "OC-%d-", &businessID)
	if businessID == 0 {
		log.Printf("❌ PayHere notify: cannot parse businessID from order_id %s", orderID)
		c.String(http.StatusOK, "OK")
		return
	}

	// Determine billing cycle from the payment amount
	detectedPlan := models.PlanStarter // fallback
	detectedCycle := models.BillingMonthly
outer:
	for plan, cycles := range billingAmounts {
		for cycle, amt := range cycles {
			if fmt.Sprintf("%.2f", amt) == fmt.Sprintf("%.2f", amount) {
				detectedPlan = plan
				detectedCycle = cycle
				break outer
			}
		}
	}

	days := billingDays[detectedCycle]
	now := time.Now()
	expiresAt := now.AddDate(0, 0, days)

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		log.Printf("❌ PayHere notify: business %d not found", businessID)
		c.String(http.StatusOK, "OK")
		return
	}

	// If trial is still active, stack from trial end
	if biz.TrialExpiresAt != nil && biz.TrialExpiresAt.After(now) {
		expiresAt = biz.TrialExpiresAt.AddDate(0, 0, days)
	}

	// If already on a plan that hasn't expired, stack from expiry (overrides trial stack if both exist)
	if biz.PlanExpiresAt != nil && biz.PlanExpiresAt.After(now) {
		expiresAt = biz.PlanExpiresAt.AddDate(0, 0, days)
	}

	database.DB.Model(&biz).Updates(map[string]interface{}{
		"plan":             detectedPlan,
		"billing_cycle":    detectedCycle,
		"plan_expires_at":  expiresAt,
		"payhere_order_id": paymentID,
	})

	LogActivity(businessID, "system", 0, "plan_upgraded", "billing", orderID, map[string]interface{}{
		"cycle":      detectedCycle,
		"amount":     amount,
		"expires_at": expiresAt,
		"payment_id": paymentID,
	}, c.ClientIP(), "medium", biz.Name, detectedPlan)

	log.Printf("✅ PayHere: business %d upgraded to Starter (%s) — expires %s", businessID, detectedCycle, expiresAt.Format("2006-01-02"))
	c.String(http.StatusOK, "OK")
}
