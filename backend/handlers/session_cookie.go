package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

const tenantAuthCookieName = "token"

func setTenantAuthCookie(c *gin.Context, token string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(tenantAuthCookieName, token, maxAge, "/", "", tenantAuthCookieSecure(c), true)
}

func clearTenantAuthCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(tenantAuthCookieName, "", -1, "/", "", tenantAuthCookieSecure(c), true)
}

func tenantAuthCookieSecure(c *gin.Context) bool {
	if gin.Mode() == gin.ReleaseMode {
		return true
	}
	if c.Request != nil && c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

func AuthSession(c *gin.Context) {
	userID := c.GetUint("user_id")
	businessID := c.GetUint("business_id")

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Session user no longer exists"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Session business no longer exists"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
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
			"wa_status":           effectiveWAStatus(biz),
			"onboarding_complete": biz.OnboardingComplete,
			"response_language":   biz.ResponseLanguage,
			"bot_name":            biz.BotName,
		},
	})
}

func Logout(c *gin.Context) {
	token, err := c.Cookie(tenantAuthCookieName)
	if err == nil && strings.TrimSpace(token) != "" {
		if claims, validateErr := utils.ValidateToken(token); validateErr == nil && claims.SessionID != "" {
			now := time.Now()
			database.DB.Model(&models.UserSession{}).
				Where("session_token = ? AND revoked_at IS NULL", claims.SessionID).
				Update("revoked_at", &now)
		}
	}

	clearTenantAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}
