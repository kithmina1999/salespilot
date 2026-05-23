package whatsapp

import (
	"fmt"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

func (p *Pipeline) enforceCommerceDecision(business *models.Business, phone, fromRaw, text string, decision CommerceDecision, pLog *models.PipelineLog) bool {
	switch decision.Intent {
	case IntentPaymentQuestion:
		reply := buildPaymentInfoReply(business, text)
		botSendText(business, fromRaw, reply)
		markRouterHandled(pLog, "router_payment", "replied")
		return true
	case IntentDeliveryQuestion, IntentOrderTimingOrAvailability:
		reply := buildDeliveryInfoReply(business)
		botSendText(business, fromRaw, reply)
		markRouterHandled(pLog, "router_delivery", "replied")
		return true
	case IntentOrderStatus:
		showCustomerOrders(business, phone, fromRaw)
		markRouterHandled(pLog, string(RouteOrderBot), "replied")
		return true
	case IntentCartEscape:
		abandonActiveCartForRouter(business, phone, fromRaw)
		markRouterHandled(pLog, string(RouteOrderBot), "abandoned_cart")
		return true
	case IntentCartContinue:
		if enforceCartContinue(business, phone, fromRaw, text) {
			markRouterHandled(pLog, string(RouteOrderBot), "replied")
			return true
		}
	case IntentAddToCart:
		if enforceAddToCart(business, phone, fromRaw, text) {
			markRouterHandled(pLog, string(RouteOrderBot), "replied")
			return true
		}
	case IntentClarifyCommerce:
		if decision.Route == RouteClarify {
			botSendButtons(business, fromRaw,
				"Your cart is empty right now. Please choose a product first.",
				[]Button{{ID: "browse_more", Title: "Browse Products"}},
			)
			markRouterHandled(pLog, string(RouteClarify), "replied")
			return true
		}
	case IntentContextBridge:
		p.handleContextBridge(business, phone, fromRaw)
		markRouterHandled(pLog, string(RouteContextBridge), "handled")
		return true
	}
	return false
}

func buildPaymentInfoReply(business *models.Business, text string) string {
	raw := strings.ToLower(text)
	normalized := strings.ToLower(NormalizeMessage(text))
	askedBank := strings.Contains(raw, "bank") || strings.Contains(raw, "transfer") || strings.Contains(raw, "deposit") ||
		strings.Contains(normalized, "bank") || strings.Contains(normalized, "transfer") || strings.Contains(normalized, "deposit")
	askedCOD := strings.Contains(raw, "cod") || strings.Contains(raw, "cash on delivery") ||
		strings.Contains(normalized, "cod") || strings.Contains(normalized, "cash on delivery")

	if !business.AllowCOD && !business.AllowTransfer {
		return "*Payment options*\n\nThis shop has not enabled a payment method yet. Please contact us directly to complete your order."
	}

	if askedBank {
		if !business.AllowTransfer {
			if business.AllowCOD {
				return "*Payment options*\n\nBank transfer is not available right now. Cash on Delivery is available for this shop."
			}
			return "*Payment options*\n\nBank transfer is not available right now. Please contact us directly to complete your order."
		}
		reply := "*Payment options*\n\nBank transfer is available. You can choose Bank Transfer at checkout."
		if strings.TrimSpace(business.BankDetails) != "" {
			reply += "\n\n*Bank details:*\n" + strings.TrimSpace(business.BankDetails)
			reply += "\n\nNote: unpaid bank-transfer orders are automatically cancelled after 72 hours."
		}
		return reply
	}

	if askedCOD {
		if business.AllowCOD {
			return "*Payment options*\n\nCash on Delivery is available for this shop."
		}
		if business.AllowTransfer {
			return "*Payment options*\n\nCash on Delivery is not available right now. Bank transfer is available."
		}
		return "*Payment options*\n\nCash on Delivery is not available right now. Please contact us directly to complete your order."
	}

	options := make([]string, 0, 2)
	if business.AllowCOD {
		options = append(options, "Cash on Delivery")
	}
	if business.AllowTransfer {
		options = append(options, "Bank Transfer")
	}
	return fmt.Sprintf("*Payment options*\n\nAvailable methods: %s. You can choose your preferred method at checkout.", strings.Join(options, ", "))
}

func buildDeliveryInfoReply(business *models.Business) string {
	var parts []string
	if strings.TrimSpace(business.DeliveryPolicy) != "" {
		parts = append(parts, strings.TrimSpace(business.DeliveryPolicy))
	} else {
		parts = append(parts, "Delivery details are not configured yet. Please contact us directly for the exact delivery time and charges.")
	}
	if strings.TrimSpace(business.OperatingHours) != "" {
		parts = append(parts, "Operating hours: "+strings.TrimSpace(business.OperatingHours))
	}
	return "*Delivery / ordering*\n\n" + strings.Join(parts, "\n\n")
}

func enforceCartContinue(business *models.Business, phone, fromRaw, text string) bool {
	cart, err := findActiveCart(phone, business.ID)
	if err != nil {
		botSendButtons(business, fromRaw,
			"Your cart is empty right now. Please choose a product first.",
			[]Button{{ID: "browse_more", Title: "Browse Products"}},
		)
		return true
	}

	switch cart.State {
	case models.CartStateItemSelected:
		botSendButtons(business, fromRaw,
			"Please add the selected item to your cart before checkout.",
			[]Button{{ID: "add_to_cart", Title: "Add to Cart"}, {ID: "browse_more", Title: "Browse Products"}},
		)
		return true
	case models.CartStateBrowsing:
		botSendButtons(business, fromRaw,
			"Your cart is empty right now. Please choose a product first.",
			[]Button{{ID: "browse_more", Title: "Browse Products"}},
		)
		return true
	default:
		return handleCartMessage(business, phone, fromRaw, text)
	}
}

func enforceAddToCart(business *models.Business, phone, fromRaw, text string) bool {
	cart, err := findActiveCart(phone, business.ID)
	if err != nil {
		return handleCartMessage(business, phone, fromRaw, text)
	}
	if cart.State == models.CartStateItemSelected {
		return handleCartMessage(business, phone, fromRaw, "add_to_cart")
	}
	return handleCartMessage(business, phone, fromRaw, text)
}

func abandonActiveCartForRouter(business *models.Business, phone, fromRaw string) {
	cart, err := findActiveCart(phone, business.ID)
	if err != nil {
		botSendText(business, fromRaw, "There is no active cart to cancel right now.")
		return
	}
	updateCart(&cart, map[string]interface{}{"state": models.CartStateAbandoned, "expires_at": time.Now()})
	botSendButtons(business, fromRaw,
		"No problem. Your cart has been cleared. What can I help you with?",
		[]Button{{ID: "browse_more", Title: "Browse Products"}, {ID: "order_status_check", Title: "My Orders"}},
	)
}

func findActiveCart(phone string, businessID uint) (models.Cart, error) {
	var cart models.Cart
	err := database.DB.
		Where("phone = ? AND business_id = ? AND state NOT IN ? AND expires_at > ?",
			phone, businessID,
			[]string{models.CartStatePlaced, models.CartStateAbandoned},
			time.Now()).
		Order("updated_at DESC").
		First(&cart).Error
	if err != nil {
		return models.Cart{}, err
	}
	return cart, nil
}

func markRouterHandled(pLog *models.PipelineLog, route, action string) {
	if pLog == nil {
		return
	}
	pLog.RouteTaken = route
	pLog.ActionTaken = action
	pLog.ModelUsed = "commerce_router"
}
