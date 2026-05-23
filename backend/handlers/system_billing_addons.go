package handlers

import (
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

const billingAddonsConfirmPhrase = "UPDATE ADDON SERVICES"

type billingAddonRequest struct {
	Name                 string  `json:"name"`
	Description          string  `json:"description"`
	Amount               float64 `json:"amount"`
	BillingType          string  `json:"billing_type"`
	PurchasePolicy       string  `json:"purchase_policy"`
	Badge                string  `json:"badge"`
	Visibility           string  `json:"visibility"`
	RequiresWAStatus     string  `json:"requires_wa_status"`
	CheckoutAvailability string  `json:"checkout_availability"`
	IncludesText         string  `json:"includes_text"`
	NotIncludedText      string  `json:"not_included_text"`
	IsActive             bool    `json:"is_active"`
	SortOrder            int     `json:"sort_order"`
	Reason               string  `json:"reason"`
	Confirm              string  `json:"confirm"`
}

func ListSystemBillingAddons(c *gin.Context) {
	var addons []models.BillingAddon
	if err := database.DB.Order("sort_order ASC, key ASC").Find(&addons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load addons"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"addons":              addons,
		"confirmation_phrase": billingAddonsConfirmPhrase,
	})
}

func validateBillingAddonRequest(req billingAddonRequest, isCreate bool) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if len(req.Name) > 80 {
		return fmt.Errorf("name exceeds max length of 80")
	}
	if len(req.Description) > 500 {
		return fmt.Errorf("description exceeds max length of 500")
	}
	if len(req.Badge) > 30 {
		return fmt.Errorf("badge exceeds max length of 30")
	}
	if len(req.IncludesText) > 1500 {
		return fmt.Errorf("includes text exceeds max length of 1500")
	}
	if len(req.NotIncludedText) > 1500 {
		return fmt.Errorf("not included text exceeds max length of 1500")
	}
	if req.Amount < 0 {
		return fmt.Errorf("amount cannot be negative")
	}

	visibility := req.Visibility
	if visibility == "" {
		visibility = models.AddonVisibilityPublic
	}
	if visibility != models.AddonVisibilityPublic && visibility != models.AddonVisibilityAdminOnly {
		return fmt.Errorf("invalid visibility")
	}

	if visibility == models.AddonVisibilityPublic && req.Amount <= 0 {
		return fmt.Errorf("public add-ons must have an amount greater than 0")
	}

	if req.BillingType != models.BillingTypeOneTime && req.BillingType != models.BillingTypeMonthly {
		return fmt.Errorf("invalid billing type")
	}

	if req.PurchasePolicy != models.PurchasePolicyOncePerBusiness && req.PurchasePolicy != models.PurchasePolicyOncePerConnection && req.PurchasePolicy != models.PurchasePolicyRepeatable {
		return fmt.Errorf("invalid purchase policy")
	}

	waStatus := req.RequiresWAStatus
	if waStatus != "" && waStatus != models.AddonWAStatusAny && waStatus != models.AddonWAStatusConnected && waStatus != models.AddonWAStatusNotConnected {
		return fmt.Errorf("invalid WA status requirement")
	}

	checkoutAvail := req.CheckoutAvailability
	if checkoutAvail != "" && checkoutAvail != models.AddonCheckoutSubOrStandalone && checkoutAvail != models.AddonCheckoutSubOnly && checkoutAvail != models.AddonCheckoutStandaloneOnly {
		return fmt.Errorf("invalid checkout availability")
	}

	return nil
}

func generateCustomKey(name string) string {
	slug := strings.ToLower(name)
	slug = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slug, "_")
	slug = strings.Trim(slug, "_")
	return "custom_" + slug
}

func CreateSystemBillingAddon(c *gin.Context) {
	var req billingAddonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if err := ValidateHighRiskAction(req.Reason, req.Confirm, billingAddonsConfirmPhrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateBillingAddonRequest(req, true); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	key := generateCustomKey(req.Name)
	// ensure uniqueness
	var count int64
	database.DB.Model(&models.BillingAddon{}).Where("key = ?", key).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "An addon with a similar name already exists"})
		return
	}

	waStatus := req.RequiresWAStatus
	if waStatus == "" {
		waStatus = models.AddonWAStatusAny
	}
	checkoutAvail := req.CheckoutAvailability
	if checkoutAvail == "" {
		checkoutAvail = models.AddonCheckoutSubOrStandalone
	}
	visibility := req.Visibility
	if visibility == "" {
		visibility = models.AddonVisibilityPublic
	}

	addon := models.BillingAddon{
		Key:                  key,
		Name:                 strings.TrimSpace(req.Name),
		Description:          strings.TrimSpace(req.Description),
		Amount:               req.Amount,
		BillingType:          req.BillingType,
		PurchasePolicy:       req.PurchasePolicy,
		Source:               models.AddonSourceCustom,
		Badge:                strings.TrimSpace(req.Badge),
		Visibility:           visibility,
		RequiresWAStatus:     waStatus,
		CheckoutAvailability: checkoutAvail,
		IncludesText:         strings.TrimSpace(req.IncludesText),
		NotIncludedText:      strings.TrimSpace(req.NotIncludedText),
		IsActive:             req.IsActive,
		SortOrder:            req.SortOrder,
	}

	if err := database.DB.Create(&addon).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create addon"})
		return
	}

	actorID := uint(0)
	if v, ok := c.Get("super_admin_id"); ok {
		if id, ok := v.(uint); ok {
			actorID = id
		}
	}
	LogActivity(0, "super_admin", actorID, "billing_addon_created", "system_setting", "billing", map[string]interface{}{
		"key":    addon.Key,
		"reason": req.Reason,
		"new":    addonAuditMeta(addon),
	}, c.ClientIP(), "high", "platform", "")

	c.JSON(http.StatusCreated, gin.H{"message": "Addon created", "addon": addon})
}

func UpdateSystemBillingAddon(c *gin.Context) {
	key := c.Param("key")
	var req billingAddonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}
	if err := ValidateHighRiskAction(req.Reason, req.Confirm, billingAddonsConfirmPhrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateBillingAddonRequest(req, false); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.BillingAddon
	if err := database.DB.Where("key = ?", key).First(&existing).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Addon not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	waStatus := req.RequiresWAStatus
	if waStatus == "" {
		waStatus = models.AddonWAStatusAny
	}
	checkoutAvail := req.CheckoutAvailability
	if checkoutAvail == "" {
		checkoutAvail = models.AddonCheckoutSubOrStandalone
	}
	visibility := req.Visibility
	if visibility == "" {
		visibility = models.AddonVisibilityPublic
	}

	next := existing
	next.Name = strings.TrimSpace(req.Name)
	next.Description = strings.TrimSpace(req.Description)
	next.Amount = req.Amount
	next.BillingType = req.BillingType
	next.PurchasePolicy = req.PurchasePolicy
	next.Badge = strings.TrimSpace(req.Badge)
	next.Visibility = visibility
	next.RequiresWAStatus = waStatus
	next.CheckoutAvailability = checkoutAvail
	next.IncludesText = strings.TrimSpace(req.IncludesText)
	next.NotIncludedText = strings.TrimSpace(req.NotIncludedText)
	next.IsActive = req.IsActive
	next.SortOrder = req.SortOrder

	updates := map[string]interface{}{
		"name":                  next.Name,
		"description":           next.Description,
		"amount":                next.Amount,
		"billing_type":          next.BillingType,
		"purchase_policy":       next.PurchasePolicy,
		"badge":                 next.Badge,
		"visibility":            next.Visibility,
		"requires_wa_status":    next.RequiresWAStatus,
		"checkout_availability": next.CheckoutAvailability,
		"includes_text":         next.IncludesText,
		"not_included_text":     next.NotIncludedText,
		"is_active":             next.IsActive,
		"sort_order":            next.SortOrder,
	}

	if err := database.DB.Model(&existing).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update addon"})
		return
	}

	actorID := uint(0)
	if v, ok := c.Get("super_admin_id"); ok {
		if id, ok := v.(uint); ok {
			actorID = id
		}
	}
	LogActivity(0, "super_admin", actorID, "billing_addon_updated", "system_setting", "billing", map[string]interface{}{
		"key":     key,
		"reason":  req.Reason,
		"changes": addonChangeMeta(existing, next),
	}, c.ClientIP(), "high", "platform", "")

	c.JSON(http.StatusOK, gin.H{"message": "Addon updated"})
}

func ArchiveSystemBillingAddon(c *gin.Context) {
	key := c.Param("key")
	var req struct {
		Reason  string `json:"reason"`
		Confirm string `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := ValidateHighRiskAction(req.Reason, req.Confirm, billingAddonsConfirmPhrase); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing models.BillingAddon
	if err := database.DB.Where("key = ?", key).First(&existing).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Addon not found"})
		return
	}

	next := existing
	next.IsActive = false
	if err := database.DB.Model(&existing).Update("is_active", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive addon"})
		return
	}

	actorID := uint(0)
	if v, ok := c.Get("super_admin_id"); ok {
		if id, ok := v.(uint); ok {
			actorID = id
		}
	}
	LogActivity(0, "super_admin", actorID, "billing_addon_archived", "system_setting", "billing", map[string]interface{}{
		"key":     key,
		"reason":  req.Reason,
		"changes": addonChangeMeta(existing, next),
	}, c.ClientIP(), "high", "platform", "")

	c.JSON(http.StatusOK, gin.H{"message": "Addon archived"})
}

func addonAuditMeta(addon models.BillingAddon) map[string]interface{} {
	return map[string]interface{}{
		"name":                  addon.Name,
		"amount":                addon.Amount,
		"billing_type":          addon.BillingType,
		"purchase_policy":       addon.PurchasePolicy,
		"source":                addon.Source,
		"badge":                 addon.Badge,
		"visibility":            addon.Visibility,
		"requires_wa_status":    addon.RequiresWAStatus,
		"checkout_availability": addon.CheckoutAvailability,
		"is_active":             addon.IsActive,
		"sort_order":            addon.SortOrder,
	}
}

func addonChangeMeta(oldAddon models.BillingAddon, nextAddon models.BillingAddon) map[string]interface{} {
	oldMeta := addonAuditMeta(oldAddon)
	newMeta := addonAuditMeta(nextAddon)
	if reflect.DeepEqual(oldMeta, newMeta) {
		return map[string]interface{}{}
	}
	return map[string]interface{}{
		"old": oldMeta,
		"new": newMeta,
	}
}
