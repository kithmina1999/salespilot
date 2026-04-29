package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ListProducts returns all active products, optionally filtered by category
func ListProducts(c *gin.Context) {
	businessID := c.GetUint("business_id")
	var products []models.Product
	query := database.DB.Where("business_id = ? AND active = ?", businessID, true)

	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"products": products, "count": len(products)})
}

// GetProduct returns a single product by ID
func GetProduct(c *gin.Context) {
	businessID := c.GetUint("business_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := database.DB.Where("business_id = ? AND id = ?", businessID, id).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// SearchProducts searches products by name or description
func SearchProducts(c *gin.Context) {
	businessID := c.GetUint("business_id")
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query 'q' is required"})
		return
	}

	var products []models.Product
	searchPattern := "%" + q + "%"
	err := database.DB.Where("business_id = ? AND active = ? AND (name LIKE ? OR description LIKE ? OR category LIKE ?)",
		businessID, true, searchPattern, searchPattern, searchPattern).Find(&products).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"products": products, "count": len(products), "query": q})
}

// ListCategories returns all unique categories
func ListCategories(c *gin.Context) {
	businessID := c.GetUint("business_id")
	var categories []string
	database.DB.Model(&models.Product{}).Where("business_id = ? AND active = ?", businessID, true).Distinct().Pluck("category", &categories)
	c.JSON(http.StatusOK, gin.H{"categories": categories})
}
