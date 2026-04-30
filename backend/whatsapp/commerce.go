package whatsapp

// commerce.go — Native WhatsApp Commerce message functions
// Uses the existing WA Cloud API credentials (no extra Meta App Review needed).
// Requires:
//   - business.MetaCatalogID  — the Meta Commerce Manager Catalog ID
//   - product.RetailerID      — the Retailer ID assigned to each product in Commerce Manager
//
// API reference: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

const waAPIBase = "https://graph.facebook.com/v20.0"

// SendCatalogMessage sends a WhatsApp "View Catalog" button message.
// When the customer taps it, their full shopping catalog opens natively in WhatsApp.
func SendCatalogMessage(phoneNumberID, accessToken, to, catalogID, bodyText string) error {
	if bodyText == "" {
		bodyText = "Browse our full product catalog below and tap any item to view details or add to cart! 🛍️"
	}
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "catalog_message",
			"body": map[string]interface{}{
				"text": bodyText,
			},
			"action": map[string]interface{}{
				"name": "catalog_message",
				"parameters": map[string]interface{}{
					"thumbnail_product_retailer_id": "", // empty = use catalog cover image
				},
			},
		},
	}
	return sendInteractive(phoneNumberID, accessToken, payload)
}

// SendProductCard sends a single product as a native WhatsApp Product Detail Page (PDP).
// The customer sees the product image, name, price, and a cart button — all native UI.
func SendProductCard(phoneNumberID, accessToken, to, catalogID, retailerID string) error {
	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "product",
			"body": map[string]interface{}{
				"text": "Here's the product you were asking about! 👇",
			},
			"action": map[string]interface{}{
				"catalog_id":          catalogID,
				"product_retailer_id": retailerID,
			},
		},
	}
	return sendInteractive(phoneNumberID, accessToken, payload)
}

// SendMultiProductMessage sends up to 30 products grouped in sections.
// section is { title, retailer_ids[] }
func SendMultiProductMessage(phoneNumberID, accessToken, to, catalogID, headerText, bodyText string, sections []ProductSection) error {
	waSections := make([]map[string]interface{}, 0, len(sections))
	for _, s := range sections {
		rows := make([]map[string]interface{}, 0, len(s.RetailerIDs))
		for _, rid := range s.RetailerIDs {
			rows = append(rows, map[string]interface{}{
				"product_retailer_id": rid,
			})
		}
		waSections = append(waSections, map[string]interface{}{
			"title":    s.Title,
			"product_items": rows,
		})
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "product_list",
			"header": map[string]interface{}{
				"type": "text",
				"text": headerText,
			},
			"body": map[string]interface{}{
				"text": bodyText,
			},
			"action": map[string]interface{}{
				"catalog_id": catalogID,
				"sections":   waSections,
			},
		},
	}
	return sendInteractive(phoneNumberID, accessToken, payload)
}

// ProductSection groups products for a multi-product message.
type ProductSection struct {
	Title       string
	RetailerIDs []string
}

// sendInteractive is a low-level helper that POSTs to the WA messages endpoint.
func sendInteractive(phoneNumberID, accessToken string, payload map[string]interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("commerce: marshal payload: %w", err)
	}

	// DEBUG: print token prefix + phone number ID so we can verify DB has the right token
	tokenPreview := accessToken
	if len(tokenPreview) > 25 {
		tokenPreview = tokenPreview[:25] + "..."
	}
	log.Printf("🔑 [sendInteractive] phoneNumberID=%s token=%s", phoneNumberID, tokenPreview)

	url := fmt.Sprintf("%s/%s/messages", waAPIBase, phoneNumberID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("commerce: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("commerce: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errBody)
		return fmt.Errorf("commerce: WA API returned %d: %v", resp.StatusCode, errBody)
	}
	return nil
}
