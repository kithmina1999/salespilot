package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
	"golang.org/x/crypto/bcrypt"
)

// ── Step 1: Request OTP ──────────────────────────────────────────────────────
// POST /api/v1/settings/change-password/request
// Authenticated (JWT required). Sends a 6-digit OTP to the user's registered EMAIL.

func RequestPasswordChangeOTP(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if user.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No email address associated with your account"})
		return
	}

	// Rate limit: max 3 requests per user per 15 minutes
	var recentCount int64
	database.DB.Model(&models.PasswordChangeToken{}).
		Where("user_id = ? AND created_at > ? AND used_at IS NULL", userID, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 3 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Please wait 15 minutes before trying again."})
		return
	}

	// Invalidate any previous unused tokens for this user
	database.DB.Where("user_id = ? AND used_at IS NULL", userID).Delete(&models.PasswordChangeToken{})

	// Generate 6-digit OTP
	otp := fmt.Sprintf("%06d", rand.Intn(1000000))

	record := models.PasswordChangeToken{
		UserID:    userID,
		Email:     user.Email,
		OTPCode:   otp,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create verification request"})
		return
	}

	if err := utils.SendVerificationEmail(user.Email, otp); err != nil {
		database.DB.Delete(&record)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Failed to send verification email. Please try again."})
		return
	}

	// Return masked email for display in the UI (e.g. "j***@example.com")
	maskedEmail := maskEmail(user.Email)
	c.JSON(http.StatusOK, gin.H{
		"message":      "Verification code sent to your email.",
		"masked_email": maskedEmail,
	})
}

// ── Step 2: Verify OTP ───────────────────────────────────────────────────────
// POST /api/v1/settings/change-password/verify
// Body: { "otp": "123456" }
// Returns: { "change_token": "<uuid>" }

func VerifyPasswordChangeOTP(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		OTP string `json:"otp" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "OTP is required"})
		return
	}

	var record models.PasswordChangeToken
	if err := database.DB.
		Where("user_id = ? AND used_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("created_at DESC").
		First(&record).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code has expired or is invalid. Please request a new one."})
		return
	}

	// Brute-force guard
	if record.Attempts >= 5 {
		now := time.Now()
		database.DB.Model(&record).Update("used_at", &now)
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many incorrect attempts. Please request a new code."})
		return
	}

	if record.OTPCode != strings.TrimSpace(req.OTP) {
		database.DB.Model(&record).UpdateColumn("attempts", record.Attempts+1)
		remaining := 5 - (record.Attempts + 1)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": fmt.Sprintf("Incorrect code. %d attempt(s) remaining.", remaining),
		})
		return
	}

	// OTP correct — issue 15-min change token
	changeToken := uuid.New().String()
	expiresAt := time.Now().Add(15 * time.Minute)
	now := time.Now()

	database.DB.Model(&record).Updates(map[string]interface{}{
		"otp_code":     "",
		"change_token": changeToken,
		"expires_at":   expiresAt,
		"used_at":      &now,
	})

	c.JSON(http.StatusOK, gin.H{
		"change_token": changeToken,
		"message":      "Code verified. You can now set your new password.",
	})
}

// ── Step 3: Set New Password ─────────────────────────────────────────────────
// POST /api/v1/settings/change-password/reset
// Body: { "change_token": "<uuid>", "new_password": "NewPass123" }

func ConfirmPasswordChange(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ChangeToken string `json:"change_token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "change_token and new_password are required"})
		return
	}

	if err := validatePasswordComplexity(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var record models.PasswordChangeToken
	if err := database.DB.
		Where("user_id = ? AND change_token = ? AND expires_at > ?", userID, req.ChangeToken, time.Now()).
		First(&record).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Session expired. Please start over."})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process new password"})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"password_hash":       string(hashed),
			"password_changed_at": now,
		}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	// Consume the token (delete it so it can't be reused)
	database.DB.Delete(&record)

	// Log the action
	var user models.User
	database.DB.First(&user, userID)
	var biz models.Business
	database.DB.First(&biz, user.BusinessID)
	LogActivity(
		user.BusinessID, "user", userID,
		"password_changed", "user",
		fmt.Sprintf("%d", userID),
		map[string]interface{}{"method": "email_otp"},
		c.ClientIP(), "high", biz.Name, biz.Plan,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully."})
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// maskEmail partially obscures an email address for safe display in the UI.
// "john.doe@example.com" → "j***@example.com"
func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := parts[0]
	if len(local) <= 1 {
		return "***@" + parts[1]
	}
	return string(local[0]) + strings.Repeat("*", len(local)-1) + "@" + parts[1]
}
