package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// Permission constants
const (
	PermBusinessView     = "business.view"
	PermBusinessManage   = "business.manage"
	PermPlanManage       = "plan.manage"
	PermQuotaManage      = "quota.manage"
	PermActivationCreate = "activation_code.create"
	PermActivationView   = "activation_code.view"
	PermActivationDelete = "activation_code.delete"
	PermBillingView      = "billing.view"
	PermBillingManage    = "billing.manage"
	PermAuditView        = "audit.view"
	PermUsageView        = "usage.view"
	PermSecurityView     = "security.view"
	PermSensitiveReveal  = "sensitive.reveal"
)

var rolePermissions = map[string]map[string]bool{
	models.SuperRoleOwner: {
		PermBusinessView:     true,
		PermBusinessManage:   true,
		PermPlanManage:       true,
		PermQuotaManage:      true,
		PermActivationCreate: true,
		PermActivationView:   true,
		PermActivationDelete: true,
		PermBillingView:      true,
		PermBillingManage:    true,
		PermAuditView:        true,
		PermUsageView:        true,
		PermSecurityView:     true,
		PermSensitiveReveal:  true,
	},
	models.SuperRoleSupport: {
		PermBusinessView:   true,
		PermAuditView:      true,
		PermUsageView:      true,
		PermActivationView: true,
		PermBillingView:    true,
	},
}

// RequireSuperAdmin validates the super admin bearer token.
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		rawToken := strings.TrimPrefix(auth, "Bearer ")

		// Hash token
		hasher := sha256.New()
		hasher.Write([]byte(rawToken))
		tokenHash := hex.EncodeToString(hasher.Sum(nil))

		var session models.SuperAdminSession
		err := database.DB.
			Preload("Admin").
			Where("token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
				tokenHash, time.Now()).
			First(&session).Error

		if err != nil || !session.Admin.IsActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Idle timeout check
		if time.Since(session.LastUsedAt) > models.AdminIdleTimeout {
			database.DB.Model(&session).Update("revoked_at", time.Now())
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session_expired"})
			return
		}

		// Touch last_used_at
		database.DB.Model(&session).Update("last_used_at", time.Now())

		c.Set("super_admin_id", session.AdminID)
		c.Set("super_admin_role", session.Admin.Role)
		c.Set("super_admin_email", session.Admin.Email)
		c.Set("super_admin_session_id", session.ID)

		c.Next()
	}
}

// RequireSuperPermission checks if the super admin has the requested permission.
func RequireSuperPermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("super_admin_role")
		if !rolePermissions[role][permission] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

// HighRiskRoute is a no-op marker that tags a route for high risk audit logging.
func HighRiskRoute(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("risk", "high")
		c.Set("risk_action", action)
		c.Next()
	}
}
