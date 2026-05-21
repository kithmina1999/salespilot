package handlers

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
	"github.com/kithmina1999/salespilot/utils"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/billing/submit-proof  (Tenant JWT)
// Accepts multipart/form-data: image + billing_cycle
// ─────────────────────────────────────────────────────────────────
func SubmitPaymentProof(c *gin.Context) {
	businessID := c.GetUint("business_id")

	// Fetch business info
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Business not found"})
		return
	}

	// Fetch the admin user email (first admin of the business)
	var user models.User
	if err := database.DB.Where("business_id = ? AND role = 'admin'", businessID).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User account not found"})
		return
	}

	cycle := strings.ToLower(strings.TrimSpace(c.PostForm("billing_cycle")))
	plan := strings.ToLower(strings.TrimSpace(c.PostForm("plan")))
	addonKeys := c.PostFormArray("addon_keys")
	if len(addonKeys) == 0 {
		addonKeys = c.PostFormArray("addon_keys[]") // fallback
	}

	var checkoutType string
	if plan != "" && len(addonKeys) > 0 {
		checkoutType = "mixed"
	} else if plan != "" {
		checkoutType = "subscription"
	} else if len(addonKeys) > 0 {
		checkoutType = "addon_only"
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Must select a plan or at least one add-on"})
		return
	}

	if checkoutType == "subscription" || checkoutType == "mixed" {
		if plan == "" || cycle == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Plan and billing cycle are required for subscription checkout"})
			return
		}
	}

	// Check existing pending proofs
	var pendingProofs []models.PaymentProof
	database.DB.Preload("LineItems").Where("business_id = ? AND status = ?", businessID, models.PaymentStatusPending).Find(&pendingProofs)

	if checkoutType == "subscription" || checkoutType == "mixed" {
		for _, p := range pendingProofs {
			if p.CheckoutType == "subscription" || p.CheckoutType == "mixed" {
				c.JSON(http.StatusConflict, gin.H{
					"error":        "You already have a subscription payment proof waiting for approval. Please wait for it to be reviewed.",
					"submitted_at": p.CreatedAt,
				})
				return
			}
		}
	}

	var lineItems []models.PaymentProofLineItem
	var planAmount, oneTimeTotal, monthlyAddonTotal, totalAmount float64

	if checkoutType == "subscription" || checkoutType == "mixed" {
		amt, err := platform.AmountFor(database.DB, plan, cycle)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid billing configuration: " + err.Error()})
			return
		}
		planAmount = amt
		totalAmount += amt

		planObj, _ := platform.GetPlan(database.DB, plan)
		lineItems = append(lineItems, models.PaymentProofLineItem{
			ItemType:    models.ItemTypeSubscription,
			Key:         plan,
			Name:        planObj.DisplayName + " Plan",
			Description: "Subscription plan: " + cycle,
			BillingType: cycle,
			Quantity:    1,
			UnitPrice:   amt,
			Total:       amt,
		})
	}

	if len(addonKeys) > 0 {
		var purchasedAddons []string
		database.DB.Raw(`
			SELECT l.key
			FROM payment_proof_line_items l
			JOIN payment_proofs p ON p.id = l.payment_proof_id
			WHERE p.business_id = ? AND p.status IN (?, ?) AND l.item_type = ?
		`, businessID, models.PaymentStatusPending, models.PaymentStatusApproved, models.ItemTypeAddon).Scan(&purchasedAddons)

		purchasedMap := make(map[string]bool)
		for _, k := range purchasedAddons {
			purchasedMap[k] = true
		}

		for _, key := range addonKeys {
			var addon models.BillingAddon
			if err := database.DB.Where("key = ? AND is_active = ?", key, true).First(&addon).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or inactive addon: " + key})
				return
			}

			if addon.PurchasePolicy == models.PurchasePolicyOncePerBusiness && purchasedMap[key] {
				c.JSON(http.StatusConflict, gin.H{"error": "Addon already purchased or pending: " + addon.Name})
				return
			}

			if addon.Key == "dfy_meta_setup" && biz.WAStatus == "connected" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Business is already connected, select Reconfiguration Support instead."})
				return
			}

			if addon.BillingType == models.BillingTypeOneTime {
				oneTimeTotal += addon.Amount
			} else {
				monthlyAddonTotal += addon.Amount
			}
			totalAmount += addon.Amount

			lineItems = append(lineItems, models.PaymentProofLineItem{
				ItemType:    models.ItemTypeAddon,
				Key:         addon.Key,
				Name:        addon.Name,
				Description: addon.Description,
				BillingType: addon.BillingType,
				Quantity:    1,
				UnitPrice:   addon.Amount,
				Total:       addon.Amount,
			})
		}
	}

	// Get the uploaded screenshot
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payment screenshot image is required"})
		return
	}

	// Validate file type (images only)
	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only image files are accepted (JPG, PNG, etc.)"})
		return
	}

	// Limit to 5MB
	if file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image must be under 5MB"})
		return
	}

	// Upload to Cloudinary
	cld, err := cloudinary.NewFromURL(os.Getenv("CLOUDINARY_URL"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize image storage"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read uploaded file"})
		return
	}
	defer src.Close()

	publicID := fmt.Sprintf("proof-%d-%d", businessID, time.Now().Unix())
	resp, err := cld.Upload.Upload(context.Background(), src, uploader.UploadParams{
		Folder:   "salespilot/payments",
		PublicID: publicID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload screenshot: " + err.Error()})
		return
	}

	// Create PaymentProof record
	proof := models.PaymentProof{
		BusinessID:        businessID,
		BusinessName:      biz.Name,
		BusinessPhone:     biz.Phone,
		BusinessEmail:     user.Email,
		CheckoutType:      checkoutType,
		BillingCycle:      cycle,
		Plan:              plan,
		Amount:            totalAmount,
		PlanAmount:        planAmount,
		OneTimeTotal:      oneTimeTotal,
		MonthlyAddonTotal: monthlyAddonTotal,
		TotalAmount:       totalAmount,
		ScreenshotURL:     resp.SecureURL,
		Status:            models.PaymentStatusPending,
		LineItems:         lineItems,
	}

	if err := database.DB.Create(&proof).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save payment proof"})
		return
	}

	log.Printf("💰 New payment proof submitted: Business %d (%s) — %s — LKR %.0f", businessID, biz.Name, cycle, totalAmount)

	LogActivity(businessID, "user", c.GetUint("user_id"), "payment_proof_submitted", "billing", strconv.FormatUint(uint64(proof.ID), 10),
		map[string]interface{}{"cycle": cycle, "amount": totalAmount, "checkout_type": checkoutType}, c.ClientIP(), "medium", biz.Name, biz.Plan)

	c.JSON(http.StatusCreated, gin.H{
		"message":       "Payment proof submitted successfully! Our team will verify and send your activation code via email within a few hours.",
		"proof_id":      proof.ID,
		"status":        proof.Status,
		"billing_cycle": cycle,
		"amount":        totalAmount,
		"checkout_type": checkoutType,
	})
}

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/billing/payment-status  (Tenant JWT)
// Returns the latest payment proof status for the business
// ─────────────────────────────────────────────────────────────────
func GetPaymentStatus(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var proof models.PaymentProof
	if err := database.DB.Where("business_id = ?", businessID).Order("created_at DESC").First(&proof).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"has_proof": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_proof":       true,
		"status":          proof.Status,
		"checkout_type":   proof.CheckoutType,
		"billing_cycle":   proof.BillingCycle,
		"plan":            proof.Plan,
		"amount":          proof.Amount,
		"activation_code": proof.ActivationCode, // non-empty only if approved
		"admin_note":      proof.AdminNote,      // non-empty only if rejected
		"submitted_at":    proof.CreatedAt,
		"reviewed_at":     proof.ReviewedAt,
	})
}

// ─────────────────────────────────────────────────────────────────
// GET /system/payments  (Master Admin)
// Returns all payment proofs, filterable by status
// ─────────────────────────────────────────────────────────────────
func ListPaymentProofs(c *gin.Context) {
	status := c.Query("status") // pending | approved | rejected | (empty = all)

	query := database.DB.Order("created_at DESC")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var proofs []models.PaymentProof
	if err := query.Preload("LineItems").Find(&proofs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payment proofs"})
		return
	}

	var pendingCount, approvedCount int64
	database.DB.Model(&models.PaymentProof{}).Where("status = ?", models.PaymentStatusPending).Count(&pendingCount)
	database.DB.Model(&models.PaymentProof{}).Where("status = ?", models.PaymentStatusApproved).Count(&approvedCount)

	c.JSON(http.StatusOK, gin.H{
		"proofs":         proofs,
		"total":          len(proofs),
		"pending_count":  pendingCount,
		"approved_count": approvedCount,
	})
}

// ─────────────────────────────────────────────────────────────────
// POST /system/payments/:id/approve  (Master Admin)
// Generates activation code, emails it, updates proof status
// ─────────────────────────────────────────────────────────────────
func ApprovePayment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proof ID"})
		return
	}

	var proof models.PaymentProof
	if err := database.DB.Preload("LineItems").First(&proof, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment proof not found"})
		return
	}

	if proof.Status != models.PaymentStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Cannot approve a proof that is already: %s", proof.Status)})
		return
	}

	var code string
	now := time.Now()

	// Create BillingServicePurchases for addon line items
	for _, li := range proof.LineItems {
		if li.ItemType == models.ItemTypeAddon {
			database.DB.Create(&models.BillingServicePurchase{
				BusinessID:     proof.BusinessID,
				AddonKey:       li.Key,
				PaymentProofID: proof.ID,
				Status:         models.ServiceStatusPaid,
				PurchasedAt:    now,
			})
		}
	}

	if proof.CheckoutType == "subscription" || proof.CheckoutType == "mixed" {
		code = generateProofActivationCode(proof.Plan)

		durationDays, err := platform.DaysForCycle(proof.BillingCycle)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid billing cycle on payment proof"})
			return
		}

		activationCode := models.ActivationCode{
			Code:         code,
			Plan:         proof.Plan,
			BillingCycle: proof.BillingCycle,
			DurationDays: durationDays,
			Note:         fmt.Sprintf("Auto-generated from payment proof #%d — %s", proof.ID, proof.BusinessName),
			TargetPhone:  proof.BusinessPhone,
		}
		if err := database.DB.Create(&activationCode).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate activation code: " + err.Error()})
			return
		}

		// Send email asynchronously
		go func() {
			if err := utils.SendActivationCodeEmail(
				proof.BusinessEmail,
				proof.BusinessName,
				code,
				proof.Plan,
				proof.BillingCycle,
				durationDays,
			); err != nil {
				log.Printf("⚠️ Failed to send activation code email to %s: %v", proof.BusinessEmail, err)
			}
		}()
	} else {
		// TODO: Add-on only confirmation email if needed
		log.Printf("ℹ️ Add-on only payment approved for %s, no activation code generated.", proof.BusinessName)
	}

	// Update PaymentProof
	if err := database.DB.Model(&proof).Updates(map[string]interface{}{
		"status":          models.PaymentStatusApproved,
		"activation_code": code,
		"reviewed_at":     &now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proof status"})
		return
	}

	LogActivity(proof.BusinessID, "super_admin", 0, "payment_approved", "billing", strconv.FormatUint(uint64(proof.ID), 10),
		map[string]interface{}{"proof_id": proof.ID, "cycle": proof.BillingCycle, "amount": proof.Amount, "checkout_type": proof.CheckoutType},
		c.ClientIP(), "high", proof.BusinessName, proof.Plan)

	log.Printf("✅ Payment proof #%d approved for %s", proof.ID, proof.BusinessName)

	if code != "" {
		c.JSON(http.StatusOK, gin.H{
			"message":         fmt.Sprintf("Payment approved! Code %s generated and emailed to %s.", code, proof.BusinessEmail),
			"activation_code": code,
			"emailed_to":      proof.BusinessEmail,
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"message": "Service payment approved successfully! Tasks have been created for fulfillment.",
		})
	}
}

// ─────────────────────────────────────────────────────────────────
// POST /system/payments/:id/reject  (Master Admin)
// Body: { "reason": "Screenshot unclear, please resubmit" }
// ─────────────────────────────────────────────────────────────────
func RejectPayment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proof ID"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A rejection reason is required"})
		return
	}

	var proof models.PaymentProof
	if err := database.DB.First(&proof, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment proof not found"})
		return
	}

	if proof.Status != models.PaymentStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Cannot reject a proof that is already: %s", proof.Status)})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&proof).Updates(map[string]interface{}{
		"status":      models.PaymentStatusRejected,
		"admin_note":  req.Reason,
		"reviewed_at": &now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proof status"})
		return
	}

	LogActivity(proof.BusinessID, "super_admin", 0, "payment_rejected", "billing", strconv.FormatUint(uint64(proof.ID), 10),
		map[string]interface{}{"reason": req.Reason, "amount": proof.Amount},
		c.ClientIP(), "medium", proof.BusinessName, "")

	log.Printf("❌ Payment proof #%d rejected for %s — Reason: %s", proof.ID, proof.BusinessName, req.Reason)

	c.JSON(http.StatusOK, gin.H{
		"message": "Payment proof rejected. The tenant will see the reason on their dashboard.",
		"reason":  req.Reason,
	})
}

// generateProofActivationCode creates a BSS-STR-XXXX code (variant of the shared logic, no DB dependency needed here)
func generateProofActivationCode(plan string) string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	planTag := "STR"
	if plan == models.PlanPro || plan == "pro" {
		planTag = "PRO"
	} else if plan == "free" {
		planTag = "FRE"
	}
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 4)
	for i := range b {
		b[i] = charset[r.Intn(len(charset))]
	}
	return fmt.Sprintf("BSS-%s-%s", planTag, string(b))
}
