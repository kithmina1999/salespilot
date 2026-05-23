package handlers

import (
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
	"golang.org/x/crypto/bcrypt"
)

// e164Re matches a valid E.164 phone number: + followed by 7–15 digits.
var e164Re = regexp.MustCompile(`^\+[1-9]\d{6,14}$`)

type LoginInput struct {
	Identifier string `json:"identifier" binding:"required"` // Can be Email or Phone
	Password   string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	ua := utils.ParseUserAgent(c.GetHeader("User-Agent"))
	ip := c.ClientIP()

	// Helper to record a failed login attempt (fire-and-forget)
	recordFailed := func(userID, bizID uint, reason string) {
		go database.DB.Create(&models.UserSession{
			UserID:       userID,
			BusinessID:   bizID,
			SessionToken: uuid.New().String(), // unique but unusable — no JWT issued
			ExpiresAt:    time.Now(),          // immediately expired
			IPAddress:    ip,
			UserAgent:    c.GetHeader("User-Agent"),
			DeviceType:   ua.DeviceType,
			Browser:      ua.Browser,
			OS:           ua.OS,
			LoginStatus:  "failed",
			FailReason:   reason,
			LastActiveAt: time.Now(),
		})
	}

	var user models.User
	if err := database.DB.Where("email = ? OR phone = ?", input.Identifier, input.Identifier).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email/phone or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		recordFailed(user.ID, user.BusinessID, "bad_password")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email/phone or password"})
		return
	}

	if !user.IsEmailVerified {
		recordFailed(user.ID, user.BusinessID, "unverified_email")
		c.JSON(http.StatusForbidden, gin.H{
			"error":                 "Please verify your email address to log in.",
			"requires_verification": true,
			"email":                 user.Email,
		})
		return
	}

	// Create session record
	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour * 7)
	session := models.UserSession{
		UserID:       user.ID,
		BusinessID:   user.BusinessID,
		SessionToken: sessionID,
		ExpiresAt:    expiresAt,
		IPAddress:    ip,
		UserAgent:    c.GetHeader("User-Agent"),
		DeviceType:   ua.DeviceType,
		Browser:      ua.Browser,
		OS:           ua.OS,
		LoginStatus:  "success",
		LastActiveAt: time.Now(),
	}
	if err := database.DB.Create(&session).Error; err != nil {
		log.Printf("⚠️ Failed to record login session for user %d: %v", user.ID, err)
		// Non-fatal — don't block login
	}

	token, err := utils.GenerateToken(user.ID, user.BusinessID, user.Role, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	var biz models.Business
	database.DB.Where("id = ?", user.BusinessID).First(&biz)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":          user.ID,
			"email":       user.Email,
			"role":        user.Role,
			"business_id": user.BusinessID,
		},
		"business": gin.H{
			"id":                  biz.ID,
			"name":                biz.Name,
			"plan":                biz.Plan,
			"wa_status":           biz.WAStatus,
			"onboarding_complete": biz.OnboardingComplete,
		},
	})
}

type RegisterInput struct {
	BusinessName string `json:"business_name" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Phone        string `json:"phone" binding:"required"`
	Password     string `json:"password" binding:"required,min=6"`
}

func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Validate E.164 phone number before anything else
	if !e164Re.MatchString(input.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid phone number format. Please use E.164 format (e.g. +94771234567)"})
		return
	}

	// 1. Check if Email or Phone exists in User table
	var existingUser models.User
	if err := database.DB.Where("email = ? OR phone = ?", input.Email, input.Phone).First(&existingUser).Error; err == nil {
		if existingUser.Phone == input.Phone {
			c.JSON(http.StatusConflict, gin.H{"error": "This WhatsApp number is already registered to another account. Please log in to manage your AI Assistant."})
			return
		}
		c.JSON(http.StatusConflict, gin.H{"error": "This email is already registered."})
		return
	}

	// 2. Check if Phone exists in Business table
	var existingBiz models.Business
	if err := database.DB.Where("phone = ?", input.Phone).First(&existingBiz).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "This WhatsApp number is already registered to another account. Please log in to manage your AI Assistant."})
		return
	}

	// Begin Transaction
	tx := database.DB.Begin()

	business := models.Business{
		Name:   input.BusinessName,
		Phone:  input.Phone,
		APIKey: "biz_" + generateRandomString(8),
		Plan:   models.PlanFree, // Trial starts after onboarding completes
	}

	if err := tx.Create(&business).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create business partition"})
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)

	user := models.User{
		BusinessID:   business.ID,
		Email:        input.Email,
		Phone:        input.Phone,
		PasswordHash: string(hashedPassword),
		Role:         "admin",
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create admin user"})
		return
	}

	tx.Commit()

	// Generate 6-digit OTP
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

	// Fire email asynchronously so we don't block the frontend response
	go func(email, code string) {
		if err := utils.SendVerificationEmail(email, code); err != nil {
			log.Printf("❌ Failed to send verification email to %s: %v", email, err)
		}
	}(user.Email, otp)

	c.JSON(http.StatusOK, gin.H{
		"message":               "Account created successfully. Please verify your email.",
		"requires_verification": true,
		"email":                 user.Email,
	})
}
