package platform

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

const (
	CycleMonthly = models.BillingMonthly
	CycleAnnual  = models.BillingAnnual
)

type UsageEntitlements struct {
	ActiveTrial           bool
	PlanKey               string
	MaxProducts           int
	MaxRules              int
	MaxAIMessages         int
	MaxSystemMessages     int
	MaxRuleGens           int
	MaxSimulations        int
	MaxStorageBytes       int64
	MaxFileSizeBytes      int64
	CanUploadCloudinary   bool
	CanSendWhatsAppImages bool
	CanUseGeminiVision    bool
}

type BankDetailsResponse struct {
	Configured   bool   `json:"configured"`
	BankName     string `json:"bank_name"`
	Branch       string `json:"branch"`
	AccountNo    string `json:"account_no"`
	AccountName  string `json:"account_name"`
	SupportPhone string `json:"support_phone"`
}

func DefaultPlans() []models.SubscriptionPlan {
	return []models.SubscriptionPlan{
		{
			Key:               models.PlanFree,
			DisplayName:       "Free",
			Currency:          "LKR",
			IsActive:          true,
			IsPublic:          true,
			SortOrder:         10,
			MaxProducts:       models.FreeProductLimit,
			MaxRules:          models.FreeRuleLimit,
			MaxAIMessages:     models.FreeAILimit,
			MaxSystemMessages: models.FreeMsgLimit,
			MaxRuleGens:       models.FreeRuleGenLimit,
			MaxSimulations:    models.FreeSimulationLimit,
			MaxStorageBytes:   0,
			MaxFileSizeBytes:  0,
		},
		{
			Key:                   models.PlanStarter,
			DisplayName:           "Starter",
			Badge:                 "Popular",
			Currency:              "LKR",
			MonthlyPrice:          1490,
			AnnualPrice:           14900,
			IsActive:              true,
			IsPublic:              true,
			SortOrder:             20,
			MaxProducts:           100,
			MaxRules:              -1,
			MaxAIMessages:         models.StarterAILimit,
			MaxSystemMessages:     -1,
			MaxRuleGens:           models.StarterRuleGenLimit,
			MaxSimulations:        models.StarterSimulationLimit,
			MaxStorageBytes:       100 * 1024 * 1024,
			MaxFileSizeBytes:      2 * 1024 * 1024,
			CanUploadCloudinary:   true,
			CanSendWhatsAppImages: true,
		},
		{
			Key:                   models.PlanPro,
			DisplayName:           "Pro",
			Badge:                 "Power",
			Currency:              "LKR",
			MonthlyPrice:          3490,
			AnnualPrice:           34900,
			IsActive:              true,
			IsPublic:              true,
			SortOrder:             30,
			MaxProducts:           -1,
			MaxRules:              -1,
			MaxAIMessages:         models.ProAILimit,
			MaxSystemMessages:     -1,
			MaxRuleGens:           models.ProRuleGenLimit,
			MaxSimulations:        models.ProSimulationLimit,
			MaxStorageBytes:       500 * 1024 * 1024,
			MaxFileSizeBytes:      5 * 1024 * 1024,
			CanUploadCloudinary:   true,
			CanSendWhatsAppImages: true,
			CanUseGeminiVision:    true,
		},
		{
			Key:                   models.PlanTrial,
			DisplayName:           "Starter Trial",
			Currency:              "LKR",
			IsActive:              true,
			IsPublic:              false,
			SortOrder:             40,
			MaxProducts:           50,
			MaxRules:              models.TrialRuleLimit,
			MaxAIMessages:         models.TrialAILimit,
			MaxSystemMessages:     models.TrialMsgLimit,
			MaxRuleGens:           models.StarterRuleGenLimit,
			MaxSimulations:        models.TrialSimulationLimit,
			MaxStorageBytes:       10 * 1024 * 1024,
			MaxFileSizeBytes:      2 * 1024 * 1024,
			CanUploadCloudinary:   true,
			CanSendWhatsAppImages: true,
		},
	}
}

func EnsureBillingDefaults(db *gorm.DB) error {
	settings := models.PlatformBillingSettings{ID: 1}
	if err := db.Where("id = ?", 1).Attrs(models.PlatformBillingSettings{
		ID:           1,
		TrialDays:    models.TrialDurationDays,
		TrialPlanKey: models.PlanTrial,
	}).FirstOrCreate(&settings).Error; err != nil {
		return err
	}
	if settings.TrialDays == 0 || settings.TrialPlanKey == "" {
		updates := map[string]interface{}{}
		if settings.TrialDays == 0 {
			updates["trial_days"] = models.TrialDurationDays
		}
		if settings.TrialPlanKey == "" {
			updates["trial_plan_key"] = models.PlanTrial
		}
		if err := db.Model(&settings).Updates(updates).Error; err != nil {
			return err
		}
	}

	for _, plan := range DefaultPlans() {
		var existing models.SubscriptionPlan
		if err := db.Where("key = ?", plan.Key).Attrs(plan).FirstOrCreate(&existing).Error; err != nil {
			return err
		}
	}
	return nil
}

func GetBillingSettings(db *gorm.DB) (models.PlatformBillingSettings, error) {
	var settings models.PlatformBillingSettings
	err := db.First(&settings, 1).Error
	return settings, err
}

func GetBankDetails(db *gorm.DB) (BankDetailsResponse, error) {
	settings, err := GetBillingSettings(db)
	if err != nil {
		return BankDetailsResponse{}, err
	}
	return BankDetailsResponse{
		Configured: strings.TrimSpace(settings.BankName) != "" &&
			strings.TrimSpace(settings.BankBranch) != "" &&
			strings.TrimSpace(settings.BankAccountNo) != "" &&
			strings.TrimSpace(settings.BankAccountName) != "",
		BankName:     settings.BankName,
		Branch:       settings.BankBranch,
		AccountNo:    settings.BankAccountNo,
		AccountName:  settings.BankAccountName,
		SupportPhone: settings.SupportPhone,
	}, nil
}

func GetPlans(db *gorm.DB) ([]models.SubscriptionPlan, error) {
	var plans []models.SubscriptionPlan
	if err := db.Order("sort_order ASC, key ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	return plans, nil
}

func GetPlanMap(db *gorm.DB) (map[string]models.SubscriptionPlan, error) {
	plans, err := GetPlans(db)
	if err != nil {
		return nil, err
	}
	byKey := make(map[string]models.SubscriptionPlan, len(plans))
	for _, plan := range plans {
		byKey[plan.Key] = plan
	}
	return byKey, nil
}

func GetPlan(db *gorm.DB, key string) (models.SubscriptionPlan, error) {
	key = strings.ToLower(strings.TrimSpace(key))
	var plan models.SubscriptionPlan
	err := db.Where("key = ?", key).First(&plan).Error
	return plan, err
}

func AmountFor(db *gorm.DB, planKey, cycle string) (float64, error) {
	plan, err := GetPlan(db, planKey)
	if err != nil {
		return 0, err
	}
	if !plan.IsActive || !plan.IsPublic || plan.Key == models.PlanFree {
		return 0, fmt.Errorf("plan %q is not billable", planKey)
	}
	switch cycle {
	case CycleMonthly:
		if plan.MonthlyPrice <= 0 {
			return 0, fmt.Errorf("monthly price is not configured for %s", plan.Key)
		}
		return plan.MonthlyPrice, nil
	case CycleAnnual:
		if plan.AnnualPrice <= 0 {
			return 0, fmt.Errorf("annual price is not configured for %s", plan.Key)
		}
		return plan.AnnualPrice, nil
	default:
		return 0, fmt.Errorf("invalid billing cycle %q", cycle)
	}
}

func DaysForCycle(cycle string) (int, error) {
	switch cycle {
	case models.BillingMonthly:
		return 30, nil
	case models.BillingAnnual:
		return 365, nil
	default:
		return 0, fmt.Errorf("invalid billing cycle %q", cycle)
	}
}

func PublicPricing(db *gorm.DB) (map[string]map[string]float64, error) {
	plans, err := GetPlans(db)
	if err != nil {
		return nil, err
	}
	pricing := map[string]map[string]float64{}
	for _, plan := range plans {
		if !plan.IsPublic || !plan.IsActive || plan.Key == models.PlanFree {
			continue
		}
		pricing[plan.Key] = map[string]float64{
			models.BillingMonthly: plan.MonthlyPrice,
			models.BillingAnnual:  plan.AnnualPrice,
		}
	}
	return pricing, nil
}

func MatchAmount(db *gorm.DB, amount float64) (planKey string, cycle string, err error) {
	plans, err := GetPlans(db)
	if err != nil {
		return "", "", err
	}
	for _, plan := range plans {
		if !plan.IsActive || !plan.IsPublic || plan.Key == models.PlanFree {
			continue
		}
		if sameMoney(plan.MonthlyPrice, amount) {
			return plan.Key, models.BillingMonthly, nil
		}
		if sameMoney(plan.AnnualPrice, amount) {
			return plan.Key, models.BillingAnnual, nil
		}
	}
	return "", "", errors.New("amount does not match an active plan price")
}

func sameMoney(a, b float64) bool {
	return math.Abs(a-b) < 0.01
}

func EntitlementsFromPlan(plan models.SubscriptionPlan) UsageEntitlements {
	return UsageEntitlements{
		PlanKey:               plan.Key,
		MaxProducts:           plan.MaxProducts,
		MaxRules:              plan.MaxRules,
		MaxAIMessages:         plan.MaxAIMessages,
		MaxSystemMessages:     plan.MaxSystemMessages,
		MaxRuleGens:           plan.MaxRuleGens,
		MaxSimulations:        plan.MaxSimulations,
		MaxStorageBytes:       plan.MaxStorageBytes,
		MaxFileSizeBytes:      plan.MaxFileSizeBytes,
		CanUploadCloudinary:   plan.CanUploadCloudinary,
		CanSendWhatsAppImages: plan.CanSendWhatsAppImages,
		CanUseGeminiVision:    plan.CanUseGeminiVision,
	}
}

func GetPlanEntitlements(db *gorm.DB, planKey string) (UsageEntitlements, error) {
	plan, err := GetPlan(db, planKey)
	if err != nil {
		return UsageEntitlements{}, err
	}
	return EntitlementsFromPlan(plan), nil
}

func GetBusinessEntitlements(db *gorm.DB, biz models.Business, now time.Time) (UsageEntitlements, error) {
	settings, err := GetBillingSettings(db)
	if err != nil {
		return UsageEntitlements{}, err
	}

	planKey := models.PlanFree
	activeTrial := false
	paidPlanActive := biz.Plan != models.PlanFree && (biz.PlanExpiresAt == nil || biz.PlanExpiresAt.After(now))

	switch {
	case paidPlanActive:
		planKey = biz.Plan
	case biz.TrialExpiresAt != nil && biz.TrialExpiresAt.After(now):
		planKey = settings.TrialPlanKey
		activeTrial = true
	}

	ent, err := GetPlanEntitlements(db, planKey)
	if err != nil {
		return UsageEntitlements{}, err
	}
	ent.ActiveTrial = activeTrial
	return ent, nil
}

func PlanLimitsResponse(plans []models.SubscriptionPlan) map[string]map[string]interface{} {
	out := make(map[string]map[string]interface{}, len(plans))
	for _, plan := range plans {
		out[plan.Key] = map[string]interface{}{
			"products":        plan.MaxProducts,
			"rules":           plan.MaxRules,
			"ai_messages":     plan.MaxAIMessages,
			"system_messages": plan.MaxSystemMessages,
			"rule_gens":       plan.MaxRuleGens,
			"simulations":     plan.MaxSimulations,
			"storage_bytes":   plan.MaxStorageBytes,
			"max_file_size":   plan.MaxFileSizeBytes,
			"cloudinary":      plan.CanUploadCloudinary,
			"whatsapp_images": plan.CanSendWhatsAppImages,
			"gemini_vision":   plan.CanUseGeminiVision,
			"display_name":    plan.DisplayName,
			"badge":           plan.Badge,
			"description":     plan.Description,
			"monthly_price":   plan.MonthlyPrice,
			"annual_price":    plan.AnnualPrice,
			"currency":        plan.Currency,
			"is_public":       plan.IsPublic,
			"is_active":       plan.IsActive,
			"sort_order":      plan.SortOrder,
		}
	}
	return out
}

func PublicPlans(plans []models.SubscriptionPlan) []models.SubscriptionPlan {
	publicPlans := make([]models.SubscriptionPlan, 0, len(plans))
	for _, plan := range plans {
		if plan.IsPublic {
			publicPlans = append(publicPlans, plan)
		}
	}
	sort.SliceStable(publicPlans, func(i, j int) bool {
		return publicPlans[i].SortOrder < publicPlans[j].SortOrder
	})
	return publicPlans
}
