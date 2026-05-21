package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// SimulateMessage allows a merchant to test their bot logic without using WhatsApp.
func SimulateMessage(c *gin.Context) {
	businessID := c.GetUint("business_id")
	if businessID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load business context"})
		return
	}

	// 1. Create a dummy incoming message using the sandbox phone number
	sandboxPhone := "99900000000"

	incoming := whatsapp.IncomingMessage{
		From:      sandboxPhone,
		Text:      req.Message,
		PushName:  "Sandbox Simulator",
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}

	// 2. Instantiate pipeline and run the message through it.
	// We run it synchronously so we can return success immediately.
	pipeline := whatsapp.NewPipeline()
	pipeline.HandleIncomingMessage(&business, incoming)

	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Simulated successfully"})
}

// ClearSimulation deletes all sandbox messages for the business.
func ClearSimulation(c *gin.Context) {
	businessID := c.GetUint("business_id")
	if businessID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	database.DB.Where("business_id = ? AND phone = ?", businessID, "99900000000").Delete(&models.Message{})
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Simulation cleared"})
}
