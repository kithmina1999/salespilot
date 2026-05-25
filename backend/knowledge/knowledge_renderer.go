package knowledge

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kithmina1999/salespilot/models"
)

// RenderKnowledgeTemplate replaces placeholders in templateText with live data from business and product.
func RenderKnowledgeTemplate(templateText string, business models.Business, product *models.Product) string {
	// Safety check: if product is nil but product-specific placeholders exist, return empty string
	if product == nil && (strings.Contains(templateText, "{{product_name}}") ||
		strings.Contains(templateText, "{{product_price}}") ||
		strings.Contains(templateText, "{{product_stock_status}}") ||
		strings.Contains(templateText, "{{product_sizes}}") ||
		strings.Contains(templateText, "{{product_colors}}") ||
		strings.Contains(templateText, "{{product_options_summary}}")) {
		return ""
	}

	result := templateText

	// Replace business placeholders
	result = strings.ReplaceAll(result, "{{payment_methods_summary}}", BuildPaymentMethodsSummary(business))
	result = strings.ReplaceAll(result, "{{delivery_policy_summary}}", BuildDeliveryPolicySummary(business))
	
	hours := strings.TrimSpace(business.OperatingHours)
	if hours != "" {
		result = strings.ReplaceAll(result, "{{operating_hours}}", fmt.Sprintf("Operating Hours:\n%s", hours))
	} else {
		result = strings.ReplaceAll(result, "{{operating_hours}}", "")
	}

	// Replace product placeholders if product is provided
	if product != nil {
		result = strings.ReplaceAll(result, "{{product_name}}", product.Name)
		result = strings.ReplaceAll(result, "{{product_price}}", fmt.Sprintf("Rs.%.2f", product.Price))
		
		stockStatus := "Out of Stock"
		if product.Stock > 0 {
			stockStatus = "In Stock"
		}
		result = strings.ReplaceAll(result, "{{product_stock_status}}", stockStatus)

		var sizes []string
		if product.Sizes != "" && product.Sizes != "[]" {
			json.Unmarshal([]byte(product.Sizes), &sizes) //nolint:errcheck
		}
		result = strings.ReplaceAll(result, "{{product_sizes}}", strings.Join(sizes, ", "))

		var colors []string
		if product.Colors != "" && product.Colors != "[]" {
			json.Unmarshal([]byte(product.Colors), &colors) //nolint:errcheck
		}
		result = strings.ReplaceAll(result, "{{product_colors}}", strings.Join(colors, ", "))

		result = strings.ReplaceAll(result, "{{product_options_summary}}", BuildProductOptionsSummary(product))
	}

	return result
}

// BuildPaymentMethodsSummary constructs a user-friendly list of active payment methods.
func BuildPaymentMethodsSummary(business models.Business) string {
	var methods []string
	if business.AllowCOD {
		methods = append(methods, "Cash on Delivery (COD)")
	}
	if business.AllowTransfer {
		transferStr := "Bank Transfer"
		bankDetails := strings.TrimSpace(business.BankDetails)
		if bankDetails != "" {
			transferStr += fmt.Sprintf(":\n%s", bankDetails)
		}
		methods = append(methods, transferStr)
	}
	if len(methods) == 0 {
		return "Payment methods are not configured yet. Please check back later!"
	}
	return "We accept the following payment methods:\n- " + strings.Join(methods, "\n- ")
}

// BuildDeliveryPolicySummary returns the business delivery policy or a placeholder.
func BuildDeliveryPolicySummary(business models.Business) string {
	policy := strings.TrimSpace(business.DeliveryPolicy)
	if policy == "" {
		return "Delivery policy is not configured yet."
	}
	return policy
}

// BuildProductOptionsSummary summarizes the available sizes and colors for a product.
func BuildProductOptionsSummary(product *models.Product) string {
	if product == nil {
		return ""
	}
	var sizes []string
	if product.Sizes != "" && product.Sizes != "[]" {
		json.Unmarshal([]byte(product.Sizes), &sizes) //nolint:errcheck
	}
	var colors []string
	if product.Colors != "" && product.Colors != "[]" {
		json.Unmarshal([]byte(product.Colors), &colors) //nolint:errcheck
	}

	var parts []string
	if len(sizes) > 0 {
		parts = append(parts, fmt.Sprintf("Available Sizes: %s", strings.Join(sizes, ", ")))
	}
	if len(colors) > 0 {
		parts = append(parts, fmt.Sprintf("Available Colors: %s", strings.Join(colors, ", ")))
	}
	return strings.Join(parts, "\n")
}
