package whatsapp

import (
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestCommerceRouterGoldenIntents(t *testing.T) {
	products := []models.Product{
		{ID: 1, Name: "Lifetime Activation Code", Category: "software", RetailerID: "life-code", Active: true},
		{ID: 2, Name: "Keda Oil 100ml", Category: "oil", RetailerID: "oil-100", Active: true},
		{ID: 3, Name: "Keda Oil 200ml", Category: "oil", RetailerID: "oil-200", Active: true},
	}
	ctx := CommerceRoutingContext{
		HasNativeCatalog: true,
		Products:         products,
	}

	tests := []struct {
		name       string
		text       string
		ctx        CommerceRoutingContext
		intent     CommerceIntent
		notIntent  CommerceIntent
		route      CommerceRoute
		productID  uint
		cartPolicy CommerceCartPolicy
	}{
		{
			name:      "greeting does not open catalog",
			text:      "hello",
			ctx:       ctx,
			intent:    IntentGreeting,
			notIntent: IntentBrowseCatalog,
			route:     RouteFAQOrGemini,
		},
		{
			name:      "specific product request beats full catalog",
			text:      "i want to buy a lifetime activation code",
			ctx:       ctx,
			intent:    IntentProductDetail,
			notIntent: IntentBrowseCatalog,
			route:     RouteNativeProduct,
			productID: 1,
		},
		{
			name:       "order timing question stays informational while loose cart remains alive",
			text:       "Can i order it today or have to wait until tomorrow",
			ctx:        withCartState(ctx, models.CartStateBrowsing),
			intent:     IntentOrderTimingOrAvailability,
			notIntent:  IntentBrowseCatalog,
			route:      RouteFAQOrGemini,
			cartPolicy: CartPolicyKeepAlive,
		},
		{
			name:      "support complaint does not open catalog",
			text:      "why are you not replying correctly",
			ctx:       ctx,
			intent:    IntentSupportOrComplaint,
			notIntent: IntentBrowseCatalog,
			route:     RouteFAQOrGemini,
		},
		{
			name:   "explicit product browse opens catalog",
			text:   "show me products",
			ctx:    ctx,
			intent: IntentBrowseCatalog,
			route:  RouteNativeCatalog,
		},
		{
			name:   "discovery question opens catalog",
			text:   "what do you sell",
			ctx:    ctx,
			intent: IntentBrowseCatalog,
			route:  RouteNativeCatalog,
		},
		{
			name:      "delivery question stays informational",
			text:      "delivery charge?",
			ctx:       ctx,
			intent:    IntentDeliveryQuestion,
			notIntent: IntentBrowseCatalog,
			route:     RouteFAQOrGemini,
		},
		{
			name:      "payment question stays informational",
			text:      "can i pay bank transfer?",
			ctx:       ctx,
			intent:    IntentPaymentQuestion,
			notIntent: IntentBrowseCatalog,
			route:     RouteFAQOrGemini,
		},
		{
			name:       "checkout belongs to active cart",
			text:       "checkout",
			ctx:        withCartState(ctx, models.CartStateAddMore),
			intent:     IntentCartContinue,
			route:      RouteOrderBot,
			cartPolicy: CartPolicyOwn,
		},
		{
			name:       "checkout without cart asks clarification",
			text:       "checkout",
			ctx:        ctx,
			intent:     IntentClarifyCommerce,
			route:      RouteClarify,
			cartPolicy: CartPolicyClarify,
		},
		{
			name:       "cancel order escapes active cart",
			text:       "cancel order",
			ctx:        withCartState(ctx, models.CartStatePendingConfirm),
			intent:     IntentCartEscape,
			route:      RouteOrderBot,
			cartPolicy: CartPolicyAbandon,
		},
		{
			name:       "yes can bridge previous bot question",
			text:       "yes",
			ctx:        withLastBotQuestion(ctx),
			intent:     IntentContextBridge,
			route:      RouteContextBridge,
			cartPolicy: CartPolicyNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision := RouteCommerceMessage(tt.ctx, tt.text)

			if decision.Intent != tt.intent {
				t.Fatalf("intent = %q, want %q (decision=%+v)", decision.Intent, tt.intent, decision)
			}
			if tt.notIntent != "" && decision.Intent == tt.notIntent {
				t.Fatalf("intent must not be %q (decision=%+v)", tt.notIntent, decision)
			}
			if decision.Route != tt.route {
				t.Fatalf("route = %q, want %q (decision=%+v)", decision.Route, tt.route, decision)
			}
			if tt.cartPolicy != "" && decision.CartPolicy != tt.cartPolicy {
				t.Fatalf("cart policy = %q, want %q (decision=%+v)", decision.CartPolicy, tt.cartPolicy, decision)
			}
			if tt.productID != 0 {
				if decision.Product == nil {
					t.Fatalf("expected product match id=%d, got nil (decision=%+v)", tt.productID, decision)
				}
				if decision.Product.ID != tt.productID {
					t.Fatalf("product id = %d, want %d (decision=%+v)", decision.Product.ID, tt.productID, decision)
				}
			}
		})
	}
}

func TestCommerceRouterPinnedCartOwnsConversation(t *testing.T) {
	pinnedStates := []string{
		models.CartStatePendingSize,
		models.CartStatePendingQty,
		models.CartStatePendingAddress,
		models.CartStatePendingNotes,
		models.CartStatePendingPaymentMethod,
		models.CartStatePendingConfirm,
	}

	for _, state := range pinnedStates {
		t.Run(state, func(t *testing.T) {
			decision := RouteCommerceMessage(CommerceRoutingContext{ActiveCartState: state}, "delivery charge?")
			if decision.Route != RouteOrderBot {
				t.Fatalf("route = %q, want %q (decision=%+v)", decision.Route, RouteOrderBot, decision)
			}
			if decision.CartPolicy != CartPolicyOwn {
				t.Fatalf("cart policy = %q, want %q (decision=%+v)", decision.CartPolicy, CartPolicyOwn, decision)
			}
		})
	}
}

func withCartState(ctx CommerceRoutingContext, state string) CommerceRoutingContext {
	ctx.ActiveCartState = state
	return ctx
}

func withLastBotQuestion(ctx CommerceRoutingContext) CommerceRoutingContext {
	ctx.LastBotAskedQuestion = true
	return ctx
}
