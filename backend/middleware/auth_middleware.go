package middleware

import (
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
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
		tokenSource := ""

		if cookieToken, err := c.Cookie("token"); err == nil && strings.TrimSpace(cookieToken) != "" {
			tokenStr = strings.TrimSpace(cookieToken)
			tokenSource = "cookie"
		} else if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenStr = parts[1]
				tokenSource = "authorization_header"
			}
		}

		if tokenStr == "" {
			log.Printf("[AuthRequired] 401: Token is completely empty")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		if tokenSource == "cookie" && isUnsafeMethod(c.Request.Method) && !allowedBrowserOrigin(c) {
			log.Printf("[AuthRequired] 403: Rejected unsafe cookie-auth request from origin=%q referer=%q", c.GetHeader("Origin"), c.GetHeader("Referer"))
			c.JSON(http.StatusForbidden, gin.H{"error": "Request origin not allowed"})
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(tokenStr)
		if err != nil {
			log.Printf("[AuthRequired] 401: Invalid token - error: %v", err)
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
				log.Printf("[AuthRequired] 401: Session not found or revoked for user %d", claims.UserID)
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

func isUnsafeMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func allowedBrowserOrigin(c *gin.Context) bool {
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if origin == "" {
		referer := strings.TrimSpace(c.GetHeader("Referer"))
		if referer == "" {
			return true
		}
		parsed, err := url.Parse(referer)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return false
		}
		origin = parsed.Scheme + "://" + parsed.Host
	}

	normalizedOrigin, err := normalizeOrigin(origin)
	if err != nil {
		return false
	}

	for _, allowed := range frontendAllowedOrigins() {
		if normalizedAllowed, err := normalizeOrigin(allowed); err == nil && normalizedAllowed == normalizedOrigin {
			return true
		}
	}
	return false
}

func frontendAllowedOrigins() []string {
	raw := os.Getenv("FRONTEND_URL")
	if raw == "" {
		raw = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
	}
	return strings.Split(raw, ",")
}

func normalizeOrigin(raw string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("origin must include scheme and host")
	}
	return strings.ToLower(parsed.Scheme + "://" + parsed.Host), nil
}
