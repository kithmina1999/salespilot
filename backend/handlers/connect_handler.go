package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/dashboard/whatsapp/connect
// Saves the tenant's Meta WhatsApp Cloud API credentials.
// Body: { "phone_number_id": "...", "waba_id": "...", "access_token": "..." }
// ─────────────────────────────────────────────────────────────────
func SaveMetaCredentials(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		PhoneNumberID string `json:"phone_number_id" binding:"required"`
		WABAID        string `json:"waba_id"         binding:"required"`
		AccessToken   string `json:"access_token"    binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "phone_number_id, waba_id, and access_token are required"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	// Quick liveness test before saving
	phoneInfo, err := whatsapp.TestCredentialsWithInfo(req.PhoneNumberID, req.AccessToken)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "Could not verify credentials with Meta. Check your Phone Number ID and Access Token.",
			"detail": err.Error(),
		})
		return
	}

	now := time.Now()
	database.DB.Model(&biz).Updates(map[string]interface{}{
		"wa_phone_number_id": req.PhoneNumberID,
		"waba_id":            req.WABAID,
		"wa_access_token":    req.AccessToken,
		"wa_status":          "connected",
		"connected_at":       now,
	})

	// Subscribe the business's WABA to our platform webhook so Meta sends events to us
	// Non-fatal: log failure but don't block the UI — operator can retry via Test
	if err := whatsapp.SubscribeWABAWebhook(req.WABAID, req.AccessToken); err != nil {
		log.Printf("⚠️  WABA %s webhook subscription failed: %v (credentials saved, retry via Test)", req.WABAID, err)
	}

	LogActivity(businessID, "user", c.GetUint("user_id"), "whatsapp_connected", "settings", req.PhoneNumberID,
		map[string]interface{}{"waba_id": req.WABAID}, c.ClientIP(), "medium", biz.Name, biz.Plan)

	c.JSON(http.StatusOK, gin.H{
		"message":         "WhatsApp connected successfully via Meta Cloud API",
		"phone_number_id": req.PhoneNumberID,
		"display_phone":   phoneInfo.DisplayPhone,
		"waba_id":         req.WABAID,
		"status":          "connected",
		"connected_at":    now,
	})
}

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/dashboard/whatsapp/status
// Returns the current Meta WhatsApp connection state for this tenant.
// ─────────────────────────────────────────────────────────────────
func GetWhatsAppStatus(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	status := effectiveWAStatus(biz)

	c.JSON(http.StatusOK, gin.H{
		"status":          status,
		"is_connected":    status == waStatusConnected,
		"has_credentials": hasWhatsAppCredentials(biz),
		"phone_number_id": biz.WAPhoneNumberID,
		"waba_id":         biz.WABAID,
	})
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/dashboard/whatsapp/test
// Sends a test ping to Meta to verify credentials are still valid.
// ─────────────────────────────────────────────────────────────────
func TestMetaConnection(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	if biz.WAPhoneNumberID == "" || biz.WAAccessToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No credentials saved. Connect your WhatsApp first."})
		return
	}

	if err := whatsapp.TestCredentials(biz.WAPhoneNumberID, biz.WAAccessToken); err != nil {
		// Mark as disconnected in DB
		database.DB.Model(&biz).Update("wa_status", "disconnected")
		// Alert the team — this tenant's bot is now silent
		go utils.AlertMetaTokenExpired(biz.Name, biz.WAPhoneNumberID)
		c.JSON(http.StatusBadGateway, gin.H{
			"ok":    false,
			"error": "Credentials are invalid or token has expired: " + err.Error(),
		})
		return
	}

	now := time.Now()
	database.DB.Model(&biz).Updates(map[string]interface{}{
		"wa_status":    "connected",
		"connected_at": now,
	})

	c.JSON(http.StatusOK, gin.H{
		"ok":              true,
		"message":         "Meta credentials verified successfully",
		"status":          "connected",
		"is_connected":    true,
		"phone_number_id": biz.WAPhoneNumberID,
		"waba_id":         biz.WABAID,
		"connected_at":    now,
	})
}

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/dashboard/whatsapp/disconnect
// Clears the tenant's Meta credentials.
// ─────────────────────────────────────────────────────────────────
func DisconnectWhatsApp(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	database.DB.Model(&biz).Updates(map[string]interface{}{
		"wa_phone_number_id": "",
		"waba_id":            "",
		"wa_access_token":    "",
		"wa_status":          "not_connected",
	})

	LogActivity(businessID, "user", c.GetUint("user_id"), "whatsapp_disconnected", "settings", "", nil,
		c.ClientIP(), "medium", biz.Name, biz.Plan)

	c.JSON(http.StatusOK, gin.H{"message": "WhatsApp disconnected. Your credentials have been cleared."})
}
