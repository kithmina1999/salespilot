package middleware

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

// AuthRequired ensures a valid JWT is present
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""

		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenStr = parts[1]
			}
		}

		// Fallback to URL query for EventSource (SSE) which cannot send custom headers
		if tokenStr == "" {
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			log.Printf("[AuthRequired] 401: Token is completely empty")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(tokenStr)
		if err != nil {
			log.Printf("[AuthRequired] 401: Invalid token - error: %v, string: %s", err, tokenStr)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		log.Printf("[AuthRequired] Success! Authed BusinessID: %d", claims.BusinessID)

		// Verification measure: Ensure the user and business still exist in the database.
		// If you wipe the DB, your JWT is cryptographically valid, but your record is gone.
		var user models.User
		if err := database.DB.Where("id = ? AND business_id = ?", claims.UserID, claims.BusinessID).First(&user).Error; err != nil {
			log.Printf("[AuthRequired] 401: Session Invalidated. UserID %d no longer exists.", claims.UserID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Session token invalidated. Account no longer exists."})
			c.Abort()
			return
		}

		// Enforce session termination upon password reset
		if user.PasswordChangedAt != nil && claims.IssuedAt != nil {
			if claims.IssuedAt.Time.Before(*user.PasswordChangedAt) {
				log.Printf("[AuthRequired] 401: Session Invalidated. Password reset occurred after token issuance.")
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired due to a recent password change. Please log in again."})
				c.Abort()
				return
			}
		}

		// Validate session is active (not revoked) — only if JWT has a session_id claim
		if claims.SessionID != "" {
			var session models.UserSession
			if err := database.DB.
				Where("session_token = ? AND revoked_at IS NULL", claims.SessionID).
				First(&session).Error; err != nil {
				log.Printf("[AuthRequired] 401: Session %s not found or revoked for user %d", claims.SessionID, claims.UserID)
				c.JSON(http.StatusUnauthorized, gin.H{"error": "This session has been revoked. Please log in again."})
				c.Abort()
				return
			}
			// Bump last_active_at (throttled to once per 5 min to avoid write spam)
			if time.Since(session.LastActiveAt) > 5*time.Minute {
				go database.DB.Model(&session).Update("last_active_at", time.Now())
			}
		}

		// Inject a tenant-scoped DB — structurally prevents cross-tenant queries
		scopedDB := database.DB.Where("business_id = ?", claims.BusinessID)
		c.Set("db", scopedDB)

		// Inject claims into context
		c.Set("user_id", claims.UserID)
		c.Set("business_id", claims.BusinessID)
		c.Set("role", claims.Role)
		c.Set("session_id", claims.SessionID)
		c.Next()
	}
}

// SuperAdminRequired ensures the user holds the 'superadmin' role
func SuperAdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists || role.(string) != "superadmin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Super Admin privileges required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireBusinessActive ensures the business is not softly suspended.
// This should be chained after AuthRequired for routes that write data.
func RequireBusinessActive() gin.HandlerFunc {
	return func(c *gin.Context) {
		businessID, exists := c.Get("business_id")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Missing business context"})
			c.Abort()
			return
		}

		var biz models.Business
		if err := database.DB.First(&biz, businessID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load business context"})
			c.Abort()
			return
		}

		if biz.SuspendedAt != nil {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "business_suspended",
				"message": "This business is suspended. Read-only access allowed.",
				"reason":  biz.SuspendedReason,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
