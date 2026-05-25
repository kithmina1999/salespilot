package knowledge

import (
	"strings"
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestRenderKnowledgeTemplate_BusinessOnly(t *testing.T) {
	biz := models.Business{
		Name:           "Test Shop",
		OperatingHours: "9 AM - 5 PM",
		DeliveryPolicy: "Rs. 350 flat rate",
		AllowCOD:       true,
		AllowTransfer:  true,
		BankDetails:    "BOC 123456789",
	}

	// 1. Payment methods summary
	t1 := "Payment: {{payment_methods_summary}}"
	r1 := RenderKnowledgeTemplate(t1, biz, nil)
	if !strings.Contains(r1, "Cash on Delivery") || !strings.Contains(r1, "BOC 123456789") {
		t.Errorf("Expected payment methods summary, got: %q", r1)
	}

	// 2. Delivery policy and operating hours
	t2 := "Delivery: {{delivery_policy_summary}}\n{{operating_hours}}"
	r2 := RenderKnowledgeTemplate(t2, biz, nil)
	if !strings.Contains(r2, "Rs. 350 flat rate") || !strings.Contains(r2, "Operating Hours:\n9 AM - 5 PM") {
		t.Errorf("Expected delivery and hours, got: %q", r2)
	}
}

func TestRenderKnowledgeTemplate_Product(t *testing.T) {
	biz := models.Business{}
	prod := &models.Product{
		Name:   "Aesthetic Mug",
		Price:  1500.00,
		Stock:  15,
		Sizes:  `["Standard", "Large"]`,
		Colors: `["White", "Pink"]`,
	}

	t1 := "*{{product_name}}*\nPrice: {{product_price}}\nStock: {{product_stock_status}}\n{{product_options_summary}}"
	r1 := RenderKnowledgeTemplate(t1, biz, prod)

	if !strings.Contains(r1, "Aesthetic Mug") {
		t.Errorf("Expected name Aesthetic Mug, got: %q", r1)
	}
	if !strings.Contains(r1, "Rs.1500.00") {
		t.Errorf("Expected price Rs.1500.00, got: %q", r1)
	}
	if !strings.Contains(r1, "In Stock") {
		t.Errorf("Expected In Stock, got: %q", r1)
	}
	if !strings.Contains(r1, "Available Sizes: Standard, Large") || !strings.Contains(r1, "Available Colors: White, Pink") {
		t.Errorf("Expected sizes/colors, got: %q", r1)
	}
}

func TestRenderKnowledgeTemplate_NilProductSafety(t *testing.T) {
	biz := models.Business{}
	t1 := "Product: {{product_name}}"
	r1 := RenderKnowledgeTemplate(t1, biz, nil)
	if r1 != "" {
		t.Errorf("Expected empty string when product is nil but product placeholder exists, got: %q", r1)
	}
}
