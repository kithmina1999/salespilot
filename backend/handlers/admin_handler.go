package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

type AdminCreateProductRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required"`
	Stock       int     `json:"stock"`
	Category    string  `json:"category"`
	Sizes       string  `json:"sizes"`
	Colors      string  `json:"colors"`
	ImageURL    string  `json:"image_url"`
	RetailerID  string  `json:"retailer_id"` // Meta Commerce Catalog Retailer ID
}

// AdminListProducts returns all products for the dashboard, including drafts
func AdminListProducts(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	var products []models.Product

	if err := db.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"products": products, "count": len(products)})
}

// AdminCreateProduct creates a new product
func AdminCreateProduct(c *gin.Context) {
	businessID := c.GetUint("business_id")
	db := c.MustGet("db").(*gorm.DB)
	var req AdminCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and price are required: " + err.Error()})
		return
	}

	// Matrix Limits Enforcement
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify business plan"})
		return
	}

	var productCount int64
	db.Model(&models.Product{}).Count(&productCount)

	if biz.Plan == models.PlanFree && productCount >= 10 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Free Plan limit reached (Max 10 Products). Please upgrade to Starter or Pro."})
		return
	}
	if biz.Plan == models.PlanStarter && productCount >= 100 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Starter Plan limit reached (Max 100 Products). Please upgrade to Pro."})
		return
	}

	product := models.Product{
		BusinessID:  businessID,
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Stock:       req.Stock,
		Category:    req.Category,
		Sizes:       req.Sizes,
		Colors:      req.Colors,
		ImageURL:    req.ImageURL,
		RetailerID:  req.RetailerID,
		Active:      true,
	}

	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
		return
	}

	LogActivity(businessID, "user", c.GetUint("user_id"), "product_created", "product", strconv.FormatUint(uint64(product.ID), 10), map[string]interface{}{
		"name":  product.Name,
		"price": product.Price,
	}, c.ClientIP(), "low", biz.Name, biz.Plan)

	c.JSON(http.StatusCreated, gin.H{"message": "Product created ✅", "product": product})
}

// AdminUpdateProduct updates an existing product
func AdminUpdateProduct(c *gin.Context) {
	businessID := c.GetUint("business_id")
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := db.Where("id = ?", id).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := db.Model(&product).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
		return
	}

	db.Where("id = ?", id).First(&product)

	bizName, bizPlan := GetBusinessContext(businessID)
	LogActivity(businessID, "user", c.GetUint("user_id"), "product_updated", "product", strconv.FormatUint(uint64(product.ID), 10), map[string]interface{}{
		"updates_applied": updates,
	}, c.ClientIP(), "low", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Product updated ✅", "product": product})
}

// AdminUpdateStock updates the stock of a product
func AdminUpdateStock(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var req struct {
		Stock int `json:"stock" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock value is required"})
		return
	}

	result := db.Model(&models.Product{}).Where("id = ?", id).Update("stock", req.Stock)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stock updated ✅", "product_id": id, "new_stock": req.Stock})
}

// AdminDeleteProduct soft-deletes a product (sets active to false)
func AdminDeleteProduct(c *gin.Context) {
	businessID := c.GetUint("business_id")
	db := c.MustGet("db").(*gorm.DB)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	result := db.Model(&models.Product{}).Where("id = ?", id).Update("active", false)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	bizName, bizPlan := GetBusinessContext(businessID)
	LogActivity(businessID, "user", c.GetUint("user_id"), "product_deleted", "product", strconv.FormatUint(uint64(id), 10), map[string]interface{}{}, c.ClientIP(), "low", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Product deleted ✅", "product_id": id})
}

// AdminUploadImage handles product image upload
func AdminUploadImage(serverURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		businessID := c.GetUint("business_id")
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
			return
		}

		// Check business tier logic (Image upload requires Starter or higher)
		var biz models.Business
		if err := database.DB.First(&biz, businessID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch business limits"})
			return
		}

		if biz.Plan == models.PlanFree {
			c.JSON(http.StatusForbidden, gin.H{"error": "Cloudinary image hosting is blocked on the Free Plan. Please upgrade."})
			return
		}

		file, err := c.FormFile("image")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
			return
		}

		// Enforce Cloudinary Storage Limits
		if biz.Plan == models.PlanStarter && biz.TotalStorageUsed+file.Size > 500*1024*1024 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Starter Plan storage limit reached (Max 500MB). Please upgrade to Pro."})
			return
		}

		// Check product exists
		scoped := c.MustGet("db").(*gorm.DB)
		var product models.Product
		if err := scoped.Where("id = ?", id).First(&product).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		// Initialize Cloudinary
		cld, err := cloudinary.NewFromURL(os.Getenv("CLOUDINARY_URL"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize Cloudinary: " + err.Error()})
			return
		}

		// Open the file buffer
		src, err := file.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
			return
		}
		defer src.Close()

		// Generate a unique public ID
		publicID := fmt.Sprintf("product-%d-%d", id, time.Now().Unix())

		// Upload stream to Cloudinary
		resp, err := cld.Upload.Upload(context.Background(), src, uploader.UploadParams{
			Folder:   "stylehaven/products",
			PublicID: publicID,
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload to Cloudinary: " + err.Error()})
			return
		}

		// Update product with Cloudinary Secure URL
		imageURL := resp.SecureURL
		database.DB.Model(&product).Update("image_url", imageURL)

		// Increment Storage Usage Tracker!
		database.DB.Model(&biz).Update("total_storage_used", biz.TotalStorageUsed+file.Size)

		c.JSON(http.StatusOK, gin.H{
			"message":   "Image uploaded via Cloudinary ✅",
			"image_url": imageURL,
			"product":   product.Name,
		})
	}
}
