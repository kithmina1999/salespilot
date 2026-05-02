package models

import (
	"time"
)

// ProductType constants — extend post-launch as needed
const (
	ProductTypeProduct = "product" // physical goods (default)
	ProductTypeService = "service" // appointment / labour / intangible
	ProductTypeDigital = "digital" // software, e-vouchers, downloads
)

type Product struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	BusinessID  uint      `json:"business_id" gorm:"index;not null"`
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description"`
	Price       float64   `json:"price" gorm:"not null"`
	Stock       int       `json:"stock" gorm:"default:0"`
	MaxStock    int       `json:"max_stock" gorm:"default:0"` // set on first stock entry; used for low-stock threshold
	Category    string    `json:"category"`
	Type        string    `json:"type" gorm:"default:'product'"` // "product" | "service" | "digital"
	Sizes       string    `json:"sizes"`        // JSON array string: ["S","M","L","XL"]
	VariantType string    `json:"variant_type"` // "clothing_size"|"shoe_size"|"volume"|"numeric"|"none" — AI extracted
	Colors      string    `json:"colors"`       // JSON array string: ["Black","White"]
	ImageURL    string    `json:"image_url"`    // Local path or external URL
	RetailerID  string    `json:"retailer_id"` // Meta Commerce Catalog Retailer ID (for native WA product messages)
	Active      bool      `json:"active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
