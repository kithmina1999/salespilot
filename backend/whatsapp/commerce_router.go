package whatsapp

import (
	"fmt"
	"sort"
	"strings"

	"github.com/kithmina1999/salespilot/models"
)

type CommerceIntent string

const (
	IntentGreeting                  CommerceIntent = "greeting"
	IntentBrowseCatalog             CommerceIntent = "browse_catalog"
	IntentProductSearch             CommerceIntent = "product_search"
	IntentProductDetail             CommerceIntent = "product_detail"
	IntentAddToCart                 CommerceIntent = "add_to_cart"
	IntentOrderTimingOrAvailability CommerceIntent = "order_timing_or_availability"
	IntentDeliveryQuestion          CommerceIntent = "delivery_question"
	IntentPaymentQuestion           CommerceIntent = "payment_question"
	IntentOrderStatus               CommerceIntent = "order_status"
	IntentCartContinue              CommerceIntent = "cart_continue"
	IntentCartEscape                CommerceIntent = "cart_escape"
	IntentSupportOrComplaint        CommerceIntent = "support_or_complaint"
	IntentContextBridge             CommerceIntent = "context_bridge"
	IntentGeneralFAQ                CommerceIntent = "general_faq"
	IntentClarifyCommerce           CommerceIntent = "clarify_commerce"
	IntentUnknown                   CommerceIntent = "unknown"
)

type CommerceRoute string

const (
	RouteFAQOrGemini   CommerceRoute = "faq_or_gemini"
	RouteOrderBot      CommerceRoute = "order_bot"
	RouteNativeCatalog CommerceRoute = "native_catalog"
	RouteNativeProduct CommerceRoute = "native_product"
	RouteClarify       CommerceRoute = "clarify"
	RouteContextBridge CommerceRoute = "context_bridge"
)

type CommerceCartPolicy string

const (
	CartPolicyNone      CommerceCartPolicy = "none"
	CartPolicyOwn       CommerceCartPolicy = "own"
	CartPolicyKeepAlive CommerceCartPolicy = "keep_alive"
	CartPolicyAbandon   CommerceCartPolicy = "abandon"
	CartPolicyClarify   CommerceCartPolicy = "clarify"
)

type CommerceUsageClass string

const (
	UsageClassSystemOnly      CommerceUsageClass = "system_only"
	UsageClassAIIfFallback    CommerceUsageClass = "ai_if_fallback"
	UsageClassNativeCatalog   CommerceUsageClass = "native_catalog"
	UsageClassNativeProduct   CommerceUsageClass = "native_product"
	UsageClassCartInteraction CommerceUsageClass = "cart_interaction"
	UsageClassClarification   CommerceUsageClass = "clarification"
	UsageClassContextBridge   CommerceUsageClass = "context_bridge"
)

type CommerceRoutingContext struct {
	ActiveCartState      string
	LastBotAskedQuestion bool
	HasNativeCatalog     bool
	Products             []models.Product
}

type CommerceProductMatch struct {
	ID         uint
	Name       string
	RetailerID string
	Category   string
	Confidence float64
	MatchType  string
	Ambiguous  bool
}

type CommerceDecision struct {
	Intent     CommerceIntent
	Route      CommerceRoute
	Confidence float64
	Reasons    []string

	CartPolicy CommerceCartPolicy
	UsageClass CommerceUsageClass
	Product    *CommerceProductMatch
}

func RouteCommerceMessage(ctx CommerceRoutingContext, text string) CommerceDecision {
	raw := strings.ToLower(strings.TrimSpace(text))
	normalized := strings.ToLower(strings.TrimSpace(NormalizeMessage(text)))
	if normalized == "" {
		normalized = raw
	}
	if normalized == "" {
		return commerceDecision(IntentUnknown, RouteFAQOrGemini, 0.2, CartPolicyNone, UsageClassAIIfFallback, "empty_or_unclassified")
	}

	cartActive := strings.TrimSpace(ctx.ActiveCartState) != ""

	if cartActive && (isCartEscapeRequest(text) || isGlobalEscapeIntent(text)) {
		return commerceDecision(IntentCartEscape, RouteOrderBot, 0.96, CartPolicyAbandon, UsageClassCartInteraction, "active_cart_escape")
	}

	if isPinnedCartState(ctx.ActiveCartState) {
		return commerceDecision(IntentCartContinue, RouteOrderBot, 0.95, CartPolicyOwn, UsageClassCartInteraction, "pinned_cart_state")
	}

	if isCheckoutRequest(normalized) {
		if cartActive {
			return commerceDecision(IntentCartContinue, RouteOrderBot, 0.95, CartPolicyOwn, UsageClassCartInteraction, "checkout_with_active_cart")
		}
		return commerceDecision(IntentClarifyCommerce, RouteClarify, 0.72, CartPolicyClarify, UsageClassClarification, "checkout_without_active_cart")
	}

	if cartActive && isAddToCartRequest(normalized) {
		return commerceDecision(IntentAddToCart, RouteOrderBot, 0.92, CartPolicyOwn, UsageClassCartInteraction, "active_cart_add_to_cart")
	}

	if ctx.LastBotAskedQuestion && isShortAffirmation(normalized) {
		return commerceDecision(IntentContextBridge, RouteContextBridge, 0.85, CartPolicyNone, UsageClassContextBridge, "affirmation_after_bot_question")
	}

	if isGreetingMessage(normalized) {
		return withCartPolicy(
			commerceDecision(IntentGreeting, RouteFAQOrGemini, 0.92, CartPolicyNone, UsageClassAIIfFallback, "greeting"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if isOrderTimingOrAvailabilityQuestion(normalized) {
		return withCartPolicy(
			commerceDecision(IntentOrderTimingOrAvailability, RouteFAQOrGemini, 0.88, CartPolicyNone, UsageClassAIIfFallback, "order_timing_or_availability"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	productMatch := matchCommerceProduct(ctx.Products, normalized)
	if productMatch != nil && isProductPurchaseOrDetailRequest(normalized) {
		return withCartPolicy(productDecision(ctx, productMatch), cartPolicyForLooseCart(cartActive))
	}

	if isDeliveryQuestion(normalized) {
		return withCartPolicy(
			commerceDecision(IntentDeliveryQuestion, RouteFAQOrGemini, 0.88, CartPolicyNone, UsageClassAIIfFallback, "delivery_question"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if isPaymentQuestion(normalized) {
		return withCartPolicy(
			commerceDecision(IntentPaymentQuestion, RouteFAQOrGemini, 0.88, CartPolicyNone, UsageClassAIIfFallback, "payment_question"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if isOrderStatusQuestion(normalized) {
		return withCartPolicy(
			commerceDecision(IntentOrderStatus, RouteOrderBot, 0.86, CartPolicyNone, UsageClassCartInteraction, "order_status_question"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if isSupportComplaint(normalized) {
		return withCartPolicy(
			commerceDecision(IntentSupportOrComplaint, RouteFAQOrGemini, 0.84, CartPolicyNone, UsageClassAIIfFallback, "support_or_complaint"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if productMatch != nil {
		return withCartPolicy(productDecision(ctx, productMatch), cartPolicyForLooseCart(cartActive))
	}

	if isExplicitBrowseRequest(text) || isBrowseSignal(text) {
		route := RouteOrderBot
		usageClass := UsageClassCartInteraction
		if ctx.HasNativeCatalog {
			route = RouteNativeCatalog
			usageClass = UsageClassNativeCatalog
		}
		return withCartPolicy(
			commerceDecision(IntentBrowseCatalog, route, 0.91, CartPolicyNone, usageClass, "explicit_browse_request"),
			cartPolicyForLooseCart(cartActive),
		)
	}

	if cartActive && detectOrderIntent(text) {
		return commerceDecision(IntentAddToCart, RouteOrderBot, 0.82, CartPolicyOwn, UsageClassCartInteraction, "loose_cart_purchase_intent")
	}

	return withCartPolicy(
		commerceDecision(IntentGeneralFAQ, RouteFAQOrGemini, 0.55, CartPolicyNone, UsageClassAIIfFallback, "default_faq_or_gemini"),
		cartPolicyForLooseCart(cartActive),
	)
}

func productDecision(ctx CommerceRoutingContext, match *CommerceProductMatch) CommerceDecision {
	route := RouteOrderBot
	usageClass := UsageClassCartInteraction
	intent := IntentProductDetail
	if match.Ambiguous {
		route = RouteClarify
		usageClass = UsageClassClarification
		intent = IntentProductSearch
	} else if ctx.HasNativeCatalog && match.RetailerID != "" {
		route = RouteNativeProduct
		usageClass = UsageClassNativeProduct
	}

	decision := commerceDecision(intent, route, match.Confidence, CartPolicyNone, usageClass, fmt.Sprintf("product_%s_match", match.MatchType))
	decision.Product = match
	return decision
}

func commerceDecision(intent CommerceIntent, route CommerceRoute, confidence float64, cartPolicy CommerceCartPolicy, usageClass CommerceUsageClass, reasons ...string) CommerceDecision {
	return CommerceDecision{
		Intent:     intent,
		Route:      route,
		Confidence: confidence,
		Reasons:    reasons,
		CartPolicy: cartPolicy,
		UsageClass: usageClass,
	}
}

func withCartPolicy(decision CommerceDecision, policy CommerceCartPolicy) CommerceDecision {
	if policy != "" && policy != CartPolicyNone {
		decision.CartPolicy = policy
	}
	if decision.CartPolicy == "" {
		decision.CartPolicy = CartPolicyNone
	}
	return decision
}

func cartPolicyForLooseCart(active bool) CommerceCartPolicy {
	if active {
		return CartPolicyKeepAlive
	}
	return CartPolicyNone
}

func isPinnedCartState(state string) bool {
	switch state {
	case models.CartStatePendingSize,
		models.CartStatePendingQty,
		models.CartStatePendingAddress,
		models.CartStatePendingNotes,
		models.CartStatePendingPaymentMethod,
		models.CartStatePendingConfirm:
		return true
	default:
		return false
	}
}

func isCheckoutRequest(normalized string) bool {
	return normalized == "checkout" ||
		normalized == "check out" ||
		strings.Contains(normalized, "proceed to checkout") ||
		strings.Contains(normalized, "place order now")
}

func isAddToCartRequest(normalized string) bool {
	if strings.Contains(normalized, "add to cart") ||
		strings.Contains(normalized, "add this to cart") ||
		strings.Contains(normalized, "put in cart") ||
		strings.Contains(normalized, "cart ekata") {
		return true
	}
	if !routerContainsWord(normalized, "cart") {
		return false
	}
	return containsExactToken(normalized, []string{"add", "ad", "put"})
}

func isCartEscapeRequest(text string) bool {
	raw := strings.ToLower(strings.TrimSpace(text))
	normalized := strings.ToLower(strings.TrimSpace(NormalizeMessage(text)))
	if normalized == "" {
		normalized = raw
	}
	switch normalized {
	case "cancel order", "cancel my order", "cancel this order", "remove order", "clear cart":
		return true
	default:
		return false
	}
}

func isShortAffirmation(normalized string) bool {
	switch normalized {
	case "yes", "yeah", "yep", "ok", "okay", "sure", "hari", "ow":
		return true
	default:
		return false
	}
}

func isGreetingMessage(normalized string) bool {
	for _, greeting := range []string{"hello", "hi", "hey", "good morning", "good evening", "good night", "greeting", "ayubowan"} {
		if normalized == greeting || strings.HasPrefix(normalized, greeting+" ") {
			return true
		}
	}
	return false
}

func isOrderTimingOrAvailabilityQuestion(normalized string) bool {
	hasOrderWord := strings.Contains(normalized, "order") || strings.Contains(normalized, "buy") || strings.Contains(normalized, "purchase")
	hasTimingWord := containsAny(normalized, []string{
		"today", "tomorrow", "now", "later", "wait", "available", "availability",
		"open", "closed", "can i order", "when can", "how soon",
	})
	return hasOrderWord && hasTimingWord
}

func isDeliveryQuestion(normalized string) bool {
	return containsAny(normalized, []string{
		"delivery", "deliver", "shipping", "ship", "courier", "arrive", "arrival",
		"delivery charge", "delivery fee", "how long delivery",
	})
}

func isPaymentQuestion(normalized string) bool {
	return containsAny(normalized, []string{
		"payment", "bank transfer", "cash on delivery", "account number",
	}) || containsExactToken(normalized, []string{"pay", "paid", "transfer", "cod", "card", "deposit"})
}

func isProductPurchaseOrDetailRequest(normalized string) bool {
	return containsAny(normalized, []string{
		"i want to buy", "want to buy", "i want", "i need", "can i get",
		"buy", "purchase", "order", "price", "how much", "details",
	})
}

func isOrderStatusQuestion(normalized string) bool {
	return containsAny(normalized, []string{
		"order status", "track order", "where is my order", "my order", "order tracking",
		"order not received", "order confirmation",
	})
}

func isSupportComplaint(normalized string) bool {
	return containsAny(normalized, []string{
		"not replying", "replying correctly", "wrong reply", "wrong answer", "bad response",
		"not correct", "problem", "issue", "complaint", "human", "agent", "support",
	})
}

func matchCommerceProduct(products []models.Product, normalized string) *CommerceProductMatch {
	if len(products) == 0 {
		return nil
	}

	active := make([]models.Product, 0, len(products))
	for _, product := range products {
		if product.Active {
			active = append(active, product)
		}
	}

	type candidate struct {
		product   models.Product
		score     float64
		matchType string
	}
	var candidates []candidate

	for _, product := range active {
		productName := strings.ToLower(strings.TrimSpace(NormalizeMessage(product.Name)))
		category := strings.ToLower(strings.TrimSpace(NormalizeMessage(product.Category)))

		switch {
		case productName != "" && normalized == productName:
			candidates = append(candidates, candidate{product: product, score: 0.98, matchType: "exact_name"})
		case productName != "" && strings.Contains(normalized, productName):
			candidates = append(candidates, candidate{product: product, score: 0.94, matchType: "name"})
		case productName != "" && phraseWordsContained(productName, normalized):
			candidates = append(candidates, candidate{product: product, score: 0.82, matchType: "partial_name"})
		case category != "" && routerContainsWord(normalized, category):
			candidates = append(candidates, candidate{product: product, score: 0.7, matchType: "category"})
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	best := candidates[0]
	match := &CommerceProductMatch{
		ID:         best.product.ID,
		Name:       best.product.Name,
		RetailerID: best.product.RetailerID,
		Category:   best.product.Category,
		Confidence: best.score,
		MatchType:  best.matchType,
	}

	if len(candidates) > 1 && candidates[1].score >= best.score-0.05 {
		match.Ambiguous = true
	}
	return match
}

func phraseWordsContained(phrase, text string) bool {
	words := strings.Fields(phrase)
	if len(words) == 0 {
		return false
	}
	matched := 0
	for _, word := range words {
		if len(word) < 3 {
			continue
		}
		if routerContainsWord(text, word) {
			matched++
		}
	}
	return matched >= 2 && matched == len(significantWords(words))
}

func significantWords(words []string) []string {
	result := make([]string, 0, len(words))
	for _, word := range words {
		if len(word) >= 3 {
			result = append(result, word)
		}
	}
	return result
}

func containsAny(text string, needles []string) bool {
	for _, needle := range needles {
		if strings.Contains(text, needle) {
			return true
		}
	}
	return false
}

func containsExactToken(text string, needles []string) bool {
	for _, token := range strings.Fields(text) {
		for _, needle := range needles {
			if token == needle {
				return true
			}
		}
	}
	return false
}

func routerContainsWord(text, word string) bool {
	for _, token := range strings.Fields(text) {
		if token == word {
			return true
		}
	}
	return false
}
