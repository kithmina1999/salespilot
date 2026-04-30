package whatsapp

// order_bot_payment_test.go — TDD for Slice 2: "The Customer's Choice"
//
// Tests that the order bot state machine correctly inserts a payment method
// selection step when a business has bank transfer enabled.
//
// Uses real PostgreSQL (via TestMain in pipeline_test.go).
// Run: go test -v ./whatsapp -run TestPaymentFlow

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── helpers ────────────────────────────────────────────────────────────────

// makeBizWithPayment creates an isolated business with the specified payment config.
func makeBizWithPayment(t *testing.T, allowCOD, allowTransfer bool, bankDetails string) models.Business {
	t.Helper()
	biz := models.Business{
		Name:          "__test_payment_flow__",
		Phone:         "00000098001",
		APIKey:        "test-payment-flow-key",
		Plan:          models.PlanFree,
		AllowCOD:      allowCOD,
		AllowTransfer: allowTransfer,
		BankDetails:   bankDetails,
	}
	database.DB.Where("api_key = ?", biz.APIKey).FirstOrCreate(&biz)
	t.Cleanup(func() {
		database.DB.Unscoped().Where("phone = ? AND business_id = ?", "94770000001", biz.ID).Delete(&models.Cart{})
		database.DB.Unscoped().Where("business_id = ?", biz.ID).Delete(&models.Order{})
		database.DB.Unscoped().Delete(&models.Business{}, biz.ID)
	})
	return biz
}

// makeCart creates a cart in the given state for the test business.
func makeCart(t *testing.T, biz models.Business, state string) models.Cart {
	t.Helper()

	items, _ := json.Marshal([]models.CartItem{
		{ProductID: 1, Name: "Test Shirt", Qty: 1, Price: 2500, Subtotal: 2500},
	})
	cart := models.Cart{
		BusinessID: biz.ID,
		Phone:      "94770000001",
		State:      state,
		Items:      string(items),
		TotalPrice: 2500,
		Address:    "12/A, Galle Road, Colombo",
		Notes:      "",
		ExpiresAt:  time.Now().Add(24 * time.Hour),
	}
	if err := database.DB.Create(&cart).Error; err != nil {
		t.Fatalf("failed to create test cart: %v", err)
	}
	t.Cleanup(func() {
		database.DB.Unscoped().Delete(&models.Cart{}, cart.ID)
	})
	return cart
}

// reloadCart fetches fresh cart state from DB.
func reloadCart(t *testing.T, id uint) models.Cart {
	t.Helper()
	var c models.Cart
	if err := database.DB.First(&c, id).Error; err != nil {
		t.Fatalf("failed to reload cart %d: %v", id, err)
	}
	return c
}

// ─── Test 1 (Tracer Bullet): payment step inserted after notes ───────────────

// TestPaymentFlow_InsertedAfterNotes verifies that when a business has both
// COD and Bank Transfer enabled, the state machine transitions from
// pending_notes → pending_payment_method (not directly to pending_confirm).
func TestPaymentFlow_InsertedAfterNotes(t *testing.T) {
	biz := makeBizWithPayment(t, true, true, "Bank: Sampath\nAccount: 123456")
	cart := makeCart(t, biz, models.CartStatePendingNotes)

	// Customer skips notes — if payment step exists, state should be pending_payment_method
	handleCartMessage(&biz, cart.Phone, cart.Phone, "skip_notes")

	updated := reloadCart(t, cart.ID)
	if updated.State != models.CartStatePendingPaymentMethod {
		t.Errorf("expected state=%q after notes (both methods enabled), got %q",
			models.CartStatePendingPaymentMethod, updated.State)
	}
	t.Logf("✅ Both methods enabled → state transitioned to %q", updated.State)
}

// ─── Test 2: payment step skipped when only COD ──────────────────────────────

// TestPaymentFlow_SkippedWhenOnlyCOD verifies that when only COD is enabled,
// the notes step transitions directly to pending_confirm (payment auto-selected).
func TestPaymentFlow_SkippedWhenOnlyCOD(t *testing.T) {
	biz := makeBizWithPayment(t, true, false, "")
	cart := makeCart(t, biz, models.CartStatePendingNotes)

	handleCartMessage(&biz, cart.Phone, cart.Phone, "skip_notes")

	updated := reloadCart(t, cart.ID)
	if updated.State != models.CartStatePendingConfirm {
		t.Errorf("expected state=%q when only COD enabled, got %q",
			models.CartStatePendingConfirm, updated.State)
	}
	if updated.PaymentMethod != "cod" {
		t.Errorf("expected payment_method=cod when only COD, got %q", updated.PaymentMethod)
	}
	t.Logf("✅ COD-only → skipped to %q with method=%q", updated.State, updated.PaymentMethod)
}

// ─── Test 3: bank transfer sets cart payment method ──────────────────────────

// TestPaymentFlow_BankTransferSetsMethod verifies that selecting "pay:bank_transfer"
// sets cart.PaymentMethod="bank_transfer" and advances to pending_confirm.
func TestPaymentFlow_BankTransferSetsMethod(t *testing.T) {
	biz := makeBizWithPayment(t, true, true, "Bank: Sampath\nAccount: 123456")
	cart := makeCart(t, biz, models.CartStatePendingPaymentMethod)

	handleCartMessage(&biz, cart.Phone, cart.Phone, "pay:bank_transfer")

	updated := reloadCart(t, cart.ID)
	if updated.PaymentMethod != "bank_transfer" {
		t.Errorf("expected payment_method=bank_transfer, got %q", updated.PaymentMethod)
	}
	if updated.State != models.CartStatePendingConfirm {
		t.Errorf("expected state=%q after bank_transfer selection, got %q",
			models.CartStatePendingConfirm, updated.State)
	}
	t.Logf("✅ pay:bank_transfer → method=%q state=%q", updated.PaymentMethod, updated.State)
}

// ─── Test 4: COD selection sets correct method ───────────────────────────────

// TestPaymentFlow_CODSelectionSetsMethod verifies that selecting "pay:cod"
// sets cart.PaymentMethod="cod" and advances to pending_confirm.
func TestPaymentFlow_CODSelectionSetsMethod(t *testing.T) {
	biz := makeBizWithPayment(t, true, true, "Bank: Sampath\nAccount: 123456")
	cart := makeCart(t, biz, models.CartStatePendingPaymentMethod)

	handleCartMessage(&biz, cart.Phone, cart.Phone, "pay:cod")

	updated := reloadCart(t, cart.ID)
	if updated.PaymentMethod != "cod" {
		t.Errorf("expected payment_method=cod, got %q", updated.PaymentMethod)
	}
	if updated.State != models.CartStatePendingConfirm {
		t.Errorf("expected state=%q after cod selection, got %q",
			models.CartStatePendingConfirm, updated.State)
	}
	t.Logf("✅ pay:cod → method=%q state=%q", updated.PaymentMethod, updated.State)
}
