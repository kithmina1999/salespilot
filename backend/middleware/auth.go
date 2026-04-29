package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// TenantAuth validates the X-API-Key header against the Business table
func TenantAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-API-Key")
		if key == "" {
			key = c.Query("api_key")
		}
		// Allow Bearer token format
		if key == "" {
			authHeader := c.GetHeader("Authorization")
			if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
				key = authHeader[7:]
			}
		}

		if key == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API key required"})
			c.Abort()
			return
		}

		var business models.Business
		if err := database.DB.Where("api_key = ?", key).First(&business).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid API key"})
			c.Abort()
			return
		}

		// Inject business ID and a tenant-scoped DB into context.
		// The scoped DB bakes in WHERE business_id = ? on every SELECT/UPDATE/DELETE,
		// making cross-tenant data leakage structurally impossible — same guarantee as AuthRequired.
		c.Set("business_id", business.ID)
		scopedDB := database.DB.Where("business_id = ?", business.ID)
		c.Set("db", scopedDB)
		c.Next()
	}
}

// MasterAuth validates against a master API key from env
func MasterAuth(masterKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Master-Key")
		if key == "" {
			key = c.Query("master_key")
		}

		if key != masterKey || masterKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid master key"})
			c.Abort()
			return
		}
		c.Next()
	}
}
