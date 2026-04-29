package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"golang.org/x/crypto/bcrypt"
)

type CreateBusinessRequest struct {
	Name  string `json:"name" binding:"required"`
	Phone string `json:"phone"`
	Email string `json:"email" binding:"required,email"`
}

func generateRandomString(n int) string {
	bytes := make([]byte, n)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// SystemCreateBusiness creates a new business (Master Admin Endpoint)
func SystemCreateBusiness(c *gin.Context) {
	var req CreateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Check if user email already exists
	var existingUser models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email is already taken"})
		return
	}

	tx := database.DB.Begin()

	business := models.Business{
		Name:   req.Name,
		Phone:  req.Phone,
		APIKey: "biz_" + generateRandomString(8),
	}

	if err := tx.Create(&business).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create business partition"})
		return
	}

	plainPassword := generateRandomString(4) // 8 character random string
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)

	user := models.User{
		BusinessID:   business.ID,
		Email:        req.Email,
		Phone:        req.Phone, // Bind the merchant's phone for Mobile login
		PasswordHash: string(hashedPassword),
		Role:         "admin",
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create admin user"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"message":  "SaaS Tenant provisioned successfully ✅",
		"business": business,
		"user": gin.H{
			"email":    user.Email,
			"password": plainPassword, // Rendered ONCE to give to the merchant
		},
	})
}
