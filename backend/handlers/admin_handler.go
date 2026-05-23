package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
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

func validateProductArrayField(raw, field string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return "", fmt.Errorf("%s must be a JSON string array", field)
	}
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			return "", fmt.Errorf("%s cannot contain empty values", field)
		}
		cleaned = append(cleaned, value)
	}
	out, _ := json.Marshal(cleaned)
	return string(out), nil
}

func validateCreateProductRequest(req *AdminCreateProductRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.TrimSpace(req.Category)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.RetailerID = strings.TrimSpace(req.RetailerID)
	if req.Name == "" {
		return fmt.Errorf("product name is required")
	}
	if req.Price <= 0 {
		return fmt.Errorf("price must be greater than zero")
	}
	if req.Stock < 0 {
		return fmt.Errorf("stock cannot be negative")
	}
	sizes, err := validateProductArrayField(req.Sizes, "sizes")
	if err != nil {
		return err
	}
	colors, err := validateProductArrayField(req.Colors, "colors")
	if err != nil {
		return err
	}
	req.Sizes = sizes
	req.Colors = colors
	return nil
}

func numberFromUpdate(value interface{}, field string) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case json.Number:
		n, err := v.Float64()
		if err != nil {
			return 0, fmt.Errorf("%s must be numeric", field)
		}
		return n, nil
	default:
		return 0, fmt.Errorf("%s must be numeric", field)
	}
}

func intFromUpdate(value interface{}, field string) (int, error) {
	n, err := numberFromUpdate(value, field)
	if err != nil {
		return 0, err
	}
	asInt := int(n)
	if n != float64(asInt) {
		return 0, fmt.Errorf("%s must be a whole number", field)
	}
	return asInt, nil
}

func sanitizeProductUpdates(updates map[string]interface{}) (map[string]interface{}, error) {
	clean := map[string]interface{}{}
	for key, value := range updates {
		switch key {
		case "name":
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("name must be a string")
			}
			s = strings.TrimSpace(s)
			if s == "" {
				return nil, fmt.Errorf("product name is required")
			}
			clean["name"] = s
		case "description", "category", "image_url", "retailer_id", "variant_type":
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be a string", key)
			}
			clean[key] = strings.TrimSpace(s)
		case "sizes", "colors":
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("%s must be a JSON string array", key)
			}
			normalized, err := validateProductArrayField(s, key)
			if err != nil {
				return nil, err
			}
			clean[key] = normalized
		case "price":
			price, err := numberFromUpdate(value, "price")
			if err != nil {
				return nil, err
			}
			if price <= 0 {
				return nil, fmt.Errorf("price must be greater than zero")
			}
			clean["price"] = price
		case "stock", "max_stock":
			n, err := intFromUpdate(value, key)
			if err != nil {
				return nil, err
			}
			if n < 0 {
				return nil, fmt.Errorf("%s cannot be negative", key)
			}
			clean[key] = n
		case "active":
			active, ok := value.(bool)
			if !ok {
				return nil, fmt.Errorf("active must be a boolean")
			}
			clean["active"] = active
		case "id", "ID", "business_id", "BusinessID", "created_at", "CreatedAt", "updated_at", "UpdatedAt":
			continue
		default:
			return nil, fmt.Errorf("unsupported product field: %s", key)
		}
	}
	return clean, nil
}

func isAllowedImageFile(contentType string, sample []byte) bool {
	contentType = strings.ToLower(contentType)
	if !strings.HasPrefix(contentType, "image/") {
		return false
	}
	if len(sample) >= 3 && sample[0] == 0xff && sample[1] == 0xd8 && sample[2] == 0xff {
		return true
	}
	if len(sample) >= 8 && string(sample[:8]) == "\x89PNG\r\n\x1a\n" {
		return true
	}
	if len(sample) >= 6 && (string(sample[:6]) == "GIF87a" || string(sample[:6]) == "GIF89a") {
		return true
	}
	if len(sample) >= 12 && string(sample[:4]) == "RIFF" && string(sample[8:12]) == "WEBP" {
		return true
	}
	return false
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
	var req AdminCreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and price are required: " + err.Error()})
		return
	}
	if err := validateCreateProductRequest(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Matrix Limits Enforcement
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify business plan"})
		return
	}

	var productCount int64
	database.DB.Model(&models.Product{}).Where("business_id = ?", businessID).Count(&productCount)

	ent, err := GetUsageEntitlements(biz, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load product limits"})
		return
	}
	if ent.MaxProducts >= 0 && productCount >= int64(ent.MaxProducts) {
		c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Product limit reached (Max %d). Please upgrade your plan.", ent.MaxProducts)})
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
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := database.DB.Where("id = ? AND business_id = ?", id, businessID).First(&product).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updates, err = sanitizeProductUpdates(updates)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No product fields to update"})
		return
	}

	if err := database.DB.Model(&product).Where("business_id = ?", businessID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
		return
	}

	database.DB.Where("id = ? AND business_id = ?", id, businessID).First(&product)

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
		Stock *int `json:"stock" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock value is required"})
		return
	}
	if req.Stock == nil || *req.Stock < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stock must be zero or greater"})
		return
	}

	result := db.Model(&models.Product{}).Where("id = ?", id).Update("stock", *req.Stock)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stock updated ✅", "product_id": id, "new_stock": *req.Stock})
}

// AdminDeleteProduct soft-deletes a product (sets active to false)
func AdminDeleteProduct(c *gin.Context) {
	businessID := c.GetUint("business_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	result := database.DB.Model(&models.Product{}).Where("id = ? AND business_id = ?", id, businessID).Update("active", false)
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

		ent, err := GetUsageEntitlements(biz, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load upload limits"})
			return
		}

		if !ent.CanUploadCloudinary {
			c.JSON(http.StatusForbidden, gin.H{"error": "Image hosting is not allowed on your current plan. Please upgrade."})
			return
		}

		file, err := c.FormFile("image")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
			return
		}

		// Enforce file size limit
		if file.Size > ent.MaxFileSizeBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Image must be under %dMB", ent.MaxFileSizeBytes/(1024*1024))})
			return
		}

		// Validate file type (images only)
		contentType := file.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "image/") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only image files are accepted (JPG, PNG, WebP)"})
			return
		}

		// Enforce Total Storage Limits
		if biz.TotalStorageUsed+file.Size > ent.MaxStorageBytes {
			c.JSON(http.StatusForbidden, gin.H{"error": "Storage limit reached. Please upgrade your plan or delete existing products."})
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
		sample := make([]byte, 512)
		n, readErr := src.Read(sample)
		if readErr != nil && readErr != io.EOF {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read uploaded image"})
			return
		}
		if _, err := src.Seek(0, io.SeekStart); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare uploaded image"})
			return
		}
		if !isAllowedImageFile(contentType, sample[:n]) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only JPG, PNG, GIF, or WebP images are accepted"})
			return
		}

		// Generate a unique public ID
		publicID := fmt.Sprintf("product-%d-%d", id, time.Now().Unix())

		// Upload stream to Cloudinary
		resp, err := cld.Upload.Upload(context.Background(), src, uploader.UploadParams{
			Folder:   "salespilot/products",
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
