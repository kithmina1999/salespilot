package handlers

import (
	"fmt"
	"net/http"
	"reflect"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
)

const billingSettingsConfirmPhrase = "UPDATE BILLING SETTINGS"

type billingSettingsPlanRequest struct {
	Key                   string  `json:"key"`
	DisplayName           string  `json:"display_name"`
	Badge                 string  `json:"badge"`
	Description           string  `json:"description"`
	Currency              string  `json:"currency"`
	MonthlyPrice          float64 `json:"monthly_price"`
	AnnualPrice           float64 `json:"annual_price"`
	IsActive              bool    `json:"is_active"`
	IsPublic              bool    `json:"is_public"`
	SortOrder             int     `json:"sort_order"`
	MaxProducts           int     `json:"max_products"`
	MaxRules              int     `json:"max_rules"`
	MaxAIMessages         int     `json:"max_ai_messages"`
	MaxSystemMessages     int     `json:"max_system_messages"`
	MaxRuleGens           int     `json:"max_rule_gens"`
	MaxSimulations        int     `json:"max_simulations"`
	MaxStorageBytes       int64   `json:"max_storage_bytes"`
	MaxFileSizeBytes      int64   `json:"max_file_size_bytes"`
	CanUploadCloudinary   bool    `json:"can_upload_cloudinary"`
	CanSendWhatsAppImages bool    `json:"can_send_whatsapp_images"`
	CanUseGeminiVision    bool    `json:"can_use_gemini_vision"`
}

type billingSettingsBankRequest struct {
	BankName        string `json:"bank_name"`
	BankBranch      string `json:"bank_branch"`
	BankAccountNo   string `json:"bank_account_no"`
	BankAccountName string `json:"bank_account_name"`
	SupportPhone    string `json:"support_phone"`
	TrialDays       int    `json:"trial_days"`
	TrialPlanKey    string `json:"trial_plan_key"`
}

type updateBillingSettingsRequest struct {
	Bank           billingSettingsBankRequest   `json:"bank"`
	Plans          []billingSettingsPlanRequest `json:"plans"`
	Reason         string                       `json:"reason"`
	Confirm        string                       `json:"confirm"`
	AccountConfirm string                       `json:"account_confirm"`
}

func GetSystemBillingSettings(c *gin.Context) {
	settings, err := platform.GetBillingSettings(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load billing settings"})
		return
	}
	plans, err := platform.GetPlans(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load subscription plans"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"bank": gin.H{
			"bank_name":         settings.BankName,
			"bank_branch":       settings.BankBranch,
			"bank_account_no":   settings.BankAccountNo,
			"bank_account_name": settings.BankAccountName,
			"support_phone":     settings.SupportPhone,
			"trial_days":        settings.TrialDays,
			"trial_plan_key":    settings.TrialPlanKey,
		},
		"plans":               plans,
		"confirmation_phrase": billingSettingsConfirmPhrase,
	})
}

func UpdateSystemBillingSettings(c *gin.Context) {
	var req updateBillingSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if err := ValidateHighRiskAction(req.Reason, req.Confirm, billingSettingsConfirmPhrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	current, err := platform.GetBillingSettings(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load existing billing settings"})
		return
	}
	oldPlans, err := platform.GetPlans(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load existing plans"})
		return
	}

	newBank, err := sanitizeBankSettings(req.Bank)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	accountChanged := strings.TrimSpace(current.BankAccountNo) != strings.TrimSpace(newBank.BankAccountNo)
	if accountChanged && strings.TrimSpace(req.AccountConfirm) != newBank.BankAccountNo {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Re-enter the new account number to confirm the bank account change"})
		return
	}

	newPlans, err := sanitizePlans(req.Plans)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start settings update"})
		return
	}

	if err := tx.Model(&current).Updates(map[string]interface{}{
		"bank_name":         newBank.BankName,
		"bank_branch":       newBank.BankBranch,
		"bank_account_no":   newBank.BankAccountNo,
		"bank_account_name": newBank.BankAccountName,
		"support_phone":     newBank.SupportPhone,
		"trial_days":        newBank.TrialDays,
		"trial_plan_key":    newBank.TrialPlanKey,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update bank settings"})
		return
	}

	for _, plan := range newPlans {
		if err := tx.Model(&models.SubscriptionPlan{}).Where("key = ?", plan.Key).Updates(planUpdateMap(plan)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update plan " + plan.Key})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit billing settings"})
		return
	}

	actorID := uint(0)
	if v, ok := c.Get("super_admin_id"); ok {
		if id, ok := v.(uint); ok {
			actorID = id
		}
	}
	LogActivity(0, "super_admin", actorID, "billing_settings_updated", "system_setting", "billing", map[string]interface{}{
		"reason":          req.Reason,
		"bank_changed":    bankChanged(current, newBank),
		"account_changed": accountChanged,
		"old_bank":        redactedBankMeta(current),
		"new_bank":        redactedBankMeta(newBank),
		"plan_changes":    planChangeMeta(oldPlans, newPlans),
	}, c.ClientIP(), "high", "platform", "")

	c.JSON(http.StatusOK, gin.H{"message": "Billing settings updated"})
}

func sanitizeBankSettings(in billingSettingsBankRequest) (models.PlatformBillingSettings, error) {
	out := models.PlatformBillingSettings{
		ID:              1,
		BankName:        strings.TrimSpace(in.BankName),
		BankBranch:      strings.TrimSpace(in.BankBranch),
		BankAccountNo:   strings.TrimSpace(in.BankAccountNo),
		BankAccountName: strings.TrimSpace(in.BankAccountName),
		SupportPhone:    strings.TrimSpace(in.SupportPhone),
		TrialDays:       in.TrialDays,
		TrialPlanKey:    strings.ToLower(strings.TrimSpace(in.TrialPlanKey)),
	}
	if out.TrialDays <= 0 || out.TrialDays > 90 {
		return out, fmt.Errorf("trial days must be between 1 and 90")
	}
	if out.TrialPlanKey == "" {
		out.TrialPlanKey = models.PlanTrial
	}
	bankValues := []string{out.BankName, out.BankBranch, out.BankAccountNo, out.BankAccountName}
	anyBankValue := false
	for _, value := range bankValues {
		if value != "" {
			anyBankValue = true
			break
		}
	}
	if anyBankValue {
		for _, value := range bankValues {
			if value == "" {
				return out, fmt.Errorf("bank name, branch, account number, and account name are all required")
			}
		}
	}
	if len(out.BankName) > 120 || len(out.BankBranch) > 120 || len(out.BankAccountNo) > 80 || len(out.BankAccountName) > 160 {
		return out, fmt.Errorf("one or more bank fields are too long")
	}
	return out, nil
}

func sanitizePlans(in []billingSettingsPlanRequest) ([]models.SubscriptionPlan, error) {
	if len(in) == 0 {
		return nil, fmt.Errorf("at least one plan is required")
	}
	allowed := map[string]bool{
		models.PlanFree:    true,
		models.PlanStarter: true,
		models.PlanPro:     true,
		models.PlanTrial:   true,
	}
	seen := map[string]bool{}
	plans := make([]models.SubscriptionPlan, 0, len(in))
	for _, p := range in {
		key := strings.ToLower(strings.TrimSpace(p.Key))
		if !allowed[key] {
			return nil, fmt.Errorf("unsupported plan key %q", p.Key)
		}
		if seen[key] {
			return nil, fmt.Errorf("duplicate plan key %q", key)
		}
		seen[key] = true
		displayName := strings.TrimSpace(p.DisplayName)
		if displayName == "" {
			return nil, fmt.Errorf("display name is required for %s", key)
		}
		currency := strings.ToUpper(strings.TrimSpace(p.Currency))
		if currency == "" {
			currency = "LKR"
		}
		if currency != "LKR" {
			return nil, fmt.Errorf("only LKR is supported for now")
		}
		if key == models.PlanStarter || key == models.PlanPro {
			if p.MonthlyPrice <= 0 || p.AnnualPrice <= 0 {
				return nil, fmt.Errorf("%s monthly and annual prices must be greater than zero", key)
			}
		} else if p.MonthlyPrice < 0 || p.AnnualPrice < 0 {
			return nil, fmt.Errorf("%s prices cannot be negative", key)
		}
		if err := validateLimit("products", p.MaxProducts); err != nil {
			return nil, err
		}
		if err := validateLimit("rules", p.MaxRules); err != nil {
			return nil, err
		}
		if err := validateLimit("AI messages", p.MaxAIMessages); err != nil {
			return nil, err
		}
		if err := validateLimit("system messages", p.MaxSystemMessages); err != nil {
			return nil, err
		}
		if err := validateLimit("rule generations", p.MaxRuleGens); err != nil {
			return nil, err
		}
		if err := validateLimit("simulations", p.MaxSimulations); err != nil {
			return nil, err
		}
		if p.MaxStorageBytes < -1 || p.MaxFileSizeBytes < 0 {
			return nil, fmt.Errorf("storage and file-size values cannot be below their allowed minimum")
		}
		if p.MaxStorageBytes > 0 && p.MaxFileSizeBytes > p.MaxStorageBytes {
			return nil, fmt.Errorf("%s max file size cannot exceed storage quota", key)
		}

		plans = append(plans, models.SubscriptionPlan{
			Key:                   key,
			DisplayName:           displayName,
			Badge:                 strings.TrimSpace(p.Badge),
			Description:           strings.TrimSpace(p.Description),
			Currency:              currency,
			MonthlyPrice:          p.MonthlyPrice,
			AnnualPrice:           p.AnnualPrice,
			IsActive:              p.IsActive,
			IsPublic:              p.IsPublic,
			SortOrder:             p.SortOrder,
			MaxProducts:           p.MaxProducts,
			MaxRules:              p.MaxRules,
			MaxAIMessages:         p.MaxAIMessages,
			MaxSystemMessages:     p.MaxSystemMessages,
			MaxRuleGens:           p.MaxRuleGens,
			MaxSimulations:        p.MaxSimulations,
			MaxStorageBytes:       p.MaxStorageBytes,
			MaxFileSizeBytes:      p.MaxFileSizeBytes,
			CanUploadCloudinary:   p.CanUploadCloudinary,
			CanSendWhatsAppImages: p.CanSendWhatsAppImages,
			CanUseGeminiVision:    p.CanUseGeminiVision,
		})
	}
	if !seen[models.PlanFree] || !seen[models.PlanStarter] || !seen[models.PlanPro] || !seen[models.PlanTrial] {
		return nil, fmt.Errorf("free, starter, pro, and trial plans are required")
	}
	return plans, nil
}

func planUpdateMap(plan models.SubscriptionPlan) map[string]interface{} {
	return map[string]interface{}{
		"display_name":              plan.DisplayName,
		"badge":                     plan.Badge,
		"description":               plan.Description,
		"currency":                  plan.Currency,
		"monthly_price":             plan.MonthlyPrice,
		"annual_price":              plan.AnnualPrice,
		"is_active":                 plan.IsActive,
		"is_public":                 plan.IsPublic,
		"sort_order":                plan.SortOrder,
		"max_products":              plan.MaxProducts,
		"max_rules":                 plan.MaxRules,
		"max_ai_messages":           plan.MaxAIMessages,
		"max_system_messages":       plan.MaxSystemMessages,
		"max_rule_gens":             plan.MaxRuleGens,
		"max_simulations":           plan.MaxSimulations,
		"max_storage_bytes":         plan.MaxStorageBytes,
		"max_file_size_bytes":       plan.MaxFileSizeBytes,
		"can_upload_cloudinary":     plan.CanUploadCloudinary,
		"can_send_whats_app_images": plan.CanSendWhatsAppImages,
		"can_use_gemini_vision":     plan.CanUseGeminiVision,
	}
}

func validateLimit(label string, value int) error {
	if value < -1 {
		return fmt.Errorf("%s limit must be -1 for unlimited or zero and above", label)
	}
	return nil
}

func bankChanged(old models.PlatformBillingSettings, next models.PlatformBillingSettings) bool {
	return strings.TrimSpace(old.BankName) != strings.TrimSpace(next.BankName) ||
		strings.TrimSpace(old.BankBranch) != strings.TrimSpace(next.BankBranch) ||
		strings.TrimSpace(old.BankAccountNo) != strings.TrimSpace(next.BankAccountNo) ||
		strings.TrimSpace(old.BankAccountName) != strings.TrimSpace(next.BankAccountName) ||
		strings.TrimSpace(old.SupportPhone) != strings.TrimSpace(next.SupportPhone) ||
		old.TrialDays != next.TrialDays ||
		strings.TrimSpace(old.TrialPlanKey) != strings.TrimSpace(next.TrialPlanKey)
}

func redactedBankMeta(settings models.PlatformBillingSettings) map[string]interface{} {
	return map[string]interface{}{
		"bank_name":         settings.BankName,
		"bank_branch":       settings.BankBranch,
		"bank_account_no":   maskAccount(settings.BankAccountNo),
		"bank_account_name": settings.BankAccountName,
		"support_phone":     settings.SupportPhone,
		"trial_days":        settings.TrialDays,
		"trial_plan_key":    settings.TrialPlanKey,
	}
}

func maskAccount(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return "****"
	}
	return strings.Repeat("*", len(value)-4) + value[len(value)-4:]
}

func planChangeMeta(oldPlans []models.SubscriptionPlan, newPlans []models.SubscriptionPlan) []map[string]interface{} {
	oldByKey := map[string]models.SubscriptionPlan{}
	for _, plan := range oldPlans {
		oldByKey[plan.Key] = plan
	}
	changes := []map[string]interface{}{}
	for _, next := range newPlans {
		old := oldByKey[next.Key]
		oldMeta := compactPlanMeta(old)
		newMeta := compactPlanMeta(next)
		if reflect.DeepEqual(oldMeta, newMeta) {
			continue
		}
		changes = append(changes, map[string]interface{}{
			"key": next.Key,
			"old": oldMeta,
			"new": newMeta,
		})
	}
	sort.SliceStable(changes, func(i, j int) bool {
		return fmt.Sprint(changes[i]["key"]) < fmt.Sprint(changes[j]["key"])
	})
	return changes
}

func compactPlanMeta(plan models.SubscriptionPlan) map[string]interface{} {
	return map[string]interface{}{
		"display_name":        plan.DisplayName,
		"monthly_price":       plan.MonthlyPrice,
		"annual_price":        plan.AnnualPrice,
		"is_active":           plan.IsActive,
		"max_products":        plan.MaxProducts,
		"max_rules":           plan.MaxRules,
		"max_ai_messages":     plan.MaxAIMessages,
		"max_system_messages": plan.MaxSystemMessages,
		"max_rule_gens":       plan.MaxRuleGens,
		"max_simulations":     plan.MaxSimulations,
	}
}

func GetBillingBankDetails(c *gin.Context) {
	bank, err := platform.GetBankDetails(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bank details"})
		return
	}
	c.JSON(http.StatusOK, bank)
}

func GetBillingOptions(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.Select("id", "wa_status", "connected_at", "wa_phone_number_id", "waba_id", "wa_access_token").First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load business details"})
		return
	}
	checkoutType := normalizeCheckoutType(c.Query("checkout_type"))
	if checkoutType == "" {
		switch strings.ToLower(strings.TrimSpace(c.Query("plan"))) {
		case "addons":
			checkoutType = checkoutTypeAddonOnly
		case models.PlanStarter, models.PlanPro:
			checkoutType = checkoutTypeSubscription
		}
	}

	bank, err := platform.GetBankDetails(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load bank details"})
		return
	}
	plans, err := platform.GetPlans(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load plan catalog"})
		return
	}
	pricing, err := platform.PublicPricing(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load pricing"})
		return
	}

	var rawAddons []models.BillingAddon
	if err := database.DB.Where("is_active = ? AND visibility = ?", true, models.AddonVisibilityPublic).Order("sort_order ASC").Find(&rawAddons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load addons"})
		return
	}

	purchaseStates, err := loadAddonPurchaseStates(database.DB, businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load purchased addons"})
		return
	}
	purchasedAddons := uniquePurchasedAddonKeys(purchaseStates)

	type addonResponse struct {
		models.BillingAddon
		Includes       []string `json:"includes"`
		NotIncluded    []string `json:"not_included"`
		IsAvailable    bool     `json:"is_available"`
		DisabledReason string   `json:"disabled_reason"`
	}

	var addons []addonResponse
	for _, a := range rawAddons {
		isAvailable := true
		disabledReason := ""

		if reason := billingAddonDisabledReason(a, biz, checkoutType, purchaseStates); reason != "" {
			isAvailable = false
			disabledReason = reason
		}

		var includes []string
		for _, s := range strings.Split(a.IncludesText, "\n") {
			if strings.TrimSpace(s) != "" {
				includes = append(includes, strings.TrimSpace(s))
			}
		}
		var notIncluded []string
		for _, s := range strings.Split(a.NotIncludedText, "\n") {
			if strings.TrimSpace(s) != "" {
				notIncluded = append(notIncluded, strings.TrimSpace(s))
			}
		}

		addons = append(addons, addonResponse{
			BillingAddon:   a,
			Includes:       includes,
			NotIncluded:    notIncluded,
			IsAvailable:    isAvailable,
			DisabledReason: disabledReason,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"bank_details":     bank,
		"pricing":          pricing,
		"plans":            platform.PublicPlans(plans),
		"plan_limits":      platform.PlanLimitsResponse(plans),
		"addons":           addons,
		"purchased_addons": purchasedAddons,
		"business_connection_status": gin.H{
			"wa_status":    effectiveWAStatus(biz),
			"connected_at": biz.ConnectedAt,
		},
	})
}
