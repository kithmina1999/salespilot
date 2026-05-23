package whatsapp

import (
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// BuildCommerceRoutingContext reads the minimum live state needed for a
// side-effect-free router decision. It deliberately does not mutate carts,
// counters, messages, or customer state.
func BuildCommerceRoutingContext(business *models.Business, phone string) CommerceRoutingContext {
	ctx := CommerceRoutingContext{
		HasNativeCatalog: strings.TrimSpace(business.MetaCatalogID) != "",
	}

	var cart models.Cart
	if err := database.DB.
		Where("phone = ? AND business_id = ? AND state NOT IN ? AND expires_at > ?",
			phone, business.ID,
			[]string{models.CartStatePlaced, models.CartStateAbandoned},
			time.Now()).
		Order("updated_at DESC").
		First(&cart).Error; err == nil {
		ctx.ActiveCartState = cart.State
	}

	var products []models.Product
	database.DB.
		Where("business_id = ? AND active = ?", business.ID, true).
		Limit(100).
		Find(&products)
	ctx.Products = products

	var lastBotMsg models.Message
	if err := database.DB.
		Where("business_id = ? AND phone = ? AND role = 'model'", business.ID, phone).
		Order("created_at DESC").
		First(&lastBotMsg).Error; err == nil {
		ctx.LastBotAskedQuestion = strings.Contains(lastBotMsg.Content, "?")
	}

	return ctx
}
