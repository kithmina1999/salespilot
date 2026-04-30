package handlers

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/services"
)

type SettingsUpdateRequest struct {
	Name              string `json:"name"`
	BotName           string `json:"bot_name"`
	GreetingMessage   string `json:"greeting_message"`
	OperatingHours    string `json:"operating_hours"`
	DeliveryPolicy    string `json:"delivery_policy"`
	MetaCatalogID     string `json:"meta_catalog_id"`
	// Language settings (new multi-language fields)
	BotReplyLanguage  string `json:"bot_reply_language"`   // ISO 639-1 fallback lang
	BotSupportedLangs string `json:"bot_supported_langs"`  // comma-separated ISO codes
	// Deprecated — kept for existing frontend compatibility
	ResponseLanguage  string `json:"response_language"`
	// Payment configuration (Slice 1)
	AllowCOD      *bool  `json:"allow_cod"`      // pointer so false is distinguishable from omitted
	AllowTransfer *bool  `json:"allow_transfer"` // pointer so false is distinguishable from omitted
	BankDetails   string `json:"bank_details"`
}

// GetBusinessSettings returns the current business branding and rules
func GetBusinessSettings(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized context"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                   biz.ID,
		"name":                 biz.Name,
		"bot_name":             biz.BotName,
		"plan":                 biz.Plan,
		"ai_message_count":     biz.AIMessageCount,
		"ai_message_limit":     biz.AIMessageLimit,
		"greeting_message":     biz.GreetingMessage,
		"operating_hours":      biz.OperatingHours,
		"delivery_policy":      biz.DeliveryPolicy,
		"onboarding_complete":  biz.OnboardingComplete,
		"wa_status":            biz.WAStatus,
		"meta_catalog_id":      biz.MetaCatalogID,
		// Language settings
		"bot_reply_language":   biz.BotReplyLanguage,
		"bot_supported_langs":  biz.BotSupportedLangs,
		// Deprecated — still returned for legacy frontend
		"response_language":    biz.ResponseLanguage,
		// Payment configuration
		"allow_cod":            biz.AllowCOD,
		"allow_transfer":       biz.AllowTransfer,
		"bank_details":         biz.BankDetails,
	})
}

// UpdateBusinessSettings saves branding and profile updates
func UpdateBusinessSettings(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized context"})
		return
	}

	var req SettingsUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	if req.Name != "" {
		biz.Name = req.Name
	}
	biz.BotName = req.BotName
	biz.GreetingMessage = req.GreetingMessage
	biz.OperatingHours = req.OperatingHours
	biz.DeliveryPolicy = req.DeliveryPolicy
	biz.MetaCatalogID = req.MetaCatalogID

	// Language fields — new multi-language engine
	if req.BotReplyLanguage != "" {
		biz.BotReplyLanguage = req.BotReplyLanguage
	}
	if req.BotSupportedLangs != "" {
		biz.BotSupportedLangs = req.BotSupportedLangs
	}
	// Legacy compat: map old english_first/sinhala_first to new fields
	if req.ResponseLanguage != "" {
		biz.ResponseLanguage = req.ResponseLanguage
		if req.ResponseLanguage == "english_first" && biz.BotReplyLanguage == "" {
			biz.BotReplyLanguage = "en"
		}
	}

	// Payment configuration — use pointer fields so explicit false is honoured
	if req.AllowCOD != nil {
		biz.AllowCOD = *req.AllowCOD
	}
	if req.AllowTransfer != nil {
		biz.AllowTransfer = *req.AllowTransfer
	}
	biz.BankDetails = req.BankDetails

	if err := database.DB.Save(&biz).Error; err != nil {
		log.Printf("❌ Failed to update settings for business %d: %v", biz.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	LogActivity(
		biz.ID, "user", c.GetUint("user_id"),
		"business_settings_updated", "business",
		fmt.Sprintf("%d", biz.ID),
		map[string]interface{}{"updates": req},
		c.ClientIP(), "medium", biz.Name, biz.Plan,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated successfully", "business": biz})
}

// UpdateLanguageSettings updates ONLY the dashboard language for the authenticated user
// and optionally the bot language settings for the business.
// These are independent: a Tamil-speaking owner can have ta dashboard + si bot.
//
// PUT /api/v1/settings/language
// Body: { "dashboard_language": "ta", "bot_reply_language": "si", "bot_supported_langs": "en,si,ta" }
func UpdateLanguageSettings(c *gin.Context) {
	businessID := c.GetUint("business_id")
	userID := c.GetUint("user_id")

	var req struct {
		DashboardLanguage string `json:"dashboard_language"` // ISO 639-1, saved on User
		BotReplyLanguage  string `json:"bot_reply_language"` // ISO 639-1, saved on Business
		BotSupportedLangs string `json:"bot_supported_langs"` // comma-separated, saved on Business
		// Convenience alias: "language" key from legacy locale.tsx apiFetch call
		Language string `json:"language"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Support both "dashboard_language" and the shorter "language" alias
	if req.Language != "" && req.DashboardLanguage == "" {
		req.DashboardLanguage = req.Language
	}

	supportedLocales := map[string]bool{"en": true, "si": true, "ta": true, "ar": true, "th": true, "ms": true, "id": true, "hi": true}

	// Update dashboard language on User
	if req.DashboardLanguage != "" {
		if !supportedLocales[req.DashboardLanguage] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported language code: " + req.DashboardLanguage})
			return
		}
		if err := database.DB.Model(&models.User{}).Where("id = ?", userID).
			Update("dashboard_language", req.DashboardLanguage).Error; err != nil {
			log.Printf("⚠️ Failed to update dashboard_language for user %d: %v", userID, err)
		}
	}

	// Update bot language settings on Business
	bizUpdates := map[string]interface{}{}
	if req.BotReplyLanguage != "" {
		if !supportedLocales[req.BotReplyLanguage] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported bot language code: " + req.BotReplyLanguage})
			return
		}
		bizUpdates["bot_reply_language"] = req.BotReplyLanguage
	}
	if req.BotSupportedLangs != "" {
		bizUpdates["bot_supported_langs"] = req.BotSupportedLangs
	}
	if len(bizUpdates) > 0 {
		database.DB.Model(&models.Business{}).Where("id = ?", businessID).Updates(bizUpdates)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Language settings saved ✅",
		"dashboard_language": req.DashboardLanguage,
		"bot_reply_language": req.BotReplyLanguage,
		"bot_supported_langs": req.BotSupportedLangs,
	})
}

// ── Monthly Report Settings ────────────────────────────────────────────────────

// GetReportSettings returns the monthly report opt-in settings for the business
func GetReportSettings(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	// Default report phone to registered business phone
	reportPhone := biz.ReportPhone
	if reportPhone == "" {
		reportPhone = biz.Phone
	}

	c.JSON(http.StatusOK, gin.H{
		"monthly_report_enabled": biz.MonthlyReportEnabled,
		"report_phone":           reportPhone,
		"plan":                   biz.Plan,
	})
}

// UpdateReportSettings saves monthly report preferences
func UpdateReportSettings(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		MonthlyReportEnabled bool   `json:"monthly_report_enabled"`
		ReportPhone          string `json:"report_phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := database.DB.Model(&models.Business{}).Where("id = ?", businessID).Updates(map[string]interface{}{
		"monthly_report_enabled": req.MonthlyReportEnabled,
		"report_phone":           req.ReportPhone,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                "Report settings saved ✅",
		"monthly_report_enabled": req.MonthlyReportEnabled,
		"report_phone":           req.ReportPhone,
	})
}

// SendTestReport triggers an immediate on-demand report for the business
func SendTestReport(c *gin.Context) {
	businessID := c.GetUint("business_id")

	go func() {
		if err := services.GenerateAndSendTestReport(businessID); err != nil {
			log.Printf("❌ Test report failed for business %d: %v", businessID, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Test report is being generated and will be sent to your WhatsApp shortly 📊",
	})
}

// GetReportHistory returns the last 3 monthly reports for this business
func GetReportHistory(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var reports []models.MonthlyReport
	if err := database.DB.
		Where("business_id = ?", businessID).
		Order("sent_at DESC").
		Limit(3).
		Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch report history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reports": reports})
}
