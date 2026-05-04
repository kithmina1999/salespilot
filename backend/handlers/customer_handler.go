package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

type UpsertCustomerRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Notes   string `json:"notes"`
	Tags    string `json:"tags"`
}

// UpsertCustomer creates or updates a customer by phone number
func UpsertCustomer(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Phone parameter is required"})
		return
	}

	var req UpsertCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	var customer models.Customer
	result := database.DB.Where("business_id = ? AND phone = ?", businessID, phone).First(&customer)

	if result.RowsAffected == 0 {
		// Create new customer
		customer = models.Customer{
			BusinessID: businessID,
			Phone:      phone,
			Name:       req.Name,
			Address:    req.Address,
			Notes:      req.Notes,
			Tags:       req.Tags,
		}
		if err := database.DB.Create(&customer).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"message": "Customer created ✅", "customer": customer})
		return
	}

	// Update existing customer - write all fields even if empty, to allow clearing CRM tags/notes.
	updates := map[string]interface{}{
		"name":    req.Name,
		"address": req.Address,
		"notes":   req.Notes,
		"tags":    req.Tags,
	}

	if err := database.DB.Model(&customer).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer"})
		return
	}

	// Fetch updated customer record
	database.DB.First(&customer, customer.ID)
	c.JSON(http.StatusOK, gin.H{"message": "Customer updated ✅", "customer": customer})
}

// GetCustomer returns a customer by phone number
func GetCustomer(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	var customer models.Customer
	if err := database.DB.Where("business_id = ? AND phone = ?", businessID, phone).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// ToggleBotPause activates or pauses the bot for a specific customer
func ToggleBotPause(c *gin.Context) {
	businessID := c.GetUint("business_id")
	phone := c.Param("phone")

	var req struct {
		BotPaused bool `json:"bot_paused"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bot_paused boolean is required"})
		return
	}

	var customer models.Customer
	if err := database.DB.Where(models.Customer{BusinessID: businessID, Phone: phone}).
		Assign(models.Customer{BusinessID: businessID, Phone: phone}).
		FirstOrCreate(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to access customer profile"})
		return
	}

	updates := map[string]interface{}{
		"bot_paused": req.BotPaused,
	}

	if req.BotPaused {
		// Pause for 30 minutes
		importTime := time.Now().Add(30 * time.Minute)
		updates["bot_paused_until"] = &importTime
	} else {
		// Resume immediately
		updates["bot_paused_until"] = gorm.Expr("NULL")
	}

	if err := database.DB.Model(&customer).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update bot status"})
		return
	}

	// Fetch updated to return
	database.DB.First(&customer, customer.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Bot status updated",
		"customer": customer,
	})
}
