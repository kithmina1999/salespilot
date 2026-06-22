package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

type VerifyEmailInput struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
}

// VerifyEmailOTP validates the OTP and issues a JWT token
func VerifyEmailOTP(c *gin.Context) {
	var input VerifyEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or OTP"})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid verification code or email"})
		return
	}

	if user.IsEmailVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is already verified"})
		return
	}

	var tokenRecord models.EmailVerificationToken
	err := database.DB.
		Where("email = ? AND otp = ? AND used_at IS NULL AND expires_at > ?", user.Email, input.OTP, time.Now()).
		First(&tokenRecord).Error

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP code"})
		return
	}

	// Mark verified
	database.DB.Model(&user).Update("is_email_verified", true)
	database.DB.Model(&tokenRecord).Update("used_at", time.Now())

	// Create a session record so the token is revocable via session management
	ua := utils.ParseUserAgent(c.GetHeader("User-Agent"))
	sessionID := uuid.New().String()
	session := models.UserSession{
		UserID:       user.ID,
		BusinessID:   user.BusinessID,
		SessionToken: sessionID,
		ExpiresAt:    time.Now().Add(24 * time.Hour * 7),
		IPAddress:    c.ClientIP(),
		UserAgent:    c.GetHeader("User-Agent"),
		DeviceType:   ua.DeviceType,
		Browser:      ua.Browser,
		OS:           ua.OS,
		LoginStatus:  "success",
		LastActiveAt: time.Now(),
	}
	database.DB.Create(&session)

	// Generate Login JWT Token Since They Are Now Verified
	token, err := utils.GenerateToken(user.ID, user.BusinessID, user.Role, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate session token after verification"})
		return
	}

	var biz models.Business
	database.DB.Where("id = ?", user.BusinessID).First(&biz)

	c.JSON(http.StatusOK, gin.H{
		"message": "Email verified successfully!",
		"token":   token,
		"user": gin.H{
			"id":          user.ID,
			"email":       user.Email,
			"role":        user.Role,
			"business_id": user.BusinessID,
		},
		"business": gin.H{
			"id":                  biz.ID,
			"name":                biz.Name,
			"onboarding_complete": biz.OnboardingComplete,
		},
	})
}

type ResendEmailInput struct {
	Email string `json:"email" binding:"required,email"`
}

// ResendEmailOTP invalidates the old OTP and sends a new one (rate limited)
func ResendEmailOTP(c *gin.Context) {
	var input ResendEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid email is required"})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		// Silent success for security
		c.JSON(http.StatusOK, gin.H{"message": "If this email exists, a new code has been sent."})
		return
	}

	if user.IsEmailVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is already verified. Please log in."})
		return
	}

	// Rate Limiting: Strict 5-Minute Block!
	// Protects Resend API Quota
	var recentToken models.EmailVerificationToken
	err := database.DB.
		Where("email = ? AND created_at > ?", user.Email, time.Now().Add(-5*time.Minute)).
		Order("created_at DESC").
		First(&recentToken).Error

	if err == nil {
		// Calculate remaining seconds
		rem := 300 - int(time.Since(recentToken.CreatedAt).Seconds())
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":             fmt.Sprintf("Please wait %d seconds before requesting another code.", rem),
			"remaining_seconds": rem,
		})
		return
	}

	// Invalidate previous OTPs
	database.DB.Where("email = ? AND used_at IS NULL", user.Email).Delete(&models.EmailVerificationToken{})

	otp, err := generateSixDigitOTP()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate verification code"})
		return
	}
	record := models.EmailVerificationToken{
		Email:     user.Email,
		OTP:       otp,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	database.DB.Create(&record)

	baseCtx := context.WithoutCancel(c.Request.Context())
	go func(e, code string) {
		ctx, cancel := context.WithTimeout(baseCtx, 15*time.Second)
		defer cancel()
		utils.SendVerificationEmailContext(ctx, e, code)
	}(user.Email, otp)

	c.JSON(http.StatusOK, gin.H{
		"message": "A new verification code has been sent to your email.",
	})
}
