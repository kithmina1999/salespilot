package whatsapp

// media_bridge_test.go — TDD for S5: Smart Media-Order Bridging
//
// Tests the two new bridging behaviors:
//
//  1. review image + shipped order → merchant alert flagged with IsUnmatched badge
//     (NO auto-delivery — merchant must confirm)
//
//  2. payment_proof + multiple unpaid orders → bot asks "which order?" disambig
//     payment_proof + single unpaid order   → simplified ACK (existing flow)

import (
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func makeShippedOrder(t *testing.T, biz models.Business, phone string, num uint) models.Order {
	t.Helper()
	order := models.Order{
		BusinessOrderNum: num,
		BusinessID:       biz.ID,
		CartID:           0,
		CustomerPhone:    phone,
		CustomerName:     "Test User",
		Items:            "[]",
		TotalPrice:       3500,
		Status:           models.OrderStatusShipped,
		Address:          "Colombo",
		PaymentMethod:    "cod",
		PaymentStatus:    "paid",
		CreatedAt:        time.Now(),
	}
	if err := database.DB.Create(&order).Error; err != nil {
		t.Fatalf("makeShippedOrder: %v", err)
	}
	t.Cleanup(func() { database.DB.Unscoped().Delete(&models.Order{}, order.ID) })
	return order
}

func makePendingBankOrder(t *testing.T, biz models.Business, phone string, num uint, amount float64) models.Order {
	t.Helper()
	order := models.Order{
		BusinessOrderNum: num,
		BusinessID:       biz.ID,
		CartID:           0,
		CustomerPhone:    phone,
		CustomerName:     "Test User",
		Items:            "[]",
		TotalPrice:       amount,
		Status:           models.OrderStatusConfirmed,
		Address:          "Colombo",
		PaymentMethod:    "bank_transfer",
		PaymentStatus:    "pending",
		CreatedAt:        time.Now(),
	}
	if err := database.DB.Create(&order).Error; err != nil {
		t.Fatalf("makePendingBankOrder: %v", err)
	}
	t.Cleanup(func() {
		database.DB.Unscoped().Delete(&models.OrderPaymentProof{}, "order_id = ?", order.ID)
		database.DB.Unscoped().Delete(&models.Order{}, order.ID)
	})
	return order
}

// ─── S5 Test 1: Review image + shipped order → IsUnmatched merchant alert ────

func TestMediaBridge_ReviewWithShippedOrder_AlertsMerchant(t *testing.T) {
	database.DB.AutoMigrate(&models.OrderPaymentProof{})

	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	phone := "94771111111"

	// Create a shipped order for this customer
	order := makeShippedOrder(t, biz, phone, 2001)

	// Simulate "review" image from a customer who has a shipped order
	handleReviewImage(&biz, phone, phone, order.ID, "Product photo showing the item unboxed")

	// Verify an IsUnmatched message was created (the merchant badge trigger)
	var msg models.Message
	if err := database.DB.Where(
		"business_id = ? AND phone = ? AND is_unmatched = ?", biz.ID, phone, true,
	).First(&msg).Error; err != nil {
		t.Fatalf("expected an IsUnmatched message to be created for merchant alert, got: %v", err)
	}

	// Verify the order was NOT automatically marked as delivered
	var reloaded models.Order
	database.DB.First(&reloaded, order.ID)
	if reloaded.Status != models.OrderStatusShipped {
		t.Errorf("order should remain Shipped (no auto-deliver), got %q", reloaded.Status)
	}

	t.Logf("✅ Review bridge: IsUnmatched msg created, order still Shipped (merchant review required)")
}

// ─── S5 Test 2: Review image with NO shipped order → thank-you only ──────────

func TestMediaBridge_ReviewNoShippedOrder_ThanksOnly(t *testing.T) {
	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	phone := "94772222222"

	// No shipped order for this phone
	// handleReviewImage should just thank the customer — no IsUnmatched message
	handleReviewImage(&biz, phone, phone, 0, "Nice product photo")

	var count int64
	database.DB.Model(&models.Message{}).Where(
		"business_id = ? AND phone = ? AND is_unmatched = ?", biz.ID, phone, true,
	).Count(&count)

	if count > 0 {
		t.Errorf("no shipped order means no IsUnmatched message should be created, got %d", count)
	}
}

// ─── S5 Test 3: payment_proof + single unpaid order → normal ACK ─────────────

func TestMediaBridge_SinglePendingOrder_NormalACK(t *testing.T) {
	database.DB.AutoMigrate(&models.OrderPaymentProof{})
	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	phone := "94773333333"

	// One pending bank transfer order
	order := makePendingBankOrder(t, biz, phone, 3001, 4500)

	// Resolve should pick this order without asking
	resolved := resolvePaymentOrder(&biz, phone)
	if resolved == nil {
		t.Fatalf("expected to resolve single pending order, got nil")
	}
	if resolved.Order == nil {
		t.Fatalf("expected order in result, got nil Order")
	}
	if resolved.Order.ID != order.ID {
		t.Errorf("expected order ID %d, got %d", order.ID, resolved.Order.ID)
	}
	if resolved.Ambiguous {
		t.Errorf("single pending order should NOT be ambiguous")
	}
}

// ─── S5 Test 4: payment_proof + multiple unpaid orders → disambiguation ───────

func TestMediaBridge_MultiplePendingOrders_Ambiguous(t *testing.T) {
	database.DB.AutoMigrate(&models.OrderPaymentProof{})
	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	phone := "94774444444"

	// Two pending bank transfer orders
	makePendingBankOrder(t, biz, phone, 4001, 2500)
	makePendingBankOrder(t, biz, phone, 4002, 7000)

	result := resolvePaymentOrder(&biz, phone)
	if result == nil {
		t.Fatalf("resolvePaymentOrder should return a result even for ambiguous case")
	}
	if !result.Ambiguous {
		t.Errorf("two pending orders should be flagged as Ambiguous")
	}
	if len(result.Orders) != 2 {
		t.Errorf("expected 2 orders in ambiguous result, got %d", len(result.Orders))
	}
}

// ─── S5 Test 5: payment_proof + no orders → graceful no-match ────────────────

func TestMediaBridge_NoPendingOrder_NoMatch(t *testing.T) {
	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	phone := "94775555555"

	// No orders at all
	result := resolvePaymentOrder(&biz, phone)
	if result != nil && !result.Ambiguous && result.Order != nil {
		t.Errorf("no pending orders should return nil or empty result, got order ID %d", result.Order.ID)
	}
}
