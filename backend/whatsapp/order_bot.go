package whatsapp

// order_bot.go — Conversational order-taking state machine for SalesPilot.
//
// Flow (per-customer, per-business):
//
//	browsing → item_selected → pending_size? → pending_qty →
//	add_more → pending_address → pending_notes → pending_confirm → placed
//
// Button IDs use prefixed conventions so the pipeline can route them:
//
//	"item:<productID>"        — customer selects a product from list
//	"add_to_cart"             — confirm adding current pending item
//	"browse_more"             — go back to product list
//	"checkout"                — proceed to address step
//	"size:<value>"            — size selection (S, M, 200ml, 42, etc.)
//	"qty:<n>"                 — quick qty button (1, 2, 3)
//	"addr:<savedAddressID>"   — select a saved address
//	"addr:new"                — type a new address
//	"skip_notes"              — skip optional notes step
//	"confirm_order"          — finalize and create order
//	"cancel_order"           — discard cart

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)


// ─── DB Tracking Wrappers ───────────────────────────────────────────────────────

func botSendText(business *models.Business, phone, body string) error {
	err := SendText(business.WAPhoneNumberID, business.WAAccessToken, phone, body)
	if err == nil {
		database.DB.Create(&models.Message{BusinessID: business.ID, Phone: phone, Role: "model", Content: body})
	}
	return err
}

func botSendButtons(business *models.Business, phone, body string, buttons []Button) error {
	err := SendButtons(business.WAPhoneNumberID, business.WAAccessToken, phone, body, buttons)
	if err == nil {
		database.DB.Create(&models.Message{BusinessID: business.ID, Phone: phone, Role: "model", Content: "[Buttons] " + body})
	}
	return err
}

func botSendList(business *models.Business, phone, body, label string, sections []ListSection) error {
	err := SendList(business.WAPhoneNumberID, business.WAAccessToken, phone, body, label, sections)
	if err == nil {
		database.DB.Create(&models.Message{BusinessID: business.ID, Phone: phone, Role: "model", Content: "[List] " + body})
	}
	return err
}
// ─── Public Entry Point ─────────────────────────────────────────────────────────

// handleCartMessage is the main entry point called from the pipeline BEFORE FAQ/Gemini.
// Returns true when the order bot has handled the message (pipeline should return early).
func handleCartMessage(business *models.Business, phone, fromRaw, msg string) bool {
	// Load active cart (non-expired, not placed/abandoned)
	var cart models.Cart
	err := database.DB.
		Where("phone = ? AND business_id = ? AND state NOT IN ? AND expires_at > ?",
			phone, business.ID,
			[]string{models.CartStatePlaced, models.CartStateAbandoned},
			time.Now()).
		First(&cart).Error

	if err != nil {
		// No active cart — handle special button IDs from the hook engine + delivery checks
		switch msg {
		case "order_intent":
			startOrderFlow(business, phone, fromRaw)
			return true
		case "browse_more":
			showProductList(business, fromRaw)
			return true
		case "order_status_check":
			showCustomerOrders(business, phone, fromRaw)
			return true
		case "delivery_yes":
			handleDeliveryYes(business, phone, fromRaw)
			return true
		case "delivery_no":
			handleDeliveryNo(business, phone, fromRaw)
			return true
		}
		// Order detail button from showCustomerOrders list
		if strings.HasPrefix(msg, "order_detail:") {
			showOrderDetail(business, phone, fromRaw, msg)
			return true
		}
		// Explicit browse request — customer wants to SEE the product list
		if isExplicitBrowseRequest(msg) {
			showProductList(business, fromRaw)
			return true
		}
		// Purchase intent → create cart and start flow
		if detectOrderIntent(msg) {
			startOrderFlow(business, phone, fromRaw)
			return true
		}
		return false
	}

	// ── Global escape: hard-exit commands abandon the cart immediately ──────────
	if isGlobalEscapeIntent(msg) {
		log.Printf("🚪 [OrderBot] Global escape detected — abandoning cart for %s", fromRaw)
		updateCart(&cart, map[string]interface{}{"state": models.CartStateAbandoned, "expires_at": time.Now()})
		botSendButtons(business, fromRaw,
			"No problem! 😊 Your cart has been cleared. What can I help you with?",
			[]Button{{ID: "browse_more", Title: "🛍️ Browse Products"}, {ID: "order_status_check", Title: "📦 My Orders"}},
		)
		return true
	}

	// ── Two-tier smart bypass ──────────────────────────────────────────────────
	// For loose states (browsing / add_more) use the intent classifier:
	//   "general" → let FAQ+Gemini answer naturally (cart stays alive)
	//   "shopping"/"browse" → stay in cart flow
	// Pinned states (address/notes/confirm) always need the cart.
	if cart.State == models.CartStateBrowsing || cart.State == models.CartStateAddMore {
		intent := ClassifyMessageIntent(msg)
		if intent == "general" {
			log.Printf("🤔 [OrderBot] %s state + general intent → FAQ/Gemini bypass: %q", cart.State, msg)
			return false
		}
	}

	// Active cart — advance the state machine
	return advanceCart(&cart, business, phone, fromRaw, msg)
}

// startOrderFlow creates a fresh cart and shows the product list.
func startOrderFlow(business *models.Business, phone, fromRaw string) {
	cart := models.Cart{
		BusinessID:    business.ID,
		Phone:         phone,
		State:         models.CartStateBrowsing,
		Items:         "[]",
		PaymentMethod: "cod",
		ExpiresAt:     time.Now().Add(24 * time.Hour),
	}
	if err := database.DB.Create(&cart).Error; err != nil {
		log.Printf("❌ [OrderBot] Failed to create cart for %s: %v", phone, err)
		botSendText(business, fromRaw,
			"Sorry, I couldn't start your order. Please try again!")
		return
	}
	showProductList(business, fromRaw)
}

// ─── State Machine ──────────────────────────────────────────────────────────────

func advanceCart(cart *models.Cart, business *models.Business, phone, fromRaw, msg string) bool {
	switch cart.State {
	case models.CartStateBrowsing:
		return handleBrowsing(cart, business, phone, fromRaw, msg)
	case models.CartStateItemSelected:
		handleItemSelected(cart, business, fromRaw, msg)
	case models.CartStatePendingSize:
		handlePendingSize(cart, business, fromRaw, msg)
	case models.CartStatePendingQty:
		handlePendingQty(cart, business, fromRaw, msg)
	case models.CartStateAddMore:
		return handleAddMore(cart, business, fromRaw, msg)
	case models.CartStatePendingAddress:
		handlePendingAddress(cart, business, phone, fromRaw, msg)
	case models.CartStatePendingNotes:
		handlePendingNotes(cart, business, fromRaw, msg)
	case models.CartStatePendingPaymentMethod:
		handlePendingPaymentMethod(cart, business, phone, fromRaw, msg)
	case models.CartStatePendingConfirm:
		handlePendingConfirm(cart, business, phone, fromRaw, msg)
	}
	return true
}

// ─── State Handlers ─────────────────────────────────────────────────────────────

func handleBrowsing(cart *models.Cart, business *models.Business, phone, fromRaw, msg string) bool {
	if strings.HasPrefix(msg, "item:") {
		productIDStr := strings.TrimPrefix(msg, "item:")
		productID, err := strconv.ParseUint(productIDStr, 10, 32)
		if err != nil {
			showProductList(business, fromRaw)
			return true
		}
		var product models.Product
		if err := database.DB.First(&product, uint(productID)).Error; err != nil {
			showProductList(business, fromRaw)
			return true
		}
		updateCart(cart, map[string]interface{}{
			"state":                models.CartStateItemSelected,
			"pending_product_id":   product.ID,
			"pending_product_name": product.Name,
			"pending_price":        product.Price,
			"pending_size":         "",
			"pending_color":        "",
			"pending_qty":          0,
		})
		showProductCard(business, fromRaw, &product)
		return true
	}

	// Smart product name search — normalize first so Sinhala/Singlish product
	// references match correctly (e.g. "mata keda oil eka" → search "keda oil")
	normalized := strings.ToLower(NormalizeMessage(msg))
	productQuery := extractProductName(normalized)

	// Strategy 1: LIKE search on extracted product name
	if productQuery != "" {
		var products []models.Product
		database.DB.Where("business_id = ? AND active = ? AND LOWER(name) LIKE ?",
			business.ID, true, "%"+productQuery+"%").Limit(1).Find(&products)
		if len(products) > 0 {
			p := products[0]
			updateCart(cart, map[string]interface{}{
				"state":                models.CartStateItemSelected,
				"pending_product_id":   p.ID,
				"pending_product_name": p.Name,
				"pending_price":        p.Price,
				"pending_size":         "",
				"pending_color":        "",
				"pending_qty":          0,
			})
			showProductCard(business, fromRaw, &p)
			return true
		}
	}

	// Strategy 2: word/bigram scan across all active products
	var allProducts []models.Product
	database.DB.Where("business_id = ? AND active = ?", business.ID, true).Find(&allProducts)
	words := strings.Fields(normalized)
	for _, p := range allProducts {
		pname := strings.ToLower(p.Name)
		for i, w := range words {
			if len(w) < 3 {
				continue // skip very short tokens to avoid false matches
			}
			if strings.Contains(pname, w) {
				updateCart(cart, map[string]interface{}{
					"state":                models.CartStateItemSelected,
					"pending_product_id":   p.ID,
					"pending_product_name": p.Name,
					"pending_price":        p.Price,
					"pending_size":         "",
					"pending_color":        "",
					"pending_qty":          0,
				})
				showProductCard(business, fromRaw, &p)
				return true
			}
			// bigram check
			if i+1 < len(words) {
				bigram := w + " " + words[i+1]
				if strings.Contains(pname, bigram) {
					updateCart(cart, map[string]interface{}{
						"state":                models.CartStateItemSelected,
						"pending_product_id":   p.ID,
						"pending_product_name": p.Name,
						"pending_price":        p.Price,
						"pending_size":         "",
						"pending_color":        "",
						"pending_qty":          0,
					})
					showProductCard(business, fromRaw, &p)
					return true
				}
			}
		}
	}

	// No product matched — show the full list as fallback
	showProductList(business, fromRaw)
	return true
}

func handleItemSelected(cart *models.Cart, business *models.Business, fromRaw, msg string) {
	switch msg {
	case "add_to_cart":
		var product models.Product
		if err := database.DB.First(&product, cart.PendingProductID).Error; err != nil {
			showProductList(business, fromRaw)
			return
		}
		sizes := parseSizes(product.Sizes)
		if len(sizes) > 0 {
			updateCart(cart, map[string]interface{}{"state": models.CartStatePendingSize})
			showSizeButtons(business, fromRaw, &product, sizes)
		} else {
			updateCart(cart, map[string]interface{}{"state": models.CartStatePendingQty})
			askQty(business, fromRaw, cart.PendingProductName, cart.PendingPrice)
		}
	case "browse_more":
		updateCart(cart, map[string]interface{}{"state": models.CartStateBrowsing})
		showProductList(business, fromRaw)
	default:
		var product models.Product
		if err := database.DB.First(&product, cart.PendingProductID).Error; err == nil {
			showProductCard(business, fromRaw, &product)
		}
	}
}

func handlePendingSize(cart *models.Cart, business *models.Business, fromRaw, msg string) {
	sizeVal := strings.TrimPrefix(msg, "size:")
	sizeVal = strings.TrimSpace(sizeVal)
	if sizeVal == "" {
		var product models.Product
		database.DB.First(&product, cart.PendingProductID)
		showSizeButtons(business, fromRaw, &product, parseSizes(product.Sizes))
		return
	}
	updateCart(cart, map[string]interface{}{
		"state":        models.CartStatePendingQty,
		"pending_size": sizeVal,
	})
	askQty(business, fromRaw, cart.PendingProductName+" ("+sizeVal+")", cart.PendingPrice)
}

func handlePendingQty(cart *models.Cart, business *models.Business, fromRaw, msg string) {
	qtyStr := strings.TrimPrefix(msg, "qty:")
	qty, err := strconv.Atoi(strings.TrimSpace(qtyStr))
	if err != nil || qty < 1 || qty > 99 {
		botSendButtons(
			business, fromRaw,
			"Please enter a valid quantity (1–99) or tap a quick option:",
			[]Button{{ID: "qty:1", Title: "1"}, {ID: "qty:2", Title: "2"}, {ID: "qty:3", Title: "3"}},
		)
		return
	}

	subtotal := float64(qty) * cart.PendingPrice
	newItem := models.CartItem{
		ProductID: cart.PendingProductID,
		Name:      cart.PendingProductName,
		Qty:       qty,
		Size:      cart.PendingSize,
		Color:     cart.PendingColor,
		Price:     cart.PendingPrice,
		Subtotal:  subtotal,
	}
	items := loadCartItems(cart.Items)
	items = append(items, newItem)
	itemsJSON, _ := json.Marshal(items)
	newTotal := cart.TotalPrice + subtotal

	updateCart(cart, map[string]interface{}{
		"state":       models.CartStateAddMore,
		"items":       string(itemsJSON),
		"total_price": newTotal,
		"pending_qty": qty,
	})

	body := fmt.Sprintf("✅ *Added to cart!*\n\n%s\n\n🛍️ %s", buildItemsText(items), buildCartSummaryLine(items))
	botSendButtons(business, fromRaw, body,
		[]Button{{ID: "browse_more", Title: "➕ Add More"}, {ID: "checkout", Title: "🛒 Checkout"}},
	)
}

// resolveAddMoreIntent returns true if a message received in the add_more cart state
// represents a NEW purchase-intent signal (customer wants a different item).
// Returns false for button IDs, browse signals, and general chat.
// When true, the caller should fall through to the order bot for fresh item detection.
//
// Evaluation order: purchase intent wins over browse signals because
// detectCatalogIntent's keyword list overlaps with buy words ("buy", "order", "ganna").
func resolveAddMoreIntent(msg string) bool {
	// Button IDs handled directly — not intent
	switch msg {
	case "browse_more", "checkout":
		return false
	}

	// High-confidence purchase intent wins first — escalate to order bot
	if ScoreOrderIntent(msg).Confidence == "high" {
		return true
	}

	// Explicit browse-only signals stay in add_more flow
	if isBrowseSignal(msg) {
		return false
	}

	return false
}

func handleAddMore(cart *models.Cart, business *models.Business, fromRaw, msg string) bool {
	switch msg {
	case "browse_more":
		updateCart(cart, map[string]interface{}{"state": models.CartStateBrowsing})
		showProductList(business, fromRaw)
	case "checkout":
		updateCart(cart, map[string]interface{}{"state": models.CartStatePendingAddress})
		showAddressOptions(business, cart, cart.Phone, fromRaw)
	default:
		// Browse intent → show product list and let customer pick
		if isBrowseSignal(msg) || detectCatalogIntent(msg) {
			updateCart(cart, map[string]interface{}{"state": models.CartStateBrowsing})
			showProductList(business, fromRaw)
			return true
		}
		// New purchase intent → fall through so the order bot detects the new item
		// (e.g. "mata oil ekak ganna one" while in add_more state)
		if resolveAddMoreIntent(msg) {
			updateCart(cart, map[string]interface{}{"state": models.CartStateBrowsing})
			return false // signal: let handleCartMessage re-process as fresh intent
		}
		// General chat → remind customer of their options
		botSendButtons(business, fromRaw,
			"Ready to checkout or want to add more?",
			[]Button{{ID: "browse_more", Title: "➕ Add More"}, {ID: "checkout", Title: "🛒 Checkout"}},
		)
	}
	return true
}

func handlePendingAddress(cart *models.Cart, business *models.Business, phone, fromRaw, msg string) {
	if strings.HasPrefix(msg, "addr:") {
		val := strings.TrimPrefix(msg, "addr:")
		if val == "new" {
			botSendText(business, fromRaw,
				"📍 Please type your full delivery address:")
			return
		}
		addrID, err := strconv.ParseUint(val, 10, 32)
		if err == nil {
			var saved models.SavedAddress
			if err := database.DB.First(&saved, uint(addrID)).Error; err == nil {
				commitAddress(cart, business, phone, fromRaw, saved.Address)
				return
			}
		}
	}

	address := strings.TrimSpace(msg)

	// Catch inability/frustration phrases — never save as a delivery address.
	if isInabilityPhrase(address) {
		log.Printf("🚫 [OrderBot] Rejected inability phrase as address: %q", address)
		botSendButtons(business, fromRaw,
			"No worries! 😊 To complete your order I need a delivery address.\nType your address (e.g. 12/A, Galle Road, Colombo) or cancel:",
			[]Button{{ID: "cancel_order", Title: "❌ Cancel Order"}},
		)
		return
	}

	// Reject garbage / keyboard-mash (e.g. "dawdawdawd", "asdfasdf").
	// IsLikelyAddress uses embedding cosine similarity (~$0.000001/call) with
	// automatic fallback to keyword+entropy heuristic if embeddings not ready.
	if ok, _ := IsLikelyAddress(address); !ok {
		log.Printf("🚫 [OrderBot] Rejected non-address input: %q", address)
		botSendText(business, fromRaw,
			"📍 That doesn't look like a delivery address. Please type your full address (e.g. 12/A, Galle Road, Colombo):")
		return
	}

	if len(address) < 5 {
		botSendText(business, fromRaw,
			"📍 Please type your full delivery address (street, city):")
		return
	}
	commitAddress(cart, business, phone, fromRaw, address)
}

func commitAddress(cart *models.Cart, business *models.Business, phone, fromRaw, address string) {
	// Persist as "Last Used" saved address in background
	go func() {
		var existing models.SavedAddress
		if err := database.DB.Where("business_id = ? AND phone = ? AND label = ?",
			business.ID, phone, "📍 Last Used").First(&existing).Error; err != nil {
			database.DB.Create(&models.SavedAddress{
				BusinessID: business.ID, Phone: phone,
				Label: "📍 Last Used", Address: address,
			})
		} else {
			database.DB.Model(&existing).Update("address", address)
		}
	}()

	updateCart(cart, map[string]interface{}{
		"state":   models.CartStatePendingNotes,
		"address": address,
	})
	botSendButtons(business, fromRaw,
		"📝 Any special notes? (landmark, colour preference, delivery instructions — optional)",
		[]Button{{ID: "skip_notes", Title: "⏭️ Skip"}},
	)
}

func handlePendingNotes(cart *models.Cart, business *models.Business, fromRaw, msg string) {
	notes := ""
	if msg != "skip_notes" {
		notes = filterFillerNotes(msg)
	}

	// If bank transfer is enabled, we must ask the customer which method they want.
	// If only COD is enabled, we skip the payment selection step and auto-select COD.
	if business.AllowTransfer {
		updateCart(cart, map[string]interface{}{
			"state": models.CartStatePendingPaymentMethod,
			"notes": notes,
		})
		askPaymentMethod(business, cart, fromRaw)
	} else {
		updateCart(cart, map[string]interface{}{
			"state":          models.CartStatePendingConfirm,
			"notes":          notes,
			"payment_method": "cod",
		})
		showOrderSummary(business, cart, fromRaw, notes)
	}
}

func askPaymentMethod(business *models.Business, cart *models.Cart, fromRaw string) {
	var buttons []Button
	if business.AllowCOD {
		buttons = append(buttons, Button{ID: "pay:cod", Title: "💵 Cash on Delivery"})
	}
	buttons = append(buttons, Button{ID: "pay:bank_transfer", Title: "🏦 Bank Transfer"})
	
	botSendButtons(business, fromRaw, "How would you like to pay?", buttons)
}

func handlePendingPaymentMethod(cart *models.Cart, business *models.Business, phone, fromRaw, msg string) {
	switch msg {
	case "pay:cod":
		updateCart(cart, map[string]interface{}{
			"state":          models.CartStatePendingConfirm,
			"payment_method": "cod",
		})
		showOrderSummary(business, cart, fromRaw, cart.Notes)
	case "pay:bank_transfer":
		updateCart(cart, map[string]interface{}{
			"state":          models.CartStatePendingConfirm,
			"payment_method": "bank_transfer",
		})
		if business.BankDetails != "" {
			warning := "\n\n⚠️ *Note:* Unpaid orders are automatically cancelled after 72 hours."
			botSendText(business, fromRaw, "🏦 *Bank Details:*\n\n"+business.BankDetails+warning)
		}
		showOrderSummary(business, cart, fromRaw, cart.Notes)
	default:
		// Unknown response, re-ask
		askPaymentMethod(business, cart, fromRaw)
	}
}

func handlePendingConfirm(cart *models.Cart, business *models.Business, phone, fromRaw, msg string) {
	switch msg {
	case "confirm_order":
		finalizeOrder(cart, business, phone, fromRaw)
	case "cancel_order":
		updateCart(cart, map[string]interface{}{"state": models.CartStateAbandoned, "expires_at": time.Now()})
		botSendText(business, fromRaw,
			"❌ Order cancelled. Feel free to browse again anytime! 😊")
	default:
		showOrderSummary(business, cart, fromRaw, cart.Notes)
	}
}

// ─── Order Finalization ─────────────────────────────────────────────────────────

func finalizeOrder(cart *models.Cart, business *models.Business, phone, fromRaw string) {
	var order models.Order
	var orderNum uint
	var customerName string

	// Wrap everything in a single DB transaction:
	// 1. Atomically grab the next order number (no gap in sequence)
	// 2. Lock & decrement stock for each cart item (SELECT FOR UPDATE prevents overselling)
	// 3. Create the order record
	// All three steps succeed together or roll back together.
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Step 1: get next order number atomically
		var maxNum struct{ Max uint }
		if err := tx.Model(&models.Order{}).
			Select("COALESCE(MAX(business_order_num), 0) as max").
			Where("business_id = ?", business.ID).
			Scan(&maxNum).Error; err != nil {
			return fmt.Errorf("order number query: %w", err)
		}
		orderNum = maxNum.Max + 1

		// Step 2: lock each product row and decrement stock
		items := loadCartItems(cart.Items)
		for _, item := range items {
			var product models.Product
			if err := tx.
				Clauses(clause.Locking{Strength: "UPDATE"}).
				First(&product, item.ProductID).Error; err != nil {
				return fmt.Errorf("product %d not found: %w", item.ProductID, err)
			}
			// Only decrement if stock is tracked (> 0)
			if product.Stock > 0 {
				newStock := product.Stock - item.Qty
				if newStock < 0 {
					newStock = 0
				}
				if err := tx.Model(&product).UpdateColumn("stock", newStock).Error; err != nil {
					return fmt.Errorf("stock decrement for product %d: %w", item.ProductID, err)
				}
			}
		}

		// Step 3: load customer name and create the order
		var customer models.Customer
		tx.Where("business_id = ? AND phone = ?", business.ID, phone).First(&customer)
		customerName = customer.Name

		order = models.Order{
			BusinessOrderNum: orderNum,
			BusinessID:       business.ID,
			CartID:           cart.ID,
			CustomerPhone:    phone,
			CustomerName:     customerName,
			Items:            cart.Items,
			TotalPrice:       cart.TotalPrice,
			Status:           models.OrderStatusNew,
			Address:          cart.Address,
			Notes:            cart.Notes,
			PaymentMethod:    cart.PaymentMethod,
			PaymentStatus:    "pending",
		}
		return tx.Create(&order).Error
	})

	if err != nil {
		log.Printf("❌ [OrderBot] Transaction failed for %s: %v", phone, err)
		botSendText(business, fromRaw,
			"Sorry, there was an error placing your order. Please try again!")
		return
	}

	updateCart(cart, map[string]interface{}{"state": models.CartStatePlaced, "expires_at": time.Now()})

	items := loadCartItems(cart.Items)
	paymentText := "COD"
	if cart.PaymentMethod == "bank_transfer" {
		paymentText = "Bank Transfer"
	}
	receipt := fmt.Sprintf(
		"🎉 *Order #%d Confirmed!*\n\n%s\n\n📍 Delivery to: %s\n💰 Total: Rs.%.0f (%s)\n\nWe'll contact you soon to confirm dispatch. Thank you! 🙏",
		orderNum, buildItemsText(items), cart.Address, cart.TotalPrice, paymentText,
	)
	botSendText(business, fromRaw, receipt)

	go notifyTenantNewOrder(business, &order, customerName)
	go createNotification(buildOrderNotification(business.ID, int(orderNum), customerName, phone, cart.TotalPrice))
	log.Printf("✅ [OrderBot] Order #%d created for %s (biz=%d)", orderNum, phone, business.ID)
}

// ─── Display Helpers ────────────────────────────────────────────────────────────

func showProductList(business *models.Business, fromRaw string) {
	var products []models.Product
	database.DB.Where("business_id = ? AND active = ?", business.ID, true).
		Order("name").Limit(10).Find(&products)

	if len(products) == 0 {
		botSendText(business, fromRaw,
			"😔 No products listed right now. Please check back soon!")
		return
	}

	rows := make([]ListRow, len(products))
	for i, p := range products {
		extra := ""
		if p.Stock > 0 && p.Stock <= 10 {
			extra = fmt.Sprintf(" ⚠️ Only %d left!", p.Stock)
		} else if p.Stock <= 0 {
			extra = " ❌ Out of stock"
		}
		// Meta imposes strict limits on interactive lists: Title (24 chars), Description (72 chars)
		title := p.Name
		if len([]rune(title)) > 24 {
			title = string([]rune(title)[:23]) + "…"
		}
		
		desc := fmt.Sprintf("Rs. %.0f%s", p.Price, extra)
		if len([]rune(desc)) > 72 {
			desc = string([]rune(desc)[:71]) + "…"
		}

		rows[i] = ListRow{
			ID:          fmt.Sprintf("item:%d", p.ID),
			Title:       title,
			Description: desc,
		}
	}
	botSendList(business, fromRaw,
		"🛍️ *Browse Our Products*\n\nTap any item to view details and add to cart!",
		"View Products",
		[]ListSection{{Title: "Available Products", Rows: rows}},
	)
}

func showProductCard(business *models.Business, fromRaw string, product *models.Product) {
	stockLine := ""
	if product.Stock > 0 && product.Stock <= 10 {
		stockLine = fmt.Sprintf("\n⚠️ *Only %d left in stock!*", product.Stock)
	} else if product.Stock <= 0 {
		stockLine = "\n❌ *Currently out of stock*"
		botSendText(business, fromRaw,
			fmt.Sprintf("*%s*\n\n💰 Rs. %.0f\n📝 %s%s\n\nThis item is currently unavailable.",
				product.Name, product.Price, product.Description, stockLine))
		return
	}
	body := fmt.Sprintf("*%s*\n\n💰 Price: *Rs. %.0f*\n📝 %s%s",
		product.Name, product.Price, product.Description, stockLine)
	botSendButtons(business, fromRaw, body,
		[]Button{{ID: "add_to_cart", Title: "🛒 Add to Cart"}, {ID: "browse_more", Title: "◀️ Back"}},
	)
}

func showSizeButtons(business *models.Business, fromRaw string, product *models.Product, sizes []string) {
	label := sizeLabel(product.VariantType)
	body := fmt.Sprintf("*%s*\n\n%s", product.Name, label)
	if len(sizes) <= 3 {
		buttons := make([]Button, len(sizes))
		for i, s := range sizes {
			buttons[i] = Button{ID: "size:" + s, Title: s}
		}
		botSendButtons(business, fromRaw, body, buttons)
	} else {
		rows := make([]ListRow, len(sizes))
		for i, s := range sizes {
			rows[i] = ListRow{ID: "size:" + s, Title: s}
		}
		botSendList(business, fromRaw, body, "Choose "+label,
			[]ListSection{{Title: label, Rows: rows}},
		)
	}
}

func askQty(business *models.Business, fromRaw, productLabel string, price float64) {
	body := fmt.Sprintf("How many *%s* (Rs. %.0f each)?\n\nTap a quick option or type a number:", productLabel, price)
	botSendButtons(business, fromRaw, body,
		[]Button{{ID: "qty:1", Title: "1"}, {ID: "qty:2", Title: "2"}, {ID: "qty:3", Title: "3"}},
	)
}

func showAddressOptions(business *models.Business, cart *models.Cart, phone, fromRaw string) {
	var saved []models.SavedAddress
	database.DB.Where("business_id = ? AND phone = ?", business.ID, phone).
		Order("is_default DESC, updated_at DESC").Limit(4).Find(&saved)

	items := loadCartItems(cart.Items)
	body := fmt.Sprintf("🛒 *Cart:*\n%s\n💰 Total: *Rs. %.0f*\n\n📍 Delivery address?",
		buildItemsText(items), cart.TotalPrice)

	if len(saved) == 0 {
		botSendText(business, fromRaw,
			body+"\n\nPlease type your full delivery address:")
		return
	}
	rows := make([]ListRow, 0, len(saved)+1)
	for _, s := range saved {
		rows = append(rows, ListRow{ID: fmt.Sprintf("addr:%d", s.ID), Title: s.Label, Description: s.Address})
	}
	rows = append(rows, ListRow{ID: "addr:new", Title: "📍 Type New Address"})
	botSendList(business, fromRaw, body, "Choose Address",
		[]ListSection{{Title: "Delivery Address", Rows: rows}},
	)
}

func showOrderSummary(business *models.Business, cart *models.Cart, fromRaw, notes string) {
	items := loadCartItems(cart.Items)
	notesLine := ""
	if notes != "" {
		notesLine = "\n📝 Notes: " + notes
	}
	paymentText := "COD"
	if cart.PaymentMethod == "bank_transfer" {
		paymentText = "Bank Transfer"
	}
	body := fmt.Sprintf(
		"📋 *Order Summary*\n\n%s\n\n📍 Delivery: %s%s\n💰 Total: *Rs. %.0f* (%s)\n\nConfirm your order:",
		buildItemsText(items), cart.Address, notesLine, cart.TotalPrice, paymentText,
	)
	botSendButtons(business, fromRaw, body,
		[]Button{{ID: "confirm_order", Title: "✅ Confirm Order"}, {ID: "cancel_order", Title: "❌ Cancel"}},
	)
}

// ─── Tenant Notification ────────────────────────────────────────────────────────

func notifyTenantNewOrder(business *models.Business, order *models.Order, customerName string) {
	reportPhone := business.ReportPhone
	if reportPhone == "" {
		reportPhone = business.Phone
	}
	if reportPhone == "" {
		return
	}
	name := customerName
	if name == "" {
		name = order.CustomerPhone
	}
	paymentText := "COD"
	if order.PaymentMethod == "bank_transfer" {
		paymentText = "Bank Transfer"
	}
	msg := fmt.Sprintf(
		"🛒 *New Order #%d!*\n\nCustomer: %s (%s)\nTotal: Rs. %.0f (%s)\n\nOpen your dashboard to confirm.",
		order.BusinessOrderNum, name, order.CustomerPhone, order.TotalPrice, paymentText,
	)
	botSendText(business, reportPhone, msg)
}

// ─── Utils ──────────────────────────────────────────────────────────────────────

// filterFillerNotes returns an empty string when the customer types a filler
// acknowledgement word at the delivery-notes step (e.g. "ok", "continue", "next").
// These phrases mean "skip" and must not be saved as actual delivery instructions.
// For any genuine note (multiple words, or words not in the filler list) the
// trimmed input is returned unchanged.
//
// The set deliberately contains only single-word tokens; "no bell" is a valid
// delivery instruction even though "no" alone is a filler.
var fillerNotes = map[string]bool{
	"ok": true, "okay": true, "k": true, "continue": true,
	"next": true, "yes": true, "yep": true, "sure": true,
	"no": true, "nope": true, "none": true, "nothing": true,
	"no notes": true, "nah": true, "na": true,
}

func filterFillerNotes(msg string) string {
	trimmed := strings.TrimSpace(msg)
	if fillerNotes[strings.ToLower(trimmed)] {
		return ""
	}
	return trimmed
}

// orderIntentKeywords are multi-word purchase-intent phrases (not single words).
// Single words like "order", "buy", "purchase" are intentionally excluded —
// they appear in too many non-purchase contexts ("track my order", "purchase history").
var orderIntentKeywords = []string{
	// English — require real purchase intent
	"want to order", "want to buy", "place order", "place an order",
	"add to cart", "i want to purchase", "how to order", "i need to buy",
	"i'd like to order", "i would like to order",
	// Singlish
	"order karanna", "order denna", "order ekak",
	"ganna onna", "gannakola", "ganne kohomada",
	"mata eka onna", "katta ganna", "kenna", "danna onna",
	"buy karanna", "buy karanawa",
	// Sinhala script (caught before normalization strips them)
	"ඕඩර්", "ගන්නවා", "ගන්නකොල",
}

// orderIntentNegatives: if the message contains these, it is NOT purchase intent
// even if it contains a keyword from orderIntentKeywords.
var orderIntentNegatives = []string{
	"my order", "order status", "track order", "cancel order",
	"where is my order", "order confirmation", "order not received",
	"mage order", "order eka koheda", "order cancel", "order track",
}

// detectOrderIntent is the backward-compatible bool wrapper around ScoreOrderIntent.
// All existing call sites continue to work unchanged while benefiting from
// the new 3-tier weighted scoring and Jaro-Winkler fuzzy matching.
func detectOrderIntent(msg string) bool {
	return ScoreOrderIntent(msg).Confidence == "high"
}

// ─── Smart Cart Helpers ─────────────────────────────────────────────────────────

// isGlobalEscapeIntent detects hard-exit commands that should abandon the cart.
func isGlobalEscapeIntent(msg string) bool {
	lower := strings.ToLower(strings.TrimSpace(msg))
	for _, e := range []string{
		// English
		"exit", "quit", "stop", "restart", "start over",
		"forget it", "nevermind", "never mind", "cancel everything", "cancel all",
		// Singlish
		"epa", "hari epa", "navatinna", "cancel karanna", "ep",
	} {
		if lower == e {
			return true
		}
	}
	return false
}

// isBrowseSignal returns true when the message is explicitly asking to BROWSE products
// (a general catalog request, not a specific product query or a tangential mention).
// Single-word signals like "product", "available", "list" are intentionally excluded
// to avoid hijacking general questions that happen to contain those words.
func isBrowseSignal(msg string) bool {
	lower := strings.ToLower(NormalizeMessage(msg))
	for _, sig := range []string{
		// English — multi-word explicit browse requests
		"what else", "show more", "more products", "other products",
		"what do you have", "what do you sell", "browse products", "see products",
		"see more", "anything else", "other items", "show your products",
		"product list", "price list", "show menu", "view catalog",
		// Singlish (post-normalize canonical forms; NormalizeMessage maps many Singlish → English)
		"availability", // NormalizeMessage maps "thiyanawa", "in stock" etc. → "availability"
		"mokakda thiyanawa", "monawada thiyanawa",
	} {
		if strings.Contains(lower, sig) {
			return true
		}
	}
	return false
}

// looksLikeAddress returns true when the input plausibly resembles a delivery
// address. Rejects pure-garbage keyboard mash (e.g. "dawdawdawd", "asdfasdf").
//
// A valid address must satisfy at LEAST ONE of:
//   - Contains a digit (house/flat/postal code)
//   - Contains a comma or slash (e.g. "12/A" or "Galle, Colombo")
//   - Contains a known Sri Lankan address word
//   - Has >= 2 distinct words AND adequate character diversity
func looksLikeAddress(addr string) bool {
	lower := strings.ToLower(addr)

	// Has house/flat number or postal code digit → almost certainly an address
	for _, c := range addr {
		if c >= '0' && c <= '9' {
			return true
		}
	}

	// Has structural punctuation
	if strings.ContainsAny(addr, ",/") {
		return true
	}

	// Contains a known Sri Lankan/common address keyword
	for _, kw := range []string{
		"road", "rd", "lane", "street", "st ", "place", "avenue", "ave",
		"colombo", "kandy", "galle", "negombo", "matara", "kurunegala",
		"nuwara", "badulla", "polonnaruwa", "anuradhapura", "jaffna",
		"ratnapura", "batticaloa", "gampaha", "kalutara", "kotte",
		"nugegoda", "dehiwala", "moratuwa", "panadura", "horana",
		"wattala", "kelaniya", "maharagama", "mount lavinia", "mw",
	} {
		if strings.Contains(lower, kw) {
			return true
		}
	}

	// Multi-word with character diversity — check for keyboard mash
	words := strings.Fields(addr)
	if len(words) >= 2 {
		// Count unique chars across the whole string (ignoring spaces)
		chars := make(map[rune]bool)
		for _, c := range lower {
			if c != ' ' {
				chars[c] = true
			}
		}
		// >= 5 unique characters for multi-word input → accept
		if len(chars) >= 5 {
			return true
		}
	}

	// Single-word with no digits, no commas → reject (city-only edge case
	// can be added to the keyword list above if needed)
	return false
}
func isInabilityPhrase(msg string) bool {
	lower := strings.ToLower(strings.TrimSpace(msg))

	// Real addresses always have a digit (e.g. house/flat number) or address keyword
	for _, c := range lower {
		if c >= '0' && c <= '9' {
			return false // has a number → looks like an address
		}
	}
	for _, hint := range []string{",", " road", " rd", " street", " st ", " lane", " mw", " place", " avenue"} {
		if strings.Contains(lower, hint) {
			return false // has address-like word → trust it
		}
	}

	// Inability patterns
	for _, p := range []string{
		"i can't", "i cant", "cannot", "can not",
		"don't know", "dont know", "idk", "not sure", "no idea",
		"i don't have", "i dont have", "no address",
	} {
		if strings.Contains(lower, p) {
			return true
		}
	}

	// Single-word dismissals
	for _, d := range []string{"exit", "stop", "quit", "skip", "cancel", "nope", "nah", "no"} {
		if lower == d {
			return true
		}
	}
	return false
}

func parseSizes(sizesJSON string) []string {
	if sizesJSON == "" {
		return nil
	}
	var sizes []string
	json.Unmarshal([]byte(sizesJSON), &sizes)
	return sizes
}

func sizeLabel(variantType string) string {
	switch variantType {
	case "clothing_size":
		return "Choose your size:"
	case "shoe_size":
		return "Choose your shoe size:"
	case "volume":
		return "Choose your volume:"
	case "numeric":
		return "Choose your size:"
	default:
		return "Choose an option:"
	}
}

func loadCartItems(itemsJSON string) []models.CartItem {
	var items []models.CartItem
	if itemsJSON == "" || itemsJSON == "[]" {
		return items
	}
	json.Unmarshal([]byte(itemsJSON), &items)
	return items
}

func buildItemsText(items []models.CartItem) string {
	var sb strings.Builder
	for _, item := range items {
		size := ""
		if item.Size != "" {
			size = " (" + item.Size + ")"
		}
		sb.WriteString(fmt.Sprintf("• %dx %s%s — Rs. %.0f\n", item.Qty, item.Name, size, item.Subtotal))
	}
	return strings.TrimRight(sb.String(), "\n")
}

func buildCartSummaryLine(items []models.CartItem) string {
	var total float64
	for _, it := range items {
		total += it.Subtotal
	}
	return fmt.Sprintf("%d item(s) — Rs. %.0f total", len(items), total)
}

func updateCart(cart *models.Cart, updates map[string]interface{}) {
	updates["expires_at"] = time.Now().Add(24 * time.Hour)
	if err := database.DB.Model(cart).Updates(updates).Error; err != nil {
		log.Printf("❌ [OrderBot] Cart update failed (id=%d): %v", cart.ID, err)
	}
	database.DB.First(cart, cart.ID)
}

// ─── Customer Order History ─────────────────────────────────────────────────────

// showCustomerOrders sends the customer their last 5 orders as a list message.
func showCustomerOrders(business *models.Business, phone, fromRaw string) {
	var orders []models.Order
	database.DB.
		Where("business_id = ? AND customer_phone = ?", business.ID, phone).
		Order("created_at DESC").
		Limit(5).
		Find(&orders)

	if len(orders) == 0 {
		botSendText(business, fromRaw,
			"📦 You don't have any orders yet.\n\nWant to browse our products?")
		return
	}

	statusEmoji := map[string]string{
		models.OrderStatusNew:       "🆕",
		models.OrderStatusConfirmed: "✅",
		models.OrderStatusShipped:   "🚚",
		models.OrderStatusDelivered: "📦",
		models.OrderStatusCancelled: "❌",
	}

	rows := make([]ListRow, len(orders))
	for i, o := range orders {
		emoji := statusEmoji[o.Status]
		if emoji == "" {
			emoji = "📋"
		}
		rows[i] = ListRow{
			ID:          fmt.Sprintf("order_detail:%d", o.ID),
			Title:       fmt.Sprintf("%s Order #%d — Rs. %.0f", emoji, o.BusinessOrderNum, o.TotalPrice),
			Description: fmt.Sprintf("Status: %s | %s", o.Status, o.CreatedAt.Format("02 Jan 2006")),
		}
	}

	SendList(
		business.WAPhoneNumberID, business.WAAccessToken, fromRaw,
		"📦 *Your Recent Orders*\n\nTap any order to view details:",
		"View Orders",
		[]ListSection{{Title: "Recent Orders", Rows: rows}},
	)
}

// showOrderDetail handles the order_detail:<id> button ID from showCustomerOrders.
// Sends a formatted summary of the selected order to the customer.
func showOrderDetail(business *models.Business, phone, fromRaw, msg string) {
	idStr := strings.TrimPrefix(msg, "order_detail:")
	orderID, err := strconv.ParseUint(strings.TrimSpace(idStr), 10, 64)
	if err != nil {
		botSendText(business, fromRaw, "❌ Could not load order details. Please try again.")
		return
	}

	var order models.Order
	if err := database.DB.
		Where("id = ? AND business_id = ? AND customer_phone = ?", orderID, business.ID, phone).
		First(&order).Error; err != nil {
		botSendText(business, fromRaw, "❌ Order not found.")
		return
	}

	statusEmoji := map[string]string{
		models.OrderStatusNew:       "🆕 New",
		models.OrderStatusConfirmed: "✅ Confirmed",
		models.OrderStatusShipped:   "🚚 Shipped",
		models.OrderStatusDelivered: "📦 Delivered",
		models.OrderStatusCancelled: "❌ Cancelled",
	}
	status := statusEmoji[order.Status]
	if status == "" {
		status = order.Status
	}

	items := loadCartItems(order.Items)
	text := fmt.Sprintf(
		"📋 *Order #%d Details*\n\n%s\n\n📍 Delivery: %s\n💰 Total: Rs. %.0f\n📌 Status: %s\n🗓 Placed: %s",
		order.BusinessOrderNum,
		buildItemsText(items),
		order.Address,
		order.TotalPrice,
		status,
		order.CreatedAt.Format("02 Jan 2006, 15:04"),
	)

	botSendButtons(business, fromRaw, text,
		[]Button{{ID: "order_status_check", Title: "📦 My Orders"}, {ID: "browse_more", Title: "🛍️ Browse Products"}},
	)
}

// ─── Browse & Product Name Helpers ─────────────────────────────────────────────

// isExplicitBrowseRequest returns true when the customer clearly and explicitly
// wants to SEE the product catalog. Does NOT trigger on incidental mentions of
// words like "product" or "available" in the middle of general questions.
func isExplicitBrowseRequest(msg string) bool {
	normalized := strings.ToLower(NormalizeMessage(msg))
	phrases := []string{
		// English multi-word explicit browse phrases
		"show products", "show me products", "product list", "price list",
		"what do you sell", "what do you have", "show catalog", "show catalogue",
		"see products", "see your products", "browse products",
		"what items", "show menu", "menu eka", "view catalog",
		// Singlish (these also map via NormalizeMessage but kept explicit for safety)
		"mokakda thiyanawa", "monawada thiyanawa",
		"product list eka", "items thiyanawa mokakda",
	}
	for _, p := range phrases {
		if strings.Contains(normalized, p) {
			return true
		}
	}
	return false
}

// extractProductName strips common intent prefixes and suffixes from a normalized
// message so the remaining fragment can be used as a product name search query.
//
//	"i want keda oil"       → "keda oil"
//	"do you have oil 200ml" → "oil 200ml"
//	"order eka ganna"       → "" (no product name fragment, caller handles fallback)
func extractProductName(normalizedMsg string) string {
	result := normalizedMsg

	// Strip leading intent prefixes (order matters — longer prefixes first)
	prefixes := []string{
		"do you have ", "i want to see ", "i want to buy ", "i need ",
		"can i get ", "is there ", "have you got ", "show me ",
		"i want ", "get me ", "order ", "buy ",
		// Singlish (post-normalize these become canonical tokens)
		"mata ", "meka ", "ganna ", "onna ",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(result, p) {
			result = strings.TrimPrefix(result, p)
			break
		}
	}

	// Strip trailing intent suffixes
	suffixes := []string{
		" price", " ganna", " onna", " eka", " ekak",
		" thiyenawada", " thiyanawada", " available",
	}
	for _, s := range suffixes {
		if strings.HasSuffix(result, s) {
			result = strings.TrimSuffix(result, s)
			break
		}
	}

	result = strings.TrimSpace(result)
	// Only return if there's something meaningful left (not just a single stopword)
	if len(result) < 2 {
		return ""
	}
	return result
}
