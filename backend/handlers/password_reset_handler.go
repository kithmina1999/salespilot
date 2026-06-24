package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"
	"unicode"

	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
	"github.com/kithmina1999/salespilot/whatsapp"
	"golang.org/x/crypto/bcrypt"
)

// ── Internal: Send OTP via WhatsApp ─────────────────────────────────────────
// Uses the Meta Cloud API to send the OTP.
func sendOTPViaWhatsApp(ctx context.Context, phone string, otp string) error {
	var biz models.Business
	cfg := config.Load()

	// 1. Try to use the user's OWN connected business bot (if they have Meta credentials)
	err := database.DB.Joins("JOIN users ON users.business_id = businesses.id").
		Where("users.phone = ? AND businesses.wa_access_token != ''", phone).
		First(&biz).Error

	if err != nil {
		// 2. Fallback: use the Master/Owner business bot as the official system sender
		err = database.DB.Where("phone = ? AND wa_access_token != ''", cfg.OwnerPhone).First(&biz).Error
	}

	if err != nil {
		return fmt.Errorf("your bot is disconnected and the system bot is offline")
	}

	if biz.WAPhoneNumberID == "" || biz.WAAccessToken == "" {
		return fmt.Errorf("Meta API credentials missing for OTP sender")
	}
	accessToken, err := whatsappAccessTokenForBusiness(biz)
	if err != nil {
		log.Printf("failed to decrypt OTP sender token: %v", err)
		return fmt.Errorf("Meta API credentials unavailable for OTP sender")
	}

	cleanPhone := phone
	if len(cleanPhone) > 0 && cleanPhone[0] == '+' {
		cleanPhone = cleanPhone[1:]
	}

	// Call the generic SendAuthTemplate handler to bypass the 24h window
	err = whatsapp.SendAuthTemplateContext(ctx, biz.WAPhoneNumberID, accessToken, cleanPhone, cfg.WhatsAppOTPTemplate, otp)
	if err != nil {
		log.Printf("Failed to send OTP template: %v", err)
		return fmt.Errorf("failed to send WhatsApp message")
	}

	log.Println("OTP template accepted by Meta")
	return nil
}

// ── Step 1: Request OTP ──────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// Body: { "phone": "+94771234567" }

type ForgotPasswordInput struct {
	Phone string `json:"phone" binding:"required"`
}

func ForgotPassword(c *gin.Context) {
	var input ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Phone number is required"})
		return
	}

	// Always respond with same message to prevent phone enumeration
	const safeResponse = "If that number is registered, you'll receive an OTP on WhatsApp within 30 seconds."

	normalized := utils.NormalizePhone(input.Phone)
	localFormat := "0" + strings.TrimPrefix(normalized, "94")

	var user models.User
	if err := database.DB.Where("phone IN ?", []string{
		input.Phone,
		normalized,
		"+" + normalized,
		localFormat,
	}).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": safeResponse})
		return
	}

	// Use their exact registered phone string for token generation and OTP sending
	input.Phone = user.Phone

	// Rate limit: max 5 requests per phone per hour
	var recentCount int64
	database.DB.Model(&models.PasswordResetToken{}).
		Where("phone = ? AND created_at > ? AND used_at IS NULL", input.Phone, time.Now().Add(-1*time.Hour)).
		Count(&recentCount)
	if recentCount >= 5 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many reset requests. Please wait an hour before trying again."})
		return
	}

	// Invalidate any previous unused OTPs
	database.DB.Where("phone = ? AND used_at IS NULL", input.Phone).Delete(&models.PasswordResetToken{})

	// Generate 6-digit OTP
	otp, err := generateSixDigitOTP()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate reset code"})
		return
	}

	record := models.PasswordResetToken{
		Phone:     input.Phone,
		OTPCode:   otp,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reset request"})
		return
	}

	if err := sendOTPViaWhatsApp(c.Request.Context(), input.Phone, otp); err != nil {
		database.DB.Delete(&record)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Could not send OTP: your WhatsApp bot is disconnected. Please contact support to recover your account.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": safeResponse})
}

// ── Step 2: Verify OTP ───────────────────────────────────────────────────────
// POST /api/v1/auth/verify-otp
// Body: { "phone": "+94771234567", "otp": "123456" }
// Returns: { "reset_token": "<uuid>" }

type VerifyOTPInput struct {
	Phone string `json:"phone" binding:"required"`
	OTP   string `json:"otp" binding:"required"`
}

func VerifyOTP(c *gin.Context) {
	var input VerifyOTPInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Phone and OTP are required"})
		return
	}

	normalized := utils.NormalizePhone(input.Phone)
	localFormat := "0" + strings.TrimPrefix(normalized, "94")

	var user models.User
	if err := database.DB.Where("phone IN ?", []string{
		input.Phone,
		normalized,
		"+" + normalized,
		localFormat,
	}).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid OTP code"})
		return
	}

	var record models.PasswordResetToken
	err := database.DB.
		Where("phone = ? AND used_at IS NULL AND expires_at > ?", user.Phone, time.Now()).
		Order("created_at DESC").
		First(&record).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired OTP. Please request a new one."})
		return
	}

	// Brute-force guard
	if record.Attempts >= 5 {
		now := time.Now()
		database.DB.Model(&record).Updates(map[string]interface{}{"used_at": &now})
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many incorrect attempts. Please request a new OTP."})
		return
	}

	if record.OTPCode != input.OTP {
		database.DB.Model(&record).UpdateColumn("attempts", record.Attempts+1)
		remaining := 5 - (record.Attempts + 1)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": fmt.Sprintf("Incorrect OTP. %d attempt(s) remaining.", remaining),
		})
		return
	}

	// OTP correct — issue 15-min reset token
	resetToken := uuid.New().String()
	expiresAt := time.Now().Add(15 * time.Minute)
	now := time.Now()

	database.DB.Model(&record).Updates(map[string]interface{}{
		"otp_code":    "",
		"reset_token": resetToken,
		"expires_at":  expiresAt,
		"used_at":     &now,
	})

	c.JSON(http.StatusOK, gin.H{
		"reset_token": resetToken,
		"message":     "OTP verified. Use the reset_token to set your new password.",
	})
}

// ── Step 3: Reset Password ───────────────────────────────────────────────────
// POST /api/v1/auth/reset-password
// Body: { "reset_token": "<uuid>", "new_password": "newpass123" }

type ResetPasswordInput struct {
	ResetToken  string `json:"reset_token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

func validatePasswordComplexity(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	var hasUpper, hasNumber bool
	for _, char := range password {
		if unicode.IsUpper(char) {
			hasUpper = true
		}
		if unicode.IsNumber(char) {
			hasNumber = true
		}
	}
	if !hasUpper {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !hasNumber {
		return fmt.Errorf("password must contain at least one number")
	}
	return nil
}

func ResetPassword(c *gin.Context) {
	var input ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token and new password are required"})
		return
	}

	if err := validatePasswordComplexity(input.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var record models.PasswordResetToken
	err := database.DB.
		Where("reset_token = ? AND expires_at > ?", input.ResetToken, time.Now()).
		First(&record).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset link has expired or is invalid. Please start over."})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process new password"})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&models.User{}).
		Where("phone = ?", record.Phone).
		Updates(map[string]interface{}{
			"password_hash":       string(hashed),
			"password_changed_at": now,
		}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	// Consume the reset record
	database.DB.Delete(&record)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully. You can now log in with your new password."})
}
