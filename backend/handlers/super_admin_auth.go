package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"golang.org/x/crypto/bcrypt"
)

// SuperAdminLogin authenticates a super admin and creates a session.
func SuperAdminLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	var admin models.SuperAdminUser
	if err := database.DB.Where("email = ?", req.Email).First(&admin).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if !admin.IsActive {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "account inactive"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Generate 48-char random token
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
		return
	}
	rawToken := models.AdminTokenPrefix + hex.EncodeToString(b)

	hasher := sha256.New()
	hasher.Write([]byte(rawToken))
	tokenHash := hex.EncodeToString(hasher.Sum(nil))

	session := models.SuperAdminSession{
		AdminID:    admin.ID,
		TokenHash:  tokenHash,
		IPAddress:  c.ClientIP(),
		UserAgent:  c.Request.UserAgent(),
		ExpiresAt:  time.Now().Add(models.AdminSessionExpiresIn),
		LastUsedAt: time.Now(),
	}

	if err := database.DB.Create(&session).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}

	// Update last login
	now := time.Now()
	database.DB.Model(&admin).Update("last_login_at", &now)

	// Audit log
	database.DB.Create(&models.AuditLog{
		BusinessID:   0,
		ActorType:    "super_admin",
		ActorID:      admin.ID,
		Action:       "super_admin_login",
		EntityType:   "super_admin",
		EntityID:     admin.Email,
		Metadata:     `{"status":"success"}`,
		Risk:         "low",
		BusinessName: "System",
		Category:     "security",
		BusinessPlan: "",
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{
		"access_token": rawToken,
		"expires_at":   session.ExpiresAt,
		"admin": gin.H{
			"id":    admin.ID,
			"name":  admin.Name,
			"email": admin.Email,
			"role":  admin.Role,
		},
	})
}

// SuperAdminLogout revokes the current admin session.
func SuperAdminLogout(c *gin.Context) {
	sessionID := c.GetUint("super_admin_session_id")
	if sessionID > 0 {
		database.DB.Model(&models.SuperAdminSession{}).
			Where("id = ?", sessionID).
			Update("revoked_at", time.Now())
	}
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

// SuperAdminMe returns the profile of the current super admin.
func SuperAdminMe(c *gin.Context) {
	adminID := c.GetUint("super_admin_id")

	var admin models.SuperAdminUser
	if err := database.DB.First(&admin, adminID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "admin not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"admin": gin.H{
			"id":    admin.ID,
			"name":  admin.Name,
			"email": admin.Email,
			"role":  admin.Role,
		},
	})
}
